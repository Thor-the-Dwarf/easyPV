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
const configPath = path.join(gameDir, '_data/_gg01_phishing_detektiv_email_edition.json');

describe('Phishing-Detektiv-E-Mail-Edition Config', () => {
  it('contains inbox with 10 mails and phishing markers', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.mails) && cfg.mails.length >= 10, 'expected at least 10 mails');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');
    assert.ok(Number.isFinite(Number(cfg.scoring.correct)), 'missing scoring.correct');
    assert.ok(Number.isFinite(Number(cfg.scoring.wrong)), 'missing scoring.wrong');

    let phishingCount = 0;
    cfg.mails.forEach((mail, index) => {
      assert.ok(typeof mail.id === 'string' && mail.id.length > 0, `mail ${index + 1}: missing id`);
      assert.ok(typeof mail.sender === 'string' && mail.sender.length > 0, `mail ${index + 1}: missing sender`);
      assert.ok(typeof mail.subject === 'string' && mail.subject.length > 0, `mail ${index + 1}: missing subject`);
      assert.ok(typeof mail.body === 'string' && mail.body.length > 0, `mail ${index + 1}: missing body`);
      assert.ok(Array.isArray(mail.clues) && mail.clues.length > 0, `mail ${index + 1}: missing clues`);
      assert.ok(typeof mail.isPhishing === 'boolean', `mail ${index + 1}: missing isPhishing`);

      if (mail.isPhishing) phishingCount += 1;
    });

    assert.ok(phishingCount >= 5, 'expected at least 5 phishing mails');
  });
});
