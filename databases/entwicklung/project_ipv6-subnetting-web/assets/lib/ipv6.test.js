/**
 * ipv6.test.js
 * Zweck:  Selbsttest der IPv6-Core-Lib. Importierbar und direkt ausführbar.
 *         Wird von WP15 als Smoke-Check-Seite genutzt.
 * Input:  Keine (importiert ipv6.js)
 * Output: { results, passed, total, ok } – auch via DOM wenn #test-results vorhanden
 *
 * Beispiel:
 *   import { runTests } from './ipv6.test.js';
 *   const { ok, passed, total } = runTests();
 *   console.log(ok ? 'ALLE TESTS OK' : `${total - passed} FEHLER`);
 */

import * as ipv6 from './ipv6.js';

// ─── Mini-Testrunner ──────────────────────────────────────────────────────────

const results = [];

function test(name, actualFn, expected) {
    let actual, error;
    try { actual = String(actualFn()); }
    catch (e) { actual = `EXCEPTION: ${e.message}`; error = e; }
    const pass = actual === String(expected);
    results.push({ name, pass, actual, expected: String(expected), error });
    if (!pass) {
        console.warn(`[ipv6-test] FAIL: ${name}\n  expected: ${expected}\n  actual:   ${actual}`);
    }
}

function testThrows(name, fn) {
    let threw = false;
    try { fn(); } catch { threw = true; }
    results.push({ name, pass: threw, actual: threw ? 'threw' : 'no throw', expected: 'throw' });
    if (!threw) console.warn(`[ipv6-test] FAIL: ${name} – hätte werfen sollen`);
}

// ─── Tests: expand ────────────────────────────────────────────────────────────

test('expand(::)',
    () => ipv6.expand('::'),
    '0000:0000:0000:0000:0000:0000:0000:0000');

test('expand(::1)',
    () => ipv6.expand('::1'),
    '0000:0000:0000:0000:0000:0000:0000:0001');

test('expand(2001:db8::1)',
    () => ipv6.expand('2001:db8::1'),
    '2001:0db8:0000:0000:0000:0000:0000:0001');

test('expand(fe80::1)',
    () => ipv6.expand('fe80::1'),
    'fe80:0000:0000:0000:0000:0000:0000:0001');

test('expand(link-local full)',
    () => ipv6.expand('fe80:0000:0000:0000:0202:b3ff:fe1e:8329'),
    'fe80:0000:0000:0000:0202:b3ff:fe1e:8329');

test('expand(::ffff – IPv4-mapped prefix)',
    () => ipv6.expand('::ffff:0:0'),
    '0000:0000:0000:0000:0000:ffff:0000:0000');

testThrows('expand(invalid – zwei ::)',
    () => ipv6.expand('::1::2'));

// ─── Tests: compress ─────────────────────────────────────────────────────────

test('compress(all zeros → ::)',
    () => ipv6.compress('0000:0000:0000:0000:0000:0000:0000:0000'),
    '::');

test('compress(loopback → ::1)',
    () => ipv6.compress('0000:0000:0000:0000:0000:0000:0000:0001'),
    '::1');

test('compress(2001:db8::1)',
    () => ipv6.compress('2001:0db8:0000:0000:0000:0000:0000:0001'),
    '2001:db8::1');

test('compress(fe80:: / link-local base)',
    () => ipv6.compress('fe80:0000:0000:0000:0000:0000:0000:0000'),
    'fe80::');

test('compress(link-local mit EUI-64)',
    () => ipv6.compress('fe80:0000:0000:0000:0202:b3ff:fe1e:8329'),
    'fe80::202:b3ff:fe1e:8329');

test('compress(GUA /48 Netz)',
    () => ipv6.compress('2001:0db8:abcd:0000:0000:0000:0000:0000'),
    '2001:db8:abcd::');

test('compress(ULA)',
    () => ipv6.compress('fd00:0000:0000:0001:0000:0000:0000:0001'),
    'fd00::1:0:0:0:1');

// ─── Tests: BigInt Round-Trip ─────────────────────────────────────────────────

test('toBigInt(::1) === 1n',
    () => ipv6.toBigInt('::1'),
    1n);

