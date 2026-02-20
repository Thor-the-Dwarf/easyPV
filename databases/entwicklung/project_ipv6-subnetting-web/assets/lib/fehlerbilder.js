/**
 * fehlerbilder.js
 * Zweck:  Durchsuchbare Bibliothek typischer IPv6-Fehlerbilder als Widget.
 *         Accordion-Karten mit Symptom/Ursache/Check/Fix-Tabs.
 *         Optionaler Quiz-Modus: Symptom anzeigen → Ursache erraten.
 * Input:  Keine (Daten inline)
 * Output: HTMLElement (mountbar via slotTool)
 *
 * Beispiel:
 *   import { createFehlerbilderWidget } from './fehlerbilder.js';
 *   document.body.appendChild(createFehlerbilderWidget());
 */

// ─── Fehlerbild-Daten ─────────────────────────────────────────────────────────

const PATTERNS = [
    {
        id: 'ra-guard',
        icon: '🛡️',
        severity: 'high',
        tags: ['slaac', 'switch', 'ra'],
        title: 'RA-Guard blockiert Router-Advertisements',
        symptom: 'Clients haben nur Link-Local-Adresse via SLAAC. Kein Default-Gateway. `ip -6 route` zeigt keine globale Route.',
        cause: 'RA-Guard auf Switch-Access-Port aktiv – filtert RA von Router-Ports.',
        check: '`tcpdump -i eth0 icmp6` auf Client – kommen RAs an?\n`rdisc6 eth0` – sehe ich RAs?',
        fix: 'RA-Guard nur auf Host-Ports ohne Router. Uplinks und Router-Ports als "trusted" konfigurieren.',
        quiz_distractors: ['ICMPv6 Typ 2 geblockt', 'Falsches /64 Präfix', 'DNS AAAA fehlt'],
    },
    {
        id: 'icmpv6-blocked',
        icon: '🚫',
        severity: 'high',
        tags: ['firewall', 'icmpv6', 'ndp'],
        title: 'ICMPv6 durch Firewall geblockt',
        symptom: 'Ping6 fehlschlägt. NDP funktioniert nicht. Hosts haben IPv6-Adresse, sind aber nicht erreichbar.',
        cause: 'Firewall-Regelwerk blockiert ICMPv6 generell. Typen 133-137 (NDP) und 2 (PMTUD) werden gedroppt.',
        check: '`ip6tables -L -n | grep icmpv6`\n`ip neigh show` – status FAILED?',
        fix: 'ICMPv6-Typen 133-137 (NDP), 1, 2, 3 (PMTUD/Error), 128-129 (Echo) freigeben.',
        quiz_distractors: ['RA-Guard aktiv', 'MTU zu groß', 'ULA nicht geroutet'],
    },
    {
        id: 'wrong-prefix-length',
        icon: '📏',
        severity: 'high',
        tags: ['slaac', 'ra', 'prefix'],
        title: 'Falsches Präfix in Router-Advertisement',
        symptom: 'SLAAC-Adresse hat unerwartete Präfixlänge (/48 oder /128 statt /64). Host schlägt als Router auf.',
        cause: 'Router-Konfiguration sendet RA mit prefix-length ≠ 64. Nur /64 ist für SLAAC gültig (RFC 4862).',
        check: '`rdisc6 eth0` – welche Prefix-Length im RA?\n`ip -6 addr show` – hat Auto-Adresse /64?',
        fix: 'RA-Konfiguration: `ipv6 nd prefix 2001:db8:0:1::/64`. Immer /64 für SLAAC-Netz.',
        quiz_distractors: ['Privacy Extensions', 'RA-Guard', 'DNS-Fehler'],
    },
    {
        id: 'pmtud-blocked',
        icon: '📦',
        severity: 'high',
        tags: ['mtu', 'pmtud', 'icmpv6'],
        title: 'PMTU-Discovery Black Hole',
        symptom: 'Kleine Pakete kommen an, große (>1280 Byte) werden silently gedroppt. SSH-Sessions brechen nach Login ab.',
        cause: 'ICMPv6 Typ 2 (Packet Too Big) durch Firewall blockiert → PMTUD kann MTU nicht reduzieren.',
        check: '`ping6 -s 1400 <ziel>` – Timeout bei großen Paketen?\n`tcpdump icmp6 and icmp6[0]=2`',
        fix: 'ICMPv6 Typ 2 (Packet Too Big) freigeben.\nAlternativ: TCP-MSS-Clamping auf 1220 für alle TCP-Verbindungen.',
        quiz_distractors: ['NDP-Cache veraltet', 'ICMPv6 geblockt generell', 'RA-Guard'],
    },
    {
        id: 'dual-stack-dns',
        icon: '🔍',
        severity: 'medium',
        tags: ['dns', 'dual-stack', 'aaaa'],
        title: 'Fehlende AAAA-Records im DNS',
        symptom: 'IPv4 funktioniert, IPv6-Hostnamen nicht erreichbar. Browser/Apps nutzen immer IPv4.',
        cause: 'DNS-Zone enthält nur A-Records. Hosts haben globale IPv6-Adresse, sind aber nicht per Name erreichbar.',
        check: '`dig AAAA host.example.com`\n`nslookup -type=aaaa host.example.com`',
        fix: 'AAAA-Records für alle Hosts hinzufügen. PTR-Records in ip6.arpa-Zone für reverse DNS.',
        quiz_distractors: ['ICMPv6 geblockt', 'Falsches Präfix', 'Privacy Extensions'],
    },
    {
        id: 'stale-ndp',
        icon: '🔄',
        severity: 'low',
        tags: ['ndp', 'cache', 'neighbor'],
        title: 'Veraltete NDP-Cache-Einträge',
        symptom: 'Verbindung bricht ab, Neighbor steht auf STALE oder FAILED. Nach Neustart OK.',
        cause: 'NUD (Neighbor Unreachability Detection) schlägt fehl – Cache-Einträge werden nicht erneuert.',
        check: '`ip neigh show` – Status STALE/PROBE/FAILED?\n`ip -6 neigh flush dev eth0`',
        fix: 'Cache flushen: `ip neigh flush all`\nNUD-Timer prüfen: base_reachable_time_ms in /proc/sys/net/ipv6/neigh/',
        quiz_distractors: ['Firewall-Regel', 'RA-Guard', 'DNS-Problem'],
    },
    {
        id: 'ula-not-routed',
        icon: '🗺️',
        severity: 'medium',
        tags: ['ula', 'routing', 'prefix'],
        title: 'ULA-Präfix nicht zwischen Sites geroutet',
        symptom: 'ULA-Adressen (fd…) innerhalb des Gebäudes nicht site-übergreifend erreichbar.',
        cause: 'ULA-Routen (fd00::/8) nicht auf Core-Routern konfiguriert. OSPFv3/BGP kennt das Präfix nicht.',
        check: '`ip -6 route | grep fd`\n`traceroute6 fd12:3456:789a::1` – wo stoppt es?',
        fix: 'Alle fd::/8-Subnetze in IGP (OSPFv3) eintragen. ULA NICHT in BGP-Updates zum ISP.',
        quiz_distractors: ['PMTUD-Problem', 'RA-Guard', 'ICMPv6 geblockt'],
    },
    {
        id: 'privacy-extensions',
        icon: '🔒',
        severity: 'low',
        tags: ['privacy', 'slaac', 'server'],
        title: 'Privacy Extensions auf Server unerwünscht',
        symptom: 'Server wechselt täglich IPv6-Adresse. Dienst per IP-Regel nicht erreichbar. Logs inkonsistent.',
        cause: 'Privacy Extensions (RFC 8981) aktiv: temporäre Zufalls-Interface-IDs werden bevorzugt.',
        check: '`ip -6 addr` – TEMPORARY-Flag bei globalen Adressen?\n`sysctl net.ipv6.conf.eth0.use_tempaddr`',
        fix: 'Für Server: `sysctl net.ipv6.conf.eth0.use_tempaddr=0`. Oder statische Adresskonfiguration.',
        quiz_distractors: ['DNS-Fehler', 'NDP-Cache', 'RA-Guard'],
    },
];

