/**
 * parser.js – SQL Parser (Upgrade WP7)
 * -------------------------------------
 * Zweck  : Zerlegt SQL-Eingabe in Simulator-Steps UND erkennt alle SQL-Clauses
 *          für die Left-Drawer-Visualisierung (Schreib- vs. Ausführungsreihenfolge).
 * Input  : SQL-String (beliebig mehrzeilig)
 * Output : { type, clauses, tables, columns, error, steps }
 * Beispiel:
 *   parser.parse("SELECT id FROM users WHERE id = 1")
 *   → { type:'SELECT', clauses:['SELECT','FROM','WHERE'], tables:['users'],
 *       columns:['id'], error:null, steps:[...] }
 */

class SQLParser {
    constructor() {
        this.steps = [];
        this.rawSQL = '';

        // Mock-Datenbank für Simulator-Steps (Fallback / Tests)
        this.simulationData = {
            TABLES: {
                'users': {
                    columns: [
                        { name: 'id', type: 'INTEGER', isPK: true },
                        { name: 'name', type: 'VARCHAR', isPK: false },
                        { name: 'role', type: 'TEXT', isPK: false }
                    ],
                    rows: [
                        [1, 'Alice', 'Admin'],
                        [2, 'Bob', 'User'],
                        [3, 'Charlie', 'User']
                    ]
                },
                'logs': {
                    columns: [
                        { name: 'log_id', type: 'INTEGER', isPK: true },
                        { name: 'user_id', type: 'INTEGER', isFK: true, fkTarget: 'users.id' },
                        { name: 'message', type: 'TEXT', isPK: false }
                    ],
                    rows: [
                        [101, 1, 'Logged In'],
                        [102, 2, 'Viewed Page'],
                        [103, 1, 'Logout']
                    ]
                }
            }
        };

        // Clause-Definitionen: Erkennungs-Regex + kanonischer Name
        // Reihenfolge ist wichtig (längere Patterns zuerst)
        this._clauseDefs = [
            { key: 'GROUP BY', regex: /\bGROUP\s+BY\b/i },
            { key: 'ORDER BY', regex: /\bORDER\s+BY\b/i },
            { key: 'INSERT INTO', regex: /\bINSERT\s+INTO\b/i },
            { key: 'DELETE FROM', regex: /\bDELETE\s+FROM\b/i },
            { key: 'LEFT JOIN', regex: /\bLEFT\s+(OUTER\s+)?JOIN\b/i },
            { key: 'RIGHT JOIN', regex: /\bRIGHT\s+(OUTER\s+)?JOIN\b/i },
            { key: 'INNER JOIN', regex: /\bINNER\s+JOIN\b/i },
            { key: 'FULL JOIN', regex: /\bFULL\s+(OUTER\s+)?JOIN\b/i },
            { key: 'JOIN', regex: /\bJOIN\b/i },
            { key: 'SELECT', regex: /\bSELECT\b/i },
            { key: 'FROM', regex: /\bFROM\b/i },
            { key: 'WHERE', regex: /\bWHERE\b/i },
            { key: 'HAVING', regex: /\bHAVING\b/i },
            { key: 'DISTINCT', regex: /\bDISTINCT\b/i },
            { key: 'LIMIT', regex: /\bLIMIT\b/i },
            { key: 'OFFSET', regex: /\bOFFSET\b/i },
            { key: 'UPDATE', regex: /\bUPDATE\b/i },
            { key: 'SET', regex: /\bSET\b/i },
            { key: 'CREATE TABLE', regex: /\bCREATE\s+TABLE\b/i },
        ];

        // Validierungsregeln: [Bedingung-Prüfung, Fehlermeldung, Typ ('error'|'warning')]
        this._validationRules = [
            {
                check: (clauses, type) => type === 'SELECT' && !clauses.includes('FROM'),
                message: 'SELECT ohne FROM – woher sollen die Daten kommen?',
                level: 'error'
            },
            {
                check: (clauses) => clauses.includes('HAVING') && !clauses.includes('GROUP BY'),
                message: 'HAVING ohne GROUP BY – HAVING filtert aggregierte Gruppen, GROUP BY fehlt.',
                level: 'warning'
            },
            {
                check: (clauses) => clauses.includes('OFFSET') && !clauses.includes('LIMIT'),
                message: 'OFFSET ohne LIMIT – OFFSET allein ist in vielen DBMS nicht gültig.',
                level: 'warning'
            },
        ];
    }

    // ─── Haupt-Einstiegspunkt ────────────────────────────────────────────────

