import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createG0Catalog } from './g0-catalog-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');

function hasNormalizedContractViolations(catalog) {
  const requiredTopLevel = ['schemaVersion', 'gameId', 'sourceGameId', 'source', 'repo', 'metadata'];
  const issues = [];
  for (let i = 0; i < catalog.games.length; i += 1) {
    const game = catalog.games[i];
    const missing = requiredTopLevel.filter((key) => !Object.prototype.hasOwnProperty.call(game, key));
    if (missing.length) {
      issues.push({
        gameId: game.gameId || `<index:${i}>`,
        missing
      });
    }
  }
  return issues;
}

function printList(label, list, maxRows = 12) {
  if (!list.length) return;
  console.log(`${label}: ${list.length}`);
  const upper = Math.min(list.length, maxRows);
  for (let i = 0; i < upper; i += 1) {
    console.log(`- ${list[i]}`);
  }
  if (list.length > upper) {
    console.log('- ...');
  }
}

async function main() {
  const strictSource = process.argv.includes('--strict-source');
  const { catalog, report } = await createG0Catalog({ workspaceRoot, includeContent: false });

  let hasErrors = false;

  if (report.parseErrors.length) {
    hasErrors = true;
    console.error('Parse errors in source JSON files:');
    for (let i = 0; i < report.parseErrors.length; i += 1) {
      const issue = report.parseErrors[i];
      console.error(`- ${issue.jsonPath}: ${issue.message}`);
    }
  }

  if (report.duplicateSourceGameIds.length) {
    hasErrors = true;
    console.error('Duplicate source game IDs detected:');
    for (let i = 0; i < report.duplicateSourceGameIds.length; i += 1) {
      const row = report.duplicateSourceGameIds[i];
      console.error(`- ${row.gameId}: ${row.count} files`);
    }
  }

  const normalizedContractIssues = hasNormalizedContractViolations(catalog);
  if (normalizedContractIssues.length) {
    hasErrors = true;
    console.error('Normalized contract violations detected:');
    for (let i = 0; i < normalizedContractIssues.length; i += 1) {
      const issue = normalizedContractIssues[i];
      console.error(`- ${issue.gameId}: missing ${issue.missing.join(', ')}`);
    }
  }

  const missingTitle = report.missingSourceFields.title;
  const missingId = report.missingSourceFields.id;
  const missingMeta = report.missingSourceFields.meta;

  console.log(`Checked _g0*.json files: ${report.fileCount}`);
  console.log(`Normalized records: ${catalog.totalGames}`);
  console.log(`Source missing title: ${missingTitle.length}`);
  console.log(`Source missing id: ${missingId.length}`);
  console.log(`Source missing meta: ${missingMeta.length}`);
  console.log(`Top-level source key variants: ${catalog.stats.topLevelKeyFrequency.length}`);

  printList('Examples missing title', missingTitle);
  printList('Examples missing id', missingId);
  printList('Examples missing meta', missingMeta);

  if (strictSource && (missingTitle.length || missingId.length || missingMeta.length)) {
    hasErrors = true;
    console.error('Strict mode failed because source files are not yet fully standardized.');
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
