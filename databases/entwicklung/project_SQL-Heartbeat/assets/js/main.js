document.addEventListener('DOMContentLoaded', () => {
    // Initialize CodeMirror
    const editor = CodeMirror.fromTextArea(document.getElementById('sql-editor'), {
        mode: 'text/x-sql',
        theme: 'dracula',
        lineNumbers: true,
        indentWithTabs: false,
        smartIndent: true,
        lineWrapping: true,
        matchBrackets: true,
        autofocus: true,
        extraKeys: { "Ctrl-Space": "autocomplete" }
    });

    window.sqlEditorInstance = editor;

    // --- Simulator & Parser Integration ---
    const simulator = window.simulator;
    const parser = new SQLParser();
    const chatContainer = document.getElementById('chat-container');
    const tablesContainer = document.getElementById('tables-container');
    const topCanvas = document.getElementById('top-canvas');
    const ctx = topCanvas.getContext('2d');

    // Controls
    const btnPlay = document.getElementById('btn-play');
    const btnFF = document.getElementById('btn-ff');

    // Resize Handling
    function resizeCanvas() {
        topCanvas.width = window.innerWidth;
        topCanvas.height = window.innerHeight;
        drawRelationships();
    }
    window.addEventListener('resize', () => {
        editor.refresh();
        resizeCanvas();
    });
    // Initial Resize
    resizeCanvas();


    // Helper: Render Steps initially
    function renderSteps(steps) {
        chatContainer.innerHTML = '';
        steps.forEach((step, index) => {
            const stepEl = document.createElement('div');
            stepEl.className = 'step-item pending';
            stepEl.id = `step-${index}`;
            stepEl.innerHTML = `
                <div class="step-header">
                    <span class="step-type">${step.type}</span>
                    <div class="step-status-icon"></div>
                </div>
                <div class="step-desc">${step.description}</div>
                <div class="step-progress"></div>
            `;
            chatContainer.appendChild(stepEl);
        });
    }

    // WP5 Helper: Render Data Tables (Extended for Attributes)
    function renderTables(data) {
        tablesContainer.innerHTML = '';
        if (!data || !data.TABLES) return;

        Object.keys(data.TABLES).forEach(tableName => {
            const tableData = data.TABLES[tableName];
            const card = document.createElement('div');
            card.className = 'table-card';
            card.id = `table-card-${tableName}`;
            card.dataset.tableName = tableName;

            // Generate Header
            let html = `<div class="table-card-header">
                            <span>${tableName}</span>
                            <span style="font-size:0.8em; opacity:0.7;">${tableData.rows.length} Rows</span>
                        </div>`;

            // Generate Table
            html += `<table class="db-table" id="table-${tableName}">
                        <thead><tr>`;

            tableData.columns.forEach(col => {
                const colName = col.name || col;
                const colType = (col.type || '').toUpperCase();

                let icons = '';
                let tooltipParts = [];

                // 1. Key Icons
                if (col.isPK) {
                    icons += '🔑 ';
                    tooltipParts.push('Primary Key');
                }
                if (col.isFK) {
                    icons += '🔗 ';
                    tooltipParts.push('Foreign Key');
                }

                // 2. Type Icons
                let typeIcon = '';
                if (['DATETIMESTAMP'].some(t => colType.includes(t))) typeIcon = '📅⏱️';
                else if (['TIMESTAMP'].some(t => colType.includes(t))) typeIcon = '⏱️';
                else if (['DATETIME'].some(t => colType.includes(t))) typeIcon = '📅🕒';
                else if (['DATE'].some(t => colType.includes(t))) typeIcon = '📅';
                else if (['TIME'].some(t => colType.includes(t))) typeIcon = '🕒';
                else if (['INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT'].some(t => colType.includes(t))) typeIcon = '🔢';
                else if (['FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC', 'REAL'].some(t => colType.includes(t))) typeIcon = '#️⃣';
                else if (['TEXT', 'VARCHAR', 'STRING', 'CLOB'].some(t => colType.includes(t))) typeIcon = '📝';
                else if (['BLOB', 'BINARY'].some(t => colType.includes(t))) typeIcon = '💾';
                else if (['BOOLEAN', 'BOOL'].some(t => colType.includes(t))) typeIcon = '✅ ❌';
                else if (['CHAR', 'CHARACTER'].some(t => colType.includes(t))) typeIcon = '🔤 🆎';
                else typeIcon = '❓';

                icons += typeIcon + ' ';
                tooltipParts.push(colType);
                const finalTooltip = tooltipParts.join(' | ');

                // Add data attributes for relationship drawing
                const isPkAttr = col.isPK ? 'true' : 'false';
                const isFkAttr = col.isFK ? 'true' : 'false';
                const fkTargetAttr = col.fkTarget || '';

                html += `<th data-title="${finalTooltip}" 
                             data-col-name="${colName}"
                             data-table="${tableName}"
                             data-is-pk="${isPkAttr}"
                             data-is-fk="${isFkAttr}"
                             data-fk-target="${fkTargetAttr}">
                             ${icons}${colName}
                         </th>`;
            });
            html += `</tr></thead>
                     <tbody>`;

            tableData.rows.forEach((row, rIndex) => {
                html += `<tr id="row-${tableName}-${rIndex}" class="table-row">`;
                row.forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table>`;

            card.innerHTML = html;
            tablesContainer.appendChild(card);
        });

        // After render, draw lines
        setTimeout(drawRelationships, 50); // slight delay for layout
    }

    // WP7: Draw Relationship Lines
    function drawRelationships() {
        ctx.clearRect(0, 0, topCanvas.width, topCanvas.height);

        const fkHeaders = document.querySelectorAll('th[data-is-fk="true"]');

        fkHeaders.forEach(fkTh => {
            const targetStr = fkTh.dataset.fkTarget; // e.g. "users.id"
            if (!targetStr) return;

            const [targetTable, targetCol] = targetStr.split('.');

            const targetTableCard = document.getElementById(`table-card-${targetTable}`);
            if (!targetTableCard) return;

            const targetTh = Array.from(targetTableCard.querySelectorAll('th')).find(th => th.dataset.colName === targetCol);

            if (targetTh) {
                // Get Rects for Cells (Connection Points)
                const startRect = fkTh.getBoundingClientRect();
                const endRect = targetTh.getBoundingClientRect();

                // Get Rects for Tables (Obstacles)
                const startTableRect = fkTh.closest('.table-card').getBoundingClientRect();
                const endTableRect = targetTableCard.getBoundingClientRect();

                ctx.beginPath();

                // Logic to determine routing style
                const gap = 40;
                // Check if target is clearly to the Right or Left (ignoring small vertical overlaps)
                const isTargetRight = endTableRect.left > (startTableRect.right + gap);
                const isTargetLeft = endTableRect.right < (startTableRect.left - gap);

                let startX, startY, endX, endY;
                let startDir = 1; // 1 = Right, -1 = Left

                // Vertical Center of the Cells
                startY = startRect.top + startRect.height / 2;
                endY = endRect.top + endRect.height / 2;

                if (isTargetRight) {
                    // Standard Z-shape: Source Right -> Target Left
                    startX = startTableRect.right;
                    endX = endTableRect.left;
                    startDir = 1;

                    const midX = (startX + endX) / 2;
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, startY);
                    ctx.lineTo(midX, endY);
                    ctx.lineTo(endX, endY);

                } else if (isTargetLeft) {
                    // Standard Z-shape: Source Left -> Target Right
                    startX = startTableRect.left;
                    endX = endTableRect.right;
                    startDir = -1;

                    const midX = (startX + endX) / 2;
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, startY);
                    ctx.lineTo(midX, endY);
                    ctx.lineTo(endX, endY);

                } else {
                    // Stacked or overlapping horizontally -> Route around the RIGHT side (C-Shape)
                    startX = startTableRect.right;
                    endX = endTableRect.right;
                    startDir = 1; // Exiting Right

                    // Determine channel X: max of both right edges + padding
                    const channelX = Math.max(startTableRect.right, endTableRect.right) + 40;

                    ctx.moveTo(startX, startY);
                    ctx.lineTo(channelX, startY);
                    ctx.lineTo(channelX, endY);
                    ctx.lineTo(endX, endY);
                }

                // Stroke Line
                ctx.strokeStyle = '#64c8ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.stroke();

                // --- Markers (Crow's Foot Notation) ---
                ctx.fillStyle = '#64c8ff';
                ctx.strokeStyle = '#64c8ff';
                ctx.lineWidth = 2;

                // 1. FK Side (Source) -> "Many" (Crow's Foot)
                // Symbol: Three prongs opening towards table
                const footSize = 10;
                ctx.beginPath();
                // Origin (startX, startY). If exiting Right (Dir=1), prongs point Left (<).
                // Top prong
                ctx.moveTo(startX + (footSize * startDir), startY - footSize / 2);
                ctx.lineTo(startX, startY);
                // Bottom prong
                ctx.lineTo(startX + (footSize * startDir), startY + footSize / 2);
                ctx.stroke();

                // 2. PK Side (Target) -> "One" (Vertical Bar)
                ctx.beginPath();
                // Bar is perpendicular to the entering line.
                // Just draw a vertical bar at EndX
                ctx.moveTo(endX, endY - 6);
                ctx.lineTo(endX, endY + 6);

                ctx.stroke();
            }
        });
    }
}

// Helper: Reset Visualization
function resetVisualization() {
        document.querySelectorAll('.table-card').forEach(el => {
            el.classList.remove('active-table', 'dimmed');
        });
        document.querySelectorAll('.table-row').forEach(el => {
            el.classList.remove('highlight-row', 'anim-scan');
        });
    }

// Hook up UI feedback (WP4 + WP5 + WP6)
simulator.onStepChange = (step, index) => {
        console.log(`[SIM] Step ${index + 1}: ${step.description}`, step);

        // --- WP4: Step List Updates ---
        for (let i = 0; i < index; i++) {
            const el = document.getElementById(`step-${i}`);
            if (el) {
                el.classList.remove('active', 'pending');
                el.classList.add('done');
                el.querySelector('.step-progress').style.width = '100%';
                el.querySelector('.step-progress').style.transition = 'none';
            }
        }

        const currentEl = document.getElementById(`step-${index}`);
        if (currentEl) {
            currentEl.classList.remove('pending');
            currentEl.classList.add('active');
            currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const progressBar = currentEl.querySelector('.step-progress');
            progressBar.style.width = '0%';
            progressBar.style.transition = 'none';
            void progressBar.offsetWidth;
            progressBar.style.transition = `width ${simulator.speed}ms linear`;
            progressBar.style.width = '100%';
        }

        // --- WP5/WP6: Data Visualization ---
        resetVisualization();

        if (step.type === 'FROM' || step.type === 'JOIN') {
            const tName = step.entity;
            if (tName) {
                const card = document.getElementById(`table-card-${tName}`);
                if (card) {
                    card.classList.add('active-table');
                    document.querySelectorAll('.table-card').forEach(c => {
                        if (c.id !== `table-card-${tName}`) c.classList.add('dimmed');
                    });
                }
            }
        }
        else if (step.type === 'WHERE' || step.type === 'DELETE' || step.type === 'UPDATE') {
            // Basic Mock Logic for WHERE/Condition
            // If condition exists, try to find matching rows

            // Simplistic visual fallback if condition is complex
            document.querySelectorAll('.table-row').forEach(row => {
                if (Math.random() > 0.7) row.classList.add('anim-scan');
            });
        }

        // WP6: Logic Execution

        if (step.type === 'CREATE') {
            const newTable = step.entity;
            if (!parser.simulationData.TABLES[newTable] && step.columns) {
                parser.simulationData.TABLES[newTable] = {
                    columns: step.columns,
                    rows: []
                };
                renderTables(parser.simulationData);
                // Highlight new table
                setTimeout(() => {
                    const card = document.getElementById(`table-card-${newTable}`);
                    if (card) {
                        card.classList.add('active-table');
                        card.style.animation = 'scaleIn 0.5s ease-out';
                    }
                    drawRelationships(); // Update lines
                }, 50);
            }
        }

        else if (step.type === 'INSERT') {
            const tName = step.entity;
            const table = parser.simulationData.TABLES[tName];
            if (table) {
                // Map values to correct columns? 
                // For now assuming order matches.
                // Note: step.values are strings.
                table.rows.push(step.values);

                renderTables(parser.simulationData);

                // Highlight new row
                setTimeout(() => {
                    const lastRowIdx = table.rows.length - 1;
                    const rowEl = document.getElementById(`row-${tName}-${lastRowIdx}`);
                    if (rowEl) {
                        rowEl.classList.add('highlight-row');
                        // Add scale animation?
                    }
                }, 50);
            }
        }

        else if (step.type === 'UPDATE') {
            const tName = step.entity;
            const table = parser.simulationData.TABLES[tName];
            if (table && step.modifications) {
                // Mock Update: Apply to ALL rows that 'match' (mock match)
                // Let's modify the first row for demo
                if (table.rows.length > 0) {
                    const row = table.rows[0]; // Target 1st row

                    // Apply mods
                    step.modifications.forEach(mod => {
                        // Find col index
                        const colIdx = table.columns.findIndex(c => (c.name || c) === mod.col);
                        if (colIdx !== -1) {
                            row[colIdx] = mod.val;
                        }
                    });

                    renderTables(parser.simulationData);
                    // Highlight row 0
                    setTimeout(() => {
                        const rowEl = document.getElementById(`row-${tName}-0`);
                        if (rowEl) rowEl.classList.add('highlight-row', 'anim-scan');
                    }, 50);
                }
            }
        }

        else if (step.type === 'DELETE') {
            const tName = step.entity;
            const table = parser.simulationData.TABLES[tName];
            if (table && table.rows.length > 0) {
                // Mock Delete: Delete last row
                table.rows.pop();
                renderTables(parser.simulationData);
            }
        }
    };

simulator.onFinish = () => {
    console.log('[SIM] Simulation Finished');
    const lastIndex = simulator.steps.length - 1;
    const lastEl = document.getElementById(`step-${lastIndex}`);
    if (lastEl) {
        lastEl.classList.remove('active');
        lastEl.classList.add('done');
    }
};

btnPlay.addEventListener('click', () => {
    const sql = editor.getValue();
    if (!sql.trim()) {
        alert('Bitte SQL eingeben!');
        return;
    }

    console.log('Starting Simulation for:', sql);
    simulator.reset();

    // 1. Parse SQL into Steps
    const steps = parser.parse(sql);

    if (steps.length > 0) {
        // Visualize Initial List
        renderSteps(steps);

        // 2. Load Simulator
        simulator.loadSteps(steps);
        // 3. Start
        simulator.start();
    } else {
        console.warn('Parser returned no steps.');
    }
});

btnFF.addEventListener('click', () => {
    if (simulator.isPlaying) {
        simulator.fastForward();
    }
});


// Verify Init
console.log('SQL Editor Initialized');

// Initial Render of Mock Data (WP5)
renderTables(parser.simulationData);
});
