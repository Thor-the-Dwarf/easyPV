/**
 * task-engine.js
 * Zweck:  Aufgaben-Engine – validiert Antworten, generiert strukturiertes Feedback.
 *         Unterstützt Typen: single-input, multiple-choice.
 *         Validator-Strategien: exact, number, prefix, prefix-len.
 * Input:  Task-Objekt (aus lessons.json) + Nutzer-Eingabe
 * Output: { correct: boolean, feedback: string, hint?: string }
 *
 * Beispiel:
 *   import { validateAnswer, renderTaskCard } from './task-engine.js';
 *   const result = validateAnswer(task, '256');
 *   // → { correct: true, feedback: '✅ Richtig! 2^8 = 256 Subnetze.' }
 */

import { expand, compress, isValidIPv6 } from './ipv6.js';

// ─── Validator-Strategien ────────────────────────────────────────────────────

const VALIDATORS = {

    /** Exakter String-Vergleich (case-insensitive, Whitespace trimmed) */
    exact(input, expected) {
        return input.toLowerCase() === String(expected).toLowerCase();
    },

    /** Numerischer Vergleich – akzeptiert '256', '2^8', '65.536', '65536' */
    number(input, expected) {
        try {
            const normalize = s => s.replace(/[,. \u202f]/g, '');
            const aStr = normalize(input);
            const eStr = normalize(String(expected));

            // Power-of-2-Notation: "2^8"
            const powerMatch = aStr.match(/^2\^(\d+)$/);
            const aBig = powerMatch ? (1n << BigInt(powerMatch[1])) : BigInt(aStr);
            const eBig = BigInt(eStr);
            return aBig === eBig;
        } catch { return false; }
    },

    /** IPv6-Präfix-Vergleich (komprimiert vs. expandiert, CIDR) */
    prefix(input, expected) {
        try {
            const normalize = cidr => {
                const [addr, len] = cidr.trim().split('/');
                if (!addr || !len) throw new Error('no cidr');
                return `${compress(expand(addr))}/${parseInt(len, 10)}`;
            };
            return normalize(input) === normalize(String(expected));
        } catch { return false; }
    },

    /** Vergleicht nur die Präfixlänge (z. B. '56' oder '/56') */
    'prefix-len'(input, expected) {
        const m = input.trim().match(/\d+/);
        return m ? parseInt(m[0], 10) === parseInt(expected, 10) : false;
    },
};

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Validiert eine Nutzer-Eingabe gegen ein Task-Objekt.
 * @param {object} task       - Task-Objekt aus lessons.json
 * @param {string} userInput  - Was der Nutzer eingegeben hat
 * @returns {{ correct: boolean, feedback: string }}
 */
export function validateAnswer(task, userInput) {
    const validatorKey = task.validator ?? 'exact';
    const fn = VALIDATORS[validatorKey] ?? VALIDATORS.exact;

    let correct = false;
    try { correct = fn(userInput.trim(), task.answer); } catch { correct = false; }

    const feedback = correct
        ? (task.success_message ?? '✅ Richtig!')
        : buildErrorFeedback(task, userInput);

    return { correct, feedback };
}

/**
 * Validiert eine Multiple-Choice-Antwort.
 * @param {object} task       - Task mit task.options[]
 * @param {string} selectedId - ID der gewählten Option
 * @returns {{ correct: boolean, feedback: string }}
 */
export function validateChoice(task, selectedId) {
    const chosen = (task.options ?? []).find(o => o.id === selectedId);
    if (!chosen) return { correct: false, feedback: '❌ Keine Option ausgewählt.' };

    const correct = !!chosen.correct;
    const feedback = correct
        ? (task.success_message ?? '✅ Richtig!')
        : `❌ ${chosen.wrong_message ?? task.error_default ?? 'Leider falsch.'}`;

    return { correct, feedback };
}

// ─── Internes ────────────────────────────────────────────────────────────────

function buildErrorFeedback(task, userInput) {
    // Prüfe spezifische Fehlerregeln
    if (Array.isArray(task.error_rules)) {
        for (const rule of task.error_rules) {
            if (matchesRule(rule, userInput)) {
                return `❌ ${rule.message}`;
            }
        }
    }
    // Fallback
    const base = task.error_messages?.wrong ?? task.error_default ?? 'Nicht ganz – versuche es nochmal.';
    const hint = task.hint ? ` 💡 Tipp: ${task.hint}` : '';
    return `❌ ${base}${hint}`;
}

function matchesRule(rule, input) {
    const trimmed = input.trim();
    switch (rule.type) {
        case 'equals': return trimmed.toLowerCase() === String(rule.value).toLowerCase();
        case 'contains': return trimmed.toLowerCase().includes(String(rule.value).toLowerCase());
        case 'greater': try { return parseFloat(trimmed) > parseFloat(rule.value); } catch { return false; }
        case 'less': try { return parseFloat(trimmed) < parseFloat(rule.value); } catch { return false; }
        case 'is-ipv6': return isValidIPv6(trimmed);
        default: return false;
    }
}

// ─── DOM-Renderer (ersetzt renderer.js-Placeholder) ─────────────────────────