test('fromBigInt(1n) === ::1 (Vollform)',
    () => ipv6.fromBigInt(1n),
    '0000:0000:0000:0000:0000:0000:0000:0001');

test('Round-Trip: fe80::202:b3ff:fe1e:8329',
    () => ipv6.compress(ipv6.fromBigInt(ipv6.toBigInt('fe80::202:b3ff:fe1e:8329'))),
    'fe80::202:b3ff:fe1e:8329');

// ─── Tests: prefixMask ────────────────────────────────────────────────────────

test('prefixMask(0) → 0n',
    () => ipv6.prefixMask(0),
    0n);

test('prefixMask(48) → ffff:ffff:ffff::',
    () => ipv6.compress(ipv6.fromBigInt(ipv6.prefixMask(48))),
    'ffff:ffff:ffff::');

test('prefixMask(64) → ffff:ffff:ffff:ffff::',
    () => ipv6.compress(ipv6.fromBigInt(ipv6.prefixMask(64))),
    'ffff:ffff:ffff:ffff::');

test('prefixMask(128) → alle Bits gesetzt',
    () => ipv6.prefixMask(128),
    (1n << 128n) - 1n);

// ─── Tests: applyMask (Netzwerkadresse) ──────────────────────────────────────

test('applyMask(2001:db8::1, /48) → Netz',
    () => ipv6.compress(ipv6.applyMask('2001:db8::1', 48)),
    '2001:db8::');

test('applyMask(fe80::202:b3ff:fe1e:8329, /64)',
    () => ipv6.compress(ipv6.applyMask('fe80::202:b3ff:fe1e:8329', 64)),
    'fe80::');

// ─── Tests: subprefix ─────────────────────────────────────────────────────────

test('subprefix(/48, +8, index=0).cidr',
    () => ipv6.subprefix('2001:db8::/48', 8, 0).cidr,
    '2001:db8::/56');

test('subprefix(/48, +8, index=1).cidr',
    () => ipv6.subprefix('2001:db8::/48', 8, 1).cidr,
    '2001:db8:0:100::/56');

test('subprefix(/48, +8, index=3).cidr',
    () => ipv6.subprefix('2001:db8::/48', 8, 3).cidr,
    '2001:db8:0:300::/56');

test('subprefix(/48, +8, index=255 – letztes).cidr',
    () => ipv6.subprefix('2001:db8::/48', 8, 255).cidr,
    '2001:db8:0:ff00::/56');

test('subprefix(/64, +4, index=0).cidr (Nibble-Grenze)',
    () => ipv6.subprefix('2001:db8::/64', 4, 0).cidr,
    '2001:db8::/68');

testThrows('subprefix: prefixLen > 128 → wirft',
    () => ipv6.subprefix('2001:db8::/120', 12, 0));

testThrows('subprefix: index out of range → wirft',
    () => ipv6.subprefix('2001:db8::/48', 8, 256));

// ─── Tests: Hilfsfunktionen ───────────────────────────────────────────────────

test('subnetCount(8) = 256n',
    () => ipv6.subnetCount(8),
    256n);

test('subnetCount(16) = 65536n',
    () => ipv6.subnetCount(16),
    65536n);

test('addressCountForPrefix(/64) = 2^64',
    () => ipv6.addressCountForPrefix(64),
    18446744073709551616n);

test('addressCountForPrefix(/128) = 1',
    () => ipv6.addressCountForPrefix(128),
    1n);

test('subnetCountBetween(/48 -> /56) = 256',
    () => ipv6.subnetCountBetween(48, 56),
    256n);

test('subnetCountBetween(/64 -> /64) = 1',
    () => ipv6.subnetCountBetween(64, 64),
    1n);

testThrows('subnetCountBetween: /neu < /alt → wirft',
    () => ipv6.subnetCountBetween(64, 56));

test('isNibbleBoundary(48) → true',
    () => ipv6.isNibbleBoundary(48),
    true);

test('isNibbleBoundary(50) → false',
    () => ipv6.isNibbleBoundary(50),
    false);

