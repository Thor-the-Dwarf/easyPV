/**
 * layout.js
 * Zweck:  Layout-Management für die IPv6-Werkbank.
 *         Sidebar (open/close, mobiler Backdrop), Tool-Drawer (fixed overlay,
 *         Accordion-Slots), Breadcrumb-Update, Keyboard-Navigation.
 * Input:  DOM (index.html), Tool-IDs aus lessons.json
 * Output: Reaktives Layout; exportierte API für andere Module
 *
 * Beispiel:
 *   import { mountTools, updateBreadcrumb, closeSidebar } from './layout.js';
 *   mountTools(['prefix-visualizer', 'prefix-slicer']);
 *   updateBreadcrumb(['Subnetting', 'Präfixe verstehen']);
 */

// ─── Tool-Definitionen (Metadaten für Accordion-Slots) ────────────────────────
const TOOL_META = {
    'prefix-calculator': { icon: '🧮', label: 'Präfix-Rechner', desc: 'Berechnet Adressanzahl pro Präfix und optional /alt → /neu Subnetze.' },
    'network-range': { icon: '📏', label: 'Netzadresse & Range', desc: 'Berechnet Netzadresse, erste und letzte Adresse für adresse/prefix.' },
    'prefix-visualizer': { icon: '🔬', label: 'Präfix-Visualizer', desc: 'Visualisiert IPv6-Adressen und Präfix-Grenzen live.' },
    'prefix-slicer': { icon: '✂️', label: 'Präfix-Slicer', desc: 'Subnetting-Rechner: Bits hinzufügen, Subnetze berechnen.' },
    'scenario-generator': { icon: '🎲', label: 'Szenario-Generator', desc: 'Generiert realistische Planungsaufgaben mit Musterlösung.' },
    'fehlerbilder': { icon: '🔍', label: 'Fehlerbilder', desc: 'Recherchiere und teste typische IPv6-Fehlerbilder.' },
    'ra-demo': { icon: '📡', label: 'RA-Demo', desc: '4 Szenarien: was passiert wenn RAs fehlen oder geblockt werden.' },
    'ndp-demo': { icon: '🔗', label: 'NDP-Demo', desc: 'Visualisiert den Neighbor-Discovery-Ablauf.' },
    'pmtud-demo': { icon: '📦', label: 'PMTUD-Demo', desc: 'Path-MTU-Discovery und Packet-Too-Big-Meldungen.' },
};

// ─── DOM-Refs ─────────────────────────────────────────────────────────────────
const htmlEl = document.documentElement;
const bodyEl = document.body;
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const btnSidebar = document.getElementById('btn-sidebar-toggle');
const toolPanel = document.getElementById('tool-panel');
const toolPanelContent = document.getElementById('tool-panel-content');
const toolPanelTitle = document.getElementById('tool-panel-title');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const btnDrawerToggle = document.getElementById('btn-drawer-toggle');
const btnDrawerClose = document.getElementById('btn-drawer-close');
const breadcrumbList = document.getElementById('breadcrumb-list');
const chapterList = document.getElementById('chapter-list');

// ─── State ────────────────────────────────────────────────────────────────────
let sidebarOpen = true;
let drawerOpen = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMobile() { return window.innerWidth < 768; }

// ─── Sidebar API ─────────────────────────────────────────────────────────────

export function openSidebar() {
    sidebarOpen = true;
    if (isMobile()) {
        bodyEl.classList.add('sidebar-open');
        bodyEl.classList.remove('sidebar-closed');
        sidebarBackdrop?.removeAttribute('hidden');
    } else {
        bodyEl.classList.remove('sidebar-closed');
    }
    btnSidebar.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
}

export function closeSidebar() {
    sidebarOpen = false;
    if (isMobile()) {
        bodyEl.classList.remove('sidebar-open');
        sidebarBackdrop?.setAttribute('hidden', '');
    } else {
        bodyEl.classList.add('sidebar-closed');
    }
    btnSidebar.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
}

export function toggleSidebar() { sidebarOpen ? closeSidebar() : openSidebar(); }

// ─── Drawer API ───────────────────────────────────────────────────────────────

export function openDrawer() {
    drawerOpen = true;
    toolPanel.classList.add('drawer-open');
    toolPanel.setAttribute('aria-hidden', 'false');
    btnDrawerToggle.setAttribute('aria-expanded', 'true');
    btnDrawerToggle.classList.add('active');
    drawerBackdrop?.removeAttribute('hidden');
}

export function closeDrawer() {
    drawerOpen = false;
    toolPanel.classList.remove('drawer-open');
    toolPanel.setAttribute('aria-hidden', 'true');
    btnDrawerToggle.setAttribute('aria-expanded', 'false');
    btnDrawerToggle.classList.remove('active');
    drawerBackdrop?.setAttribute('hidden', '');
}

export function toggleDrawer() { drawerOpen ? closeDrawer() : openDrawer(); }

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export function updateBreadcrumb(parts = []) {
    breadcrumbList.innerHTML = '';
    const base = document.createElement('li');
    base.innerHTML = `<a href="#" class="breadcrumb-home">IPv6 Werkbank</a>`;
    base.querySelector('a').addEventListener('click', e => {
        e.preventDefault();
        window.location.hash = '';
    });
    breadcrumbList.appendChild(base);

    parts.forEach((part, i) => {
        const li = document.createElement('li');
        li.textContent = part;
        if (i === parts.length - 1) li.classList.add('breadcrumb-current');
        breadcrumbList.appendChild(li);
    });
}

// ─── Tool-Panel Slot-System (Accordion) ───────────────────────────────────────

/**
 * Bestückt den Tool-Drawer mit Accordion-Widgets für die gegebenen Tool-IDs.
 * @param {string[]} toolIds
 * @param {boolean}  [autoOpen=true]  Drawer automatisch öffnen wenn Tools vorhanden
 */