    /**
     * Parst einen SQL-String vollständig.
     * @param {string} sql
     * @returns {{ type:string, clauses:string[], tables:string[], columns:string[], error:string|null, warning:string|null, steps:object[] }}
     */
    parse(sql) {
        this.steps = [];
        this.rawSQL = sql;

        const result = {
            type: null,
            clauses: [],
            tables: [],
            columns: [],
            error: null,
            warning: null,
            steps: []
        };

        if (!sql || sql.trim() === '') {
            result.error = 'Kein SQL eingegeben.';
            return result;
        }

        const normalized = sql.replace(/\s+/g, ' ').trim();
        const upper = normalized.toUpperCase();

        // 1. Clauses erkennen (alle, in Schreibreihenfolge des Textes)
        result.clauses = this._detectClauses(normalized);

        // 2. Statement-Typ bestimmen
        result.type = this._detectType(upper);

        // 3. Tabellen & Spalten extrahieren
        result.tables = this._extractTables(normalized);
        result.columns = this._extractColumns(normalized);

        // 4. Validierung
        const validation = this._validate(result.clauses, result.type);
        result.error = validation.error;
        result.warning = validation.warning;

        // 5. Simulator-Steps generieren
        result.steps = this._buildSteps(normalized, upper, result);

        return result;
    }

    // ─── Interne Methoden ────────────────────────────────────────────────────

    /** Erkennt alle SQL-Clauses im Text, in Reihenfolge ihres ersten Vorkommens */
    _detectClauses(sql) {
        const found = [];
        const positions = [];

        for (const def of this._clauseDefs) {
            const match = def.regex.exec(sql);
            if (match) {
                // Normalisiere JOIN-Varianten auf 'JOIN' für die Visualisierung
                const displayKey = def.key.includes('JOIN') ? 'JOIN' : def.key;
                // Nur einmal pro kanonischem Key
                if (!positions.some(p => p.key === displayKey)) {
                    positions.push({ key: displayKey, index: match.index });
                }
            }
        }

        // Sortieren nach Position im Text → Schreibreihenfolge
        positions.sort((a, b) => a.index - b.index);
        return positions.map(p => p.key);
    }

    /** Bestimmt den primären Statement-Typ */
    _detectType(upper) {
        if (upper.startsWith('SELECT')) return 'SELECT';
        if (upper.startsWith('INSERT')) return 'INSERT';
        if (upper.startsWith('UPDATE')) return 'UPDATE';
        if (upper.startsWith('DELETE')) return 'DELETE';
        if (upper.startsWith('CREATE TABLE')) return 'CREATE';
        if (upper.startsWith('DROP')) return 'DROP';
        if (upper.startsWith('ALTER')) return 'ALTER';
        return 'UNKNOWN';
    }

    /** Extrahiert Tabellennamen aus FROM / JOIN / INTO / UPDATE-Clauses */
    _extractTables(sql) {
        const tables = new Set();
        const patterns = [
            /\bFROM\s+(\w+)/gi,
            /\bJOIN\s+(\w+)/gi,
            /\bINTO\s+(\w+)/gi,
            /\bUPDATE\s+(\w+)/gi,
        ];
        for (const re of patterns) {
            let m;
            while ((m = re.exec(sql)) !== null) {
                tables.add(m[1].toLowerCase());
            }
        }
        return [...tables];
    }

    /** Extrahiert Spaltennamen aus SELECT-Liste (einfache Heuristik) */
    _extractColumns(sql) {
        const columns = [];
        const selectMatch = sql.match(/\bSELECT\s+(.+?)\s+\bFROM\b/i);
        if (!selectMatch) return columns;

        const colStr = selectMatch[1];
        if (colStr.trim() === '*') return ['*'];

        colStr.split(',').forEach(c => {
            // Entferne Table-Prefix (z.B. "u.name" → "name") und Aliases
            const clean = c.trim().split(/\s+AS\s+/i)[0].trim();
            const col = clean.includes('.') ? clean.split('.')[1] : clean;
            if (col) columns.push(col.trim());
        });
        return columns;
    }

    /** Validiert Clauses gegen bekannte Regeln */
    _validate(clauses, type) {
        for (const rule of this._validationRules) {
            if (rule.check(clauses, type)) {
                return rule.level === 'error'
                    ? { error: rule.message, warning: null }
                    : { error: null, warning: rule.message };
            }
        }
        return { error: null, warning: null };
    }

