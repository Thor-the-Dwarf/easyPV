use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context, Result};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::blocking::Client;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Number, Value};
use unicode_normalization::UnicodeNormalization;

const COLLECTION_NAME: &str = "feedback_all_games";
const SERVICE_ACCOUNT_FILE: &str = "__admin_dont_push/firebase-service-account.local.json";
const OUTPUT_RELATIVE_PATH: &str = "__admin_dont_push/fireBaseGetter/feedback_all_games.json";
const PROTOCOL_RELATIVE_PATH: &str = "__admin_dont_push/fireBaseGetter/codex_protocoll_allFeedBack.txt";
const TOKEN_SCOPE: &str = "https://www.googleapis.com/auth/datastore";
const TOKEN_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const FIRESTORE_PAGE_SIZE: u32 = 1000;
const LEARNING_EXPORT_SUBDIR: &str = "firebase_feedback_import";

const SANITIZER_VERSION: &str = "hardcoded_prompt_injection_filter_v1";
const COMMENT_MAX_CHARS: usize = 4000;
const BLOCK_SCORE_THRESHOLD: u32 = 14;
const BLOCKED_COMMENT_TOKEN: &str = "[blocked-by-fireBaseGetter-security]";
const EMPTY_COMMENT_TOKEN: &str = "[empty-after-sanitization]";
const REDACTION_TOKEN: &str = "[redacted]";

static CONTROL_CHAR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]").expect("valid regex"));
static ZERO_WIDTH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{2064}\u{FEFF}]")
        .expect("valid regex")
});
static MULTI_SPACE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s+").expect("valid regex"));

#[derive(Debug)]
struct DetectionRule {
    id: &'static str,
    weight: u32,
    regex: Regex,
}

#[derive(Debug)]
struct RewriteRule {
    regex: Regex,
    replacement: &'static str,
}

static DETECTION_RULES: Lazy<Vec<DetectionRule>> = Lazy::new(|| {
    vec![
        rule(
            "ignore_previous_instructions",
            5,
            r"(?is)\b(ignore|disregard|forget)\b.{0,60}\b(previous|prior|above|all)\b.{0,60}\b(instruction|rules?|prompt|message)\b",
        ),
        rule(
            "prompt_exfiltration",
            6,
            r"(?is)\b(reveal|show|print|dump|expose|leak)\b.{0,80}\b(system|developer|hidden|internal)\b.{0,40}\b(prompt|instruction|message)\b",
        ),
        rule(
            "role_override",
            4,
            r"(?is)\b(you are|act as|pretend to be|simulate|impersonate)\b.{0,80}\b(system|developer|assistant|admin|root)\b",
        ),
        rule(
            "jailbreak_keyword",
            5,
            r"(?i)\b(jailbreak|dan mode|do anything now|bypass safety|override safety|ignore safeguards)\b",
        ),
        rule(
            "role_prefix",
            4,
            r"(?im)(^|\s)(system|assistant|developer|user)\s*:",
        ),
        rule(
            "xml_prompt_tag",
            4,
            r"(?is)<\s*/?\s*(system|assistant|developer|instructions?|prompt)\b[^>]*>",
        ),
        rule("code_fence", 3, r"(?s)```.*?```"),
        rule(
            "instruction_header",
            3,
            r"(?im)^#{1,6}\s*(system|developer|assistant|prompt|instruction)\b",
        ),
        rule(
            "tool_injection",
            4,
            r"(?i)\b(function\s*call|tool\s*call|execute_command|shell\s*command|browser\.search|browser\.open)\b",
        ),
        rule(
            "encoded_payload",
            3,
            r"(?is)\b(base64|rot13|hex)\b.{0,40}\b(decode|payload|instruction|prompt|command)\b",
        ),
        rule(
            "dangerous_uri_scheme",
            4,
            r"(?i)\b(javascript|data|file|vbscript)\s*:",
        ),
        rule(
            "command_payload",
            4,
            r"(?i)\b(rm\s+-rf|curl\s+https?://|wget\s+https?://|powershell\s+-|bash\s+-c)\b",
        ),
    ]
});

