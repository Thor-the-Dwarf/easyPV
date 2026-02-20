/**
 * prefix-calculator.js
 * Zweck:  Erstellt ein interaktives Prefix-Rechner-Widget (DOM-Element).
 *         Liefert Adressanzahl fuer /x und optional Subnetzanzahl bei /alt -> /neu.
 * Input:  initialPrefixAlt (number), optional initialPrefixNeu (number|null)
 * Output: HTMLElement (mountbar via slotTool)
 */

import { addressCountForPrefix, subnetCountBetween } from './ipv6.js';

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
 * Erstellt das Prefix-Rechner-Widget.
 * @param   {number} [initialPrefixAlt=48]
 * @param   {number|null} [initialPrefixNeu=null]
 * @returns {HTMLElement}
 */
export function createPrefixCalculator(initialPrefixAlt = 48, initialPrefixNeu = null) {
    const root = document.createElement('div');
    root.className = 'pc-widget';

    root.innerHTML = `
    <div class="pc-input-section">
      <label class="pc-label" for="pc-prefix-alt">prefixAlt</label>
      <input class="pc-number-input" id="pc-prefix-alt" type="number" min="0" max="128" step="1"
             value="${initialPrefixAlt}" />

      <label class="pc-label" for="pc-prefix-neu">prefixNeu (optional)</label>
      <input class="pc-number-input" id="pc-prefix-neu" type="number" min="0" max="128" step="1"
             value="${initialPrefixNeu ?? ''}" placeholder="z. B. 56" />

      <button class="btn btn-primary pc-calc-btn pc-full-btn">Berechnen</button>
    </div>

    <div class="pc-results" aria-live="polite"></div>`;

    const altInput = root.querySelector('#pc-prefix-alt');
    const neuInput = root.querySelector('#pc-prefix-neu');
    const calcBtn = root.querySelector('.pc-calc-btn');
    const results = root.querySelector('.pc-results');

    function renderError(msg) {
        results.innerHTML = `<p class="pc-error">❌ ${escHtml(msg)}</p>`;
    }

    function calculate() {
        const alt = Number.parseInt(altInput.value, 10);
        if (Number.isNaN(alt) || alt < 0 || alt > 128) {
            renderError('prefixAlt muss zwischen 0 und 128 liegen.');
            return;
        }

        let addresses;
        try {
            addresses = addressCountForPrefix(alt);
        } catch (err) {
            renderError(err.message);
            return;
        }

        const neuRaw = neuInput.value.trim();
        const hasNeu = neuRaw.length > 0;

        let subnetCount = null;
        let neu = null;
        if (hasNeu) {
            neu = Number.parseInt(neuRaw, 10);
            if (Number.isNaN(neu) || neu < 0 || neu > 128) {
                renderError('prefixNeu muss zwischen 0 und 128 liegen, wenn gesetzt.');
                return;
            }
            try {
                subnetCount = subnetCountBetween(alt, neu);
            } catch (err) {
                renderError(err.message);
                return;
            }
        }

        const addressesExp = 128 - alt;
        const subnetExp = hasNeu ? neu - alt : null;

        results.innerHTML = `
      <div class="pc-result-grid">
        <div class="pc-result-item">
          <span class="pc-result-label">adressenImPraefix</span>
          <code class="pc-result-value">${formatBigInt(addresses)}</code>
          <span class="pc-result-formula">2^${addressesExp}</span>
        </div>
        ${hasNeu ? `
          <div class="pc-result-item">
            <span class="pc-result-label">anzahlSubnetze</span>
            <code class="pc-result-value">${formatBigInt(subnetCount)}</code>
            <span class="pc-result-formula">2^(${subnetExp}) bei /${alt} → /${neu}</span>
          </div>` : `
          <div class="pc-result-item pc-result-hint">
            <span class="pc-result-label">anzahlSubnetze</span>
            <span class="pc-hint-text">Setze prefixNeu, um /alt → /neu zu berechnen.</span>
          </div>`}
      </div>`;
    }

    calcBtn.addEventListener('click', calculate);
    altInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
    neuInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
    altInput.addEventListener('change', calculate);
    neuInput.addEventListener('change', calculate);

    calculate();
    return root;
}

