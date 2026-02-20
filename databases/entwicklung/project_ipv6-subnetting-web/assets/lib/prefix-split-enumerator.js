/**
 * prefix-split-enumerator.js
 * Zweck:  Erstellt ein interaktives Präfix-Split-Widget (DOM-Element).
 *         Teilt basisPraefix auf zielPrefix und zeigt ein Subnetz-Fenster.
 * Input:  initialBasisPraefix (string), initialZielPrefix (number)
 * Output: HTMLElement (mountbar via slotTool)
 */

import { enumerateSubprefixes } from './ipv6.js';

function escHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatBigInt(n) {
    return n.toLocaleString('de-DE');
}

/**
 * Erstellt das Präfix-Split-Enumerator-Widget.
 * @param   {string} [initialBasisPraefix='2001:db8::/48']
 * @param   {number} [initialZielPrefix=56]
 * @returns {HTMLElement}
 */
export function createPrefixSplitEnumerator(initialBasisPraefix = '2001:db8::/48', initialZielPrefix = 56) {
    const root = document.createElement('div');
    root.className = 'pse-widget';

    root.innerHTML = `
    <div class="pse-input-section">
      <label class="pse-label" for="pse-basis">basisPraefix</label>
      <input class="pse-text-input" id="pse-basis" type="text"
             value="${initialBasisPraefix}" placeholder="z. B. 2001:db8::/48"
             spellcheck="false" autocomplete="off" />

      <label class="pse-label" for="pse-ziel">zielPrefix</label>
      <input class="pse-number-input" id="pse-ziel" type="number" min="0" max="128" step="1"
             value="${initialZielPrefix}" />

      <div class="pse-row-two">
        <div>
          <label class="pse-label" for="pse-offset">offset (optional)</label>
          <input class="pse-number-input" id="pse-offset" type="number" min="0" step="1" value="0" />
        </div>
        <div>
          <label class="pse-label" for="pse-limit">limit (optional)</label>
          <input class="pse-number-input" id="pse-limit" type="number" min="1" max="256" step="1" value="16" />
        </div>
      </div>

      <button class="btn btn-primary pse-calc-btn pse-full-btn">Berechnen</button>
    </div>

    <div class="pse-results" aria-live="polite"></div>`;

    const basisInput = root.querySelector('#pse-basis');
    const zielInput = root.querySelector('#pse-ziel');
    const offsetInput = root.querySelector('#pse-offset');
    const limitInput = root.querySelector('#pse-limit');
    const calcBtn = root.querySelector('.pse-calc-btn');
    const results = root.querySelector('.pse-results');

    function renderError(msg) {
        results.innerHTML = `<p class="pse-error">❌ ${escHtml(msg)}</p>`;
    }

    function copy(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = '⎘'; }, 1200);
        }).catch(() => { });
    }

    function calculate() {
        const basisPraefix = basisInput.value.trim();
        const zielPrefix = Number.parseInt(zielInput.value, 10);
        const offsetRaw = offsetInput.value.trim();
        const limitRaw = limitInput.value.trim();

        const offset = offsetRaw === '' ? 0 : Number.parseInt(offsetRaw, 10);
        const limit = limitRaw === '' ? 16 : Number.parseInt(limitRaw, 10);

        if (Number.isNaN(zielPrefix)) {
            renderError('zielPrefix muss gesetzt sein.');
            return;
        }
        if (Number.isNaN(offset) || offset < 0) {
            renderError('offset muss >= 0 sein.');
            return;
        }
        if (Number.isNaN(limit) || limit < 1 || limit > 256) {
            renderError('limit muss zwischen 1 und 256 liegen.');
            return;
        }

        let data;
        try {
            data = enumerateSubprefixes(basisPraefix, zielPrefix, offset, limit);
        } catch (err) {
            renderError(err.message);
            return;
        }

        const total = data.total;
        const windowStart = data.subnets.length > 0 ? data.subnets[0].index : BigInt(offset);
        const windowEnd = data.subnets.length > 0 ? data.subnets[data.subnets.length - 1].index : BigInt(offset) - 1n;

        const list = data.subnets.map((s) => `
          <div class="pse-subnet-item">
            <span class="pse-subnet-idx">${s.index}</span>
            <code class="pse-subnet-cidr">${escHtml(s.cidr)}</code>
            <button class="pse-copy-cidr" data-cidr="${escHtml(s.cidr)}" title="Kopieren" aria-label="Kopieren">⎘</button>
          </div>
        `).join('');

        results.innerHTML = `
      <div class="pse-summary-grid">
        <div class="pse-summary-item">
          <span class="pse-summary-label">anzahlSubnetzeGesamt</span>
          <code class="pse-summary-value">${formatBigInt(total)}</code>
        </div>
        <div class="pse-summary-item">
          <span class="pse-summary-label">Fenster</span>
          <code class="pse-summary-value">${windowStart} .. ${windowEnd}</code>
        </div>
      </div>

      ${data.subnets.length === 0 ? `
        <div class="pse-empty">Keine Subnetze im angeforderten Fenster (offset liegt hinter dem Ende).</div>
      ` : `
        <div class="pse-subnet-list">
          <div class="pse-subnet-list-header">subnetze[] (Index / Präfix)</div>
          ${list}
        </div>
      `}
    `;

        results.querySelectorAll('.pse-copy-cidr').forEach((btn) => {
            btn.addEventListener('click', () => copy(btn.dataset.cidr, btn));
        });
    }

    calcBtn.addEventListener('click', calculate);
    [basisInput, zielInput, offsetInput, limitInput].forEach((el) => {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
        el.addEventListener('change', calculate);
    });

    calculate();
    return root;
}

