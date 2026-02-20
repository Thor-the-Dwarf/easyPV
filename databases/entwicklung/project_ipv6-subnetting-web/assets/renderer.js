/**
 * renderer.js
 * Zweck:  Rendert Lerninhalte aus lessons.json (Unterkapitel-Objekte) in den
 *         #content-area. Unterstützt Blöcke: text, example, hint.
 *         Task-Interaktion wird per Event-Delegation verwaltet.
 *         Neues Kapitel → neue JSON-Einträge, kein Code-Änderung nötig.
 * Input:  Subchapter-Objekt (aus lessons.json) + markTaskDone-Callback
 * Output: DOM-Inhalte in #content-area; CustomEvent 'task-checked' auf document
 *
 * Beispiel:
 *   import { renderSubchapter, renderPlaceholder } from './renderer.js';
 *   renderSubchapter(subObj);     // rendert Kapitel-Inhalt
 *   renderPlaceholder();          // zeigt Startscreen
 */

import { getState, findSubchapter, markTaskDone } from './state.js';

// ─── DOM-Ref ──────────────────────────────────────────────────────────────────
const contentArea = document.getElementById('content-area');

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Rendert den Startscreen (kein Kapitel aktiv).
 */
export function renderPlaceholder() {
    contentArea.innerHTML = `
    <div id="content-placeholder" class="placeholder-screen">
      <div class="placeholder-icon">⚡</div>
      <h1 class="placeholder-title">IPv6 Werkbank</h1>
      <p class="placeholder-sub">Wähle ein Kapitel aus dem Lernpfad, um zu starten.</p>
      <button id="btn-start" class="btn btn-primary">Los geht's →</button>
    </div>`;

    document.getElementById('btn-start')?.addEventListener('click', () => {
        const state = getState();
        const first = state.lessons?.chapters?.[0];
        const firstSub = first?.subchapters?.[0];
        if (first && firstSub) {
            import('./router.js').then(({ navigate }) =>
                navigate(first.id, firstSub.id)
            );
        }
    });
}

/**
 * Rendert eine Fehlermeldung im Content-Bereich (zusätzlich zum Error-Banner).
 * @param {string} msg
 */
export function renderError(msg) {
    contentArea.innerHTML = `
    <div class="content-error-screen">
      <div class="error-icon">⚠️</div>
      <h1>Seite nicht gefunden</h1>
      <p>${escHtml(msg)}</p>
      <a href="#" class="btn btn-ghost" onclick="history.back();return false">← Zurück</a>
    </div>`;
}

/**
 * Rendert ein Unterkapitel vollständig.
 * @param {object} sub  - Subchapter-Objekt aus lessons.json
 */
export function renderSubchapter(sub) {
    if (!sub) { renderPlaceholder(); return; }

    const progress = getState().progress;
    const tasksHtml = (sub.tasks ?? []).length
        ? `<section class="tasks-section" aria-label="Aufgaben">
         <h2 class="tasks-heading">✍️ Aufgaben</h2>
         <div class="tasks-list">
           ${sub.tasks.map(t => renderTaskCard(t, progress)).join('')}
         </div>
       </section>`
        : '';

    contentArea.innerHTML = `
    <article class="content-article">
      <header class="content-header">
        <h1 class="content-title">${escHtml(sub.title)}</h1>
      </header>
      <div class="content-body">
        ${(sub.blocks ?? []).map(renderBlock).join('')}
        ${tasksHtml}
      </div>
    </article>`;

    contentArea.scrollTop = 0;
}

// ─── Block-Renderer ───────────────────────────────────────────────────────────

function renderBlock(block) {
    switch (block.type) {
        case 'text': return renderTextBlock(block);
        case 'example': return renderExampleBlock(block);
        case 'hint': return renderHintBlock(block);
        default: return `<!-- unbekannter Block-Typ: ${escHtml(block.type)} -->`;
    }
}

function renderTextBlock(block) {
    const html = parseMiniMarkdown(block.content ?? '');
    return `<p class="content-text">${html}</p>`;
}

