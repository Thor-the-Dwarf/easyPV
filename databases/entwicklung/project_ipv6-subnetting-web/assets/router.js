/**
 * router.js
 * Zweck:  Hash-basierter Client-Router. Parst #/chapterId/subId,
 *         feuert onNavigate-Callback bei hashchange und initialem Load.
 * Input:  window.location.hash, navigate()/replaceRoute() Aufrufe
 * Output: Parsed Route { chapterId, subId | null }, Navigation-Events
 *
 * Beispiel:
 *   import { initRouter, navigate } from './router.js';
 *   initRouter(route => console.log(route.chapterId, route.subId));
 *   navigate('subnetting', 'prefix-basics');
 */

// ─── Konstanten ────────────────────────────────────────────────────────────────
const PREFIX = '#/';

// ─── Interner State ───────────────────────────────────────────────────────────
let _handler = null;
let _current = null;

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parst einen Hash-String in eine Route.
 * @param   {string}       hash  - z. B. '#/subnetting/prefix-basics'
 * @returns {{ chapterId: string, subId: string|null } | null}
 */
export function parseHash(hash = window.location.hash) {
    if (!hash || !hash.startsWith(PREFIX)) return null;
    const parts = hash.slice(PREFIX.length).split('/');
    const chapterId = parts[0] || null;
    const subId = parts[1] || null;
    if (!chapterId) return null;
    return { chapterId, subId };
}

/**
 * Gibt die aktuell geparste Route zurück.
 * @returns {{ chapterId: string, subId: string|null } | null}
 */
export function getCurrentRoute() {
    return parseHash(window.location.hash);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Navigiert zu einer Route und fügt einen History-Eintrag hinzu.
 * @param {string}      chapterId
 * @param {string|null} [subId]
 */
export function navigate(chapterId, subId = null) {
    const hash = buildHash(chapterId, subId);
    if (window.location.hash !== hash) {
        window.location.hash = hash;     // löst hashchange aus → _dispatchRoute()
    } else {
        _dispatchRoute();                // Gleicher Hash → manuell dispatchen
    }
}

/**
 * Ersetzt den aktuellen History-Eintrag (kein Back-Stack-Eintrag).
 * @param {string}      chapterId
 * @param {string|null} [subId]
 */
export function replaceRoute(chapterId, subId = null) {
    const hash = buildHash(chapterId, subId);
    history.replaceState(null, '', hash);
    _dispatchRoute();
}

/**
 * Löscht den Hash (Startseite / Placeholder).
 */
export function clearRoute() {
    history.replaceState(null, '', window.location.pathname);
    if (_handler) _handler(null);
    _current = null;
}

// ─── Intern ───────────────────────────────────────────────────────────────────

function buildHash(chapterId, subId) {
    return subId
        ? `${PREFIX}${chapterId}/${subId}`
        : `${PREFIX}${chapterId}`;
}

function _dispatchRoute() {
    const route = parseHash(window.location.hash);
    _current = route;
    if (_handler) _handler(route);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialisiert den Router mit einem Navigations-Handler.
 * Wird sofort mit der aktuellen Route aufgerufen.
 * @param {(route: { chapterId: string, subId: string|null } | null) => void} handler
 */
export function initRouter(handler) {
    _handler = handler;

    window.addEventListener('hashchange', () => _dispatchRoute());

    // Initial-Route beim Laden auflösen
    _dispatchRoute();
}