static REWRITE_RULES: Lazy<Vec<RewriteRule>> = Lazy::new(|| {
    vec![
        rewrite(r"(?s)```.*?```", REDACTION_TOKEN),
        rewrite(r"(?im)(^|\s)(system|assistant|developer|user)\s*:", " $1[role-redacted]:"),
        rewrite(
            r"(?is)<\s*/?\s*(system|assistant|developer|instructions?|prompt)\b[^>]*>",
            REDACTION_TOKEN,
        ),
        rewrite(r"(?i)\b(javascript|data|file|vbscript)\s*:", "[scheme-redacted]"),
        rewrite(
            r"(?is)\b(ignore|disregard|forget)\b.{0,60}\b(instruction|rules?|prompt|message)\b",
            REDACTION_TOKEN,
        ),
        rewrite(
            r"(?is)\b(reveal|show|print|dump|expose|leak)\b.{0,80}\b(system|developer|hidden|internal)\b.{0,40}\b(prompt|instruction|message)\b",
            REDACTION_TOKEN,
        ),
    ]
});

#[derive(Debug, Deserialize)]
struct ServiceAccount {
    project_id: String,
    private_key: String,
    client_email: String,
    token_uri: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(Debug, Serialize)]
struct JwtClaims {
    iss: String,
    scope: String,
    aud: String,
    iat: i64,
    exp: i64,
}

#[derive(Debug, Serialize)]
struct CommentSanitizationReport {
    field_path: String,
    blocked: bool,
    changed: bool,
    score: u32,
    reasons: Vec<String>,
    original_length: usize,
    sanitized_length: usize,
}

#[derive(Debug)]
struct SanitizationOutcome {
    sanitized: String,
    blocked: bool,
    changed: bool,
    score: u32,
    reasons: Vec<String>,
    original_length: usize,
    sanitized_length: usize,
}

#[derive(Debug)]
struct BuildOutputResult {
    payload: Value,
    mapped_documents: Vec<Value>,
}

#[derive(Debug)]
struct LearningExportSummary {
    checked_documents: usize,
    exported_feedbacks: usize,
    filtered_feedbacks: usize,
    unresolved_folder_feedbacks: usize,
    written_paths: Vec<PathBuf>,
}

fn main() -> Result<()> {
    let repo_root = find_repo_root(std::env::current_dir().context("failed to read current directory")?)?;
    let service_account_path = repo_root.join(SERVICE_ACCOUNT_FILE);
    let output_path = repo_root.join(OUTPUT_RELATIVE_PATH);

    let service_account = read_service_account(&service_account_path)?;
    let http_client = Client::builder()
        .build()
        .context("failed to create HTTP client")?;

    let access_token = fetch_access_token(&http_client, &service_account)?;
    let documents = download_feedback_collection(&http_client, &access_token, &service_account.project_id)?;

    let mut build_result = build_output_payload(&service_account.project_id, &documents);
    let export_summary = export_feedback_to_learning_folders(&repo_root, &build_result.mapped_documents)?;
    write_feedback_protocol_file(&repo_root, &export_summary.written_paths)?;

    if let Some(root_obj) = build_result.payload.as_object_mut() {
        root_obj.insert(
            "learningExport".to_string(),
            json!({
                "checkedDocuments": export_summary.checked_documents,
                "exportedFeedbacks": export_summary.exported_feedbacks,
                "filteredFeedbacks": export_summary.filtered_feedbacks,
                "unresolvedFolderFeedbacks": export_summary.unresolved_folder_feedbacks,
                "exportSubdir": LEARNING_EXPORT_SUBDIR,
                "protocolFile": PROTOCOL_RELATIVE_PATH,
                "writtenPaths": export_summary
                    .written_paths
                    .iter()
                    .map(|p| path_to_repo_relative(&repo_root, p))
                    .collect::<Vec<String>>()
            }),
        );
    }

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create output directory for {}",
                output_path.display()
            )
        })?;
    }

    let serialized =
        serde_json::to_vec_pretty(&build_result.payload).context("failed to serialize output JSON")?;
    fs::write(&output_path, serialized)
        .with_context(|| format!("failed to write output file {}", output_path.display()))?;

    println!(
        "Downloaded {} documents, exported {} feedback files, wrote {}",
        documents.len(),
        export_summary.exported_feedbacks,
        output_path.display()
    );

    Ok(())
}

fn find_repo_root(start: PathBuf) -> Result<PathBuf> {
    let mut cursor = start;
    loop {
        if cursor.join(".git").is_dir() {
            return Ok(cursor);
        }
        if !cursor.pop() {
            bail!("could not find repository root (.git directory)");
        }
    }
}

