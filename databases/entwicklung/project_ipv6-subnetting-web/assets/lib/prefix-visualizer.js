/**
 * prefix-visualizer.js
 * Zweck:  Erstellt ein interaktives Prefix-Visualizer-Widget (DOM-Element).
 *         Zeigt 8 IPv6-Gruppen mit Präfix-Highlighting und Nibble-Grenzen.
 * Input:  initialCidr (string, z. B. '2001:db8::/48')
 * Output: HTMLElement (mountbar via slotTool)
 *
 * Beispiel:
 *   import { createPrefixVisualizer } from './prefix-visualizer.js';
 *   const el = createPrefixVisualizer('2001:db8::/48');
 *   document.body.appendChild(el);
 */

import {
    expand, compress, groupInfo, getAddressType,
    isValidIPv6, prefixMask, fromBigInt, applyMask, isNibbleBoundary
} from './ipv6.js';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function nibbleState(groupStart, nibbleIndex, prefixLen) {
    const bitStart = groupStart + nibbleIndex * 4;
    const bitEnd = bitStart + 4;
    if (bitEnd <= prefixLen) return 'full';
    if (bitStart < prefixLen) return 'partial';
    return 'none';
}

function buildGroupsHTML(groups, prefixLen) {
    return groups.map(g => {
        const nibbles = g.hex.split(''); // 4 hex chars = 4 nibbles
        const nibblesHtml = nibbles.map((hexChar, ni) => {
            const state = nibbleState(g.groupStart, ni, prefixLen);
            const bits = g.bits.slice(ni * 4, (ni + 1) * 4);
            return `<span class="pv-nibble pv-nibble-${state}" title="${bits} (Bits ${g.groupStart + ni * 4}–${g.groupStart + ni * 4 + 3})">${hexChar}</span>`;
        }).join('<span class="pv-nibble-sep">·</span>');

        return `
      <div class="pv-group pv-group-${g.inPrefix}">
        <div class="pv-group-hex">${g.hex}</div>
        <div class="pv-nibbles-row">${nibblesHtml}</div>
        <div class="pv-group-idx">G${g.groupIndex}</div>
      </div>`;
    }).join('<span class="pv-group-sep">:</span>');
}

function buildBitBarHTML(prefixLen) {
    const segs = [];
    for (let i = 0; i < GROUPS; i++) {
        const start = i * 16;
        const end = start + 16;
        let state;
        if (end <= prefixLen) state = 'full';
        else if (start < prefixLen) state = 'partial';
        else state = 'none';
        const w = (state === 'partial') ? (prefixLen - start) / 16 * 100 : 100;
        segs.push(`<div class="pv-bar-seg pv-bar-${state}" style="flex:1" title="Gruppe ${i} (Bits ${start}–${end - 1})"></div>`);
    }
    return `<div class="pv-bar">${segs.join('')}</div>`;
}

const GROUPS = 8;

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

/**
 * Erstellt das Prefix-Visualizer-Widget.
 * @param   {string} [initialCidr='2001:db8::/48']
 * @returns {HTMLElement}
 */
export function createPrefixVisualizer(initialCidr = '2001:db8::/48') {
    const root = document.createElement('div');
    root.className = 'pv-widget';
    root.innerHTML = `
    <div class="pv-input-row">
      <input class="pv-cidr-input" type="text"
             value="${initialCidr}"
             placeholder="z. B. 2001:db8::/48"
             spellcheck="false" autocomplete="off"
             aria-label="IPv6-Präfix eingeben" />
      <button class="btn btn-primary pv-btn-go" aria-label="Visualisieren">▶</button>
    </div>
    <div class="pv-display" aria-live="polite"></div>`;

    const input = root.querySelector('.pv-cidr-input');
    const display = root.querySelector('.pv-display');
    const btn = root.querySelector('.pv-btn-go');

    // ── Render-Funktion ──
    function render() {
        const raw = input.value.trim();
        if (!raw) { display.innerHTML = ''; return; }

        let addr, prefixLen;
        const m = raw.match(/^(.+?)\/(\d+)$/);
        if (m) { addr = m[1]; prefixLen = parseInt(m[2], 10); }
        else { addr = raw; prefixLen = 64; }

        if (!isValidIPv6(addr)) {
            display.innerHTML = `<p class="pv-error">❌ Ungültige IPv6-Adresse</p>`;
            return;
        }
        prefixLen = clamp(prefixLen, 0, 128);

        const groups = groupInfo(addr, prefixLen);
        const compressed = compress(addr);
        const expanded = expand(addr);
        const netAddr = applyMask(addr, prefixLen);
        const maskStr = compress(fromBigInt(prefixMask(prefixLen)));
        const type = getAddressType(addr);
        const nibbleOk = isNibbleBoundary(prefixLen);

        display.innerHTML = `
      <div class="pv-type-badge pv-type-${type.type}">${type.label}</div>
      ${!nibbleOk
                ? `<div class="pv-nibble-warn">⚠️ /${prefixLen} liegt nicht auf einer Nibble-Grenze. Bevorzuge ein Vielfaches von 4.</div>`
                : ''}

      <div class="pv-groups-scroll">
        <div class="pv-groups-row">${buildGroupsHTML(groups, prefixLen)}</div>
      </div>
      ${buildBitBarHTML(prefixLen)}

      <div class="pv-legend">
        <span class="pv-leg"><span class="pv-swatch pv-sw-full"></span>Präfix (/${prefixLen})</span>
        ${!nibbleOk ? `<span class="pv-leg"><span class="pv-swatch pv-sw-partial"></span>Nibble-Grenze</span>` : ''}
        <span class="pv-leg"><span class="pv-swatch pv-sw-none"></span>Host-Bits</span>
      </div>

      <div class="pv-info-grid">
        ${infoRow('Komprimiert', compressed + '/' + prefixLen, 'pv-c1')}
        ${infoRow('Expandiert', expanded, 'pv-c2')}
        ${infoRow('Netzadresse', compress(netAddr) + '/' + prefixLen, 'pv-c3')}
        ${infoRow('Netzmaske', maskStr, 'pv-c4')}
      </div>`;

        // Copy-Buttons verdrahten
        display.querySelectorAll('.pv-copy-btn').forEach(copyBtn => {
            copyBtn.addEventListener('click', () => {
                const valEl = display.querySelector('#' + copyBtn.dataset.target);
                if (!valEl) return;
                navigator.clipboard.writeText(valEl.textContent).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = '⎘'; }, 1500);
                }).catch(() => { });
            });
        });
    }

    function infoRow(label, value, id) {
        return `
      <div class="pv-info-row">
        <span class="pv-info-label">${label}</span>
        <code class="pv-info-val" id="${id}">${value}</code>
        <button class="pv-copy-btn" data-target="${id}" title="Kopieren" aria-label="Kopieren">⎘</button>
      </div>`;
    }

    // ── Events ──
    btn.addEventListener('click', render);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') render(); });

    // Live-Update mit Debounce
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(render, 400);
    });

    render();
    return root;
}
