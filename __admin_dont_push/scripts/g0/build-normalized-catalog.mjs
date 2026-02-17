import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createG0Catalog } from './g0-catalog-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const outputPath = path.join(workspaceRoot, '__agent_dont_push', 'metadata', 'g0-catalog.normalized.json');

function printParseErrors(parseErrors) {
  if (!parseErrors.length) return;
  console.error('JSON parse errors detected in _g0*.json files:');
  for (let i = 0; i < parseErrors.length; i += 1) {
    const issue = parseErrors[i];
    console.error(`- ${issue.jsonPath}: ${issue.message}`);
  }
}

async function main() {
  const { catalog, report } = await createG0Catalog({ workspaceRoot, includeContent: true });
  if (report.parseErrors.length) {
    printParseErrors(report.parseErrors);
    process.exit(1);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

  console.log(`Normalized catalog written: ${path.relative(workspaceRoot, outputPath)}`);
  console.log(`Total _g0*.json files: ${report.fileCount}`);
  console.log(`Normalized game records: ${catalog.totalGames}`);
  console.log(
    `Missing source fields (title/id/meta): ${catalog.stats.missingSourceFields.title}/${catalog.stats.missingSourceFields.id}/${catalog.stats.missingSourceFields.meta}`
  );

  if (report.duplicateSourceGameIds.length) {
    console.warn('Duplicate source game IDs were detected and auto-suffixed during normalization:');
    for (let i = 0; i < report.duplicateSourceGameIds.length; i += 1) {
      const row = report.duplicateSourceGameIds[i];
      console.warn(`- ${row.gameId}: ${row.count} files`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
