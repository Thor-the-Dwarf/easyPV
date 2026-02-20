/**
 * prefix-slicer.js
 * Zweck:  Erstellt ein interaktives Prefix-Slicer-Widget (DOM-Element).
 *         Berechnet Subnetze: neue Präfixlänge, Anzahl, erste 5 + letztes.
 * Input:  initialCidr (string, z. B. '2001:db8::/48')
 * Output: HTMLElement (mountbar via slotTool)
 *
 * Beispiel:
 *   import { createPrefixSlicer } from './prefix-slicer.js';
 *   const el = createPrefixSlicer('2001:db8::/48');
 */

import {
    isValidIPv6, listSubnets, isNibbleBoundary, subnetCount
} from './ipv6.js';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nextPowerOf2(n) {
    if (n <= 1) return 1;
    return Math.pow(2, Math.ceil(Math.log2(n)));
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

/**
 * Erstellt das Prefix-Slicer-Widget.
 * @param   {string} [initialCidr='2001:db8::/48']
 * @returns {HTMLElement}
 */
export function createPrefixSlicer(initialCidr = '2001:db8::/48') {
    const root = document.createElement('div');
    root.className = 'ps-widget';

    root.innerHTML = `
    <div class="ps-input-section">
      <label class="ps-label" for="ps-cidr">Präfix (CIDR)</label>
      <input class="ps-cidr-input" id="ps-cidr" type="text"
             value="${initialCidr}" placeholder="z. B. 2001:db8::/48"
             spellcheck="false" autocomplete="off" />

      <div class="ps-mode-tabs">
        <button class="ps-mode-btn ps-mode-active" data-mode="bits">+ Bits</button>
        <button class="ps-mode-btn" data-mode="count">Subnetzanzahl</button>
      </div>

      <div class="ps-bits-section">
        <label class="ps-label" for="ps-bits-slider">Zusätzliche Bits: <strong id="ps-bits-val">8</strong></label>
        <input class="ps-slider" id="ps-bits-slider" type="range" min="1" max="80" value="8" />
        <div class="ps-slider-hints">
          <span>+1</span><span>+16</span><span>+32</span><span>+48</span><span>+64</span><span>+80</span>
        </div>
      </div>

      <div class="ps-count-section" hidden>
        <label class="ps-label" for="ps-count-input">Benötigte Subnetze</label>
        <input class="ps-count-input" id="ps-count-input" type="number"
               min="2" max="1000000" value="256" placeholder="z. B. 256" />
        <p class="ps-count-hint">Wird auf nächste 2^n-Potenz aufgerundet.</p>
      </div>

      <button class="btn btn-primary ps-btn-calc ps-full-btn">Berechnen</button>
    </div>

    <div class="ps-results" aria-live="polite"></div>`;

    // ── Element-Refs ──
    const cidrInput = root.querySelector('.ps-cidr-input');
    const bitsSection = root.querySelector('.ps-bits-section');
    const countSection = root.querySelector('.ps-count-section');
    const bitsSlider = root.querySelector('#ps-bits-slider');
    const bitsVal = root.querySelector('#ps-bits-val');
    const countInput = root.querySelector('.ps-count-input');
    const calcBtn = root.querySelector('.ps-btn-calc');
    const results = root.querySelector('.ps-results');
    const modeBtns = root.querySelectorAll('.ps-mode-btn');

    let currentMode = 'bits';

    // ── Mode-Tabs ──
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentMode = btn.dataset.mode;
            modeBtns.forEach(b => b.classList.toggle('ps-mode-active', b === btn));
            bitsSection.hidden = (currentMode !== 'bits');
            countSection.hidden = (currentMode !== 'count');
        });
    });

    // ── Slider Live-Label ──
    bitsSlider.addEventListener('input', () => {
        bitsVal.textContent = bitsSlider.value;
    });

    // ── Berechnen ──
    function calculate() {
        const cidr = cidrInput.value.trim();
        const m = cidr.match(/^(.+?)\/(\d+)$/);
        if (!m) {
            results.innerHTML = `<p class="ps-error">❌ Präfix im Format "Adresse/Länge" eingeben</p>`;
            return;
        }
        const [, addr, lenStr] = m;
        const parentLen = parseInt(lenStr, 10);

        if (!isValidIPv6(addr)) {
            results.innerHTML = `<p class="ps-error">❌ Ungültige IPv6-Adresse</p>`;
            return;
        }

        // Bits ermitteln
        let addBits;
        if (currentMode === 'bits') {
            addBits = parseInt(bitsSlider.value, 10);
        } else {
            const needed = parseInt(countInput.value, 10);
            if (!needed || needed < 1) {
                results.innerHTML = `<p class="ps-error">❌ Ungültige Subnetzanzahl</p>`;
                return;
            }
            addBits = Math.ceil(Math.log2(nextPowerOf2(needed)));
            if (addBits < 1) addBits = 1;
        }

        const newLen = parentLen + addBits;
        if (newLen > 128) {
            results.innerHTML = `<p class="ps-error">❌ Resultierende Präfixlänge /${newLen} > /128 nicht möglich</p>`;
            return;
        }

        let data;
        try {
            data = listSubnets(cidr, addBits, 5);
        } catch (e) {
            results.innerHTML = `<p class="ps-error">❌ Fehler: ${escHtml(e.message)}</p>`;
            return;
        }

        const nibbleOk = isNibbleBoundary(newLen);
        const countStr = data.total <= 9999n
            ? data.total.toString()
            : `2<sup>${addBits}</sup> (${data.total.toLocaleString('de-DE')})`;

        const subnetItems = data.subnets.map((s, i) =>
            `<div class="ps-subnet-item">
        <span class="ps-subnet-idx">${i}</span>
        <code class="ps-subnet-cidr">${escHtml(s.cidr)}</code>
        <button class="ps-copy-cidr" data-cidr="${escHtml(s.cidr)}" title="Kopieren" aria-label="Kopieren">⎘</button>
      </div>`
        ).join('');

        const lastItem = data.last
            ? `<div class="ps-subnet-separator">⋮ noch ${data.total - BigInt(data.subnets.length) - 1n} weitere ⋮</div>
         <div class="ps-subnet-item ps-subnet-last">
           <span class="ps-subnet-idx">${data.total - 1n}</span>
           <code class="ps-subnet-cidr">${escHtml(data.last.cidr)}</code>
           <button class="ps-copy-cidr" data-cidr="${escHtml(data.last.cidr)}" title="Kopieren" aria-label="Kopieren">⎘</button>
         </div>`
            : '';

        results.innerHTML = `
      <div class="ps-summary">
        <div class="ps-summary-item">
          <span class="ps-summary-label">Ausgangspräfix</span>
          <code class="ps-summary-val">/${parentLen}</code>
        </div>
        <span class="ps-summary-arrow">→</span>
        <div class="ps-summary-item">
          <span class="ps-summary-label">Neue Länge</span>
          <code class="ps-summary-val ps-highlight">/${newLen}</code>
        </div>
        <div class="ps-summary-item">
          <span class="ps-summary-label">Subnetze</span>
          <code class="ps-summary-val">${countStr}</code>
        </div>
        <div class="ps-summary-item">
          <span class="ps-summary-label">+Bits</span>
          <code class="ps-summary-val">+${addBits}</code>
        </div>
      </div>

      ${!nibbleOk
                ? `<div class="ps-warn">⚠️ /${newLen} ist keine Nibble-Grenze (kein Vielfaches von 4). In der Praxis sind /48, /52, /56, /60, /64 bevorzugt.</div>`
                : `<div class="ps-ok">✅ Nibble-konforme Präfixlänge (/${newLen} ist ein Vielfaches von 4)</div>`
            }

      <div class="ps-subnet-list">
        <div class="ps-subnet-list-header">Subnetze (Index / CIDR)</div>
        ${subnetItems}
        ${lastItem}
      </div>`;

        // Copy-Buttons
        results.querySelectorAll('.ps-copy-cidr').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.cidr).then(() => {
                    btn.textContent = '✓';
                    setTimeout(() => { btn.textContent = '⎘'; }, 1400);
                }).catch(() => { });
            });
        });
    }

    calcBtn.addEventListener('click', calculate);
    cidrInput.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
    bitsSlider.addEventListener('change', calculate);

    // Initial
    calculate();
    return root;
}