fn read_service_account(path: &Path) -> Result<ServiceAccount> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("failed to read service account file {}", path.display()))?;
    serde_json::from_str(&raw).with_context(|| {
        format!(
            "failed to parse service account JSON from {}",
            path.display()
        )
    })
}

fn fetch_access_token(client: &Client, service_account: &ServiceAccount) -> Result<String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system time is before UNIX_EPOCH")?
        .as_secs() as i64;

    let claims = JwtClaims {
        iss: service_account.client_email.clone(),
        scope: TOKEN_SCOPE.to_string(),
        aud: service_account.token_uri.clone(),
        iat: now,
        exp: now + 3600,
    };

    let header = Header::new(Algorithm::RS256);
    let encoding_key = EncodingKey::from_rsa_pem(service_account.private_key.as_bytes())
        .context("failed to load RSA private key from service account JSON")?;
    let assertion = encode(&header, &claims, &encoding_key).context("failed to sign JWT assertion")?;

    let token_response = client
        .post(&service_account.token_uri)
        .form(&[("grant_type", TOKEN_GRANT_TYPE), ("assertion", assertion.as_str())])
        .send()
        .context("token endpoint request failed")?
        .error_for_status()
        .context("token endpoint returned non-success status")?
        .json::<TokenResponse>()
        .context("failed to parse token endpoint response")?;

    if token_response.access_token.trim().is_empty() {
        bail!("token endpoint returned an empty access token");
    }
    Ok(token_response.access_token)
}

fn download_feedback_collection(client: &Client, access_token: &str, project_id: &str) -> Result<Vec<Value>> {
    let mut all_documents: Vec<Value> = Vec::new();
    let mut page_token: Option<String> = None;

    loop {
        let endpoint = format!(
            "https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents/{}",
            project_id, COLLECTION_NAME
        );
        let mut url = Url::parse(&endpoint).context("failed to build Firestore URL")?;
        {
            let mut query = url.query_pairs_mut();
            query.append_pair("pageSize", &FIRESTORE_PAGE_SIZE.to_string());
            if let Some(token) = page_token.as_ref() {
                query.append_pair("pageToken", token);
            }
        }

        let page = client
            .get(url)
            .bearer_auth(access_token)
            .send()
            .context("Firestore request failed")?
            .error_for_status()
            .context("Firestore returned non-success status")?
            .json::<Value>()
            .context("failed to parse Firestore response")?;

        if let Some(documents) = page.get("documents").and_then(Value::as_array) {
            all_documents.extend(documents.iter().cloned());
        }

        page_token = page
            .get("nextPageToken")
            .and_then(Value::as_str)
            .map(|token| token.to_string())
            .filter(|token| !token.is_empty());

        if page_token.is_none() {
            break;
        }
    }

    Ok(all_documents)
}

fn build_output_payload(project_id: &str, documents: &[Value]) -> BuildOutputResult {
    let now_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut total_comment_fields = 0usize;
    let mut total_changed_fields = 0usize;
    let mut total_blocked_fields = 0usize;
    let mut docs_with_blocked_comments = 0usize;

    let mapped_docs: Vec<Value> = documents
        .iter()
        .map(|raw_doc| {
            let name = raw_doc
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let create_time = raw_doc
                .get("createTime")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let update_time = raw_doc
                .get("updateTime")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let fields = raw_doc
                .get("fields")
                .cloned()
                .unwrap_or_else(|| Value::Object(Map::new()));

            let mut data = decode_firestore_fields(&fields);
            let reports = sanitize_comment_fields(&mut data);

            let comment_field_count = reports.len();
            let changed_count = reports.iter().filter(|r| r.changed).count();
            let blocked_count = reports.iter().filter(|r| r.blocked).count();

            total_comment_fields += comment_field_count;
            total_changed_fields += changed_count;
            total_blocked_fields += blocked_count;
            if blocked_count > 0 {
                docs_with_blocked_comments += 1;
            }

            json!({
                "id": extract_document_id(&name),
                "name": name,
                "createTime": create_time,
                "updateTime": update_time,
                "data": data,
                "commentSecurity": {
                    "sanitizerVersion": SANITIZER_VERSION,
                    "commentFieldsChecked": comment_field_count,
                    "changedFields": changed_count,
                    "blockedFields": blocked_count,
                    "reports": reports
                }
            })
        })
        .collect();

    let payload = json!({
        "projectId": project_id,
        "collection": COLLECTION_NAME,
        "downloadedAtUnix": now_unix,
        "documentCount": mapped_docs.len(),
        "security": {
            "sanitizerVersion": SANITIZER_VERSION,
            "commentFieldsChecked": total_comment_fields,
            "changedFields": total_changed_fields,
            "blockedFields": total_blocked_fields,
            "documentsWithBlockedComments": docs_with_blocked_comments,
            "blockScoreThreshold": BLOCK_SCORE_THRESHOLD,
            "commentMaxChars": COMMENT_MAX_CHARS
        },
        "documents": mapped_docs.clone()
    });

    BuildOutputResult {
        payload,
        mapped_documents: mapped_docs,
    }
}

