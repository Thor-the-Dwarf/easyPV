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

            // Find Target Header
            // We need to search specifically within the target table's card
            const targetTableCard = document.getElementById(`table-card-${targetTable}`);
            if (!targetTableCard) return;

            const targetTh = Array.from(targetTableCard.querySelectorAll('th')).find(th => th.dataset.colName === targetCol);

            if (targetTh) {
                const startRect = fkTh.getBoundingClientRect();
                const endRect = targetTh.getBoundingClientRect();

                // Calculate center points
                const x1 = startRect.left + startRect.width / 2;
                const y1 = startRect.top + startRect.height / 2;
                const x2 = endRect.left + endRect.width / 2;
                const y2 = endRect.top + endRect.height / 2;

                // Draw Curve
                ctx.beginPath();
                ctx.moveTo(x1, y1);

                // Control points for nice S-curve
                // Adjust curvature based on distance
                const cp1x = x1;
                const cp1y = y1 - 50; // Curve up
                const cp2x = x2;
                const cp2y = y2 - 50;

                // Simple line for now or Bezier? Let's try Bezier to top of table or simple direct line.
                // Since tables are floating, direct line might overlap.
                // Let's draw a line with some transparency/dash.

                ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);

                ctx.lineTo(x2, y2); // Simple line for prototype reliability

                ctx.stroke();

                // Draw dots at ends
                ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(x1, y1, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x2, y2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
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
