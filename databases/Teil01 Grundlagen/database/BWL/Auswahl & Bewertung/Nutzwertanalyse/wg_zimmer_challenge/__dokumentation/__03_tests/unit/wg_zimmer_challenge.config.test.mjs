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
const configPath = path.join(gameDir, 'data/_gg01_wg_zimmer_challenge.json');

describe('WG-Zimmer-Challenge Config', () => {
  it('contains 10 offers and exactly one offer above threshold', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.offers) && cfg.offers.length === 10, 'expected exactly 10 offers');
    assert.ok(typeof cfg.target_threshold === 'number', 'missing numeric target_threshold');
    assert.ok(cfg.weights && typeof cfg.weights.price === 'number' && typeof cfg.weights.size === 'number', 'missing weights');
    assert.equal(cfg.weights.price + cfg.weights.size, 100, 'weights must sum to 100');

    const ids = new Set();
    let aboveThreshold = 0;
    let correctSeen = false;

    for (const [index, offer] of cfg.offers.entries()) {
      assert.ok(typeof offer.id === 'string' && offer.id.length > 0, `offer ${index + 1}: missing id`);
      assert.ok(!ids.has(offer.id), `duplicate offer id: ${offer.id}`);
      ids.add(offer.id);
      assert.ok(typeof offer.label === 'string' && offer.label.length > 0, `offer ${index + 1}: missing label`);
      assert.ok(Number.isFinite(Number(offer.price_score)), `offer ${index + 1}: missing price_score`);
      assert.ok(Number.isFinite(Number(offer.size_score)), `offer ${index + 1}: missing size_score`);

      const points = (Number(offer.price_score) * cfg.weights.price) + (Number(offer.size_score) * cfg.weights.size);
      if (points > cfg.target_threshold) {
        aboveThreshold += 1;
      }

      if (offer.id === cfg.correct_offer) {
        correctSeen = true;
      }
    }

    assert.ok(correctSeen, 'correct_offer must exist in offers');
    assert.equal(aboveThreshold, 1, 'expected exactly one offer above threshold');
  });
});