fn export_feedback_to_learning_folders(repo_root: &Path, mapped_docs: &[Value]) -> Result<LearningExportSummary> {
    let learning_folders = discover_learning_folders(&repo_root.join("databases"))?;
    cleanup_previous_learning_exports(&learning_folders)?;

    let mut written_paths: Vec<PathBuf> = Vec::new();
    let mut used_paths: HashSet<String> = HashSet::new();
    let mut filtered_feedbacks = 0usize;
    let mut unresolved_folder_feedbacks = 0usize;

    for doc in mapped_docs {
        let doc_id = doc
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();

        let Some(data_obj) = doc.get("data").and_then(Value::as_object) else {
            filtered_feedbacks += 1;
            continue;
        };

        let blocked_fields = doc
            .get("commentSecurity")
            .and_then(Value::as_object)
            .and_then(|s| s.get("blockedFields"))
            .and_then(Value::as_u64)
            .unwrap_or(0);

        let comment_text = data_obj
            .get("comment")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();

        if blocked_fields > 0
            || comment_text.is_empty()
            || comment_text == BLOCKED_COMMENT_TOKEN
            || comment_text == EMPTY_COMMENT_TOKEN
        {
            filtered_feedbacks += 1;
            continue;
        }

        let Some(learning_folder) = resolve_learning_folder_for_feedback(repo_root, data_obj) else {
            unresolved_folder_feedbacks += 1;
            continue;
        };

        let export_dir = learning_folder.join(LEARNING_EXPORT_SUBDIR);
        fs::create_dir_all(&export_dir).with_context(|| {
            format!(
                "failed to create learning export directory {}",
                export_dir.display()
            )
        })?;

        let safe_id = sanitize_file_component(if doc_id.is_empty() { "unknown" } else { &doc_id });
        let mut target_path = export_dir.join(format!("feedback_{}.json", safe_id));
        let mut suffix = 2usize;

        loop {
            let unique_key = target_path.to_string_lossy().to_string();
            if !used_paths.contains(&unique_key) {
                used_paths.insert(unique_key);
                break;
            }
            target_path = export_dir.join(format!("feedback_{}_{}.json", safe_id, suffix));
            suffix += 1;
        }

        let export_payload = json!({
            "id": doc_id,
            "source": data_obj.get("source").cloned().unwrap_or(Value::Null),
            "comment": data_obj.get("comment").cloned().unwrap_or(Value::Null),
            "createdAtIso": data_obj.get("createdAtIso").cloned().unwrap_or(Value::Null),
            "context": data_obj.get("context").cloned().unwrap_or(Value::Null),
            "commentSecurity": doc.get("commentSecurity").cloned().unwrap_or(Value::Null)
        });

        let encoded =
            serde_json::to_vec_pretty(&export_payload).context("failed to serialize learning export payload")?;
        fs::write(&target_path, encoded)
            .with_context(|| format!("failed to write learning export file {}", target_path.display()))?;

        written_paths.push(target_path);
    }

    written_paths.sort();

    Ok(LearningExportSummary {
        checked_documents: mapped_docs.len(),
        exported_feedbacks: written_paths.len(),
        filtered_feedbacks,
        unresolved_folder_feedbacks,
        written_paths,
    })
}

fn discover_learning_folders(databases_root: &Path) -> Result<Vec<PathBuf>> {
    if !databases_root.is_dir() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();
    let mut stack = vec![databases_root.to_path_buf()];

    while let Some(current) = stack.pop() {
        let entries = fs::read_dir(&current)
            .with_context(|| format!("failed to read directory {}", current.display()))?;

        for entry in entries {
            let entry = entry.with_context(|| {
                format!("failed to read directory entry under {}", current.display())
            })?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string();

            if name.starts_with("__04_lernings_") {
                result.push(path);
                continue;
            }

            stack.push(path);
        }
    }

    result.sort();
    Ok(result)
}

