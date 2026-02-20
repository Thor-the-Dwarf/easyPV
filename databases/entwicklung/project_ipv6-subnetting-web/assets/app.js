/**
 * app.js
 * Zweck:  Haupt-Orchestrator der IPv6-Werkbank.
 *         Verdrahtet: Router, State, Layout, Renderer, Error-Handling, Theme.
 * Input:  DOM (index.html), assets/data/lessons.json
 * Output: Vollständig initialisierte Anwendung
 *
 * Beispiel:
 *   import { showError } from './app.js';
 *   showError('lessons.json nicht gefunden.');
 */

import { initRouter, navigate } from './router.js';
import {
    getState, setState, subscribe, findSubchapter,
    findChapter, progressSummary
} from './state.js';
import { initLayout, mountTools, updateBreadcrumb } from './layout.js';
import { renderSubchapter, renderPlaceholder, renderError } from './renderer.js';
import { mountActualTools } from './tools.js';

// ─── Konstanten ───────────────────────────────────────────────────────────────
const LESSONS_URL = './assets/data/lessons.json';
const STORAGE_THEME = 'ipv6wb-theme';

// ─── DOM-Refs ─────────────────────────────────────────────────────────────────
const htmlEl = document.documentElement;
const btnTheme = document.getElementById('btn-theme-toggle');
const btnExam = document.getElementById('btn-exam-mode');
const chapterList = document.getElementById('chapter-list');
const progressBadge = document.getElementById('sidebar-progress-badge');
const errorBanner = document.getElementById('error-banner');
const errorBannerMsg = document.getElementById('error-banner-msg');
const errorBannerClose = document.getElementById('error-banner-close');

// ─── Error API ────────────────────────────────────────────────────────────────

/**
 * Zeigt eine sichtbare Fehlermeldung im Error-Banner an (Grundregel 9).
 * @param {string} msg
 */
export function showError(msg) {
    console.error('[IPv6-Werkbank]', msg);
    errorBannerMsg.textContent = msg;
    errorBanner.removeAttribute('hidden');
}

function hideError() {
    errorBanner.setAttribute('hidden', '');
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
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
    applyTheme(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ─── Exam Mode ────────────────────────────────────────────────────────────────

function syncExamMode(examMode) {
    btnExam.classList.toggle('active', examMode);
    document.body.classList.toggle('exam-mode', examMode);
    btnExam.textContent = examMode ? '📋 Prüfung ✓' : '📋 Prüfung';
}

btnExam.addEventListener('click', () => {
    const next = !getState().examMode;
    setState({ examMode: next });
    syncExamMode(next);
});

// Initialen Exam-Mode aus State anwenden
syncExamMode(getState().examMode);

// ─── Sidebar rendern ──────────────────────────────────────────────────────────

function renderSidebar(chapters) {
    chapterList.innerHTML = '';

    chapters.forEach(chapter => {
        const li = document.createElement('li');
        li.setAttribute('role', 'treeitem');
        li.setAttribute('aria-expanded', 'false');

        // Kapitel-Header-Button
        const chapBtn = document.createElement('button');
        chapBtn.className = 'chapter-item';
        chapBtn.dataset.id = chapter.id;
        chapBtn.setAttribute('tabindex', '0');
        chapBtn.innerHTML = `
      <span class="chapter-item-icon" aria-hidden="true">${chapter.icon ?? '📁'}</span>
      <span class="chapter-item-label">${chapter.title}</span>
      <span class="chapter-item-count" aria-hidden="true">${chapter.subchapters?.length ?? 0}</span>
      <span class="chapter-item-arrow" aria-hidden="true">▶</span>`;

        // Unterkapitel-Liste
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

            subBtn.addEventListener('click', () => navigate(chapter.id, sub.id));
            subLi.appendChild(subBtn);
            subList.appendChild(subLi);
        });

        // Toggle Unterkapitel-Liste
        chapBtn.addEventListener('click', () => {
            const opening = subList.hidden;
            subList.hidden = !opening;
            li.setAttribute('aria-expanded', String(opening));
            chapBtn.classList.toggle('expanded', opening);
            subList.querySelectorAll('button').forEach(b =>
                b.setAttribute('tabindex', opening ? '0' : '-1')
            );
        });

        li.appendChild(chapBtn);
        li.appendChild(subList);
        chapterList.appendChild(li);
    });
}

