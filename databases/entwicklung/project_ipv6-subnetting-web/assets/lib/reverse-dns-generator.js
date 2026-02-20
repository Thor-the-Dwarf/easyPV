/**
 * reverse-dns-generator.js
 * Zweck:  Erstellt ein interaktives Reverse-DNS-Widget (DOM-Element).
 *         Erzeugt ip6.arpa Full-Domain und optional Cut bis Prefix.
 * Input:  initialAdresse (string), optional initialPrefix (number|null)
 * Output: HTMLElement (mountbar via slotTool)
 */

import { reverseDnsIp6Arpa } from './ipv6.js';

function escHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Erstellt das Reverse-DNS-Generator-Widget.
 * @param   {string} [initialAdresse='2001:db8::1']
 * @param   {number|null} [initialPrefix=null]
 * @returns {HTMLElement}
 */
export function createReverseDnsGenerator(initialAdresse = '2001:db8::1', initialPrefix = null) {
    const root = document.createElement('div');
    root.className = 'rdg-widget';

    root.innerHTML = `
    <div class="rdg-input-section">
      <label class="rdg-label" for="rdg-address">adresse</label>
      <input class="rdg-text-input" id="rdg-address" type="text"
             value="${initialAdresse}" placeholder="z. B. 2001:db8::1"
             spellcheck="false" autocomplete="off" />

      <label class="rdg-label" for="rdg-prefix">prefix (optional)</label>
      <input class="rdg-number-input" id="rdg-prefix" type="number" min="0" max="128" step="1"
             value="${initialPrefix ?? ''}" placeholder="z. B. 48" />

      <button class="btn btn-primary rdg-calc-btn rdg-full-btn">Generieren</button>
    </div>

    <div class="rdg-results" aria-live="polite"></div>`;

    const addressInput = root.querySelector('#rdg-address');
    const prefixInput = root.querySelector('#rdg-prefix');
    const calcBtn = root.querySelector('.rdg-calc-btn');
    const results = root.querySelector('.rdg-results');

    function renderError(msg) {
        results.innerHTML = `<p class="rdg-error">❌ ${escHtml(msg)}</p>`;
    }

    function wireCopyButtons() {
        results.querySelectorAll('.rdg-copy-btn').forEach((btn) => {
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
        const adresse = addressInput.value.trim();
        const prefixRaw = prefixInput.value.trim();
        const prefix = prefixRaw === '' ? null : Number.parseInt(prefixRaw, 10);

        if (!adresse) {
            renderError('adresse darf nicht leer sein.');
            return;
        }
        if (prefixRaw !== '' && (Number.isNaN(prefix) || prefix < 0 || prefix > 128)) {
            renderError('prefix muss eine ganze Zahl von 0 bis 128 sein.');
            return;
        }

        let data;
        try {
            data = reverseDnsIp6Arpa(adresse, prefix);
        } catch (err) {
            renderError(err.message);
            return;
        }

        const hasCut = data.ip6ArpaBisPrefix !== null;
        const warnNonNibble = hasCut && prefix % 4 !== 0;
        const cutLabel = hasCut ? data.ip6ArpaBisPrefix : 'n/a (prefix nicht gesetzt)';

        results.innerHTML = `
      <div class="rdg-result-item">
        <span class="rdg-result-label">ip6ArpaFull</span>
        <code class="rdg-result-value">${escHtml(data.ip6ArpaFull)}</code>
        <button class="rdg-copy-btn" data-copy="${escHtml(data.ip6ArpaFull)}" title="Kopieren" aria-label="Kopieren">⎘</button>
      </div>

      <div class="rdg-result-item">
        <span class="rdg-result-label">ip6ArpaBisPrefix</span>
        <code class="rdg-result-value">${escHtml(cutLabel)}</code>
        ${hasCut ? `<button class="rdg-copy-btn" data-copy="${escHtml(data.ip6ArpaBisPrefix)}" title="Kopieren" aria-label="Kopieren">⎘</button>` : ''}
      </div>

      ${warnNonNibble ? `<div class="rdg-warn">⚠️ prefix /${prefix} ist keine Nibble-Grenze. Delegations-Cut erfolgt auf /${data.effectivePrefix}.</div>` : ''}
    `;

        wireCopyButtons();
    }

    calcBtn.addEventListener('click', calculate);
    [addressInput, prefixInput].forEach((el) => {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
        el.addEventListener('change', calculate);
    });

    calculate();
    return root;
}