/**
 * Erstellt eine vollständige Task-Card als DOM-Element.
 * Unterstützt: single-input, multiple-choice.
 * @param {object}  task
 * @param {object}  progress  - { [taskId]: 'done' }
 * @param {Function} onDone   - Callback(taskId) wenn Aufgabe gelöst
 * @returns {HTMLElement}
 */
export function createTaskCard(task, progress = {}, onDone = () => { }) {
    const isDone = progress[task.id] === 'done';
    const el = document.createElement('div');
    el.className = `task-card ${isDone ? 'task-done' : ''}`;
    el.dataset.taskId = task.id;

    switch (task.type ?? 'single-input') {
        case 'multiple-choice': buildChoiceCard(el, task, isDone, onDone); break;
        default: buildInputCard(el, task, isDone, onDone);
    }

    return el;
}

// ── Single-Input-Card ──────────────────────────────────────────────────────

function buildInputCard(el, task, isDone, onDone) {
    el.innerHTML = `
    <p class="task-question">${esc(task.question)}</p>
    <div class="task-input-row">
      <input class="task-input" type="text"
             id="ti-${esc(task.id)}"
             aria-label="Antwort: ${esc(task.question)}"
             placeholder="Antwort …"
             autocomplete="off" spellcheck="false"
             ${isDone ? 'disabled' : ''} />
      <button class="btn btn-primary task-check-btn">
        ${isDone ? '✓' : 'Prüfen'}
      </button>
    </div>
    ${task.hint ? `<button class="task-hint-btn" aria-expanded="false">💡 Tipp anzeigen</button>
      <div class="task-hint-box" hidden>${esc(task.hint)}</div>` : ''}
    <div class="task-feedback ${isDone ? 'feedback-ok' : ''}" aria-live="polite" ${isDone ? '' : 'hidden'}>
      ${isDone ? '✅ Bereits gelöst!' : ''}
    </div>`;

    const input = el.querySelector('.task-input');
    const checkBtn = el.querySelector('.task-check-btn');
    const feedback = el.querySelector('.task-feedback');
    const hintBtn = el.querySelector('.task-hint-btn');
    const hintBox = el.querySelector('.task-hint-box');

    if (isDone) { if (checkBtn) checkBtn.disabled = true; return; }

    if (hintBtn && hintBox) {
        hintBtn.addEventListener('click', () => {
            const open = hintBox.hidden;
            hintBox.hidden = !open;
            hintBtn.setAttribute('aria-expanded', String(open));
            hintBtn.textContent = open ? '💡 Tipp verbergen' : '💡 Tipp anzeigen';
        });
    }

    const check = () => {
        const { correct, feedback: fb } = validateAnswer(task, input.value);
        feedback.removeAttribute('hidden');
        feedback.className = `task-feedback ${correct ? 'feedback-ok' : 'feedback-err'}`;
        feedback.textContent = fb;

        if (correct) {
            input.disabled = true;
            checkBtn.disabled = true;
            checkBtn.textContent = '✓';
            el.classList.add('task-done');
            onDone(task.id);
        }
    };

    checkBtn.addEventListener('click', check);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
}

// ── Multiple-Choice-Card ───────────────────────────────────────────────────

function buildChoiceCard(el, task, isDone, onDone) {
    const optionsHtml = (task.options ?? []).map(opt => `
    <label class="task-option ${isDone && opt.correct ? 'option-correct' : ''}"
           for="opt-${esc(task.id)}-${esc(opt.id)}">
      <input type="radio" name="mc-${esc(task.id)}"
             id="opt-${esc(task.id)}-${esc(opt.id)}"
             value="${esc(opt.id)}"
             ${isDone ? 'disabled' : ''} />
      <span>${esc(opt.text)}</span>
    </label>`).join('');

    el.innerHTML = `
    <p class="task-question">${esc(task.question)}</p>
    <div class="task-options">${optionsHtml}</div>
    <div class="task-input-row">
      <button class="btn btn-primary task-check-btn" ${isDone ? 'disabled' : ''}>
        ${isDone ? '✓' : 'Prüfen'}
      </button>
    </div>
    <div class="task-feedback ${isDone ? 'feedback-ok' : ''}" aria-live="polite" ${isDone ? '' : 'hidden'}>
      ${isDone ? '✅ Bereits gelöst!' : ''}
    </div>`;

    const checkBtn = el.querySelector('.task-check-btn');
    const feedback = el.querySelector('.task-feedback');

    if (isDone) return;

    checkBtn.addEventListener('click', () => {
        const selected = el.querySelector(`input[name="mc-${task.id}"]:checked`);
        if (!selected) {
            feedback.removeAttribute('hidden');
            feedback.className = 'task-feedback feedback-err';
            feedback.textContent = '❌ Bitte wähle eine Option.';
            return;
        }
        const { correct, feedback: fb } = validateChoice(task, selected.value);
        feedback.removeAttribute('hidden');
        feedback.className = `task-feedback ${correct ? 'feedback-ok' : 'feedback-err'}`;
        feedback.textContent = fb;

        if (correct) {
            el.querySelectorAll('input[type=radio]').forEach(r => r.disabled = true);
            checkBtn.disabled = true;
            checkBtn.textContent = '✓';
            el.classList.add('task-done');
            onDone(task.id);
        }
    });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function esc(s = '') {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
