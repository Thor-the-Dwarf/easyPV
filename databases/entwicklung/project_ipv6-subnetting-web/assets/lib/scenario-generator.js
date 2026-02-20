/**
 * scenario-generator.js
 * Zweck:  Erstellt reproduzierbare IPv6-Planungsszenarien (WP09).
 *         Seed → gleiche Aufgabe per URL teilbar.
 *         Checker validiert Präfix-Hierarchie und Größen.
 * Input:  Seed-Zahl (aus URL-Parameter oder zufällig)
 * Output: HTMLElement (mountbar via slotTool)
 *
 * Beispiel:
 *   import { createScenarioGenerator } from './scenario-generator.js';
 *   document.body.appendChild(createScenarioGenerator());
 */

import { subprefix, compress, isNibbleBoundary, subnetCount } from './ipv6.js';

// ─── Seeded RNG (LCG) ────────────────────────────────────────────────────────

function createRNG(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

// ─── Szenario-Generator ───────────────────────────────────────────────────────

function generateScenario(seed) {
    const rng = createRNG(seed);
    const hexA = randInt(rng, 0, 0xfffe).toString(16).padStart(4, '0');
    const hexB = randInt(rng, 0, 0xfffe).toString(16).padStart(4, '0');
    const hexC = randInt(rng, 0, 0xfffe).toString(16).padStart(4, '0');
    const parent = `2001:${hexA}:${hexB}::/48`;

    const sites = randInt(rng, 2, 12);
    const vlans = randInt(rng, 4, 20);

    const siteBits = Math.ceil(Math.log2(sites + 1));  // +1 Reserve
    const vlanBits = Math.ceil(Math.log2(vlans + 1));
    const sitePfxLen = 48 + siteBits;
    const vlanPfxLen = sitePfxLen + vlanBits;

    // Musterlösung: erste 3 Standort-Subnetze mit je erstem VLAN
    const siteExamples = [];
    for (let i = 0; i < Math.min(sites, 3); i++) {
        const site = subprefix(parent, siteBits, i);
        const vlan = subprefix(site.cidr, vlanBits, 0);
        siteExamples.push({ site, vlan });
    }

    return { seed, parent, sites, vlans, siteBits, vlanBits, sitePfxLen, vlanPfxLen, siteExamples };
}

// ─── Validierung ──────────────────────────────────────────────────────────────

function validateUserPlan(scenario, userSiteLen, userVlanLen) {
    const errors = [];
    const { sites, vlans, siteBits, vlanBits, sitePfxLen, vlanPfxLen } = scenario;

    if (isNaN(userSiteLen) || userSiteLen < 1 || userSiteLen > 128)
        return [{ type: 'error', msg: 'Ungültige Standort-Präfixlänge.' }];
    if (isNaN(userVlanLen) || userVlanLen < 1 || userVlanLen > 128)
        return [{ type: 'error', msg: 'Ungültige VLAN-Präfixlänge.' }];

    const userSiteBits = userSiteLen - 48;
    const userVlanBits = userVlanLen - userSiteLen;
    const siteCapacity = userSiteBits >= 0 ? (1 << userSiteBits) : 0;
    const vlanCapacity = userVlanBits >= 0 ? (1 << userVlanBits) : 0;

    if (userSiteLen <= 48)
        errors.push({ type: 'error', msg: `Standort-Präfix muss länger als /48 sein (dein Wert: /${userSiteLen}).` });
    if (userVlanLen <= userSiteLen)
        errors.push({ type: 'error', msg: `VLAN-Präfix (/${userVlanLen}) muss länger als Standort-Präfix (/${userSiteLen}) sein.` });
    if (userVlanLen > 64)
        errors.push({ type: 'warn', msg: `VLAN-Präfix /${userVlanLen} > /64 – die Interface-ID könnte knapp werden.` });
    if (siteCapacity < sites)
        errors.push({ type: 'error', msg: `/${userSiteLen} bietet nur ${siteCapacity} Standorte, du brauchst ${sites}.` });
    if (vlanCapacity < vlans)
        errors.push({ type: 'error', msg: `/${userVlanLen} bietet nur ${vlanCapacity} VLANs je Standort, du brauchst ${vlans}.` });
    if (!isNibbleBoundary(userSiteLen))
        errors.push({ type: 'warn', msg: `/${userSiteLen} ist keine Nibble-Grenze (Vielfaches von 4). Empfohlen: /${Math.ceil(userSiteLen / 4) * 4}.` });
    if (!isNibbleBoundary(userVlanLen))
        errors.push({ type: 'warn', msg: `/${userVlanLen} ist keine Nibble-Grenze. Empfohlen: /${Math.ceil(userVlanLen / 4) * 4}.` });

    if (errors.length === 0) {
        errors.push({
            type: 'ok',
            msg: `✅ Korrekt! /${userSiteLen} gibt ${siteCapacity} Standorte (Reserve: ${siteCapacity - sites}), /${userVlanLen} gibt ${vlanCapacity} VLANs.`
        });
    }

    return errors;
}

// ─── Widget erstellen ─────────────────────────────────────────────────────────

/**
 * @param {number|null} [initialSeed]  - null = zufällig
 * @returns {HTMLElement}
 */
export function createScenarioGenerator(initialSeed = null) {
    const randomSeed = () => Math.floor(Math.random() * 99999) + 1;
    let seed = initialSeed ?? (parseInt(new URLSearchParams(location.search).get('seed'), 10) || randomSeed());

    let scenario = generateScenario(seed);
    let solutionVisible = false;

    const root = document.createElement('div');
    root.className = 'sg-widget';

    function render() {
        const { parent, sites, vlans, sitePfxLen, vlanPfxLen, siteExamples } = scenario;

        root.innerHTML = `
      <div class="sg-seed-row">
        <label class="sg-label" for="sg-seed-input">Seed</label>
        <input class="sg-seed-input" id="sg-seed-input" type="number" min="1" max="99999" value="${seed}" />
        <button class="sg-new-btn btn btn-ghost">🎲 Neu</button>
      </div>

      <div class="sg-scenario-box">
        <div class="sg-scenario-title">📋 Szenario</div>
        <div class="sg-scenario-row"><span>Ausgangspräfix</span><code>${parent}</code></div>
        <div class="sg-scenario-row"><span>Standorte</span><code>${sites}</code></div>
        <div class="sg-scenario-row"><span>VLANs/Standort</span><code>${vlans}</code></div>
      </div>

      <div class="sg-task-box">
        <div class="sg-task-text">
          Plane die Aufteilung des Präfixes <code>${parent}</code> auf
          <strong>${sites} Standorte</strong> mit je <strong>${vlans} VLANs</strong>.
          Wähle geeignete Präfixlängen.
        </div>
        <div class="sg-input-grid">
          <label class="sg-label" for="sg-site-len">Standort-Präfixlänge</label>
          <div class="sg-input-row">
            <span class="sg-slash">/</span>
            <input class="sg-len-input" id="sg-site-len" type="number" min="49" max="124" placeholder="z. B. 56" />
          </div>
          <label class="sg-label" for="sg-vlan-len">VLAN-Präfixlänge</label>
          <div class="sg-input-row">
            <span class="sg-slash">/</span>
            <input class="sg-len-input" id="sg-vlan-len" type="number" min="50" max="128" placeholder="z. B. 64" />
          </div>
        </div>
        <div class="sg-btn-row">
          <button class="btn btn-primary sg-check-btn">Prüfen</button>
          <button class="btn btn-ghost sg-solution-btn">Musterlösung</button>
        </div>
        <div class="sg-feedback" aria-live="polite" hidden></div>
        <div class="sg-solution" hidden>
          <div class="sg-solution-title">Musterlösung</div>
          <div class="sg-solution-row"><span>Standort-Präfixlänge</span><code>/${sitePfxLen} (${sites} Standorte benötigen +${sitePfxLen - 48} Bits → ${1 << (sitePfxLen - 48)} Slots)</code></div>
          <div class="sg-solution-row"><span>VLAN-Präfixlänge</span><code>/${vlanPfxLen} (${vlans} VLANs benötigen +${vlanPfxLen - sitePfxLen} Bits → ${1 << (vlanPfxLen - sitePfxLen)} Slots)</code></div>
          <div class="sg-solution-title" style="margin-top:8px">Erste Subnetze</div>
          ${siteExamples.map((ex, i) => `
            <div class="sg-solution-row"><span>Standort ${i}</span><code>${ex.site.cidr}</code></div>
            <div class="sg-solution-row sg-vlan-row"><span>↳ VLAN 0</span><code>${ex.vlan.cidr}</code></div>`).join('')}
        </div>
      </div>`;

        // ── Events verdrahten ──
        const seedInput = root.querySelector('.sg-seed-input');
        const newBtn = root.querySelector('.sg-new-btn');
        const checkBtn = root.querySelector('.sg-check-btn');
        const solBtn = root.querySelector('.sg-solution-btn');
        const feedback = root.querySelector('.sg-feedback');
        const solution = root.querySelector('.sg-solution');

        newBtn.addEventListener('click', () => {
            seed = randomSeed();
            scenario = generateScenario(seed);
            solutionVisible = false;
            // URL updaten (kein History-Eintrag)
            history.replaceState(null, '', `?seed=${seed}${location.hash}`);
            render();
        });

        seedInput.addEventListener('change', () => {
            const v = parseInt(seedInput.value, 10);
            if (v > 0) { seed = v; scenario = generateScenario(seed); solutionVisible = false; render(); }
        });

        checkBtn.addEventListener('click', () => {
            const sLen = parseInt(root.querySelector('#sg-site-len').value, 10);
            const vLen = parseInt(root.querySelector('#sg-vlan-len').value, 10);
            const results = validateUserPlan(scenario, sLen, vLen);

            feedback.removeAttribute('hidden');
            feedback.innerHTML = results.map(r => `
        <div class="sg-fb-item sg-fb-${r.type}">${r.msg}</div>`).join('');
        });

        solBtn.addEventListener('click', () => {
            solutionVisible = !solutionVisible;
            solution.hidden = !solutionVisible;
            solBtn.textContent = solutionVisible ? 'Musterlösung verbergen' : 'Musterlösung';
        });
    }

    render();
    return root;
}
