/**
 * layout.js
 * Zweck:  Layout-Management für die IPv6-Werkbank.
 *         Sidebar (open/close, mobiler Backdrop), Tool-Panel-Slots,
 *         Breadcrumb-Update, Keyboard-Navigation in der Sidebar.
 * Input:  DOM (index.html), Tool-IDs aus lessons.json
 * Output: Reaktives Layout; exportierte API für andere Module
 *
 * Beispiel:
 *   import { mountTools, updateBreadcrumb, closeSidebar } from './layout.js';
 *   mountTools(['prefix-visualizer', 'prefix-slicer']);
 *   updateBreadcrumb(['Subnetting', 'Präfixe verstehen']);
 */

// ─── Tool-Definitionen (Metadaten für Platzhalter-Widgets) ────────────────────
const TOOL_META = {
    'prefix-visualizer': { icon: '🔬', label: 'Präfix-Visualizer', desc: 'Visualisiert IPv6-Adressen und Präfix-Grenzen live.' },
    'prefix-slicer': { icon: '✂️', label: 'Präfix-Slicer', desc: 'Subnetting-Rechner: Bits hinzufügen, Subnetze berechnen.' },
    'scenario-generator': { icon: '🎲', label: 'Szenario-Generator', desc: 'Generiert realistische Planungsaufgaben mit Musterlösung.' },
    'ra-demo': { icon: '📡', label: 'RA-Demo', desc: 'Zeigt den Effekt fehlender Router Advertisements.' },
    'ndp-demo': { icon: '🔗', label: 'NDP-Demo', desc: 'Visualisiert die Neighbor-Discovery-Protokoll-Auflösung.' },
    'pmtud-demo': { icon: '📦', label: 'PMTUD-Demo', desc: 'Erklärt Path-MTU-Discovery und Packet-Too-Big-Meldungen.' },
};

// ─── DOM-Refs ────────────────────────────────────────────────────────────────
const htmlEl = document.documentElement;
const bodyEl = document.body;
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const btnSidebar = document.getElementById('btn-sidebar-toggle');
const toolPanelContent = document.getElementById('tool-panel-content');
const toolPanelTitle = document.getElementById('tool-panel-title');
const breadcrumbList = document.getElementById('breadcrumb-list');
const chapterList = document.getElementById('chapter-list');

// ─── State ────────────────────────────────────────────────────────────────────
let sidebarOpen = true;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMobile() {
    return window.innerWidth < 768;
}

// ─── Sidebar API ──────────────────────────────────────────────────────────────

export function openSidebar() {
    sidebarOpen = true;
    if (isMobile()) {
        bodyEl.classList.add('sidebar-open');
        bodyEl.classList.remove('sidebar-closed');
        backdrop?.removeAttribute('hidden');
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
        backdrop?.setAttribute('hidden', '');
    } else {
        bodyEl.classList.add('sidebar-closed');
    }
    btnSidebar.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
}

export function toggleSidebar() {
    sidebarOpen ? closeSidebar() : openSidebar();
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

/**
 * Aktualisiert die Breadcrumb-Navigation im Header.
 * @param {string[]} parts  - Array von Labels (links nach rechts)
 */
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

// ─── Tool-Panel Slot-System ───────────────────────────────────────────────────

/**
 * Bestückt das Tool-Panel mit Widgets für die gegebenen Tool-IDs.
 * @param {string[]} toolIds  - z. B. ['prefix-visualizer', 'prefix-slicer']
 */
export function mountTools(toolIds = []) {
    toolPanelContent.innerHTML = '';

    if (!toolIds.length) {
        toolPanelTitle.textContent = 'Tools';
        toolPanelContent.innerHTML =
            `<p class="tool-placeholder-text">Dieses Kapitel hat keine interaktiven Tools.</p>`;
        return;
    }

    toolPanelTitle.textContent = toolIds.length === 1
        ? (TOOL_META[toolIds[0]]?.label ?? 'Tool')
        : 'Tools';

    toolIds.forEach(id => {
        const meta = TOOL_META[id] ?? { icon: '🔧', label: id, desc: '' };
        const widget = document.createElement('div');
        widget.className = 'tool-widget';
        widget.dataset.toolId = id;
        widget.setAttribute('role', 'region');
        widget.setAttribute('aria-label', meta.label);

        widget.innerHTML = `
      <div class="tool-widget-header">
        <span class="tool-widget-icon" aria-hidden="true">${meta.icon}</span>
        <h3 class="tool-widget-title">${meta.label}</h3>
        <button class="tool-widget-collapse" aria-expanded="true" aria-label="${meta.label} ein-/ausblenden">▾</button>
      </div>
      <div class="tool-widget-body" id="tool-body-${id}">
        <p class="tool-widget-desc">${meta.desc}</p>
        <div class="tool-widget-slot" data-slot="${id}">
          <!-- Tool-Implementierung wird hier gemountet (WP06-WP11) -->
          <div class="tool-coming-soon">
            <span class="tool-coming-icon">⚙️</span>
            <span>Wird in einem späteren Schritt implementiert.</span>
          </div>
        </div>
      </div>`;

        // Collapse-Toggle
        const btn = widget.querySelector('.tool-widget-collapse');
        const body = widget.querySelector('.tool-widget-body');
        btn.addEventListener('click', () => {
            const open = body.hidden;
            body.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
            btn.textContent = open ? '▾' : '▸';
        });

        toolPanelContent.appendChild(widget);
    });
}

/**
 * Mountet ein fertiges DOM-Element (Tool-Implementierung) in einen Slot.
 * @param {string}      toolId   - Tool-ID (z. B. 'prefix-visualizer')
 * @param {HTMLElement} element  - Fertig gerenderte Tool-Komponente
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
    // Escape schließt Sidebar auf Mobile
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isMobile() && sidebarOpen) {
            closeSidebar();
            btnSidebar.focus();
        }
    });

    // Pfeil-Tasten navigieren in der Sidebar-Liste
    chapterList?.addEventListener('keydown', e => {
        const focusable = Array.from(
            chapterList.querySelectorAll('.chapter-item, .subchapter-item:not([hidden])')
        );
        const idx = focusable.indexOf(document.activeElement);
        if (idx === -1) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusable[Math.min(idx + 1, focusable.length - 1)]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusable[Math.max(idx - 1, 0)]?.focus();
        }
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
            // Auf Desktop: mobile Klassen entfernen
            bodyEl.classList.remove('sidebar-open');
            backdrop?.setAttribute('hidden', '');
            if (sidebarOpen) bodyEl.classList.remove('sidebar-closed');
        }
    });
}

// ─── Progress-Badges in Sidebar ───────────────────────────────────────────────

/**
 * Aktualisiert den Fortschritts-Badge eines Unterkapitels.
 * @param {string}  subId    - Unterkapitel-ID
 * @param {'done'|'active'|'none'} status
 */
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
    // Sidebar-Toggle (Button im Header)
    btnSidebar.addEventListener('click', toggleSidebar);

    // Backdrop anklicken schließt Sidebar
    backdrop?.addEventListener('click', closeSidebar);

    // Initial-State
    if (isMobile()) {
        closeSidebar();
    } else {
        openSidebar();
    }

    initKeyboardNav();
    initResizeHandler();

    // Breadcrumb Basis initialisieren
    updateBreadcrumb([]);
}