// ─── Widget erstellen ─────────────────────────────────────────────────────────

/**
 * @returns {HTMLElement}
 */
export function createFehlerbilderWidget() {
    const root = document.createElement('div');
    root.className = 'fb-widget';
    let quizMode = false;
    let quizIdx = -1;

    function render() {
        const query = root.querySelector('.fb-search')?.value?.toLowerCase() ?? '';
        const filtered = query
            ? PATTERNS.filter(p =>
                p.title.toLowerCase().includes(query) ||
                p.tags.some(t => t.includes(query)) ||
                p.symptom.toLowerCase().includes(query))
            : PATTERNS;

        root.innerHTML = `
      <div class="fb-toolbar">
        <input class="fb-search" type="search"
               placeholder="Suchen …" value="${esc(query)}"
               aria-label="Fehlermuster suchen" />
        <button class="fb-quiz-toggle btn btn-ghost ${quizMode ? 'active' : ''}"
                aria-pressed="${quizMode}">
          ${quizMode ? '📖 Karten' : '🎓 Quiz'}
        </button>
      </div>

      ${quizMode && filtered.length
                ? renderQuiz(filtered, quizIdx)
                : renderCards(filtered)}`;

        // ── Events ──
        root.querySelector('.fb-search').addEventListener('input', e => {
            // Re-render mit Debounce
            setTimeout(() => render(), 0);
        });

        root.querySelector('.fb-quiz-toggle').addEventListener('click', () => {
            quizMode = !quizMode;
            quizIdx = quizMode ? Math.floor(Math.random() * PATTERNS.length) : -1;
            render();
        });

        // Card-Accordions
        root.querySelectorAll('.fb-card-header').forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.fb-card');
                const isOpen = card.classList.toggle('fb-open');
                header.setAttribute('aria-expanded', String(isOpen));
            });
        });

        // Tab-Switching in Karten
        root.querySelectorAll('.fb-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.fb-card');
                card.querySelectorAll('.fb-tab-btn').forEach(b => b.classList.remove('fb-tab-active'));
                card.querySelectorAll('.fb-tab-panel').forEach(p => p.hidden = true);
                btn.classList.add('fb-tab-active');
                const target = card.querySelector(`.fb-tab-panel[data-tab="${btn.dataset.tab}"]`);
                if (target) target.hidden = false;
            });
        });

        // Quiz-Optionen
        root.querySelectorAll('.fb-quiz-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = root.querySelector('.fb-quiz-result');
                const isRight = btn.dataset.correct === 'true';
                result.hidden = false;
                result.className = `fb-quiz-result ${isRight ? 'fb-correct' : 'fb-wrong'}`;
                result.textContent = isRight
                    ? `✅ Richtig! ${btn.textContent}`
                    : `❌ Falsch. ${btn.dataset.correctAnswer}`;
                root.querySelectorAll('.fb-quiz-opt').forEach(b => b.disabled = true);
                root.querySelector('.fb-quiz-next')?.removeAttribute('hidden');
            });
        });

        root.querySelector('.fb-quiz-next')?.addEventListener('click', () => {
            const filtered2 = PATTERNS;
            quizIdx = (quizIdx + 1) % filtered2.length;
            render();
        });
    }

    // ── Karten ──
    function renderCards(patterns) {
        if (!patterns.length) return `<p class="fb-empty">Keine Treffer gefunden.</p>`;
        return `<div class="fb-card-list">
      ${patterns.map(p => `
        <div class="fb-card" data-id="${p.id}">
          <button class="fb-card-header" aria-expanded="false">
            <span class="fb-card-icon">${p.icon}</span>
            <span class="fb-card-title">${esc(p.title)}</span>
            <span class="fb-severity fb-sev-${p.severity}"></span>
            <span class="fb-card-arrow">▶</span>
          </button>
          <div class="fb-card-body" hidden>
            <div class="fb-tags">${p.tags.map(t => `<span class="fb-tag">${t}</span>`).join('')}</div>
            <div class="fb-tabs">
              <button class="fb-tab-btn fb-tab-active" data-tab="symptom">Symptom</button>
              <button class="fb-tab-btn" data-tab="cause">Ursache</button>
              <button class="fb-tab-btn" data-tab="check">Check</button>
              <button class="fb-tab-btn" data-tab="fix">Fix</button>
            </div>
            <div class="fb-tab-panel" data-tab="symptom">${preformat(p.symptom)}</div>
            <div class="fb-tab-panel" data-tab="cause" hidden>${preformat(p.cause)}</div>
            <div class="fb-tab-panel" data-tab="check" hidden>${preformat(p.check)}</div>
            <div class="fb-tab-panel" data-tab="fix" hidden>${preformat(p.fix)}</div>
          </div>
        </div>`).join('')}
    </div>`;
    }

    // ── Quiz ──
    function renderQuiz(patterns, idx) {
        const p = PATTERNS[idx < 0 ? 0 : idx % PATTERNS.length];
        const options = shuffle([
            { text: p.cause, correct: true },
            ...p.quiz_distractors.slice(0, 3).map(d => ({ text: d, correct: false }))
        ]);
        const correctAnswer = p.cause.split('\n')[0].substring(0, 60) + '…';

        return `
      <div class="fb-quiz">
        <div class="fb-quiz-progress">${idx + 1} / ${PATTERNS.length}</div>
        <div class="fb-quiz-icon">${p.icon}</div>
        <p class="fb-quiz-symptom"><strong>Symptom:</strong> ${esc(p.symptom.split('\n')[0])}</p>
        <p class="fb-quiz-question">Was ist die wahrscheinlichste Ursache?</p>
        <div class="fb-quiz-options">
          ${options.map(o => `
            <button class="fb-quiz-opt"
                    data-correct="${o.correct}"
                    data-correct-answer="${esc(correctAnswer)}">
              ${esc(o.text.split('\n')[0])}
            </button>`).join('')}
        </div>
        <div class="fb-quiz-result" hidden></div>
        <button class="fb-quiz-next btn btn-ghost" hidden>Nächste Frage →</button>
      </div>`;
    }

    render();
    return root;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(s = '') {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function preformat(text) {
    return text.split('\n').map(line =>
        line.startsWith('`') && line.endsWith('`')
            ? `<code class="fb-cmd">${esc(line.slice(1, -1))}</code>`
            : `<span>${esc(line)}</span>`
    ).join('<br>');
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
