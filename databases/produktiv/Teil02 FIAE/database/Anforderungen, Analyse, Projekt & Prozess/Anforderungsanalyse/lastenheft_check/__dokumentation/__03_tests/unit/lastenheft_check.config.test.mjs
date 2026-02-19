import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testsDir = path.resolve(unitDir, '..');
const docsDir = path.resolve(testsDir, '..');
const topicDir = path.resolve(docsDir, '..');
const gameDir = topicDir;
const configPath = path.join(gameDir, '_data/_gg01_lastenheft_check.json');

describe('Lastenheft-Check Config', () => {
  it('contains items with valid quality tags', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.items) && cfg.items.length >= 4, 'expected at least 4 items');

    for (const [index, item] of cfg.items.entries()) {
      assert.ok(typeof item.text === 'string' && item.text.length > 0, `item ${index + 1}: missing text`);
      assert.ok(item.quality === 'clear' || item.quality === 'unclear', `item ${index + 1}: invalid quality`);
    }
  });
});
