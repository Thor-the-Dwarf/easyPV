/**
 * app.js
 * Zweck:  Haupteinstiegspunkt der IPv6-Werkbank.
 *         Initialisiert Theme, Sidebar-Toggle, lädt lessons.json
 *         und stellt die showError()-API für alle Module bereit.
 * Input:  DOM (index.html), assets/data/lessons.json
 * Output: Bootstrapped App-State; gefüllte Sidebar; Theme gesetzt
 *
 * Beispiel:
 *   import { showError } from './app.js';
 *   showError('lessons.json konnte nicht geladen werden.');
 */

// ─── Konstanten ───────────────────────────────────────────
const LESSONS_URL = './assets/data/lessons.json';
const STORAGE_THEME = 'ipv6wb-theme';
const STORAGE_CHAPTER = 'ipv6wb-chapter';

// ─── State ────────────────────────────────────────────────
export const appState = {
    lessons: null,   // Rohdaten aus lessons.json
    currentChapter: null,   // aktive Kapitel-ID
    currentSub: null,   // aktive Unterkapitel-ID
    examMode: false,
};

// ─── DOM-Refs ─────────────────────────────────────────────
const html = document.documentElement;
const btnTheme = document.getElementById('btn-theme-toggle');
const btnSidebar = document.getElementById('btn-sidebar-toggle');
const btnExam = document.getElementById('btn-exam-mode');
const chapterList = document.getElementById('chapter-list');
const errorBanner = document.getElementById('error-banner');
const errorBannerMsg = document.getElementById('error-banner-msg');
const errorBannerClose = document.getElementById('error-banner-close');
const btnStart = document.getElementById('btn-start');

// ─── Error API ────────────────────────────────────────────

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

// ─── Theme ────────────────────────────────────────────────

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
    const current = html.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ─── Sidebar Toggle ───────────────────────────────────────

function initSidebar() {
    const isMobile = window.innerWidth < 768;
    // Desktop: offen; Mobile: geschlossen
    document.body.classList.toggle('sidebar-closed', !isMobile ? false : true);
    btnSidebar.setAttribute('aria-expanded', String(!isMobile));
}

btnSidebar.addEventListener('click', () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        document.body.classList.toggle('sidebar-open');
    } else {
        document.body.classList.toggle('sidebar-closed');
        const closed = document.body.classList.contains('sidebar-closed');
        btnSidebar.setAttribute('aria-expanded', String(!closed));
    }
});

// ─── Exam Mode ────────────────────────────────────────────

btnExam.addEventListener('click', () => {
    appState.examMode = !appState.examMode;
    btnExam.classList.toggle('active', appState.examMode);
    document.body.classList.toggle('exam-mode', appState.examMode);
    btnExam.textContent = appState.examMode ? '📋 Prüfung ✓' : '📋 Prüfung';
});

// ─── Lessons laden ────────────────────────────────────────

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
    } catch (err) {
        showError(`Fehler: Lerninhalt konnte nicht geladen werden – ${err.message}`);
    }
}

// ─── Sidebar rendern ──────────────────────────────────────

function renderSidebar(chapters) {
    chapterList.innerHTML = '';

    chapters.forEach(chapter => {
        const li = document.createElement('li');
        li.setAttribute('role', 'treeitem');

        // Kapitel-Header
        const chapBtn = document.createElement('button');
        chapBtn.className = 'chapter-item';
        chapBtn.dataset.id = chapter.id;
        chapBtn.setAttribute('aria-expanded', 'false');
        chapBtn.innerHTML = `<span class="chapter-item-icon" aria-hidden="true">${chapter.icon ?? '📁'}</span>${chapter.title}`;

        // Unterkapitel-Liste
        const subList = document.createElement('ul');
        subList.setAttribute('role', 'group');
        subList.hidden = true;

        (chapter.subchapters ?? []).forEach(sub => {
            const subLi = document.createElement('li');
            subLi.setAttribute('role', 'treeitem');
            const subBtn = document.createElement('button');
            subBtn.className = 'subchapter-item';
            subBtn.dataset.chapterId = chapter.id;
            subBtn.dataset.subId = sub.id;
            subBtn.textContent = sub.title;
            subBtn.addEventListener('click', () => navigateTo(chapter.id, sub.id));
            subLi.appendChild(subBtn);
            subList.appendChild(subLi);
        });

        // Toggle Unterkapitel
        chapBtn.addEventListener('click', () => {
            const open = subList.hidden;
            subList.hidden = !open;
            chapBtn.setAttribute('aria-expanded', String(open));
            chapBtn.classList.toggle('active', open);
        });

        li.appendChild(chapBtn);
        li.appendChild(subList);
        chapterList.appendChild(li);
    });
}

// ─── Navigation ───────────────────────────────────────────

/**
 * Navigiert zu einem Unterkapitel.
 * @param {string} chapterId
 * @param {string} subId
 */
export function navigateTo(chapterId, subId) {
    appState.currentChapter = chapterId;
    appState.currentSub = subId;
    localStorage.setItem(STORAGE_CHAPTER, JSON.stringify({ chapterId, subId }));

    // Aktive Klassen setzen
    document.querySelectorAll('.chapter-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === chapterId);
        if (el.dataset.id === chapterId) {
            const group = el.nextElementSibling;
            if (group) { group.hidden = false; el.setAttribute('aria-expanded', 'true'); }
        }
    });
    document.querySelectorAll('.subchapter-item').forEach(el => {
        el.classList.toggle('active',
            el.dataset.chapterId === chapterId && el.dataset.subId === subId
        );
    });

    // TODO WP03: Hash-Router übernimmt das Rendering
    window.location.hash = `#/${chapterId}/${subId}`;
}

// ─── Start-Button ─────────────────────────────────────────

btnStart?.addEventListener('click', () => {
    const first = appState.lessons?.chapters?.[0];
    const firstSub = first?.subchapters?.[0];
    if (first && firstSub) navigateTo(first.id, firstSub.id);
});

// ─── Bootstrap ────────────────────────────────────────────

function init() {
    initTheme();
    initSidebar();
    errorBannerClose.addEventListener('click', hideError);
    loadLessons();
}

init();
