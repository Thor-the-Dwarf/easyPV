/**
 * next-previous-network.js
 * Zweck:  Erstellt ein interaktives Next/Previous-Network-Widget (DOM-Element).
 *         Berechnet nächstes/vorheriges Netz gleicher Präfixlänge.
 * Input:  initialPraefix (string), initialSteps (number)
 * Output: HTMLElement (mountbar via slotTool)
 */

import { nextPreviousNetwork } from './ipv6.js';

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
 * Erstellt das Next/Previous-Network-Widget.
 * @param   {string} [initialPraefix='2001:db8::/64']
 * @param   {number} [initialSteps=1]
 * @returns {HTMLElement}
 */
export function createNextPreviousNetwork(initialPraefix = '2001:db8::/64', initialSteps = 1) {
    const root = document.createElement('div');
    root.className = 'npn-widget';

    root.innerHTML = `
    <div class="npn-input-section">
      <label class="npn-label" for="npn-prefix">praefix</label>
      <input class="npn-text-input" id="npn-prefix" type="text"
             value="${initialPraefix}" placeholder="z. B. 2001:db8::/64"
             spellcheck="false" autocomplete="off" />

      <label class="npn-label" for="npn-steps">steps (optional)</label>
      <input class="npn-number-input" id="npn-steps" type="number" min="1" step="1" value="${initialSteps}" />

      <button class="btn btn-primary npn-calc-btn npn-full-btn">Berechnen</button>
    </div>

    <div class="npn-results" aria-live="polite"></div>`;

    const prefixInput = root.querySelector('#npn-prefix');
    const stepsInput = root.querySelector('#npn-steps');
    const calcBtn = root.querySelector('.npn-calc-btn');
    const results = root.querySelector('.npn-results');

    function renderError(msg) {
        results.innerHTML = `<p class="npn-error">❌ ${escHtml(msg)}</p>`;
    }

    function wireCopyButtons() {
        results.querySelectorAll('.npn-copy-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const text = btn.dataset.copy || '';
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = '✓';
                    setTimeout(() => { btn.textContent = '⎘'; }, 1200);
                }).catch(() => { });
            });
        });
    }

    function calculate() {
        const praefix = prefixInput.value.trim();
        const stepsRaw = stepsInput.value.trim();
        const steps = stepsRaw === '' ? 1 : Number.parseInt(stepsRaw, 10);

        if (Number.isNaN(steps) || steps < 1) {
            renderError('steps muss eine ganze Zahl >= 1 sein.');
            return;
        }

        let data;
        try {
            data = nextPreviousNetwork(praefix, steps);
        } catch (err) {
            renderError(err.message);
            return;
        }

        const blockPower = 128 - data.prefixLen;
        results.innerHTML = `
      <div class="npn-summary-grid">
        <div class="npn-summary-item">
          <span class="npn-summary-label">basePraefix</span>
          <code class="npn-summary-value">${escHtml(data.basePrefix)}</code>
          <button class="npn-copy-btn" data-copy="${escHtml(data.basePrefix)}" title="Kopieren" aria-label="Kopieren">⎘</button>
        </div>
        <div class="npn-summary-item">
          <span class="npn-summary-label">blockgroesse</span>
          <code class="npn-summary-value">${formatBigInt(data.blockSize)}</code>
          <span class="npn-summary-meta">2^${blockPower} Adressen pro Schritt</span>
        </div>
      </div>

      <div class="npn-summary-grid">
        <div class="npn-summary-item">
          <span class="npn-summary-label">nextPraefix</span>
          ${data.nextPrefix
                ? `<code class="npn-summary-value">${escHtml(data.nextPrefix)}</code>
               <button class="npn-copy-btn" data-copy="${escHtml(data.nextPrefix)}" title="Kopieren" aria-label="Kopieren">⎘</button>`
                : `<span class="npn-edge">Kein weiteres Netz in dieser Richtung (oberes Ende erreicht).</span>`
            }
        </div>
        <div class="npn-summary-item">
          <span class="npn-summary-label">previousPraefix</span>
          ${data.previousPrefix
                ? `<code class="npn-summary-value">${escHtml(data.previousPrefix)}</code>
               <button class="npn-copy-btn" data-copy="${escHtml(data.previousPrefix)}" title="Kopieren" aria-label="Kopieren">⎘</button>`
                : `<span class="npn-edge">Kein vorheriges Netz in dieser Richtung (unteres Ende erreicht).</span>`
            }
        </div>
      </div>
    `;

        wireCopyButtons();
    }

    calcBtn.addEventListener('click', calculate);
    [prefixInput, stepsInput].forEach((el) => {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
        el.addEventListener('change', calculate);
    });

    calculate();
    return root;
}

