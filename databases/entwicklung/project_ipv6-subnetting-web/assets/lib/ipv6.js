/**
 * ipv6.js
 * Zweck:  Reine IPv6-Berechnungsfunktionen (kein DOM, kein State).
 *         Alle 128-Bit-Operationen nutzen BigInt – kein Float-Overflow möglich.
 * Input:  IPv6-Strings und Prefix-Längen
 * Output: Berechnete Adressen, Masken, Subnetze als Strings / BigInt / Objekte
 *
 * Beispiel:
 *   import * as ipv6 from './ipv6.js';
 *   ipv6.compress('2001:0db8:0000:0000:0000:0000:0000:0001'); // '2001:db8::1'
 *   ipv6.subprefix('2001:db8::/48', 8, 3).cidr;              // '2001:db8:0:300::/56'
 */

'use strict';

// ─── Interne Konstanten ───────────────────────────────────────────────────────
const ALL_ONES = (1n << 128n) - 1n;
const GROUPS = 8;

// ═══════════════════════════════════════════════════════════
// 1. expand – komprimiert → vollständig
// ═══════════════════════════════════════════════════════════

/**
 * Expandiert eine IPv6-Adresse in die Vollform (8 × 4 Hex-Zeichen).
 * @param   {string} addr  - z. B. '2001:db8::1' oder '::1'
 * @returns {string}         '2001:0db8:0000:0000:0000:0000:0000:0001'
 * @throws  {Error}          Bei ungültigem Format
 */
export function expand(addr) {
    if (typeof addr !== 'string') throw new TypeError('Adresse muss ein String sein');
    addr = addr.trim().toLowerCase();

    // Enthält :: ?
    if (addr.includes('::')) {
        const halves = addr.split('::');
        if (halves.length !== 2) throw new Error(`Ungültiges IPv6: "${addr}" (mehr als ein ::)`);
        const leftGroups = halves[0] ? halves[0].split(':') : [];
        const rightGroups = halves[1] ? halves[1].split(':') : [];
        const missing = GROUPS - leftGroups.length - rightGroups.length;
        if (missing < 0) throw new Error(`Ungültiges IPv6: "${addr}" (zu viele Gruppen)`);
        const full = [...leftGroups, ...Array(missing).fill('0'), ...rightGroups];
        return full.map(g => g.padStart(4, '0')).join(':');
    }

    // Einzelne Gruppen ohne ::
    const groups = addr.split(':');
    if (groups.length !== GROUPS) {
        throw new Error(`Ungültiges IPv6: "${addr}" (${groups.length} von 8 Gruppen)`);
    }
    return groups.map(g => g.padStart(4, '0')).join(':');
}

// ═══════════════════════════════════════════════════════════
// 2. compress – Vollform → kürzeste RFC-5952-Form
// ═══════════════════════════════════════════════════════════

/**
 * Komprimiert eine IPv6-Adresse (Vollform oder bereits komprimiert).
 * RFC 5952: längster zusammenhängender :: Block (≥ 2 Gruppen).
 * @param   {string} addr
 * @returns {string}
 */
export function compress(addr) {
    const full = expand(addr);
    const groups = full.split(':').map(g => parseInt(g, 16).toString(16)); // führende Nullen entfernen

    // Längsten Lauf aus Null-Gruppen finden (mind. 2 für ::)
    let bestStart = -1, bestLen = 0, i = 0;
    while (i < GROUPS) {
        if (groups[i] === '0') {
            let j = i;
            while (j < GROUPS && groups[j] === '0') j++;
            const len = j - i;
            if (len > bestLen) { bestLen = len; bestStart = i; }
            i = j;
        } else { i++; }
    }

    if (bestLen < 2) return groups.join(':');

    const before = groups.slice(0, bestStart).join(':');
    const after = groups.slice(bestStart + bestLen).join(':');
    return `${before}::${after}`;   // Ergibt ::, ::1, 2001:db8::, 2001:db8::1, …
}

// ═══════════════════════════════════════════════════════════
// 3. BigInt-Konvertierungen
// ═══════════════════════════════════════════════════════════

/**
 * Wandelt eine IPv6-Adresse in ein BigInt um.
 * @param   {string} addr
 * @returns {bigint}
 */
export function toBigInt(addr) {
    return expand(addr)
        .split(':')
        .reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
}

/**
 * Wandelt ein BigInt (128 Bit) in eine expandierte IPv6-Adresse (Vollform) um.
 * @param   {bigint} n
 * @returns {string}   immer in Vollform; für komprimierte Form compress() nutzen
 */
