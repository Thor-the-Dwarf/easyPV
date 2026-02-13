(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        connections: [], // { source: headerName, target: fieldName, svgElement: path }
        dragStart: null, // { x, y, sourceHeader, dotElement }
        gameOver: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        sourcePanel: document.getElementById('source-list'),
        targetPanel: document.getElementById('target-list'),
        svgCanvas: document.getElementById('cable-svg'),
        dragLine: document.getElementById('drag-line'),
        logConsole: document.getElementById('log-console'),
        resultScreen: document.getElementById('result-screen'),
        finalResult: document.getElementById('final-result'),
        nextBtn: document.getElementById('next-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'connect') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_csv_mapper.json');
            state.config = await resp.json();

            el.nextBtn.addEventListener('click', () => {
                el.resultScreen.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            });

            // Global Mouse Events for Dragging
            document.addEventListener('mousemove', onDragMove);
            document.addEventListener('mouseup', onDragEnd);

            startLevel(0);
        } catch (e) {
            console.error(e);
            log("Error loading config: " + e.message, 'error');
        }
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            showResult(true, "All Data Migrated Successfully!");
            return;
        }
        state.levelIdx = idx;
        state.connections = [];
        state.gameOver = false;

        // Clear canvas (keep drag-line)
        while (el.svgCanvas.children.length > 1) {
            if (el.svgCanvas.lastElementChild.id !== 'drag-line') {
                el.svgCanvas.lastElementChild.remove();
            } else {
                break;
            }
        }

        const level = state.config.levels[idx];
        el.levelTitle.textContent = `Level ${idx + 1}: ${level.title}`;
        log(`Starting Level: ${level.title}`, 'info');
        log(`Task: ${level.description}`, 'info');

        renderSource(level.source);
        renderTarget(level.target);
    }

    function renderSource(source) {
        el.sourcePanel.innerHTML = '';
        source.headers.forEach(header => {
            const div = document.createElement('div');
            div.className = 'field-item';
            div.innerHTML = `<span>${header}</span>`;

            const dot = document.createElement('div');
            dot.className = 'connector-dot source-dot';
            dot.dataset.header = header;
            dot.addEventListener('mousedown', e => onDragStart(e, header, dot));

            div.appendChild(dot);
            el.sourcePanel.appendChild(div);
        });
    }

    function renderTarget(target) {
        el.targetPanel.innerHTML = '';
        target.fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'field-item';
            div.innerHTML = `<span>${field.name}</span> <span style="font-size:0.8em; color:#666">${field.type}</span>`;

            const dot = document.createElement('div');
            dot.className = 'connector-dot target-dot';
            dot.dataset.field = field.name;
            // Target dots are drop targets, handled by mouseup global

            div.appendChild(dot); // append child first
            div.insertBefore(dot, div.firstChild); // move to left
            el.targetPanel.appendChild(div);
        });
    }

    function onDragStart(e, header, dotEl) {
        if (state.gameOver) return;
        const rect = dotEl.getBoundingClientRect();
        const canvasRect = el.svgCanvas.getBoundingClientRect();

        state.dragStart = {
            x: rect.left + rect.width / 2 - canvasRect.left,
            y: rect.top + rect.height / 2 - canvasRect.top,
            sourceHeader: header,
            dotElement: dotEl
        };

        el.dragLine.setAttribute('d', `M${state.dragStart.x},${state.dragStart.y} L${state.dragStart.x},${state.dragStart.y}`);
        el.dragLine.style.display = 'block';
    }

    function onDragMove(e) {
        if (!state.dragStart) return;

        const canvasRect = el.svgCanvas.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;

        // Bezier curve
        const sx = state.dragStart.x;
        const sy = state.dragStart.y;
        const cp1x = sx + (x - sx) / 2;
        const cp2x = x - (x - sx) / 2;

        el.dragLine.setAttribute('d', `M${sx},${sy} C${cp1x},${sy} ${cp2x},${y} ${x},${y}`);
    }

    function onDragEnd(e) {
        if (!state.dragStart) return;

        // Check if dropped on target dot
        const target = document.elementFromPoint(e.clientX, e.clientY);

        if (target && target.classList.contains('target-dot')) {
            createConnection(state.dragStart.sourceHeader, target.dataset.field, target);
        }

        state.dragStart = null;
        el.dragLine.style.display = 'none';
    }

    function createConnection(sourceHeader, targetField, targetDot) {
        // Check if already connected
        if (state.connections.find(c => c.target === targetField)) {
            log(`Target ${targetField} is already connected!`, 'error');
            playTone('error');
            return;
        }

        const level = state.config.levels[state.levelIdx];

        // Calculate coordinates
        const canvasRect = el.svgCanvas.getBoundingClientRect();
        const sourceDot = document.querySelector(`.source-dot[data-header="${sourceHeader}"]`);

        if (!sourceDot) return;

        const sRect = sourceDot.getBoundingClientRect();
        const tRect = targetDot.getBoundingClientRect();

        const sx = sRect.left + sRect.width / 2 - canvasRect.left;
        const sy = sRect.top + sRect.height / 2 - canvasRect.top;
        const tx = tRect.left + tRect.width / 2 - canvasRect.left;
        const ty = tRect.top + tRect.height / 2 - canvasRect.top;

        // Create SVG Path
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "cable");
        const cp1x = sx + (tx - sx) / 2;
        const cp2x = tx - (tx - sx) / 2;
        path.setAttribute("d", `M${sx},${sy} C${cp1x},${sy} ${cp2x},${ty} ${tx},${ty}`);

        // Validate
        const expected = level.mapping[sourceHeader];
        if (expected === targetField) {
            path.classList.add('active');
            log(`Connected [${sourceHeader}] -> [${targetField}]: OK`, 'success');
            playTone('connect');
        } else {
            path.classList.add('error');
            log(`Connected [${sourceHeader}] -> [${targetField}]: MISMATCH (Expected: ${expected})`, 'error');
            playTone('error');
            // Auto remove after a second
            setTimeout(() => {
                path.remove();
                state.connections = state.connections.filter(c => c.target !== targetField);
            }, 1000);
        }

        // Interaction to remove
        path.addEventListener('click', () => {
            path.remove();
            state.connections = state.connections.filter(c => c.target !== targetField);
            log(`Disconnected [${sourceHeader}] -> [${targetField}]`, 'info');
        });

        el.svgCanvas.appendChild(path);

        if (expected === targetField) {
            state.connections.push({ source: sourceHeader, target: targetField, element: path });
            checkCompletion();
        }
    }

    function checkCompletion() {
        const level = state.config.levels[state.levelIdx];
        const required = Object.keys(level.mapping).length;

        if (state.connections.length === required) {
            setTimeout(() => {
                showResult(false, `Import of Level ${state.levelIdx + 1} Complete!`);
            }, 500);
        }
    }

    function showResult(finishedAll, msg) {
        if (finishedAll) {
            el.nextBtn.textContent = 'FINISH';
            el.nextBtn.onclick = () => window.location.reload();
        } else {
            el.nextBtn.textContent = 'NEXT IMPORT';
        }
        el.finalResult.textContent = msg;
        el.resultScreen.classList.remove('hidden');
    }

    function log(msg, type) {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = `> ${msg}`;
        el.logConsole.appendChild(div);
        el.logConsole.scrollTop = el.logConsole.scrollHeight;
    }

    init();
})();
