Ich würde die Seite wie eine kleine **IPv6-Werkbank** bauen: links Lernpfad, in der Mitte Erklärung/Beispiele, rechts immer ein „Tool-Panel“, das mit dem aktuellen Kapitel mitläuft. Ziel: nicht lesen bis man einschläft, sondern **tippen, schneiden, prüfen, wiederholen**.

### So sähe die Webseite aus (Layout)

**Header**

* Kapitel-Breadcrumb (z. B. *Subnetting → Präfixe schneiden*)
* Suchfeld (Begriffe wie „/64“, „SLAAC“, „NDP“, „ULA“)
* Toggle: Light/Dark, „Prüfungsmodus“

**Linke Seitenleiste (Lernpfad)**

* 1. Grundlagen (Hex, Präfix, /64-Warum)
* 2. Adresstypen (GUA/ULA/LLA)
* 3. Subnetting (Präfixe, Hierarchie, Nibble-Grenzen)
* 4. Praxis (VLAN-Planung, Standort-Design)
* 5. Checks & Fehlerbilder (RA fehlt, ICMPv6 geblockt, falsches Präfix)

**Hauptbereich (Mitte)**

* kurze Abschnitte (max. 1 Bildschirm)
* pro Abschnitt: 1 Bild/Animation + 1 Beispiel + 1 Mini-Aufgabe

**Rechte Seitenleiste (Tool-Panel)**

* je nach Kapitel: Rechner, Visualizer, Aufgaben-Checker, „Merksätze“

---

### Features, die das Ding wirklich gut machen

#### 1) Präfix-Visualizer (das Herzstück)

* Eingabe: `2001:db8:abcd::/48`
* Darstellung als:

    * **Hex-Blöcke** (8 Gruppen)
    * **Bit-Leiste** (on/off) *nur für das Präfix-Segment, nicht für alles 128 Bit*
    * Markierung von **Nibble-Grenzen** (je 4 Bit → passt zu Hex)
* „Was ändert sich bei /52 vs /56 vs /60 vs /64?“ als Live-Highlight

#### 2) „Prefix Slicer“ – Subnetting ohne Kopfweh

* Schieberegler: „Wie viele Subnetze brauchst du?“ oder „Wie viele zusätzliche Bits nimmst du?“
* Output:

    * neuer Präfix (z. B. `/48` → `/56`)
    * Anzahl Subnetze (2^n)
    * **erste 5 Subnetze + letztes Subnetz** (realistisch genug, keine 256 Zeilen Spam)
    * Option: „Schrittweise erklären“ vs „nur Ergebnis“

#### 3) Aufgabenmodus mit sofortiger Korrektur (wie ein Debugger)

* Aufgabenarten:

    * „Welches Präfix pro VLAN?“
    * „Wie viele /64 passen in /48?“
    * „Plane Standort A–D: /56 je Standort, /64 je VLAN“
* Nutzer tippt Lösung → Seite sagt:

    * ✅ korrekt / ❌ falsch
    * bei falsch: **welcher Schritt** falsch ist (z. B. Bits gezählt, Potenz vertauscht)

#### 4) Szenario-Generator (Praxis statt Rechenporno)

Ein Button: **„Neue Übungsaufgabe“**

* Beispiel: „Firma bekommt `/48`. 12 Standorte. Pro Standort 20 VLANs. Plane sinnvoll.“
* Seite bewertet:

    * Hierarchie (Standort → VLAN)
    * Präfix-Wahl (z. B. Standort `/56`, VLAN `/64`)
    * Konsistenz (keine Überschneidung)

#### 5) „Typische Denkfehler“-Bibliothek

Kurze Karten:

* „/64 ist nicht optional im LAN (fast immer)“
* „Kein Broadcast – Multicast statt dessen“
* „ICMPv6 blocken = Selbstsabotage“
* „NDP ≠ ARP, RA ≠ DHCP“

#### 6) Mini-Simulationen (nur das Nötigste)

Keine riesige Netzwerksimulation, aber gezielte Demos:

* RA kommt / kommt nicht → Client hat / hat keine Default-Route
* NDP-Auflösung → warum ICMPv6 nötig ist
* Dual-Stack: Warum „Ping geht“ trotzdem nicht heißt „App geht“

#### 7) Prüfungsmodus

* weniger Text, mehr Aufgaben
* Zeitlimit optional
* Punkte + Auswertung nach Themen (Subnetting, Adresstypen, Routing-Basics)

#### 8) Lehrer-Ansicht (für Unterricht Gold)

* Aufgaben als QR/Link teilen
* „Live-Board“: wie viele haben welche Aufgabe richtig (anonymisiert)
* Musterlösungen einblendbar

#### 9) UX-Kleinkram, der entscheidet ob es genutzt wird

* Alles responsive (Handy/Beamer)
* Tastatur-friendly (Tab/Enter)
* Copy-Buttons für Präfixe/Ergebnisse
* „Merksatz-Leiste“ oben, die immer sichtbar bleibt (z. B. „Hex = Nibble = 4 Bit“)

---

### Eine Beispiel-Seite im Kapitel „Subnetting“

* **Kurzidee:** „Du hast ein /48. Du willst Subnetze pro Standort. Wie viele Bits brauchst du?“
* rechts Tool-Panel zeigt:

    * Eingabe Präfix
    * Slider „Standorte: 12“
    * Ergebnis: „Nimm +4 Bits → /52 gibt 16 Standorte (Reserve!)“
    * darunter: „Pro Standort VLANs? → /56 oder /60, VLAN immer /64“

So eine Seite fühlt sich an wie: **„IPv6 ist nicht schwer, es ist nur ungewohnt“** — und sie zwingt dich, die ungewohnten Teile aktiv zu benutzen, statt sie wegzulesen.
