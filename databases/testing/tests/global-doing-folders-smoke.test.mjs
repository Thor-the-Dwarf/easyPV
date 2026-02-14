import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasesRoot = path.resolve(__dirname, '../..');

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('__02_doing_')) {
        out.push(entryPath);
        continue;
      }
      await walk(entryPath, out);
    }
  }
  return out;
}

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

function parseLocalLinks(html) {
  const matches = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
  return matches.filter((link) =>
    link &&
    !link.startsWith('http://') &&
    !link.startsWith('https://') &&
    !link.startsWith('//') &&
    !link.startsWith('#') &&
    !link.startsWith('data:')
  );
}

describe('Global Doing Folder Smoke Tests', () => {
  it('finds doing folders in databases', async () => {
    const doingDirs = await walk(databasesRoot);
    assert.ok(doingDirs.length > 0, 'expected at least one __02_doing_* folder');
  });

  it('ensures each doing folder has game files', async () => {
    const doingDirs = await walk(databasesRoot);

    for (const doingDir of doingDirs) {
      const files = await filesIn(doingDir);
      const gameFiles = files.filter((name) => /^game_.+\.(html|js|json)$/i.test(name));
      assert.ok(
        gameFiles.length > 0,
        `expected game_*.{html,js,json} in ${doingDir}`
      );
    }
  });

  it('validates local asset links for each game html', async () => {
    const doingDirs = await walk(databasesRoot);

    for (const doingDir of doingDirs) {
      const files = await filesIn(doingDir);
      const htmlFiles = files.filter((name) => /^game_.+\.html$/i.test(name));

      for (const htmlFile of htmlFiles) {
        const htmlPath = path.join(doingDir, htmlFile);
        const html = await readFile(htmlPath, 'utf8');
        const links = parseLocalLinks(html);

        for (const link of links) {
          const resolved = path.normalize(path.join(doingDir, link));
          const insideDatabases = resolved.startsWith(databasesRoot + path.sep) || resolved === databasesRoot;
          assert.ok(insideDatabases, `link escapes databases root: ${link} in ${htmlPath}`);

        }
      }
    }
  });
});
