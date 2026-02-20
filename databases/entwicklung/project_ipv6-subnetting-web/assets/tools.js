/**
 * tools.js
 * Zweck:  Tool-Registry – verbindet Tool-IDs aus lessons.json mit
 *         konkreten Widget-Implementierungen.
 *         Nach mountTools() ruft mountActualTools() slotTool() auf.
 * Input:  Array von Tool-IDs (aus sub.tools[])
 * Output: Gemountete DOM-Widgets im Tool-Panel
 *
 * Beispiel:
 *   import { mountActualTools } from './tools.js';
 *   mountActualTools(['prefix-visualizer', 'prefix-slicer']);
 */

import { slotTool } from './layout.js';
import { createPrefixVisualizer } from './lib/prefix-visualizer.js';
import { createPrefixSlicer } from './lib/prefix-slicer.js';
import { createScenarioGenerator } from './lib/scenario-generator.js';
import { createFehlerbilderWidget } from './lib/fehlerbilder.js';
import { createRADemo } from './lib/ra-demo.js';
import { createPrefixCalculator } from './lib/prefix-calculator.js';
import { createNetworkRange } from './lib/network-range.js';
import { createPrefixSplitEnumerator } from './lib/prefix-split-enumerator.js';
import { createNextPreviousNetwork } from './lib/next-previous-network.js';
import { createContainmentOverlapCheck } from './lib/containment-overlap-check.js';
import { createReverseDnsGenerator } from './lib/reverse-dns-generator.js';

// ─── Tool-Factory-Registry ────────────────────────────────────────────────────
// Neue Tools hier eintragen (WP09–WP11 erweitern diese Map).

const TOOL_FACTORIES = new Map([
    ['prefix-calculator', (ctx) => createPrefixCalculator(ctx?.prefixAlt ?? 48, ctx?.prefixNeu ?? null)],
    ['network-range', (ctx) => createNetworkRange(ctx?.rangeAddress ?? '2001:db8::1234', ctx?.rangePrefix ?? 64)],
    ['prefix-split-enumerator', (ctx) => createPrefixSplitEnumerator(ctx?.basisPraefix ?? '2001:db8::/48', ctx?.zielPrefix ?? 56)],
    ['next-previous-network', (ctx) => createNextPreviousNetwork(ctx?.praefix ?? '2001:db8::/64', ctx?.steps ?? 1)],
    ['containment-overlap-check', (ctx) => createContainmentOverlapCheck(ctx?.A ?? '2001:db8::42', ctx?.B ?? '2001:db8::/48')],
    ['reverse-dns-generator', (ctx) => createReverseDnsGenerator(ctx?.adresse ?? '2001:db8::1', ctx?.prefix ?? null)],
    ['prefix-visualizer', (ctx) => createPrefixVisualizer(ctx?.defaultCidr)],
    ['prefix-slicer', (ctx) => createPrefixSlicer(ctx?.defaultCidr)],
    ['scenario-generator', (ctx) => createScenarioGenerator(ctx?.seed ?? null)],
    ['fehlerbilder', () => createFehlerbilderWidget()],
    ['ra-demo', () => createRADemo()],
]);


// ─── Mount-Funktion ───────────────────────────────────────────────────────────

/**
 * Erstellt die echten Tool-Widgets und mountet sie in ihre Slots.
 * Muss nach mountTools() in layout.js aufgerufen werden.
 * @param {string[]} toolIds   - z. B. ['prefix-visualizer']
 * @param {object}   [context] - Optionaler Kontext (z. B. defaultCidr)
 */
export function mountActualTools(toolIds = [], context = {}) {
    toolIds.forEach(id => {
        const factory = TOOL_FACTORIES.get(id);
        if (!factory) return;  // noch nicht implementiert → Placeholder bleibt sichtbar
        try {
            const element = factory(context);
            slotTool(id, element);
        } catch (err) {
            console.error(`[tools] Fehler beim Mounten von "${id}":`, err);
        }
    });
}

/**
 * Gibt alle bekannten Tool-IDs zurück (für Debugging / Smoke-Check).
 * @returns {string[]}
 */
export function registeredToolIds() {
    return [...TOOL_FACTORIES.keys()];
}