test('isValidIPv6(2001:db8::1) → true',
    () => ipv6.isValidIPv6('2001:db8::1'),
    true);

test('isValidIPv6(invalid) → false',
    () => ipv6.isValidIPv6('not-an-address'),
    false);

test('prefixLastAddress(2001:db8::/48)',
    () => ipv6.compress(ipv6.prefixLastAddress('2001:db8::', 48)),
    '2001:db8::ffff:ffff:ffff:ffff:ffff');

test('prefixRange(/64).network',
    () => ipv6.compress(ipv6.prefixRange('2001:db8::1234', 64).network),
    '2001:db8::');

test('prefixRange(/64).first',
    () => ipv6.compress(ipv6.prefixRange('2001:db8::1234', 64).first),
    '2001:db8::');

test('prefixRange(/64).last',
    () => ipv6.compress(ipv6.prefixRange('2001:db8::1234', 64).last),
    '2001:db8::ffff:ffff:ffff:ffff');

// ─── Tests: Adresstypen ───────────────────────────────────────────────────────

test('getAddressType(::) → unspecified',
    () => ipv6.getAddressType('::').type,
    'unspecified');

test('getAddressType(::1) → loopback',
    () => ipv6.getAddressType('::1').type,
    'loopback');

test('getAddressType(fe80::1) → link-local',
    () => ipv6.getAddressType('fe80::1').type,
    'link-local');

test('getAddressType(fd00::1) → ula',
    () => ipv6.getAddressType('fd00::1').type,
    'ula');

test('getAddressType(2001:db8::1) → gua',
    () => ipv6.getAddressType('2001:db8::1').type,
    'gua');

test('getAddressType(ff02::1) → multicast',
    () => ipv6.getAddressType('ff02::1').type,
    'multicast');

// ─── Tests: prefixContains ────────────────────────────────────────────────────

test('prefixContains(2001:db8::/48, 2001:db8::1) → true',
    () => ipv6.prefixContains('2001:db8::/48', '2001:db8::1'),
    true);

test('prefixContains(2001:db8::/48, 2001:db9::1) → false',
    () => ipv6.prefixContains('2001:db8::/48', '2001:db9::1'),
    false);

// ─── Tests: listSubnets ───────────────────────────────────────────────────────

test('listSubnets(/48, +8).total = 256n',
    () => ipv6.listSubnets('2001:db8::/48', 8).total,
    256n);

test('listSubnets(/48, +8).subnets[0].cidr',
    () => ipv6.listSubnets('2001:db8::/48', 8).subnets[0].cidr,
    '2001:db8::/56');

test('listSubnets(/48, +8).last.cidr',
    () => ipv6.listSubnets('2001:db8::/48', 8).last.cidr,
    '2001:db8:0:ff00::/56');

// ─── Auswertung ───────────────────────────────────────────────────────────────

const passed = results.filter(r => r.pass).length;
const total = results.length;
const ok = passed === total;

console.log(`[ipv6-test] ${ok ? '✅ ALLE' : '❌'} ${passed}/${total} Tests bestanden`);

/**
 * Führt alle Tests aus und gibt das Ergebnis zurück.
 * Rendert optional in ein DOM-Element #test-results.
 * @returns {{ results, passed, total, ok }}
 */
export function runTests() {
    // Optional: DOM-Ausgabe
    const el = document.getElementById('test-results');
    if (el) {
        el.innerHTML = results.map(r => `
      <div class="test-row ${r.pass ? 'test-pass' : 'test-fail'}">
        <span class="test-icon">${r.pass ? '✅' : '❌'}</span>
        <span class="test-name">${r.name}</span>
        ${!r.pass ? `<span class="test-detail">erwartet: <code>${r.expected}</code> | tatsächlich: <code>${r.actual}</code></span>` : ''}
      </div>`).join('');
        el.insertAdjacentHTML('afterbegin',
            `<div class="test-summary ${ok ? 'test-ok' : 'test-err'}">
        ${ok ? '✅' : '❌'} ${passed}/${total} Tests bestanden
       </div>`);
    }
    return { results, passed, total, ok };
}

export { results, passed, total, ok };
