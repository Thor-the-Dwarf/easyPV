/**
 * containment-overlap-check.js
 * Zweck:  Erstellt ein interaktives Containment/Overlap-Widget (DOM-Element).
 *         Prüft A_in_B und bei Präfix-A zusätzlich overlap.
 * Input:  initialA (string), initialB (string)
 * Output: HTMLElement (mountbar via slotTool)
 */

import { containmentOverlapCheck } from './ipv6.js';

function escHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Erstellt das Containment/Overlap-Widget.
 * @param   {string} [initialA='2001:db8::42']
 * @param   {string} [initialB='2001:db8::/48']
 * @returns {HTMLElement}
 */
export function createContainmentOverlapCheck(initialA = '2001:db8::42', initialB = '2001:db8::/48') {
    const root = document.createElement('div');
    root.className = 'coc-widget';

    root.innerHTML = `
    <div class="coc-input-section">
      <label class="coc-label" for="coc-a">A (Adresse oder Präfix)</label>
      <input class="coc-text-input" id="coc-a" type="text"
             value="${initialA}" placeholder="z. B. 2001:db8::42 oder 2001:db8::/64"
             spellcheck="false" autocomplete="off" />

      <label class="coc-label" for="coc-b">B (Präfix)</label>
      <input class="coc-text-input" id="coc-b" type="text"
             value="${initialB}" placeholder="z. B. 2001:db8::/48"
             spellcheck="false" autocomplete="off" />

      <button class="btn btn-primary coc-calc-btn coc-full-btn">Prüfen</button>
    </div>

    <div class="coc-results" aria-live="polite"></div>`;

    const aInput = root.querySelector('#coc-a');
    const bInput = root.querySelector('#coc-b');
    const calcBtn = root.querySelector('.coc-calc-btn');
    const results = root.querySelector('.coc-results');

    function renderError(msg) {
        results.innerHTML = `<p class="coc-error">❌ ${escHtml(msg)}</p>`;
    }

    function calculate() {
        const A = aInput.value.trim();
        const B = bInput.value.trim();
        if (!A || !B) {
            renderError('A und B dürfen nicht leer sein.');
            return;
        }

        let data;
        try {
            data = containmentOverlapCheck(A, B);
        } catch (err) {
            renderError(err.message);
            return;
        }

        const aInBText = data.A_in_B ? 'true' : 'false';
        const overlapText = data.overlap === null ? 'n/a (A ist Adresse)' : (data.overlap ? 'true' : 'false');

        results.innerHTML = `
      <div class="coc-result-grid">
        <div class="coc-result-item">
          <span class="coc-result-label">A_in_B</span>
          <code class="coc-result-value">${aInBText}</code>
        </div>
        <div class="coc-result-item">
          <span class="coc-result-label">overlap</span>
          <code class="coc-result-value">${overlapText}</code>
        </div>
      </div>

      <div class="coc-meta">
        <span><strong>A-Typ:</strong> ${data.aType === 'prefix' ? 'Präfix' : 'Adresse'}</span>
        <span><strong>A:</strong> <code>${escHtml(data.A_normalized)}</code></span>
        <span><strong>B:</strong> <code>${escHtml(data.B_normalized)}</code></span>
      </div>`;
    }

    calcBtn.addEventListener('click', calculate);
    [aInput, bInput].forEach((el) => {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
        el.addEventListener('change', calculate);
    });

    calculate();
    return root;
}