    /** Generiert die Simulator-Steps (abwärtskompatibel zur alten API) */
    _buildSteps(normalized, upper, result) {
        const steps = [];

        if (result.type === 'CREATE') {
            return this._buildCreateSteps(normalized);
        }
        if (result.type === 'INSERT') {
            return this._buildInsertSteps(normalized);
        }
        if (result.type === 'UPDATE') {
            return this._buildUpdateSteps(normalized);
        }
        if (result.type === 'DELETE') {
            return this._buildDeleteSteps(normalized);
        }

        // SELECT / Fallback: DBMS-Ausführungsreihenfolge als Steps
        const DBMS_ORDER = ['FROM', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'DISTINCT', 'ORDER BY', 'LIMIT', 'OFFSET'];

        for (const clause of DBMS_ORDER) {
            if (!result.clauses.includes(clause)) continue;

            switch (clause) {
                case 'FROM':
                    result.tables.forEach(t => steps.push({
                        type: 'FROM', entity: t,
                        description: `Lade Tabelle: ${t}`, visual: 'Load Table'
                    }));
                    break;
                case 'JOIN':
                    steps.push({ type: 'JOIN', description: 'Verbinde Tabellen (JOIN)', visual: 'Join Table' });
                    break;
                case 'WHERE':
                    steps.push({ type: 'WHERE', description: 'Filtere Zeilen (WHERE)', visual: 'Filter Rows' });
                    break;
                case 'GROUP BY':
                    steps.push({ type: 'GROUP BY', description: 'Gruppiere Zeilen (GROUP BY)', visual: 'Group Rows' });
                    break;
                case 'HAVING':
                    steps.push({ type: 'HAVING', description: 'Filtere Gruppen (HAVING)', visual: 'Filter Groups' });
                    break;
                case 'SELECT':
                    steps.push({ type: 'SELECT', description: `Wähle Spalten: ${result.columns.join(', ')}`, visual: 'Highlight Columns' });
                    break;
                case 'DISTINCT':
                    steps.push({ type: 'DISTINCT', description: 'Entferne Duplikate (DISTINCT)', visual: 'Deduplicate' });
                    break;
                case 'ORDER BY':
                    steps.push({ type: 'ORDER BY', description: 'Sortiere Ergebnis (ORDER BY)', visual: 'Sort Rows' });
                    break;
                case 'LIMIT':
                    steps.push({ type: 'LIMIT', description: 'Begrenze Zeilenzahl (LIMIT)', visual: 'Limit Rows' });
                    break;
                case 'OFFSET':
                    steps.push({ type: 'OFFSET', description: 'Überspringe Zeilen (OFFSET)', visual: 'Offset Rows' });
                    break;
            }
        }

        steps.push({ type: 'RESULT', description: 'Ergebnis wird generiert...', visual: 'Show Result' });
        return steps;
    }

    _buildCreateSteps(sql) {
        const steps = [];
        const m = sql.match(/CREATE\s+TABLE\s+(\w+)\s*\(([^)]+)\)/i);
        if (!m) return steps;
        const tableName = m[1];
        const columns = m[2].split(',').map(colDef => {
            const parts = colDef.trim().split(/\s+/);
            const colObj = { name: parts[0], type: (parts[1] || 'TEXT').toUpperCase(), isPK: false, isFK: false };
            const up = colDef.toUpperCase();
            if (up.includes('PRIMARY KEY')) colObj.isPK = true;
            if (up.includes('REFERENCES')) colObj.isFK = true;
            return colObj;
        });
        steps.push({ type: 'CREATE', description: `Erstelle Tabelle: ${tableName}`, visual: 'Create Table', entity: tableName, columns });
        steps.push({ type: 'RESULT', description: 'Tabelle erfolgreich erstellt.', visual: 'Done' });
        return steps;
    }

    _buildInsertSteps(sql) {
        const steps = [];
        const m = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)/i);
        if (!m) return steps;
        const cols = m[2].split(',').map(c => c.trim());
        const vals = m[3].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        steps.push({ type: 'INSERT', description: `Füge Daten in ${m[1]} ein`, visual: 'Insert Row', entity: m[1], columns: cols, values: vals });
        steps.push({ type: 'RESULT', description: 'Daten eingefügt.', visual: 'Done' });
        return steps;
    }

    _buildUpdateSteps(sql) {
        const steps = [];
        const m = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
        if (!m) return steps;
        const modifications = m[2].split(',').map(mod => {
            const p = mod.split('=');
            return { col: p[0].trim(), val: (p[1] || '').trim().replace(/^['"]|['"]$/g, '') };
        });
        steps.push({ type: 'UPDATE', description: `Aktualisiere ${m[1]}`, visual: 'Update Rows', entity: m[1], modifications, condition: m[3] });
        steps.push({ type: 'RESULT', description: 'Daten aktualisiert.', visual: 'Done' });
        return steps;
    }

    _buildDeleteSteps(sql) {
        const steps = [];
        const m = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
        if (!m) return steps;
        steps.push({ type: 'DELETE', description: `Lösche aus ${m[1]}`, visual: 'Delete Rows', entity: m[1], condition: m[2] });
        steps.push({ type: 'RESULT', description: 'Daten gelöscht.', visual: 'Done' });
        return steps;
    }
}

// Globale Instanz (abwärtskompatibel)
window.sqlParser = new SQLParser();