fn cleanup_previous_learning_exports(learning_folders: &[PathBuf]) -> Result<()> {
    for folder in learning_folders {
        let export_dir = folder.join(LEARNING_EXPORT_SUBDIR);
        if export_dir.exists() {
            fs::remove_dir_all(&export_dir).with_context(|| {
                format!(
                    "failed to clean previous learning export directory {}",
                    export_dir.display()
                )
            })?;
        }
    }
    Ok(())
}

fn resolve_learning_folder_for_feedback(repo_root: &Path, data_obj: &Map<String, Value>) -> Option<PathBuf> {
    let mut candidates: Vec<String> = Vec::new();

    if let Some(context_obj) = data_obj.get("context").and_then(Value::as_object) {
        push_candidate_path(context_obj, "folderPath", &mut candidates);
        push_candidate_path(context_obj, "gamePath", &mut candidates);
        push_candidate_path(context_obj, "jsonPath", &mut candidates);
    }

    push_candidate_path(data_obj, "folderPath", &mut candidates);
    push_candidate_path(data_obj, "gamePath", &mut candidates);
    push_candidate_path(data_obj, "jsonPath", &mut candidates);

    for candidate in candidates {
        if let Some(path) = resolve_learning_folder_from_candidate(repo_root, &candidate) {
            return Some(path);
        }
    }

    None
}

fn push_candidate_path(map: &Map<String, Value>, key: &str, out: &mut Vec<String>) {
    if let Some(value) = map.get(key).and_then(Value::as_str) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            out.push(trimmed.to_string());
        }
    }
}

fn resolve_learning_folder_from_candidate(repo_root: &Path, candidate: &str) -> Option<PathBuf> {
    let normalized = normalize_repo_candidate_path(candidate)?;

    let mut absolute = if Path::new(&normalized).is_absolute() {
        PathBuf::from(&normalized)
    } else {
        repo_root.join(&normalized)
    };

    if !absolute.exists() && absolute.extension().is_some() {
        absolute = absolute.parent()?.to_path_buf();
    } else if absolute.is_file() {
        absolute = absolute.parent()?.to_path_buf();
    }

    if let Some(name) = absolute.file_name().and_then(|n| n.to_str()) {
        if name.starts_with("__04_lernings_") && absolute.is_dir() {
            return Some(absolute);
        }
    }

    let mut cursor = Some(absolute.as_path());
    while let Some(current) = cursor {
        if let Some(found) = find_learning_child_directory(current) {
            return Some(found);
        }
        if current == repo_root {
            break;
        }
        cursor = current.parent();
    }

    None
}

fn normalize_repo_candidate_path(candidate: &str) -> Option<String> {
    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.contains("://") {
        return None;
    }

    let normalized = trimmed.replace('\\', "/");
    if Path::new(&normalized).is_absolute() {
        return Some(normalized);
    }

    Some(normalized.trim_start_matches('/').to_string())
}

fn find_learning_child_directory(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    let mut learning_dirs: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_dir()
                && path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|name| name.starts_with("__04_lernings_"))
                    .unwrap_or(false)
        })
        .collect();

    learning_dirs.sort();
    learning_dirs.into_iter().next()
}

fn write_feedback_protocol_file(repo_root: &Path, written_paths: &[PathBuf]) -> Result<()> {
    let protocol_path = repo_root.join(PROTOCOL_RELATIVE_PATH);

    if let Some(parent) = protocol_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create protocol directory {}", parent.display()))?;
    }

    let mut lines: Vec<String> = written_paths
        .iter()
        .map(|p| path_to_repo_relative(repo_root, p))
        .collect();
    lines.sort();

    let content = if lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", lines.join("\n"))
    };

    fs::write(&protocol_path, content)
        .with_context(|| format!("failed to write protocol file {}", protocol_path.display()))?;

    Ok(())
}

fn path_to_repo_relative(repo_root: &Path, absolute: &Path) -> String {
    absolute
        .strip_prefix(repo_root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| absolute.to_string_lossy().replace('\\', "/"))
}

fn sanitize_file_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }

    let collapsed = out.trim_matches('_').to_string();
    if collapsed.is_empty() {
        "unknown".to_string()
    } else {
        collapsed
    }
}

