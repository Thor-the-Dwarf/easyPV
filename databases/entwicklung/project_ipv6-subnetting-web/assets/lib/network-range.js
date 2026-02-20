/**
 * network-range.js
 * Zweck:  Erstellt ein interaktives Netzadresse-&-Range-Widget (DOM-Element).
 *         Liefert netzadresse, ersteAdresseImPraefix, letzteAdresseImPraefix.
 * Input:  initialAddress (string), initialPrefix (number)
 * Output: HTMLElement (mountbar via slotTool)
 */

import { compress, isValidIPv6, prefixRange } from './ipv6.js';

function escHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Erstellt das Netzadresse-&-Range-Widget.
 * @param   {string} [initialAddress='2001:db8::1234']
 * @param   {number} [initialPrefix=64]
 * @returns {HTMLElement}
 */
export function createNetworkRange(initialAddress = '2001:db8::1234', initialPrefix = 64) {
    const root = document.createElement('div');
    root.className = 'nr-widget';

    root.innerHTML = `
    <div class="nr-input-section">
      <label class="nr-label" for="nr-address">adresse</label>
      <input class="nr-text-input" id="nr-address" type="text"
             value="${initialAddress}" placeholder="z. B. 2001:db8::1234"
             spellcheck="false" autocomplete="off" />

      <label class="nr-label" for="nr-prefix">prefix</label>
      <input class="nr-number-input" id="nr-prefix" type="number" min="0" max="128" step="1"
             value="${initialPrefix}" />

      <button class="btn btn-primary nr-calc-btn nr-full-btn">Berechnen</button>
    </div>

    <div class="nr-results" aria-live="polite"></div>`;

    const addressInput = root.querySelector('#nr-address');
    const prefixInput = root.querySelector('#nr-prefix');
    const calcBtn = root.querySelector('.nr-calc-btn');
    const results = root.querySelector('.nr-results');

    function renderError(msg) {
        results.innerHTML = `<p class="nr-error">❌ ${escHtml(msg)}</p>`;
    }

    function calculate() {
        const address = addressInput.value.trim();
        const prefix = Number.parseInt(prefixInput.value, 10);

        if (!isValidIPv6(address)) {
            renderError('adresse muss eine gültige IPv6-Adresse sein.');
            return;
        }
        if (Number.isNaN(prefix) || prefix < 0 || prefix > 128) {
            renderError('prefix muss zwischen 0 und 128 liegen.');
            return;
        }

        let range;
        try {
            range = prefixRange(address, prefix);
        } catch (err) {
            renderError(err.message);
            return;
        }

        const netzadresse = compress(range.network);
        const ersteAdresseImPraefix = compress(range.first);
        const letzteAdresseImPraefix = compress(range.last);

        results.innerHTML = `
      <div class="nr-result-grid">
        <div class="nr-result-item">
          <span class="nr-result-label">netzadresse</span>
          <code class="nr-result-value">${escHtml(netzadresse)}</code>
          <span class="nr-result-meta">/${prefix}</span>
        </div>
        <div class="nr-result-item">
          <span class="nr-result-label">ersteAdresseImPraefix</span>
          <code class="nr-result-value">${escHtml(ersteAdresseImPraefix)}</code>
          <span class="nr-result-meta">Bei IPv6 identisch zur Netzadresse.</span>
        </div>
        <div class="nr-result-item">
          <span class="nr-result-label">letzteAdresseImPraefix</span>
          <code class="nr-result-value">${escHtml(letzteAdresseImPraefix)}</code>
          <span class="nr-result-meta">Höchste Adresse innerhalb /${prefix}.</span>
        </div>
      </div>`;
    }

    calcBtn.addEventListener('click', calculate);
    addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
    prefixInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
    addressInput.addEventListener('change', calculate);
    prefixInput.addEventListener('change', calculate);

    calculate();
    return root;
}

