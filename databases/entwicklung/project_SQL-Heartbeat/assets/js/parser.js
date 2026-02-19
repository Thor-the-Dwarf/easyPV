/**
 * Parser (Simulator Compatible)
 * ----------------------------
 * Takes raw SQL text and converts it into a sequence of executable simulation steps.
 * This is a highly simplified parser for educational visualization purposes.
 */

class SQLParser {
    constructor() {
        this.steps = [];
        this.rawSQL = "";

        // Mock data for initial testing (Updated Structure for Metadata)
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
    }

    parse(sql) {
        this.steps = [];
        this.rawSQL = sql;

        if (!sql || sql.trim() === '') {
            return [];
        }

        // 1. Normalize SQL for multi-line support (especially CREATE TABLE)
        const fullSQL = sql.replace(/\s+/g, ' ').trim();

        // 2. Check for CREATE TABLE (Command-based Parsing)
        // Regex: CREATE TABLE [Name] ( [Columns...] )
        const createRegex = /CREATE\s+TABLE\s+(\w+)\s*\(([^)]+)\)/i;
        const createMatch = fullSQL.match(createRegex);

        if (fullSQL.toUpperCase().startsWith('CREATE TABLE') && createMatch) {
            // ... (keep existing CREATE logic) ...
            const tableName = createMatch[1];
            const columnsRaw = createMatch[2];

            const columns = columnsRaw.split(',').map(colDef => {
                const parts = colDef.trim().split(' ');
                const name = parts[0];
                const type = parts.length > 1 ? parts[1].toUpperCase() : 'TEXT';

                const colObj = {
                    name: name,
                    type: type,
                    isPK: false,
                    isFK: false
                };

                const fullDef = colDef.toUpperCase();
                if (fullDef.includes('PRIMARY KEY')) colObj.isPK = true;
                if (fullDef.includes('REFERENCES')) colObj.isFK = true;

                return colObj;
            });

            this.steps.push({
                type: 'CREATE',
                description: `Erstelle Tabelle: ${tableName}`,
                visual: 'Create Table',
                entity: tableName,
                columns: columns
            });

            this.steps.push({ type: 'RESULT', description: 'Tabelle erfolgreich erstellt.', visual: 'Done' });
            return this.steps;
        }

        // 3. Check for INSERT INTO
        // Regex: INSERT INTO table (col1, col2) VALUES (val1, val2)
        const insertRegex = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)/i;
        const insertMatch = fullSQL.match(insertRegex);

        if (fullSQL.toUpperCase().startsWith('INSERT INTO') && insertMatch) {
            const tableName = insertMatch[1];
            const cols = insertMatch[2].split(',').map(c => c.trim());
            const vals = insertMatch[3].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, '')); // Remove quotes

            this.steps.push({
                type: 'INSERT',
                description: `Füge Daten in Tabelle ${tableName} ein`,
                visual: 'Insert Row',
                entity: tableName,
                columns: cols,
                values: vals
            });
            this.steps.push({ type: 'RESULT', description: 'Daten eingefügt.', visual: 'Done' });
            return this.steps;
        }

        // 4. Check for UPDATE
        // Regex: UPDATE table SET col=val, col2=val2 WHERE condition
        const updateRegex = /UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i;
        const updateMatch = fullSQL.match(updateRegex);

        if (fullSQL.toUpperCase().startsWith('UPDATE') && updateMatch) {
            const tableName = updateMatch[1];
            const setClause = updateMatch[2];
            const whereClause = updateMatch[3];

            // Parse Set Clause: "col1=val1, col2=val2"
            const modifications = setClause.split(',').map(mod => {
                const parts = mod.split('=');
                return { col: parts[0].trim(), val: parts[1].trim().replace(/^['"]|['"]$/g, '') };
            });

            this.steps.push({
                type: 'UPDATE',
                description: `Aktualisiere Tabelle ${tableName}`,
                visual: 'Update Rows',
                entity: tableName,
                modifications: modifications,
                condition: whereClause
            });
            this.steps.push({ type: 'RESULT', description: 'Daten aktualisiert.', visual: 'Done' });
            return this.steps;
        }

        // 5. Check for DELETE
        // Regex: DELETE FROM table WHERE condition
        const deleteRegex = /DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i;
        const deleteMatch = fullSQL.match(deleteRegex);

        if (fullSQL.toUpperCase().startsWith('DELETE') && deleteMatch) {
            const tableName = deleteMatch[1];
            const whereClause = deleteMatch[2];

            this.steps.push({
                type: 'DELETE',
                description: `Lösche aus Tabelle ${tableName}`,
                visual: 'Delete Rows',
                entity: tableName,
                condition: whereClause
            });
            this.steps.push({ type: 'RESULT', description: 'Daten gelöscht.', visual: 'Done' });
            return this.steps;
        }

        // 6. Fallback: Line-by-Line (SELECT etc.) is handled below...

        // 3. Fallback: Line-by-Line Parsing for SELECT/FROM etc.
        const lines = sql.split('\n');

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed === '' || trimmed.startsWith('--')) return;

            // Simple Keyword Detection
            if (trimmed.toUpperCase().startsWith('SELECT')) {
                this.steps.push({
                    type: 'SELECT',
                    description: `Analysiere Spaltenauswahl: ${trimmed.substring(6)}`,
                    visual: 'Highlight Columns'
                });
            } else if (trimmed.toUpperCase().startsWith('FROM')) {
                const tableName = trimmed.substring(4).trim();
                this.steps.push({
                    type: 'FROM',
                    description: `Lade Tabelle: ${tableName}`,
                    visual: 'Load Table',
                    entity: tableName
                });
            } else if (trimmed.toUpperCase().startsWith('WHERE')) {
                this.steps.push({
                    type: 'WHERE',
                    description: `Filtere Zeilen: ${trimmed.substring(5)}`,
                    visual: 'Filter Rows'
                });
            } else if (trimmed.toUpperCase().startsWith('JOIN')) {
                const joinParts = trimmed.split('ON');
                const tableName = joinParts[0].substring(4).trim();
                this.steps.push({
                    type: 'JOIN',
                    description: `Verbinde mit Tabelle: ${tableName}`,
                    visual: 'Join Table',
                    entity: tableName
                });
            } else {
                // If line is not one of the above but not empty, maybe generic step
                this.steps.push({
                    type: 'GENERIC',
                    description: `Verarbeite Befehl: ${trimmed}`,
                    visual: 'Process Line'
                });
            }
        });

        // Add final "Result" step
        this.steps.push({ type: 'RESULT', description: 'Ergebnis wird generiert...', visual: 'Show Result' });

        return this.steps;
    }
}

// Export instance
window.sqlParser = new SQLParser();