fn extract_document_id(full_name: &str) -> String {
    full_name
        .rsplit('/')
        .next()
        .map(|v| v.to_string())
        .unwrap_or_default()
}

fn decode_firestore_fields(fields: &Value) -> Value {
    let Some(object) = fields.as_object() else {
        return Value::Object(Map::new());
    };

    let mut decoded = Map::new();
    for (key, value) in object {
        decoded.insert(key.clone(), decode_firestore_value(value));
    }

    Value::Object(decoded)
}

fn decode_firestore_value(value: &Value) -> Value {
    let Some(object) = value.as_object() else {
        return Value::Null;
    };

    if object.contains_key("nullValue") {
        return Value::Null;
    }
    if let Some(v) = object.get("booleanValue").and_then(Value::as_bool) {
        return Value::Bool(v);
    }
    if let Some(v) = object.get("stringValue").and_then(Value::as_str) {
        return Value::String(v.to_string());
    }
    if let Some(v) = object.get("timestampValue").and_then(Value::as_str) {
        return Value::String(v.to_string());
    }
    if let Some(v) = object.get("referenceValue").and_then(Value::as_str) {
        return Value::String(v.to_string());
    }
    if let Some(v) = object.get("bytesValue").and_then(Value::as_str) {
        return Value::String(v.to_string());
    }
    if let Some(v) = object.get("integerValue").and_then(Value::as_str) {
        if let Ok(parsed) = v.parse::<i64>() {
            return Value::Number(Number::from(parsed));
        }
        return Value::String(v.to_string());
    }
    if let Some(raw_double) = object.get("doubleValue") {
        if let Some(parsed) = parse_firestore_number(raw_double) {
            if let Some(num) = Number::from_f64(parsed) {
                return Value::Number(num);
            }
        }
    }
    if let Some(geo) = object.get("geoPointValue").and_then(Value::as_object) {
        let mut decoded_geo = Map::new();
        if let Some(lat) = geo.get("latitude").and_then(parse_firestore_number) {
            if let Some(n) = Number::from_f64(lat) {
                decoded_geo.insert("latitude".to_string(), Value::Number(n));
            }
        }
        if let Some(lng) = geo.get("longitude").and_then(parse_firestore_number) {
            if let Some(n) = Number::from_f64(lng) {
                decoded_geo.insert("longitude".to_string(), Value::Number(n));
            }
        }
        if !decoded_geo.is_empty() {
            return Value::Object(decoded_geo);
        }
        return Value::Object(geo.clone());
    }
    if let Some(array_obj) = object.get("arrayValue").and_then(Value::as_object) {
        if let Some(values) = array_obj.get("values").and_then(Value::as_array) {
            return Value::Array(values.iter().map(decode_firestore_value).collect());
        }
        return Value::Array(Vec::new());
    }
    if let Some(map_obj) = object.get("mapValue").and_then(Value::as_object) {
        let fields = map_obj
            .get("fields")
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
        return decode_firestore_fields(&fields);
    }

    Value::Object(object.clone())
}

fn parse_firestore_number(value: &Value) -> Option<f64> {
    if let Some(v) = value.as_f64() {
        return Some(v);
    }
    if let Some(v) = value.as_i64() {
        return Some(v as f64);
    }
    if let Some(v) = value.as_u64() {
        return Some(v as f64);
    }
    if let Some(v) = value.as_str() {
        return v.parse::<f64>().ok();
    }
    None
}

fn sanitize_comment_fields(value: &mut Value) -> Vec<CommentSanitizationReport> {
    let mut reports = Vec::new();
    walk_and_sanitize_comments(value, "data", false, &mut reports);
    reports
}

fn walk_and_sanitize_comments(
    value: &mut Value,
    path: &str,
    in_comment_context: bool,
    reports: &mut Vec<CommentSanitizationReport>,
) {
    match value {
        Value::Object(map) => {
            for (key, child) in map.iter_mut() {
                let child_path = join_path(path, key);
                let comment_context = in_comment_context || is_comment_field(key);
                walk_and_sanitize_comments(child, &child_path, comment_context, reports);
            }
        }
        Value::Array(items) => {
            for (index, child) in items.iter_mut().enumerate() {
                let child_path = format!("{}[{}]", path, index);
                walk_and_sanitize_comments(child, &child_path, in_comment_context, reports);
            }
        }
        Value::String(text) => {
            if !in_comment_context {
                return;
            }

            let outcome = sanitize_comment_text(text);
            *text = outcome.sanitized.clone();
            reports.push(CommentSanitizationReport {
                field_path: path.to_string(),
                blocked: outcome.blocked,
                changed: outcome.changed,
                score: outcome.score,
                reasons: outcome.reasons,
                original_length: outcome.original_length,
                sanitized_length: outcome.sanitized_length,
            });
        }
        _ => {}
    }
}

