import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testsDir = path.resolve(unitDir, '..');
const docsDir = path.resolve(testsDir, '..');
const gameDir = path.resolve(docsDir, '..');
const configPath = path.join(gameDir, '_data/_gg01_body_language_coach.json');

describe('Body-Language-Coach Config', () => {
  it('contains at least 5 poses with do/dont ratings', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.poses) && cfg.poses.length >= 5, 'expected at least 5 poses');

    cfg.poses.forEach((pose, index) => {
      assert.ok(typeof pose.title === 'string' && pose.title.length > 0, `pose ${index + 1}: missing title`);
      assert.ok(pose.rating === 'do' || pose.rating === 'dont', `pose ${index + 1}: rating must be do or dont`);
      assert.ok(typeof pose.feedback === 'string' && pose.feedback.length > 0, `pose ${index + 1}: missing feedback`);
    });
  });
});
