/**
 * MatchingGame Engine
 * Handles "Connect Pair A to Pair B" gameplay.
 * Supports Generic Config and Topic-Specific Configs (Join Puzzle).
 * Logic: Click Item A -> Click Item B -> Draw SVGS line.
 */

class MatchingGame {
    constructor() {
        this.config = null;
        this.currentLevel = 0;
        this.selectedLeft = null;
        this.connections = []; // [{leftId, rightId, svgLine}]

        this.gameUI = {
            title: document.getElementById('game-title'),
            instruction: document.getElementById('instruction-text'),
            startScreen: document.getElementById('start-screen'),
            endScreen: document.getElementById('end-screen'),
            leftColumn: document.getElementById('left-column'),
            rightColumn: document.getElementById('right-column'),
            svgLines: document.getElementById('lines-svg'),
            checkBtn: document.getElementById('check-btn'),
            feedback: document.getElementById('feedback-area'),
            finalMessage: document.getElementById('final-message'),
            levelIndicator: document.getElementById('level-indicator'),
        };

        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedConfigPath = urlParams.get('config') || 'config.json';
        const configPath = this.resolveConfigPath(requestedConfigPath);

        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawConfig = await response.json();
            this.config = this.normalizeConfig(rawConfig);
            this.setupUI();
        } catch (e) {
            console.error("Failed to load game config:", e);
            document.body.innerHTML = "<h1>Fehler beim Laden der Konfiguration</h1><p>" + e.message + "</p>";
        }
    }

    resolveConfigPath(configPath) {
        const rawPath = String(configPath || '').trim() || 'config.json';
        if (/^(https?:)?\/\//i.test(rawPath) || rawPath.startsWith('/')) {
            return rawPath;
        }
        const baseCandidates = [document.referrer, window.location.href].filter(Boolean);
        for (const base of baseCandidates) {
            try {
                return new URL(rawPath, base).href;
            } catch (_) {
                // Try next candidate
            }
        }
        return rawPath;
    }

    normalizeConfig(raw) {
        if (!raw.levels) {
            raw.levels = [];
            if (raw.pairs) {
                raw.levels.push({
                    id: 1,
                    title: raw.title || "Level 1",
                    pairs: raw.pairs
                });
            }
        }

        // Iterate levels and normalize content
        raw.levels = raw.levels.map(level => {
            // Join Puzzle Specifics
            if (level.tableA && level.tableB && level.expected) {
                const pairs = [];
                const leftItems = [];
                const rightItems = [];

                // Extract Rows
                const rowsA = this.extractRows(level.tableA);
                const rowsB = this.extractRows(level.tableB);

                const joinColA = level.expected.from.split('.')[1];
                const joinColB = level.expected.to.split('.')[1];

                // Create Items
                rowsA.forEach(row => {
                    leftItems.push({
                        id: `a_${row.pk}`,
                        text: this.formatRow(row, level.tableA.name),
                        val: row[joinColA]
                    });
                });

                rowsB.forEach(row => {
                    rightItems.push({
                        id: `b_${row.pk}`,
                        text: this.formatRow(row, level.tableB.name),
                        val: row[joinColB]
                    });
                });

                // Generate Pairs based on values (Inner Join Logic)
                rowsA.forEach(rowA => {
                    rowsB.forEach(rowB => {
                        // Loose equality for cross-type matching (1 vs "1")
                        if (rowA[joinColA] == rowB[joinColB]) {
                            pairs.push({
                                left: `a_${rowA.pk}`,
                                right: `b_${rowB.pk}`
                            });
                        }
                    });
                });

                return {
                    ...level,
                    leftItems,
                    rightItems,
                    validPairs: pairs,
                    mode: "join"
                };
            }
            return level;
        });

        return raw;
    }

    extractRows(tableDef) {
        const rowCount = tableDef.columns[0].val.length;
        const rows = [];
        for (let i = 0; i < rowCount; i++) {
            let row = { pk: i };
            tableDef.columns.forEach(col => {
                row[col.name] = col.val[i];
                if (col.type === 'PK') row.pk = col.val[i];
            });
            rows.push(row);
        }
        return rows;
    }

    formatRow(row, tableName) {
        const keys = Object.keys(row).filter(k => k !== 'pk');
        const labelKey = keys.find(k => k.includes('name') || k.includes('titel') || k.includes('mess')) || keys[0];
        return `${row[labelKey]} <small>(${tableName})</small>`;
    }

    setupUI() {
        this.gameUI.title.innerText = this.config.metadata?.title || this.config.title || "Matching Game";

        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
            this.loadLevel(0);
        });

        document.getElementById('check-btn').addEventListener('click', () => this.checkSolution());

        // Improve UX: clear connection on right click?
    }

    loadLevel(index) {
        if (index >= this.config.levels.length) {
            this.endGameAll();
            return;
        }
        this.currentLevel = index;
        const level = this.config.levels[index];

        this.gameUI.title.innerText = level.title || `Level ${index + 1}`;
        document.getElementById('instruction-text').innerText = level.description || "Verbinde!";

        // Reset
        this.selectedLeft = null;
        this.connections = [];
        this.gameUI.svgLines.innerHTML = '';
        this.gameUI.leftColumn.innerHTML = '';
        this.gameUI.rightColumn.innerHTML = '';

        // Render Columns
        const leftItems = level.leftItems || level.pairs?.map(p => ({ id: p.left, text: p.left }));
        const rightItems = level.rightItems || level.pairs?.map(p => ({ id: p.right, text: p.right }));

        const rightItemsRender = [...rightItems].sort(() => Math.random() - 0.5);

        leftItems.forEach(item => this.createItem(item, 'left'));
        rightItemsRender.forEach(item => this.createItem(item, 'right'));

        window.addEventListener('resize', () => this.redrawLines());
    }

    createItem(item, side) {
        const el = document.createElement('div');
        el.className = 'match-item';
        el.dataset.id = item.id;
        el.dataset.side = side;
        el.innerHTML = `<span>${item.text}</span>`;
        // Position relative for line drawing

        el.addEventListener('click', () => this.handleItemClick(item.id, side, el));

        const col = side === 'left' ? this.gameUI.leftColumn : this.gameUI.rightColumn;
        col.appendChild(el);
    }

    handleItemClick(id, side, el) {
        if (side === 'left') {
            // Select Left
            if (this.selectedLeft === id) {
                this.selectedLeft = null;
                el.classList.remove('selected');
            } else {
                if (this.selectedLeft) {
                    document.querySelector(`.match-item[data-id="${this.selectedLeft}"][data-side="left"]`)?.classList.remove('selected');
                }
                this.selectedLeft = id;
                el.classList.add('selected');
            }
        } else {
            // Clicked Right
            if (this.selectedLeft) {
                this.toggleConnection(this.selectedLeft, id);
                // Keep selection active for multi-connect
            }
        }
    }

    toggleConnection(leftId, rightId) {
        const existingIdx = this.connections.findIndex(c => c.leftId === leftId && c.rightId === rightId);

        if (existingIdx >= 0) {
            this.connections.splice(existingIdx, 1);
        } else {
            this.connections.push({ leftId, rightId });
        }
        this.redrawLines();
    }

    redrawLines() {
        this.gameUI.svgLines.innerHTML = '';
        const containerRect = document.querySelector('.matching-workspace').getBoundingClientRect();

        this.connections.forEach(conn => {
            const elLeft = document.querySelector(`.match-item[data-id="${conn.leftId}"][data-side="left"]`);
            const elRight = document.querySelector(`.match-item[data-id="${conn.rightId}"][data-side="right"]`);

            if (elLeft && elRight) {
                const rectLeft = elLeft.getBoundingClientRect();
                const rectRight = elRight.getBoundingClientRect();

                const x1 = rectLeft.right - containerRect.left;
                const y1 = rectLeft.top + rectLeft.height / 2 - containerRect.top;
                const x2 = rectRight.left - containerRect.left;
                const y2 = rectRight.top + rectRight.height / 2 - containerRect.top;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', 'connector-line active');
                this.gameUI.svgLines.appendChild(line);
            }
        });
    }

    checkSolution() {
        const level = this.config.levels[this.currentLevel];
        const validPairs = level.validPairs || level.pairs;

        let correctCount = 0;
        let errors = 0;

        // Check each user connection
        this.connections.forEach(conn => {
            const isValid = validPairs.some(p =>
                (p.left === conn.leftId && p.right === conn.rightId) ||
                (p.id === conn.leftId && p.matchId === conn.rightId)
            );

            if (isValid) {
                correctCount++;
            } else {
                errors++;
            }
        });

        const totalNeeded = validPairs.length;

        if (correctCount === totalNeeded && errors === 0) {
            this.showFeedback("Perfekt!", "success");
            setTimeout(() => this.nextLevel(), 1500);
        } else {
            this.showFeedback(`Falsch. ${correctCount} von ${totalNeeded} richtig gefunden.`, "error");
        }
    }

    nextLevel() {
        this.loadLevel(this.currentLevel + 1);
    }

    endGameAll() {
        this.gameUI.endScreen.classList.remove('hidden');
    }

    showFeedback(msg, type) {
        const fb = this.gameUI.feedback;
        fb.innerText = msg;
        fb.className = `feedback-toast show ${type}`;
        fb.classList.remove('hidden');
        setTimeout(() => fb.classList.add('hidden'), 3000);
    }

    getMode() {
        const startHidden = this.gameUI.startScreen?.classList.contains('hidden');
        const endVisible = !this.gameUI.endScreen?.classList.contains('hidden');
        if (!startHidden) return 'start';
        if (endVisible) return 'end';
        return this.config ? 'matching' : 'loading';
    }

    getProgressPercent() {
        const level = this.config?.levels?.[this.currentLevel];
        const needed = level ? (level.validPairs || level.pairs || []).length : 0;
        if (!needed || needed <= 0) return 0;
        return Math.round((this.connections.length / needed) * 100);
    }

    renderGameToText() {
        const level = this.config?.levels?.[this.currentLevel] || null;
        return JSON.stringify({
            mode: this.getMode(),
            coordinate_system: 'origin top-left, x right, y down',
            current_level: this.currentLevel,
            total_levels: this.config?.levels?.length || 0,
            selected_left: this.selectedLeft,
            connections: this.connections.map((c) => ({ left: c.leftId, right: c.rightId })),
            expected_connections: level ? ((level.validPairs || level.pairs || []).length) : 0,
            progress_percent: this.getProgressPercent()
        });
    }

    advanceTime() {
        return true;
    }
}

const matchingGame = new MatchingGame();
window.render_game_to_text = () => matchingGame.renderGameToText();
window.advanceTime = (ms) => matchingGame.advanceTime(ms);
