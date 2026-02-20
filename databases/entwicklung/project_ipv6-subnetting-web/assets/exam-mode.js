/**
 * exam-mode.js
 * Zweck:  WP12 – Prüfungsmodus: Timer, Aufgaben-Queue, Scoring, JSON-Export.
 *         Kapselt den Prüfungsmodus als eigenständiges Modul.
 * Input:  lessons (State), optionale Prüfungsdauer in Minuten
 * Output: HTMLElement (Prüfungs-Panel), CustomEvent 'exam-complete'
 *
 * Beispiel:
 *   import { createExamPanel } from './exam-mode.js';
 *   document.body.appendChild(createExamPanel());
 */

import { getState, markTaskDone } from './state.js';
import { validateAnswer, validateChoice } from './lib/task-engine.js';

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Erstellt das Prüfungs-Panel.
 * @param {{ durationMin?: number }} [opts]
 * @returns {HTMLElement}
 */
export function createExamPanel(opts = {}) {
    const DURATION_S = (opts.durationMin ?? 30) * 60;

    const state = getState();
    const tasks = collectAllTasks(state.lessons);

    if (!tasks.length) {
        const el = document.createElement('div');
        el.className = 'exam-panel';
        el.innerHTML = `<p class="exam-empty">Keine Aufgaben verfügbar. Bitte zuerst Kapitel laden.</p>`;
        return el;
    }

    // Aufgaben in zufällige Reihenfolge bringen
    const queue = shuffle([...tasks]);
    let qIdx = 0;
    let correct = 0;
    let remaining = DURATION_S;
    let timerInterval;
    let finished = false;

    const root = document.createElement('div');
    root.className = 'exam-panel';

    function renderQuestion() {
        const task = queue[qIdx];
        const isChoice = task.type === 'multiple-choice';

        root.innerHTML = `
      <div class="exam-header">
        <div class="exam-progress-bar">
          <div class="exam-progress-fill" style="width:${(qIdx / queue.length) * 100}%"></div>
        </div>
        <div class="exam-meta">
          <span class="exam-q-count">${qIdx + 1} / ${queue.length}</span>
          <span class="exam-timer" id="exam-timer">${formatTime(remaining)}</span>
          <span class="exam-score">${correct} ✓</span>
        </div>
      </div>

      <div class="exam-question-area">
        <p class="exam-question-text">${esc(task.question)}</p>
        ${isChoice
                ? renderChoiceOptions(task)
                : `<input class="exam-answer-input" type="text"
                    placeholder="Antwort …" autocomplete="off" spellcheck="false"
                    aria-label="Antwort" />`
            }
        <div class="exam-feedback" aria-live="polite" hidden></div>
        <div class="exam-btn-row">
          <button class="btn btn-primary exam-submit-btn">Prüfen</button>
          <button class="btn btn-ghost exam-skip-btn">Überspringen →</button>
        </div>
      </div>`;

        startTimer();
        wireEvents(task, isChoice);
    }

    function renderChoiceOptions(task) {
        return `<div class="exam-options">${(task.options ?? []).map(o => `
      <label class="exam-option" for="exam-opt-${esc(o.id)}">
        <input type="radio" name="exam-mc" id="exam-opt-${esc(o.id)}" value="${esc(o.id)}">
        <span>${esc(o.text)}</span>
      </label>`).join('')}</div>`;
    }

    function wireEvents(task, isChoice) {
        const feedback = root.querySelector('.exam-feedback');
        const submitBtn = root.querySelector('.exam-submit-btn');
        const skipBtn = root.querySelector('.exam-skip-btn');
        const input = root.querySelector('.exam-answer-input');

        const check = () => {
            let result;
            if (isChoice) {
                const sel = root.querySelector('input[name="exam-mc"]:checked');
                if (!sel) { showFeedback('Bitte eine Option wählen.', false); return; }
                result = validateChoice(task, sel.value);
            } else {
                if (!input.value.trim()) { showFeedback('Bitte eine Antwort eingeben.', false); return; }
                result = validateAnswer(task, input.value);
            }

            showFeedback(result.feedback, result.correct);
            if (result.correct) {
                correct++;
                markTaskDone(task.id);
            }
            submitBtn.disabled = true;
            if (input) input.disabled = true;
            root.querySelectorAll('input[type=radio]').forEach(r => r.disabled = true);
            setTimeout(nextQuestion, 1400);
        };

        function showFeedback(msg, ok) {
            feedback.removeAttribute('hidden');
            feedback.className = `exam-feedback ${ok ? 'exam-fb-ok' : 'exam-fb-err'}`;
            feedback.textContent = msg;
        }

        submitBtn.addEventListener('click', check);
        skipBtn.addEventListener('click', nextQuestion);
        input?.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    }

    function nextQuestion() {
        qIdx++;
        if (qIdx >= queue.length) { finish(); return; }
        renderQuestion();
    }

    function startTimer() {
        clearInterval(timerInterval);
        const timerEl = () => root.querySelector('#exam-timer');
        timerInterval = setInterval(() => {
            remaining--;
            if (timerEl()) timerEl().textContent = formatTime(remaining);
            if (remaining <= 0) { clearInterval(timerInterval); finish(); }
        }, 1000);
    }

    function finish() {
        if (finished) return;
        finished = true;
        clearInterval(timerInterval);

        const scorePercent = Math.round((correct / queue.length) * 100);
        const grade = scorePercent >= 90 ? '1' : scorePercent >= 75 ? '2' : scorePercent >= 60 ? '3' : scorePercent >= 50 ? '4' : '5';
        const result = { date: new Date().toISOString(), correct, total: queue.length, scorePercent, grade };

        root.innerHTML = `
      <div class="exam-result">
        <div class="exam-result-icon">${scorePercent >= 60 ? '🎉' : '📚'}</div>
        <h2 class="exam-result-title">Prüfung abgeschlossen</h2>
        <div class="exam-result-score">${correct} / ${queue.length} (${scorePercent}%)</div>
        <div class="exam-result-grade">Note: <strong>${grade}</strong></div>
        <div class="exam-result-bar">
          <div class="exam-result-fill ${scorePercent >= 60 ? 'fill-pass' : 'fill-fail'}"
               style="width:${scorePercent}%"></div>
        </div>
        <div class="exam-result-btns">
          <button class="btn btn-primary exam-export-btn">📥 Ergebnis exportieren</button>
          <button class="btn btn-ghost exam-restart-btn">🔄 Neue Prüfung</button>
        </div>
      </div>`;

        root.querySelector('.exam-export-btn').addEventListener('click', () => exportResult(result));
        root.querySelector('.exam-restart-btn').addEventListener('click', () => {
            finished = false; qIdx = 0; correct = 0; remaining = DURATION_S;
            shuffle(queue);
            renderQuestion();
        });

        document.dispatchEvent(new CustomEvent('exam-complete', { detail: result }));
    }

    renderQuestion();
    return root;
}

// ─── Teacher-Mode / Share-Link (WP13) ────────────────────────────────────────

/**
 * Generiert einen Share-Link für ein bestimmtes Kapitel + optionalen Seed.
 * @param {string}  chapterId
 * @param {string}  subId
 * @param {number}  [seed]
 * @returns {string}  absolute URL
 */
export function buildShareLink(chapterId, subId, seed) {
    const base = `${location.origin}${location.pathname}`;
    const hash = `#/${chapterId}/${subId}`;
    const params = seed ? `?seed=${seed}` : '';
    return `${base}${params}${hash}`;
}

/**
 * Exportiert ein Prüfungsergebnis als JSON-Download.
 * @param {object} result
 */
export function exportResult(result) {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ipv6-pruefung-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function collectAllTasks(lessons) {
    return (lessons?.chapters ?? [])
        .flatMap(c => c.subchapters ?? [])
        .flatMap(s => s.tasks ?? []);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function esc(s = '') {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
