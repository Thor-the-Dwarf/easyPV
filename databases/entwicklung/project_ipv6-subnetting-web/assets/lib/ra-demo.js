/**
 * ra-demo.js
 * Zweck:  Animierte Router-Advertisement-Simulation (WP11).
 *         Zeigt RA-Fluss zwischen Router und Client, 4 Szenarien:
 *         normal, gestoppt, RA-Guard-geblockt, Solicited-RA.
 * Input:  Keine
 * Output: HTMLElement (mountbar via slotTool)
 *
 * Beispiel:
 *   import { createRADemo } from './ra-demo.js';
 *   document.body.appendChild(createRADemo());
 */

// ─── Zustands-Definitionen ────────────────────────────────────────────────────

const STATES = {
    active: {
        label: '✅ RA aktiv',
        routerState: 'Sendet RA alle 4s',
        clientAddr: '2001:db8::1a2b (SLAAC)',
        clientGw: 'fe80::1 ✓',
        packetClass: 'ra-pkt-flow',
        blocked: false,
        raGuard: false,
    },
    stopped: {
        label: '⏹️ RA gestoppt',
        routerState: 'Sendet keine RAs',
        clientAddr: '(läuft ab …)',
        clientGw: '– (verloren)',
        packetClass: '',
        blocked: false,
        raGuard: false,
    },
    guarded: {
        label: '🛡️ RA-Guard aktiv',
        routerState: 'Sendet RA (ungehört)',
        clientAddr: 'fe80::… (nur link-local)',
        clientGw: '– (gefiltert)',
        packetClass: 'ra-pkt-blocked',
        blocked: true,
        raGuard: true,
    },
    solicited: {
        label: '📩 Solicited RA',
        routerState: 'Antwortet auf RS',
        clientAddr: '2001:db8::3c4d (SLAAC)',
        clientGw: 'fe80::1 ✓',
        packetClass: 'ra-pkt-solicited',
        blocked: false,
        raGuard: false,
    },
};

// ─── Widget erstellen ─────────────────────────────────────────────────────────

/**
 * @returns {HTMLElement}
 */
export function createRADemo() {
    let currentState = 'active';
    let animTimer = null;

    const root = document.createElement('div');
    root.className = 'ra-widget';

    function render() {
        const s = STATES[currentState];

        root.innerHTML = `
      <div class="ra-state-badge ra-state-${currentState}">${s.label}</div>

      <div class="ra-network">
        <!-- Router -->
        <div class="ra-node ra-router">
          <div class="ra-node-icon">🖥️</div>
          <div class="ra-node-label">Router</div>
          <div class="ra-node-info">fe80::1</div>
          <div class="ra-node-status">${s.routerState}</div>
        </div>

        <!-- Verbindungsstrecke -->
        <div class="ra-link">
          <div class="ra-link-line"></div>
          ${s.raGuard
                ? `<div class="ra-guard-icon" title="RA-Guard / Switch-ACL">🛡️</div>`
                : ''}
          <div class="ra-packet ${s.packetClass}" aria-hidden="true">
            RA
          </div>
          ${currentState === 'solicited'
                ? `<div class="ra-packet ra-pkt-rs" aria-hidden="true">RS</div>`
                : ''}
        </div>

        <!-- Client -->
        <div class="ra-node ra-client">
          <div class="ra-node-icon">${currentState === 'stopped' || currentState === 'guarded' ? '😟' : '💻'
            }</div>
          <div class="ra-node-label">Client</div>
          <div class="ra-node-info ra-client-addr">${s.clientAddr}</div>
          <div class="ra-node-info ra-client-gw">GW: ${s.clientGw}</div>
        </div>
      </div>

      <div class="ra-controls">
        <button class="ra-ctrl-btn ${currentState === 'active' ? 'active' : ''}" data-state="active">
          📡 RA senden
        </button>
        <button class="ra-ctrl-btn ${currentState === 'stopped' ? 'active' : ''}" data-state="stopped">
          ⏹️ Stoppen
        </button>
        <button class="ra-ctrl-btn ${currentState === 'guarded' ? 'active' : ''}" data-state="guarded">
          🛡️ RA-Guard
        </button>
        <button class="ra-ctrl-btn ${currentState === 'solicited' ? 'active' : ''}" data-state="solicited">
          📩 Solicited
        </button>
      </div>

      <div class="ra-explain">
        ${getExplanation(currentState)}
      </div>

      <div class="ra-log" id="ra-log-${Date.now()}">
        <div class="ra-log-title">📋 Protokoll</div>
        <div class="ra-log-entries"></div>
      </div>`;

        // ── Buttons verdrahten ──
        root.querySelectorAll('.ra-ctrl-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                clearTimeout(animTimer);
                currentState = btn.dataset.state;
                render();
                addLog(`Szenario gewechselt: ${STATES[currentState].label}`);
            });
        });

        // ── Auto-Log für aktiven Zustand ──
        if (currentState === 'active') {
            addLog('Router sendet Router-Advertisement (ICMPv6 Typ 134)');
            addLog('Client: SLAAC – generiert Adresse aus Präfix + EUI-64');
            addLog('Client: Default-Route gesetzt → fe80::1');
        } else if (currentState === 'stopped') {
            addLog('Keine RAs mehr – Preferred Lifetime läuft ab');
            addLog('Client: Adresse wird DEPRECATED');
            addLog('Client: Default-Route entfernt nach Valid Lifetime');
        } else if (currentState === 'guarded') {
            addLog('Router sendet RA an Switch-Port');
            addLog('Switch: RA-Guard filtert RA – Client empfängt nichts');
            addLog('Client: nur Link-Local-Adresse (kein SLAAC)');
        } else if (currentState === 'solicited') {
            addLog('Client sendet Router-Solicitation (RS, ICMPv6 Typ 133)');
            addLog('Router antwortet mit sofortigem Router-Advertisement');
            addLog('Client: SLAAC-Adresse konfiguriert');
        }
    }

    function addLog(msg) {
        const logEl = root.querySelector('.ra-log-entries');
        if (!logEl) return;
        const now = new Date().toLocaleTimeString('de', { hour12: false });
        const entry = document.createElement('div');
        entry.className = 'ra-log-entry';
        entry.textContent = `${now}  ${msg}`;
        logEl.prepend(entry);
        // Max 6 Einträge
        while (logEl.children.length > 6) logEl.lastChild.remove();
    }

    render();
    return root;
}

// ─── Erklärungstexte ─────────────────────────────────────────────────────────

function getExplanation(state) {
    switch (state) {
        case 'active':
            return `<strong>Normal:</strong> Router sendet periodisch RAs. Client konfiguriert per SLAAC eine globale Adresse und setzt Default-Route.`;
        case 'stopped':
            return `<strong>RA gestoppt:</strong> Nach dem letzten RA läuft die <em>Preferred Lifetime</em> ab – Adresse wird DEPRECATED. Nach <em>Valid Lifetime</em> wird sie entfernt.`;
        case 'guarded':
            return `<strong>RA-Guard:</strong> Switch-ACL blockiert RA-Pakete. Clients sehen nur Link-Local-Adressen. Häufige Ursache für "kein IPv6".`;
        case 'solicited':
            return `<strong>Solicited RA:</strong> Client sendet RS →Router antwortet sofort mit RA (statt periodisch zu warten). Schnellere Initialisierung.`;
    }
}