export function mountTools(toolIds = [], autoOpen = true) {
    toolPanelContent.innerHTML = '';

    if (!toolIds.length) {
        toolPanelTitle.textContent = 'Tools';
        toolPanelContent.innerHTML =
            `<p class="tool-placeholder-text">Dieses Kapitel hat keine interaktiven Tools.</p>`;
        // Drawer-Badge zurücksetzen
        updateDrawerBadge(0);
        return;
    }

    toolPanelTitle.textContent = `Tools (${toolIds.length})`;
    updateDrawerBadge(toolIds.length);

    toolIds.forEach((id, idx) => {
        const meta = TOOL_META[id] ?? { icon: '🔧', label: id, desc: '' };

        const accordion = document.createElement('div');
        accordion.className = 'tool-accordion';
        accordion.dataset.toolId = id;

        // Standardmäßig expandiert: erstes Tool offen, Rest geschlossen
        const startOpen = idx === 0;

        accordion.innerHTML = `
          <button class="tool-acc-header" aria-expanded="${startOpen}" aria-controls="tool-body-${id}">
            <span class="tool-acc-icon" aria-hidden="true">${meta.icon}</span>
            <span class="tool-acc-title">${meta.label}</span>
            <span class="tool-acc-chevron" aria-hidden="true">${startOpen ? '▾' : '▸'}</span>
          </button>
          <div class="tool-acc-body" id="tool-body-${id}" ${startOpen ? '' : 'hidden'}>
            <p class="tool-acc-desc">${meta.desc}</p>
            <div class="tool-acc-slot" data-slot="${id}">
              <div class="tool-coming-soon">
                <span class="tool-coming-icon">⚙️</span>
                <span>Wird geladen…</span>
              </div>
            </div>
          </div>`;

        // Accordion-Toggle
        const header = accordion.querySelector('.tool-acc-header');
        const body = accordion.querySelector('.tool-acc-body');
        const chevron = accordion.querySelector('.tool-acc-chevron');

        header.addEventListener('click', () => {
            const isOpen = body.hidden;
            body.hidden = !isOpen;
            header.setAttribute('aria-expanded', String(isOpen));
            chevron.textContent = isOpen ? '▾' : '▸';
        });

        toolPanelContent.appendChild(accordion);
    });

    // Drawer automatisch öffnen wenn Tools vorhanden
    if (autoOpen && toolIds.length > 0) {
        openDrawer();
    }
}

/** Aktualisiert den Badge am Drawer-Toggle-Button (Anzahl aktiver Tools). */
function updateDrawerBadge(count) {
    let badge = btnDrawerToggle.querySelector('.drawer-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'drawer-badge';
        btnDrawerToggle.appendChild(badge);
    }
    badge.textContent = count > 0 ? String(count) : '';
    badge.hidden = count === 0;
}

/**
 * Mountet ein fertiges DOM-Element in einen Accordion-Slot.
 * @param {string}      toolId
 * @param {HTMLElement} element
 */
export function slotTool(toolId, element) {
    const slot = toolPanelContent.querySelector(`[data-slot="${toolId}"]`);
    if (!slot) {
        console.warn(`[layout] Slot für "${toolId}" nicht gefunden`);
        return;
    }
    slot.innerHTML = '';
    slot.appendChild(element);
}

// ─── Keyboard-Navigation (Sidebar) ───────────────────────────────────────────

function initKeyboardNav() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (drawerOpen) { closeDrawer(); btnDrawerToggle.focus(); return; }
            if (isMobile() && sidebarOpen) { closeSidebar(); btnSidebar.focus(); }
        }
    });

    chapterList?.addEventListener('keydown', e => {
        const focusable = Array.from(
            chapterList.querySelectorAll('.chapter-item, .subchapter-item:not([hidden])')
        );
        const idx = focusable.indexOf(document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); focusable[Math.min(idx + 1, focusable.length - 1)]?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); focusable[Math.max(idx - 1, 0)]?.focus(); }
    });
}

// ─── Resize-Handler ───────────────────────────────────────────────────────────

function initResizeHandler() {
    let lastMobile = isMobile();
    window.addEventListener('resize', () => {
        const mobile = isMobile();
        if (mobile === lastMobile) return;
        lastMobile = mobile;
        if (!mobile) {
            bodyEl.classList.remove('sidebar-open');
            sidebarBackdrop?.setAttribute('hidden', '');
            if (sidebarOpen) bodyEl.classList.remove('sidebar-closed');
        }
    });
}

// ─── Progress-Badges in Sidebar ───────────────────────────────────────────────

export function setSubchapterStatus(subId, status) {
    const btn = chapterList?.querySelector(`[data-sub-id="${subId}"]`);
    if (!btn) return;
    btn.classList.remove('status-done', 'status-active');
    const badge = btn.querySelector('.sub-badge');
    if (status === 'done') {
        btn.classList.add('status-done');
        if (badge) badge.textContent = '✓';
    } else if (status === 'active') {
        btn.classList.add('status-active');
        if (badge) badge.textContent = '';
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initLayout() {
    // Sidebar
    btnSidebar.addEventListener('click', toggleSidebar);
    sidebarBackdrop?.addEventListener('click', closeSidebar);
    if (isMobile()) { closeSidebar(); } else { openSidebar(); }

    // Drawer
    btnDrawerToggle.addEventListener('click', toggleDrawer);
    btnDrawerClose?.addEventListener('click', closeDrawer);
    drawerBackdrop?.addEventListener('click', closeDrawer);
    updateDrawerBadge(0);

    initKeyboardNav();
    initResizeHandler();
    updateBreadcrumb([]);
}