// ─── Sidebar aktiven Zustand setzen ──────────────────────────────────────────

function setActiveSidebarItem(chapterId, subId) {
    // Kapitel
    document.querySelectorAll('.chapter-item').forEach(el => {
        const isActive = el.dataset.id === chapterId;
        el.classList.toggle('active', isActive);
        if (isActive) {
            const subList = el.nextElementSibling;
            if (subList?.hidden) {
                subList.hidden = false;
                el.classList.add('expanded');
                el.closest('li')?.setAttribute('aria-expanded', 'true');
                subList.querySelectorAll('button').forEach(b => b.setAttribute('tabindex', '0'));
            }
        }
    });

    // Unterkapitel
    document.querySelectorAll('.subchapter-item').forEach(el => {
        el.classList.toggle('active',
            el.dataset.chapterId === chapterId && el.dataset.subId === subId
        );
    });
}

// ─── Fortschritts-Badge ───────────────────────────────────────────────────────

function refreshProgressBadge() {
    if (!progressBadge) return;
    const { done, total } = progressSummary();
    progressBadge.textContent = total ? `${done}/${total}` : '';
}

// ─── Router-Handler (Render-Pipeline) ────────────────────────────────────────
// State → UI Pipeline: Route → Subchapter → Render + Tools + Breadcrumb

function onNavigate(route) {
    if (!route) {
        renderPlaceholder();
        updateBreadcrumb([]);
        mountTools([]);
        return;
    }

    const { chapterId, subId } = route;
    const chapter = findChapter(chapterId);

    if (!chapter) {
        renderError(`Kapitel "${chapterId}" nicht gefunden.`);
        return;
    }

    // Kein Unterkapitel → erstes Unterkapitel wählen
    const targetSubId = subId ?? chapter.subchapters?.[0]?.id;
    if (!targetSubId) {
        renderError(`Keine Unterkapitel in "${chapter.title}".`);
        return;
    }

    // Redirect falls subId angepasst wurde
    if (targetSubId !== subId) {
        import('./router.js').then(({ replaceRoute }) =>
            replaceRoute(chapterId, targetSubId)
        );
        return;
    }

    const sub = findSubchapter(chapterId, subId);
    if (!sub) {
        renderError(`Unterkapitel "${subId}" nicht gefunden.`);
        return;
    }

    // ── Render-Pipeline ──
    renderSubchapter(sub);
    setActiveSidebarItem(chapterId, subId);
    updateBreadcrumb([chapter.title, sub.title]);
    mountTools(sub.tools ?? []);
    mountActualTools(sub.tools ?? [], { defaultCidr: '2001:db8::/48' });
}

// ─── Lessons laden ────────────────────────────────────────────────────────────

async function loadLessons() {
    try {
        const resp = await fetch(LESSONS_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data?.chapters || !Array.isArray(data.chapters)) {
            throw new Error('Kein gültiges "chapters"-Array in lessons.json');
        }
        setState({ lessons: data });
        renderSidebar(data.chapters);
        refreshProgressBadge();

        // Router nach Lessons-Load starten (damit onNavigate Daten hat)
        initRouter(onNavigate);

    } catch (err) {
        showError(`Fehler: Lerninhalt konnte nicht geladen werden – ${err.message}`);
        renderPlaceholder();
    }
}

// ─── Task-Done Listener → Progress-Badge aktualisieren ───────────────────────

document.addEventListener('task-done', () => refreshProgressBadge());

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
    initTheme();
    initLayout();                                    // layout.js: Sidebar-Toggle, Backdrop, Keyboard-Nav
    errorBannerClose.addEventListener('click', hideError);
    renderPlaceholder();                             // sofort anzeigen, bevor JSON geladen ist
    loadLessons();
}

init();
