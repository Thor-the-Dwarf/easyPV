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
const configPath = path.join(gameDir, 'data/_gg01_risk_finder_das_kleingedruckte.json');

describe('Risk-Finder Config', () => {
  it('defines exactly 5 target terms and valid scoring settings', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.contract_excerpt) && cfg.contract_excerpt.length >= 2, 'contract_excerpt must have at least two lines');
    assert.ok(Array.isArray(cfg.terms) && cfg.terms.length >= 8, 'terms must contain enough clickable candidates');

    const ids = new Set();
    for (const [index, term] of cfg.terms.entries()) {
      assert.ok(typeof term.id === 'string' && term.id.length > 0, `term ${index + 1}: missing id`);
      assert.ok(typeof term.label === 'string' && term.label.length > 0, `term ${index + 1}: missing label`);
      assert.ok(typeof term.is_target === 'boolean', `term ${index + 1}: missing is_target boolean`);
      assert.ok(typeof term.explanation === 'string' && term.explanation.length > 0, `term ${index + 1}: missing explanation`);
      assert.ok(!ids.has(term.id), `duplicate term id: ${term.id}`);
      ids.add(term.id);
    }

    const targetCount = cfg.terms.filter((term) => term.is_target).length;
    assert.equal(targetCount, 5, 'expected exactly five hidden target terms');

    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring object');
    assert.equal(cfg.scoring.max_score, 100, 'max_score should be 100');
    assert.equal(cfg.scoring.miss_penalty, 20, 'miss_penalty should be 20');
    assert.equal(cfg.scoring.false_penalty, 10, 'false_penalty should be 10');
  });
});