fn join_path(path: &str, key: &str) -> String {
    if path.is_empty() {
        key.to_string()
    } else {
        format!("{}.{}", path, key)
    }
}

fn is_comment_field(key: &str) -> bool {
    let folded = key
        .to_ascii_lowercase()
        .replace('-', "")
        .replace('_', "")
        .replace(' ', "");

    folded.contains("comment")
        || folded.contains("kommentar")
        || folded.contains("feedbacktext")
        || folded == "feedback"
        || folded == "message"
        || folded == "nachricht"
}

fn sanitize_comment_text(input: &str) -> SanitizationOutcome {
    let mut reasons = BTreeSet::<String>::new();
    let mut score = 0u32;
    let mut changed = false;
    let mut matched_injection_rule = false;

    let original_length = input.chars().count();
    let mut sanitized = input.nfkc().collect::<String>();

    if sanitized != input {
        changed = true;
        score += 1;
        reasons.insert("unicode_normalized_nfkc".to_string());
    }

    let without_control = CONTROL_CHAR_RE.replace_all(&sanitized, "").to_string();
    if without_control != sanitized {
        changed = true;
        score += 1;
        reasons.insert("control_chars_removed".to_string());
        sanitized = without_control;
    }

    let without_zero_width = ZERO_WIDTH_RE.replace_all(&sanitized, "").to_string();
    if without_zero_width != sanitized {
        changed = true;
        score += 1;
        reasons.insert("zero_width_removed".to_string());
        sanitized = without_zero_width;
    }

    let compact_whitespace = MULTI_SPACE_RE.replace_all(&sanitized, " ").to_string();
    if compact_whitespace != sanitized {
        changed = true;
        reasons.insert("whitespace_compacted".to_string());
        sanitized = compact_whitespace;
    }

    let trimmed = sanitized.trim().to_string();
    if trimmed != sanitized {
        changed = true;
        reasons.insert("trimmed".to_string());
        sanitized = trimmed;
    }

    let char_count = sanitized.chars().count();
    if char_count > COMMENT_MAX_CHARS {
        changed = true;
        score += 2;
        reasons.insert("max_length_truncated".to_string());
        sanitized = sanitized.chars().take(COMMENT_MAX_CHARS).collect::<String>();
    }

    for rule in DETECTION_RULES.iter() {
        if rule.regex.is_match(&sanitized) {
            matched_injection_rule = true;
            score += rule.weight;
            reasons.insert(format!("detected:{}", rule.id));
        }
    }

    for rewrite in REWRITE_RULES.iter() {
        let updated = rewrite
            .regex
            .replace_all(&sanitized, rewrite.replacement)
            .to_string();
        if updated != sanitized {
            changed = true;
            sanitized = updated;
        }
    }

    if sanitized.is_empty() {
        changed = true;
        score += 1;
        reasons.insert("empty_after_scrub".to_string());
        sanitized = EMPTY_COMMENT_TOKEN.to_string();
    }

    let blocked = matched_injection_rule || score >= BLOCK_SCORE_THRESHOLD;
    if blocked {
        changed = true;
        if matched_injection_rule {
            reasons.insert("blocked_by_detected_injection_rule".to_string());
        } else {
            reasons.insert("blocked_by_score_threshold".to_string());
        }
        sanitized = BLOCKED_COMMENT_TOKEN.to_string();
    }

    let sanitized_length = sanitized.chars().count();

    SanitizationOutcome {
        sanitized,
        blocked,
        changed,
        score,
        reasons: reasons.into_iter().collect(),
        original_length,
        sanitized_length,
    }
}

fn rule(id: &'static str, weight: u32, pattern: &'static str) -> DetectionRule {
    DetectionRule {
        id,
        weight,
        regex: Regex::new(pattern).expect("valid detection regex"),
    }
}

fn rewrite(pattern: &'static str, replacement: &'static str) -> RewriteRule {
    RewriteRule {
        regex: Regex::new(pattern).expect("valid rewrite regex"),
        replacement,
    }
}