export function fromBigInt(n) {
    const groups = [];
    for (let i = 0; i < GROUPS; i++) {
        groups.unshift((n & 0xffffn).toString(16).padStart(4, '0'));
        n >>= 16n;
    }
    return groups.join(':');
}

// ═══════════════════════════════════════════════════════════
// 4. Präfix-Maske & Netzwerkadresse
// ═══════════════════════════════════════════════════════════

/**
 * Erstellt eine 128-Bit-Netzmaske für die angegebene Präfixlänge.
 * @param   {number} prefixLen  0–128
 * @returns {bigint}
 */
export function prefixMask(prefixLen) {
    if (prefixLen < 0 || prefixLen > 128) throw new RangeError(`Präfixlänge ${prefixLen} ungültig (0–128)`);
    if (prefixLen === 0) return 0n;
    if (prefixLen === 128) return ALL_ONES;
    return ALL_ONES ^ ((1n << BigInt(128 - prefixLen)) - 1n);
}

/**
 * Gibt die Netzwerkadresse (Host-Bits auf 0) für addr/prefixLen zurück (Vollform).
 * @param   {string} addr
 * @param   {number} prefixLen
 * @returns {string}  Vollform (8×4 hex)
 */
export function applyMask(addr, prefixLen) {
    return fromBigInt(toBigInt(addr) & prefixMask(prefixLen));
}

// ═══════════════════════════════════════════════════════════
// 5. Subnetting
// ═══════════════════════════════════════════════════════════

/**
 * Berechnet das index-te Kind-Subnetz.
 * @param   {string} parentCidr  - z. B. '2001:db8::/48'
 * @param   {number} addBits     - zusätzliche Bits (1–80)
 * @param   {number|bigint} index - 0-basierter Subnetz-Index
 * @returns {{ address: string, prefixLen: number, cidr: string, cidrFull: string }}
 *
 * Beispiel:
 *   subprefix('2001:db8::/48', 8, 3)
 *   // → { cidr: '2001:db8:0:300::/56', address: '2001:0db8:0000:0300:...', ... }
 */
export function subprefix(parentCidr, addBits, index) {
    const [addrPart, lenStr] = parentCidr.split('/');
    const parentLen = parseInt(lenStr, 10);
    const newLen = parentLen + addBits;
    const idxBig = BigInt(index);

    if (newLen > 128) throw new RangeError(`Resultierende Präfixlänge ${newLen} > 128`);
    if (addBits < 1) throw new RangeError('addBits muss ≥ 1 sein');
    if (idxBig >= (1n << BigInt(addBits))) {
        throw new RangeError(`Index ${index} überschreitet 2^${addBits} = ${2 ** addBits}`);
    }

    const parentNet = toBigInt(applyMask(addrPart, parentLen));
    const shift = BigInt(128 - parentLen - addBits);
    const childNet = parentNet | (idxBig << shift);
    const childAddr = fromBigInt(childNet);

    return {
        address: childAddr,
        prefixLen: newLen,
        cidr: `${compress(childAddr)}/${newLen}`,
        cidrFull: `${childAddr}/${newLen}`,
    };
}

/**
 * Gibt die letzte Adresse (höchste) in einem Präfix zurück (Vollform).
 * @param   {string} addr
 * @param   {number} prefixLen
 * @returns {string}
 */
export function prefixLastAddress(addr, prefixLen) {
    const net = toBigInt(applyMask(addr, prefixLen));
    const hostBits = BigInt(128 - prefixLen);
    return fromBigInt(net | ((1n << hostBits) - 1n));
}

/**
 * Liefert Netzwerk- und Range-Grenzen für addr/prefixLen (Vollform).
 * Hinweis: Bei IPv6 ist die erste Adresse identisch zur Netzadresse.
 * @param   {string} addr
 * @param   {number} prefixLen
 * @returns {{ network: string, first: string, last: string }}
 */
export function prefixRange(addr, prefixLen) {
    const network = applyMask(addr, prefixLen);
    const last = prefixLastAddress(addr, prefixLen);
    return { network, first: network, last };
}

/**
 * Anzahl der Kind-Subnetze bei gegebener Bit-Erweiterung (als BigInt).
 * @param   {number} addBits
 * @returns {bigint}  2^addBits
 */
export function subnetCount(addBits) {
    return 1n << BigInt(addBits);
}

