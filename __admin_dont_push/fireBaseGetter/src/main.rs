use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context, Result};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::blocking::Client;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Number, Value};

const COLLECTION_NAME: &str = "feedback_all_games";
const SERVICE_ACCOUNT_FILE: &str = "firebase-service-account.local.json";
const OUTPUT_RELATIVE_PATH: &str = "__admin_dont_push/fireBaseGetter/feedback_all_games.json";
const TOKEN_SCOPE: &str = "https://www.googleapis.com/auth/datastore";
const TOKEN_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const FIRESTORE_PAGE_SIZE: u32 = 1000;

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

    let output_payload = build_output_payload(&service_account.project_id, &documents);
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "failed to create output directory for {}",
                output_path.display()
            )
        })?;
    }

    let serialized = serde_json::to_vec_pretty(&output_payload).context("failed to serialize output JSON")?;
    fs::write(&output_path, serialized)
        .with_context(|| format!("failed to write output file {}", output_path.display()))?;

    println!(
        "Downloaded {} documents from '{}' and wrote {}",
        documents.len(),
        COLLECTION_NAME,
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
        .form(&[
            ("grant_type", TOKEN_GRANT_TYPE),
            ("assertion", assertion.as_str()),
        ])
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

fn build_output_payload(project_id: &str, documents: &[Value]) -> Value {
    let now_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

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
            let data = decode_firestore_fields(&fields);

            json!({
                "id": extract_document_id(&name),
                "name": name,
                "createTime": create_time,
                "updateTime": update_time,
                "data": data,
                "raw": raw_doc
            })
        })
        .collect();

    json!({
        "projectId": project_id,
        "collection": COLLECTION_NAME,
        "downloadedAtUnix": now_unix,
        "documentCount": mapped_docs.len(),
        "documents": mapped_docs
    })
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