function renderExampleBlock(block) {
    return `
    <div class="content-example">
      <div class="example-label">${escHtml(block.label ?? 'Beispiel')}</div>
      <pre class="example-code"><code>${escHtml(block.code ?? '')}</code></pre>
    </div>`;
}

function renderHintBlock(block) {
    return `
    <div class="content-hint" role="note">
      <span class="hint-icon" aria-hidden="true">💡</span>
      <span>${parseMiniMarkdown(block.content ?? '')}</span>
    </div>`;
}

// ─── Task-Renderer ────────────────────────────────────────────────────────────

function renderTaskCard(task, progress) {
    const isDone = progress[task.id] === 'done';
    const doneClass = isDone ? ' task-done' : '';
    return `
    <div class="task-card${doneClass}" data-task-id="${escAttr(task.id)}">
      <p class="task-question">${escHtml(task.question)}</p>
      <div class="task-input-row">
        <input type="text" class="task-input"
               id="task-input-${escAttr(task.id)}"
               aria-label="Antwort für: ${escAttr(task.question)}"
               placeholder="Antwort eingeben …"
               autocomplete="off" spellcheck="false"
               ${isDone ? 'disabled value="✓ Gelöst"' : ''} />
        <button class="btn btn-primary task-check-btn"
                data-task-id="${escAttr(task.id)}"
                ${isDone ? 'disabled' : ''}>
          ${isDone ? '✓' : 'Prüfen'}
        </button>
      </div>
      <div class="task-feedback ${isDone ? 'feedback-ok' : ''}"
           id="task-feedback-${escAttr(task.id)}"
           aria-live="polite"
           ${isDone ? '' : 'hidden'}>
        ${isDone ? '✅ Bereits gelöst!' : ''}
      </div>
    </div>`;
}

// ─── Task-Checker (Event-Delegation) ─────────────────────────────────────────
// Lauscht auf #content-area; WP08 ersetzt diese Logik durch eine vollständige Engine.

contentArea.addEventListener('click', e => {
    const btn = e.target.closest('.task-check-btn');
    if (!btn || btn.disabled) return;

    const taskId = btn.dataset.taskId;
    const input = document.getElementById(`task-input-${taskId}`);
    const feedback = document.getElementById(`task-feedback-${taskId}`);
    const card = btn.closest('.task-card');
    if (!input || !feedback || !card) return;

    // Task-Definition aus State holen
    const state = getState();
    const allSub = (state.lessons?.chapters ?? []).flatMap(c => c.subchapters ?? []);
    const task = allSub.flatMap(s => s.tasks ?? []).find(t => t.id === taskId);
    if (!task) return;

    const userVal = input.value.trim().toLowerCase();
    const correct = String(task.answer).trim().toLowerCase();
    const isOk = userVal === correct;

    feedback.removeAttribute('hidden');
    feedback.className = `task-feedback ${isOk ? 'feedback-ok' : 'feedback-err'}`;
    feedback.textContent = isOk
        ? '✅ Richtig!'
        : `❌ ${task.error_messages?.wrong ?? 'Falsch – versuche es nochmal.'}${task.hint ? ` Tipp: ${task.hint}` : ''}`;

    if (isOk) {
        markTaskDone(taskId);
        card.classList.add('task-done');
        btn.disabled = true;
        btn.textContent = '✓';
        input.disabled = true;

        // Event für andere Module (z. B. Sidebar-Badge)
        document.dispatchEvent(new CustomEvent('task-done', { detail: { taskId } }));
    }
});

// Enter-Taste in Task-Inputs
contentArea.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('.task-input');
    if (!input) return;
    const card = input.closest('.task-card');
    card?.querySelector('.task-check-btn')?.click();
});

// ─── Mini-Markdown ────────────────────────────────────────────────────────────

/**
 * Minimaler Markdown-Parser: **bold**, `code`.
 * @param   {string} text
 * @returns {string} HTML
 */
function parseMiniMarkdown(text) {
    return escHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, `<code>$1</code>`);
}

// ─── HTML-Escape ──────────────────────────────────────────────────────────────

function escHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(str = '') {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
