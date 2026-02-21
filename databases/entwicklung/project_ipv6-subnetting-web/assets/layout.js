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
    'prefix-split-enumerator': { icon: '🧩', label: 'Präfix-Split (Enumerator)', desc: 'Teilt ein Präfix auf zielPrefix und zeigt ein Subnetz-Fenster per offset/limit.' },
    'next-previous-network': { icon: '↔️', label: 'Next/Previous Network', desc: 'Berechnet nächstes und vorheriges Netz gleicher Präfixlänge inklusive Blockgröße.' },
    'containment-overlap-check': { icon: '🔁', label: 'Containment / Overlap', desc: 'Prüft A_in_B und bei Präfix-A die Überlappung mit B.' },
    'reverse-dns-generator': { icon: '🔄', label: 'Reverse-DNS Generator', desc: 'Erzeugt ip6.arpa Full-Domain und optional den Delegations-Cut bis Präfix.' },
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
const drawerEdgeTabs = document.getElementById('drawer-edge-tabs');
const breadcrumbList = document.getElementById('breadcrumb-list');
const folderTreePath = document.getElementById('foldertree-path');
const chapterList = document.getElementById('chapter-list');
const sidebarTools = document.getElementById('sidebar-tools');
const sidebarToolButtons = document.getElementById('sidebar-tool-buttons');

// ─── State ────────────────────────────────────────────────────────────────────
let sidebarOpen = true;
let drawerOpen = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMobile() { return window.innerWidth < 768; }

function setActiveEdgeTab(toolId = null) {
    drawerEdgeTabs?.querySelectorAll('.edge-tool-tab').forEach((tab) => {
        const isActive = toolId !== null && tab.dataset.toolId === toolId;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', String(isActive));
    });
}