/**
 * Anzahl der Adressen in einem IPv6-Präfix (als BigInt).
 * @param   {number} prefixLen  0–128
 * @returns {bigint}            2^(128-prefixLen)
 */
export function addressCountForPrefix(prefixLen) {
    if (prefixLen < 0 || prefixLen > 128) {
        throw new RangeError(`Präfixlänge ${prefixLen} ungültig (0–128)`);
    }
    return 1n << BigInt(128 - prefixLen);
}

/**
 * Anzahl der Subnetze für eine Präfix-Verfeinerung /alt -> /neu (als BigInt).
 * @param   {number} prefixAlt  0–128
 * @param   {number} prefixNeu  prefixNeu >= prefixAlt
 * @returns {bigint}            2^(prefixNeu-prefixAlt)
 */
export function subnetCountBetween(prefixAlt, prefixNeu) {
    if (prefixAlt < 0 || prefixAlt > 128) {
        throw new RangeError(`prefixAlt ${prefixAlt} ungültig (0–128)`);
    }
    if (prefixNeu < 0 || prefixNeu > 128) {
        throw new RangeError(`prefixNeu ${prefixNeu} ungültig (0–128)`);
    }
    if (prefixNeu < prefixAlt) {
        throw new RangeError(`prefixNeu /${prefixNeu} muss >= prefixAlt /${prefixAlt} sein`);
    }
    return 1n << BigInt(prefixNeu - prefixAlt);
}

// ═══════════════════════════════════════════════════════════
// 6. Validierung & Klassifizierung
// ═══════════════════════════════════════════════════════════

/**
 * Prüft ob ein IPv6-String syntaktisch gültig ist.
 * @param   {string} addr
 * @returns {boolean}
 */
export function isValidIPv6(addr) {
    try {
        const expanded = expand(addr);
        return expanded.split(':').every(g => /^[0-9a-f]{4}$/.test(g));
    } catch { return false; }
}

/**
 * Prüft ob prefixLen auf einer Nibble-Grenze (Vielfaches von 4) liegt.
 * @param   {number} prefixLen
 * @returns {boolean}
 */
export function isNibbleBoundary(prefixLen) {
    return prefixLen % 4 === 0;
}

/**
 * Gibt den RFC-Adresstyp einer IPv6-Adresse zurück.
 * @param   {string} addr
 * @returns {{ type: string, label: string }}
 */
export function getAddressType(addr) {
    const n = toBigInt(addr);
    if (n === 0n) return { type: 'unspecified', label: 'Unspezifiziert (::)' };
    if (n === 1n) return { type: 'loopback', label: 'Loopback (::1)' };
    if ((n >> 120n) === 0xffn) return { type: 'multicast', label: 'Multicast (ff00::/8)' };
    if ((n >> 118n) === 0x3fan) return { type: 'link-local', label: 'Link-Local (fe80::/10)' };
    if ((n >> 121n) === 0x7en) return { type: 'ula', label: 'ULA – Unique Local (fc00::/7)' };
    if ((n >> 125n) === 0x1n) return { type: 'gua', label: 'GUA – Global Unicast (2000::/3)' };
    return { type: 'unknown', label: 'Unbekannter Typ' };
}

/**
 * Prüft ob eine Adresse in einem Präfix enthalten ist.
 * @param   {string} cidr   - z. B. '2001:db8::/48'
 * @param   {string} addr
 * @returns {boolean}
 */
export function prefixContains(cidr, addr) {
    const [net, lenStr] = cidr.split('/');
    const len = parseInt(lenStr, 10);
    return applyMask(addr, len) === applyMask(net, len);
}

// ═══════════════════════════════════════════════════════════
// 7. WP06/WP07-Hilfs­strukturen
// ═══════════════════════════════════════════════════════════

/**
 * Zerlegt eine expandierte Adresse in 8 Gruppen-Infos für den Visualizer.
 * @param   {string} addr
 * @param   {number} prefixLen
 * @returns {Array<{ hex: string, bits: string, inPrefix: 'full'|'partial'|'none', groupIndex: number }>}
 */
export function groupInfo(addr, prefixLen) {
    const full = expand(addr);
    return full.split(':').map((hex, i) => {
        const groupStart = i * 16;      // Bit-Offset (MSB-Zählung, 0 = Bit 127)
        const groupEnd = groupStart + 16;
        let inPrefix;
        if (groupEnd <= prefixLen) inPrefix = 'full';
        else if (groupStart < prefixLen) inPrefix = 'partial';
        else inPrefix = 'none';

        const val = parseInt(hex, 16);
        const bits = val.toString(2).padStart(16, '0');
        return { hex, bits, inPrefix, groupIndex: i, groupStart, groupEnd };
    });
}

