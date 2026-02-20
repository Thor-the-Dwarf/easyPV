/**
 * app.js
 * Zweck:  Haupteinstiegspunkt der IPv6-Werkbank.
 *         Koordiniert: Theme, Exam-Mode, Lessons laden, Sidebar rendern,
 *         Navigation, sichtbare showError()-API.
 * Input:  DOM (index.html), assets/data/lessons.json
 * Output: Bootstrapped App-State; gefüllte Sidebar; Layout initialisiert
 *
 * Beispiel:
 *   import { showError, navigateTo } from './app.js';
 *   navigateTo('subnetting', 'prefix-basics');
 */

import { initLayout, mountTools, updateBreadcrumb } from './layout.js';

// ─── Konstanten ───────────────────────────────────────────────────────────────
const LESSONS_URL = './assets/data/lessons.json';
const STORAGE_THEME = 'ipv6wb-theme';
const STORAGE_CHAPTER = 'ipv6wb-chapter';

// ─── App-State ────────────────────────────────────────────────────────────────
export const appState = {
    lessons: null,   // Rohdaten aus lessons.json
    currentChapter: null,   // aktive Kapitel-ID
    currentSub: null,   // aktive Unterkapitel-ID
    examMode: false,
    progress: {},     // { subId: 'done'|'active' }
};

// ─── DOM-Refs ─────────────────────────────────────────────────────────────────
const html = document.documentElement;
const btnTheme = document.getElementById('btn-theme-toggle');
const btnExam = document.getElementById('btn-exam-mode');
const chapterList = document.getElementById('chapter-list');
const progressBadge = document.getElementById('sidebar-progress-badge');
const errorBanner = document.getElementById('error-banner');
const errorBannerMsg = document.getElementById('error-banner-msg');
const errorBannerClose = document.getElementById('error-banner-close');

// ─── Error API ────────────────────────────────────────────────────────────────

/**
 * Zeigt eine sichtbare Fehlermeldung im Error-Banner an.
 * @param {string} msg  - Fehlermeldung für den Nutzer
 */
export function showError(msg) {
    console.error('[IPv6-Werkbank]', msg);
    errorBannerMsg.textContent = msg;
    errorBanner.removeAttribute('hidden');
}

function hideError() {
    errorBanner.setAttribute('hidden', '');
    errorBannerMsg.textContent = '';
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
    btnTheme.title = theme === 'dark' ? 'Helles Design' : 'Dunkles Design';
    localStorage.setItem(STORAGE_THEME, theme);
}

function initTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved ?? preferred);
}

