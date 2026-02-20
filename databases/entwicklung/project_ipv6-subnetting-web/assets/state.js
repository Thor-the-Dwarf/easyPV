/**
 * state.js
 * Zweck:  Zentraler reaktiver App-State für die IPv6-Werkbank.
 *         Verwaltet Lessons, Kapitel-Fortschritt und Exam-Mode.
 *         Persistiert nicht-URL-State in localStorage.
 * Input:  setState(patch) Aufrufe aus allen Modulen
 * Output: getState(), subscribe(fn) für reaktive UI-Updates
 *
 * Beispiel:
 *   import { getState, setState, subscribe } from './state.js';
 *   const unsub = subscribe(s => updateBadge(s.progress));
 *   setState({ examMode: true });
 *   unsub(); // abmelden
 */

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const KEY_PROGRESS = 'ipv6wb-progress';
const KEY_EXAM = 'ipv6wb-examMode';

// ─── Initialer State ──────────────────────────────────────────────────────────

function loadProgress() {
    try { return JSON.parse(localStorage.getItem(KEY_PROGRESS) || '{}'); }
    catch { return {}; }
}

function loadExamMode() {
    try { return JSON.parse(localStorage.getItem(KEY_EXAM) || 'false'); }
    catch { return false; }
}

/** @type {AppState} */
let _state = {
    lessons: null,    // { version, chapters } – aus lessons.json
    progress: loadProgress(),  // { [taskId]: 'done' }
    examMode: loadExamMode(),
};

// ─── Observer ─────────────────────────────────────────────────────────────────

/** @type {Set<(state: AppState) => void>} */
const _listeners = new Set();

/**
 * Gibt eine flache Kopie des aktuellen States zurück.
 * @returns {AppState}
 */
export function getState() {
    return { ..._state };
}

/**
 * Aktualisiert den State und benachrichtigt alle Subscriber.
 * @param {Partial<AppState>} patch
 */
export function setState(patch) {
    _state = { ..._state, ...patch };

    // Persistenz
    if ('progress' in patch) {
        localStorage.setItem(KEY_PROGRESS, JSON.stringify(_state.progress));
    }
    if ('examMode' in patch) {
        localStorage.setItem(KEY_EXAM, JSON.stringify(_state.examMode));
    }

    // Listeners benachrichtigen
    _listeners.forEach(fn => fn(_state));
}

/**
 * Meldet eine Listener-Funktion an, die bei jedem setState aufgerufen wird.
 * Gibt eine Unsubscribe-Funktion zurück.
 * @param {(state: AppState) => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Findet ein Kapitel-Objekt anhand der ID.
 * @param {string} chapterId
 * @returns {Chapter | undefined}
 */
export function findChapter(chapterId) {
    return _state.lessons?.chapters?.find(c => c.id === chapterId);
}

/**
 * Findet ein Unterkapitel-Objekt anhand von Kapitel- und Unterkapitel-ID.
 * @param {string} chapterId
 * @param {string} subId
 * @returns {Subchapter | undefined}
 */
export function findSubchapter(chapterId, subId) {
    return findChapter(chapterId)?.subchapters?.find(s => s.id === subId);
}

/**
 * Gibt alle Unterkapitel (flach) zurück.
 * @returns {Subchapter[]}
 */
export function allSubchapters() {
    return (_state.lessons?.chapters ?? []).flatMap(c => c.subchapters ?? []);
}

/**
 * Gibt Anzahl abgeschlossener und gesamter Tasks zurück.
 * @returns {{ done: number, total: number }}
 */
export function progressSummary() {
    const allTasks = allSubchapters().flatMap(s => s.tasks ?? []);
    const done = allTasks.filter(t => _state.progress[t.id] === 'done').length;
    return { done, total: allTasks.length };
}

/**
 * Markiert eine Task als erledigt.
 * @param {string} taskId
 */
export function markTaskDone(taskId) {
    setState({ progress: { ..._state.progress, [taskId]: 'done' } });
}