/**
 * Gibt die ersten N und das letzte Subnetz einer Präfix-Erweiterung zurück.
 * @param   {string} parentCidr
 * @param   {number} addBits
 * @param   {number} [maxShow=5]   Anzahl der Subnetze die angezeigt werden sollen
 * @returns {{ subnets: Array, total: bigint, newPrefixLen: number }}
 */
export function listSubnets(parentCidr, addBits, maxShow = 5) {
    const [addrPart, lenStr] = parentCidr.split('/');
    const parentLen = parseInt(lenStr, 10);
    const newPrefixLen = parentLen + addBits;
    const total = subnetCount(addBits);
    const showCount = total <= BigInt(maxShow) ? Number(total) : maxShow;

    const subnets = [];
    for (let i = 0; i < showCount; i++) {
        subnets.push(subprefix(parentCidr, addBits, i));
    }

    // Letztes Subnetz (falls total > maxShow)
    let last = null;
    if (total > BigInt(maxShow)) {
        last = subprefix(parentCidr, addBits, total - 1n);
    }

    return { subnets, last, total, newPrefixLen };
}

/**
 * Enumeriert Kind-Subnetze fensterweise (offset/limit) für basisPraefix -> zielPrefix.
 * @param   {string} parentCidr             z. B. '2001:db8::/48'
 * @param   {number} targetPrefix           z. B. 56
 * @param   {number|bigint} [offset=0]
 * @param   {number} [limit=16]
 * @returns {{ total: bigint, subnets: Array, parentPrefixLen: number, targetPrefix: number, offset: bigint, limit: number }}
 */
export function enumerateSubprefixes(parentCidr, targetPrefix, offset = 0, limit = 16) {
    if (typeof parentCidr !== 'string') {
        throw new TypeError('parentCidr muss ein String sein');
    }

    const m = parentCidr.trim().match(/^(.+?)\/(\d+)$/);
    if (!m) throw new Error('parentCidr muss im Format "Adresse/Präfix" vorliegen');

    const addrPart = m[1].trim();
    const parentPrefixLen = parseInt(m[2], 10);
    if (!isValidIPv6(addrPart)) throw new Error(`Ungültige IPv6-Adresse: "${addrPart}"`);
    if (parentPrefixLen < 0 || parentPrefixLen > 128) throw new RangeError('Basis-Präfixlänge muss 0–128 sein');

    if (!Number.isInteger(targetPrefix) || targetPrefix < 0 || targetPrefix > 128) {
        throw new RangeError('zielPrefix muss eine ganze Zahl von 0 bis 128 sein');
    }
    if (targetPrefix < parentPrefixLen) {
        throw new RangeError(`zielPrefix /${targetPrefix} muss >= Basis /${parentPrefixLen} sein`);
    }

    const off = typeof offset === 'bigint' ? offset : BigInt(offset);
    if (off < 0n) throw new RangeError('offset muss >= 0 sein');

    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError('limit muss eine ganze Zahl >= 1 sein');
    }

    const addBits = targetPrefix - parentPrefixLen;
    const total = 1n << BigInt(addBits);
    const baseNetwork = applyMask(addrPart, parentPrefixLen);
    const normalizedParent = `${baseNetwork}/${parentPrefixLen}`;

    if (off >= total) {
        return {
            total,
            subnets: [],
            parentPrefixLen,
            targetPrefix,
            offset: off,
            limit,
        };
    }

    const remaining = total - off;
    const count = remaining < BigInt(limit) ? Number(remaining) : limit;
    const subnets = [];

    for (let i = 0; i < count; i++) {
        const idx = off + BigInt(i);
        if (addBits === 0) {
            subnets.push({
                index: idx,
                address: baseNetwork,
                prefixLen: parentPrefixLen,
                cidr: `${compress(baseNetwork)}/${parentPrefixLen}`,
                cidrFull: `${baseNetwork}/${parentPrefixLen}`,
            });
            continue;
        }

        const sub = subprefix(normalizedParent, addBits, idx);
        subnets.push({ index: idx, ...sub });
    }

    return {
        total,
        subnets,
        parentPrefixLen,
        targetPrefix,
        offset: off,
        limit,
    };
}