btnTheme.addEventListener('click', () => {
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ─── Exam Mode ────────────────────────────────────────────────────────────────

btnExam.addEventListener('click', () => {
    appState.examMode = !appState.examMode;
    btnExam.classList.toggle('active', appState.examMode);
    document.body.classList.toggle('exam-mode', appState.examMode);
    btnExam.textContent = appState.examMode ? '📋 Prüfung ✓' : '📋 Prüfung';
});

// ─── Lessons laden ────────────────────────────────────────────────────────────

async function loadLessons() {
    try {
        const resp = await fetch(LESSONS_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} beim Laden von lessons.json`);
        const data = await resp.json();
        if (!data?.chapters || !Array.isArray(data.chapters)) {
            throw new Error('lessons.json hat kein gültiges "chapters"-Array');
        }
        appState.lessons = data;
        renderSidebar(data.chapters);
        updateProgressBadge();

        // Gespeichertes Kapitel wiederherstellen (WP03 macht das vollständig)
        const saved = localStorage.getItem(STORAGE_CHAPTER);
        if (saved) {
            try {
                const { chapterId, subId } = JSON.parse(saved);
                if (chapterId && subId) navigateTo(chapterId, subId, { restoring: true });
            } catch { /* ignore */ }
        }
    } catch (err) {
        showError(`Fehler: Lerninhalt konnte nicht geladen werden – ${err.message}`);
    }
}

// ─── Sidebar rendern ──────────────────────────────────────────────────────────

function renderSidebar(chapters) {
    chapterList.innerHTML = '';

    chapters.forEach(chapter => {
        const li = document.createElement('li');
        li.setAttribute('role', 'treeitem');
        li.setAttribute('aria-expanded', 'false');

        // ── Kapitel-Header-Button ──
        const chapBtn = document.createElement('button');
        chapBtn.className = 'chapter-item';
        chapBtn.dataset.id = chapter.id;
        chapBtn.setAttribute('tabindex', '0');
        chapBtn.innerHTML = `
      <span class="chapter-item-icon" aria-hidden="true">${chapter.icon ?? '📁'}</span>
      <span class="chapter-item-label">${chapter.title}</span>
      <span class="chapter-item-count" aria-hidden="true">${chapter.subchapters?.length ?? 0}</span>
      <span class="chapter-item-arrow" aria-hidden="true">▶</span>`;

        // ── Unterkapitel-Liste ──
        const subList = document.createElement('ul');
        subList.setAttribute('role', 'group');
        subList.className = 'subchapter-list';
        subList.hidden = true;

        (chapter.subchapters ?? []).forEach(sub => {
            const subLi = document.createElement('li');
            subLi.setAttribute('role', 'treeitem');

            const subBtn = document.createElement('button');
            subBtn.className = 'subchapter-item';
            subBtn.dataset.chapterId = chapter.id;
            subBtn.dataset.subId = sub.id;
            subBtn.setAttribute('tabindex', '-1');
            subBtn.innerHTML = `
        <span class="sub-label">${sub.title}</span>
        <span class="sub-badge" aria-hidden="true"></span>`;

            subBtn.addEventListener('click', () => navigateTo(chapter.id, sub.id));
            subLi.appendChild(subBtn);
            subList.appendChild(subLi);
        });

        // Toggle Unterkapitel-Liste
        chapBtn.addEventListener('click', () => {
            const opening = subList.hidden;
            subList.hidden = !opening;
            li.setAttribute('aria-expanded', String(opening));
            chapBtn.classList.toggle('expanded', opening);

            // Unterkapitel-Buttons für Tab-Navigation freigeben/sperren
            subList.querySelectorAll('button').forEach(b =>
                b.setAttribute('tabindex', opening ? '0' : '-1')
            );
        });

        li.appendChild(chapBtn);
        li.appendChild(subList);
        chapterList.appendChild(li);
    });
}

// ─── Fortschritts-Badge ───────────────────────────────────────────────────────

function updateProgressBadge() {
    if (!appState.lessons || !progressBadge) return;
    const total = appState.lessons.chapters
        .flatMap(c => c.subchapters ?? []).length;
    const done = Object.values(appState.progress)
        .filter(v => v === 'done').length;
    progressBadge.textContent = total ? `${done}/${total}` : '';
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Navigiert zu einem Unterkapitel, setzt aktive Klassen und montiert Tools.
 * @param {string} chapterId
 * @param {string} subId
 * @param {{ restoring?: boolean }} [opts]
 */
export function navigateTo(chapterId, subId, opts = {}) {
    appState.currentChapter = chapterId;
    appState.currentSub = subId;

    if (!opts.restoring) {
        localStorage.setItem(STORAGE_CHAPTER, JSON.stringify({ chapterId, subId }));
    }

    // Aktive Klassen setzen
    document.querySelectorAll('.chapter-item').forEach(el => {
        const isActive = el.dataset.id === chapterId;
        el.classList.toggle('active', isActive);
        if (isActive) {
            // Kapitel aufklappen
            const subList = el.nextElementSibling;
            if (subList) {
                subList.hidden = false;
                el.classList.add('expanded');
                el.closest('li')?.setAttribute('aria-expanded', 'true');
                subList.querySelectorAll('button').forEach(b => b.setAttribute('tabindex', '0'));
            }
        }
    });

    document.querySelectorAll('.subchapter-item').forEach(el => {
        el.classList.toggle('active',
            el.dataset.chapterId === chapterId && el.dataset.subId === subId
        );
    });

    // Breadcrumb aktualisieren
    const chapter = appState.lessons?.chapters?.find(c => c.id === chapterId);
    const sub = chapter?.subchapters?.find(s => s.id === subId);
    if (chapter && sub) {
        updateBreadcrumb([chapter.title, sub.title]);
    }

    // Tool-Panel mit kontextuellen Tools bestücken
    const tools = sub?.tools ?? [];
    mountTools(tools);

    // Content rendern (WP04 übernimmt das vollständig)
    renderContentPlaceholder(sub);

    // TODO WP03: Hash-Router verwaltet URL
    const hash = `#/${chapterId}/${subId}`;
    if (window.location.hash !== hash) {
        history.pushState(null, '', hash);
    }
}

// ─── Content-Placeholder (bis WP04) ──────────────────────────────────────────

function renderContentPlaceholder(sub) {
    const area = document.getElementById('content-area');
    if (!sub) return;

    area.innerHTML = `
    <article class="content-article">
      <header class="content-header">
        <h1 class="content-title">${sub.title}</h1>
      </header>
      <div class="content-body">
        ${(sub.blocks ?? []).map(block => renderBlock(block)).join('')}
        ${(sub.tasks ?? []).length ? `
          <section class="tasks-section" aria-label="Aufgaben">
            <h2 class="tasks-heading">✍️ Aufgaben</h2>
            ${sub.tasks.map(t => renderTaskPlaceholder(t)).join('')}
          </section>` : ''}
      </div>
    </article>`;

    // Scroll nach oben
    area.scrollTop = 0;
}

function renderBlock(block) {
    switch (block.type) {
        case 'text':
            return `<p class="content-text">${block.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
        case 'example':
            return `<div class="content-example">
                <div class="example-label">${block.label ?? 'Beispiel'}</div>
                <pre class="example-code"><code>${escHtml(block.code)}</code></pre>
              </div>`;
        case 'hint':
            return `<div class="content-hint" role="note">
                <span class="hint-icon" aria-hidden="true">💡</span>
                <span>${block.content}</span>
              </div>`;
        default:
            return '';
    }
}

function renderTaskPlaceholder(task) {
    return `
    <div class="task-card" data-task-id="${task.id}">
      <p class="task-question">${task.question}</p>
      <div class="task-input-row">
        <input type="text" class="task-input" placeholder="Antwort eingeben …"
               id="task-input-${task.id}" aria-label="Antwort für: ${task.question}"
               autocomplete="off" spellcheck="false" />
        <button class="btn btn-primary task-check-btn" data-task-id="${task.id}">
          Prüfen
        </button>
      </div>
      <div class="task-feedback" id="task-feedback-${task.id}" aria-live="polite" hidden></div>
    </div>`;
}

// ─── Task-Checker (WP08 übernimmt vollständig) ────────────────────────────────

document.addEventListener('click', e => {
    const btn = e.target.closest('.task-check-btn');
    if (!btn) return;

    const taskId = btn.dataset.taskId;
    const input = document.getElementById(`task-input-${taskId}`);
    const feedback = document.getElementById(`task-feedback-${taskId}`);
    if (!input || !feedback) return;

    const sub = appState.lessons?.chapters
        ?.flatMap(c => c.subchapters ?? [])
        .find(s => (s.tasks ?? []).some(t => t.id === taskId));
    const task = sub?.tasks?.find(t => t.id === taskId);
    if (!task) return;

    const userVal = input.value.trim().toLowerCase();
    const correct = String(task.answer).trim().toLowerCase();
    const isOk = userVal === correct;

    feedback.removeAttribute('hidden');
    feedback.className = `task-feedback ${isOk ? 'feedback-ok' : 'feedback-err'}`;
    feedback.textContent = isOk
        ? '✅ Richtig!'
        : `❌ ${task.error_messages?.wrong ?? 'Falsch. Versuche es nochmal.'} (Tipp: ${task.hint ?? ''})`;

    if (isOk) {
        appState.progress[taskId] = 'done';
        updateProgressBadge();
    }
});

// ─── HTML-Escape Utility ──────────────────────────────────────────────────────

function escHtml(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
    initTheme();
    initLayout();   // layout.js übernimmt Sidebar-Toggle, Backdrop, Keyboard-Nav
    errorBannerClose.addEventListener('click', hideError);

    // Basis-Breadcrumb
    updateBreadcrumb([]);

    // Start-Button auf Placeholder-Screen
    document.getElementById('btn-start')?.addEventListener('click', () => {
        const first = appState.lessons?.chapters?.[0];
        const firstSub = first?.subchapters?.[0];
        if (first && firstSub) navigateTo(first.id, firstSub.id);
    });

    loadLessons();
}

init();
