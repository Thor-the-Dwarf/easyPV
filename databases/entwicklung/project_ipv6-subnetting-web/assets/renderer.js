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
import { createTaskCard } from './lib/task-engine.js';

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

  // Article-Element
  const article = document.createElement('article');
  article.className = 'content-article';
  article.innerHTML = `
    <header class="content-header">
      <h1 class="content-title">${escHtml(sub.title)}</h1>
    </header>
    <div class="content-body">
      ${(sub.blocks ?? []).map(renderBlock).join('')}
    </div>`;

  // Tasks als echte DOM-Elemente (nicht innerHTML) – benötigt für task-engine Events
  if ((sub.tasks ?? []).length) {
    const sec = document.createElement('section');
    sec.className = 'tasks-section';
    sec.setAttribute('aria-label', 'Aufgaben');
    sec.innerHTML = `<h2 class="tasks-heading">✍️ Aufgaben</h2>`;
    const list = document.createElement('div');
    list.className = 'tasks-list';
    const progress = getState().progress;
    sub.tasks.forEach(task => {
      list.appendChild(createTaskCard(task, progress, id => {
        markTaskDone(id);
        document.dispatchEvent(new CustomEvent('task-done', { detail: { taskId: id } }));
      }));
    });
    sec.appendChild(list);
    article.appendChild(sec);
  }

  contentArea.innerHTML = '';
  contentArea.appendChild(article);
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