function setActiveSidebarToolButton(toolId = null) {
    sidebarToolButtons?.querySelectorAll('.sidebar-tool-btn').forEach((btn) => {
        const isActive = toolId !== null && btn.dataset.toolId === toolId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function openToolById(toolId, { scroll = true } = {}) {
    const views = Array.from(toolPanelContent.querySelectorAll('.tool-drawer-view'));
    let found = null;
    views.forEach((view) => {
        const isTarget = view.dataset.toolId === toolId;
        view.hidden = !isTarget;
        view.classList.toggle('active', isTarget);
        if (isTarget) found = view;
    });
    if (!found) return false;
    setActiveEdgeTab(toolId);
    setActiveSidebarToolButton(toolId);
    if (scroll) {
        found.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return true;
}

function mountEdgeTabs(toolIds = []) {
    if (!drawerEdgeTabs) return;
    drawerEdgeTabs.innerHTML = '';
    const hasTabs = toolIds.length > 0;
    drawerEdgeTabs.hidden = !hasTabs;
    bodyEl.classList.toggle('has-edge-tool-tabs', hasTabs);
    if (!hasTabs) {
        setActiveEdgeTab(null);
        return;
    }

    toolIds.forEach((id, idx) => {
        const meta = TOOL_META[id] ?? { icon: '🔧', label: id };
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'edge-tool-tab';
        tab.dataset.toolId = id;
        tab.title = meta.label;
        tab.setAttribute('aria-label', `Tool öffnen: ${meta.label}`);
        tab.setAttribute('aria-pressed', 'false');
        tab.innerHTML = `
          <span class="edge-tool-tab-icon" aria-hidden="true">${meta.icon}</span>
          <span class="edge-tool-tab-index" aria-hidden="true">${idx + 1}</span>`;
        tab.addEventListener('click', () => {
            openDrawer();
            openToolById(id, { scroll: true });
        });
        drawerEdgeTabs.appendChild(tab);
    });
}

function mountSidebarToolButtons(toolIds = []) {
    if (!sidebarTools || !sidebarToolButtons) return;
    sidebarToolButtons.innerHTML = '';
    const hasTools = toolIds.length > 0;
    sidebarTools.hidden = !hasTools;
    if (!hasTools) {
        setActiveSidebarToolButton(null);
        return;
    }

    toolIds.forEach((id) => {
        const meta = TOOL_META[id] ?? { label: id };
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sidebar-tool-btn';
        btn.dataset.toolId = id;
        btn.textContent = meta.label;
        btn.title = `Tool öffnen: ${meta.label}`;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
            openDrawer();
            openToolById(id, { scroll: true });
        });
        sidebarToolButtons.appendChild(btn);
    });
}

// ─── Sidebar API ─────────────────────────────────────────────────────────────

export function openSidebar() {
    sidebarOpen = true;
    bodyEl.classList.remove('sidebar-closed');
    if (isMobile()) {
        bodyEl.classList.add('sidebar-open');
        sidebarBackdrop?.removeAttribute('hidden');
    } else {
        bodyEl.classList.remove('sidebar-open');
        sidebarBackdrop?.setAttribute('hidden', '');
    }
    btnSidebar.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
}

export function closeSidebar() {
    sidebarOpen = false;
    bodyEl.classList.add('sidebar-closed');
    bodyEl.classList.remove('sidebar-open');
    if (isMobile()) {
        sidebarBackdrop?.setAttribute('hidden', '');
    }
    btnSidebar.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
}

export function toggleSidebar() { sidebarOpen ? closeSidebar() : openSidebar(); }

// ─── Drawer API ───────────────────────────────────────────────────────────────

export function openDrawer() {
    drawerOpen = true;
    bodyEl.classList.add('drawer-open');
    toolPanel.classList.add('drawer-open');
    toolPanel.setAttribute('aria-hidden', 'false');
    btnDrawerToggle.setAttribute('aria-expanded', 'true');
    btnDrawerToggle.classList.add('active');
    drawerBackdrop?.removeAttribute('hidden');
}

export function closeDrawer() {
    drawerOpen = false;
    bodyEl.classList.remove('drawer-open');
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

    const folderTreeParts = ['IPv6 Werkbank', ...parts];
    const folderTreeText = folderTreeParts.join(' > ');
    if (folderTreePath) {
        folderTreePath.textContent = folderTreeText;
        folderTreePath.title = folderTreeText;
    }
}

// ─── Tool-Panel Slot-System (Ein Tool pro Drawer-Ansicht) ───────────────────

/**
 * Bestückt den Tool-Drawer mit separaten Tool-Ansichten für die gegebenen Tool-IDs.
 * @param {string[]} toolIds
 * @param {boolean}  [autoOpen=true]  Drawer automatisch öffnen wenn Tools vorhanden
 */
export function mountTools(toolIds = [], autoOpen = true) {
    toolPanelContent.innerHTML = '';
    mountEdgeTabs(toolIds);
    mountSidebarToolButtons(toolIds);

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

    toolIds.forEach((id) => {
        const meta = TOOL_META[id] ?? { icon: '🔧', label: id, desc: '' };
        const view = document.createElement('section');
        view.className = 'tool-drawer-view';
        view.dataset.toolId = id;
        view.hidden = true;
        view.innerHTML = `
          <div class="tool-drawer-head">
            <span class="tool-drawer-icon" aria-hidden="true">${meta.icon}</span>
            <span class="tool-drawer-name">${meta.label}</span>
          </div>
          <p class="tool-acc-desc">${meta.desc}</p>
          <div class="tool-acc-slot" data-slot="${id}">
            <div class="tool-coming-soon">
              <span class="tool-coming-icon">⚙️</span>
              <span>Wird geladen…</span>
            </div>
          </div>`;
        toolPanelContent.appendChild(view);
    });

    if (toolIds.length) {
        openToolById(toolIds[0], { scroll: false });
    }

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
        if (mobile) {
            if (sidebarOpen) {
                bodyEl.classList.add('sidebar-open');
                bodyEl.classList.remove('sidebar-closed');
                sidebarBackdrop?.removeAttribute('hidden');
            } else {
                bodyEl.classList.remove('sidebar-open');
                sidebarBackdrop?.setAttribute('hidden', '');
            }
        } else {
            bodyEl.classList.remove('sidebar-open');
            sidebarBackdrop?.setAttribute('hidden', '');
            if (sidebarOpen) {
                bodyEl.classList.remove('sidebar-closed');
            } else {
                bodyEl.classList.add('sidebar-closed');
            }
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
