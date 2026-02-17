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
const configPath = path.join(gameDir, 'data/_gg01_sla_timer_kampf.json');

describe('SLA-Timer-Kampf Config', () => {
  it('contains rounds with valid ticket choices and priority values', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(cfg.priority_targets_minutes, 'missing priority targets');
    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const allowedPriorities = new Set(['P1', 'P2', 'P3', 'P4']);

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.tickets) && round.tickets.length >= 3, `round ${index + 1}: expected >=3 tickets`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);

      const ticketIds = new Set(round.tickets.map((ticket) => ticket.id));
      assert.ok(ticketIds.has(round.best_choice), `round ${index + 1}: best_choice is not a ticket id`);

      for (const [ticketIndex, ticket] of round.tickets.entries()) {
        assert.ok(typeof ticket.title === 'string' && ticket.title.length > 0, `round ${index + 1}, ticket ${ticketIndex + 1}: missing title`);
        assert.ok(allowedPriorities.has(ticket.priority), `round ${index + 1}, ticket ${ticketIndex + 1}: invalid priority`);
        assert.ok(Number.isInteger(ticket.minutes_left) && ticket.minutes_left > 0, `round ${index + 1}, ticket ${ticketIndex + 1}: invalid minutes_left`);
      }
    }
  });
});
