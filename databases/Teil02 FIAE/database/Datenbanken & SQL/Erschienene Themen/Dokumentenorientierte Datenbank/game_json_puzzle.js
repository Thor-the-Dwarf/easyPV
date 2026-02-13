(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        structure: {}, // Focus on current root object
        gameOver: false,
        dragSrc: null
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        targetDisplay: document.getElementById('target-display'),
        hints: document.getElementById('hints'),
        stage: document.getElementById('root-drop-zone'),
        palette: document.getElementById('palette-items'),
        promptOverlay: document.getElementById('prompt-overlay'),
        promptInput: document.getElementById('prompt-input'),
        promptConfirm: document.getElementById('prompt-confirm'),
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

        if (type === 'pop') {
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_json_puzzle.json');
            state.config = await resp.json();

            el.nextBtn.addEventListener('click', () => {
                if (state.levelIdx < state.config.levels.length - 1) {
                    el.resultScreen.classList.add('hidden');
                    startLevel(state.levelIdx + 1);
                } else {
                    window.location.reload();
                }
            });

            // Prompt Handling
            el.promptConfirm.addEventListener('click', confirmPrompt);

            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        const level = state.config.levels[idx];

        el.levelTitle.textContent = `Level ${idx + 1}: ${level.title}`;
        el.targetDisplay.textContent = JSON.stringify(level.target, null, 2);
        el.hints.textContent = "Hints: " + level.hints.join(' | ');

        resetStage();
        renderPalette();
    }

    function resetStage() {
        el.stage.innerHTML = '<div style="color:#666">Drag Root Container Here</div>';
        // Root drop handler
        setupDropZone(el.stage, (type, val) => {
            if (type === 'object') {
                el.stage.innerHTML = '';
                createObject(el.stage);
            } else if (type === 'array') {
                el.stage.innerHTML = '';
                createArray(el.stage);
            } else {
                playTone('error');
                alert("Root must be Object or Array!");
            }
        });
    }

    function renderPalette() {
        el.palette.innerHTML = '';
        state.config.toolbox.forEach(tool => {
            const div = document.createElement('div');
            div.className = 'draggable-item';
            div.draggable = true;
            div.dataset.type = tool.type;

            div.innerHTML = `<span class="item-icon">${tool.label}</span> <span>${tool.info}</span>`;

            div.addEventListener('dragstart', e => {
                e.dataTransfer.setData('type', tool.type);
                state.dragSrc = tool;
            });

            el.palette.appendChild(div);
        });
    }

    function createObject(parent) {
        const container = document.createElement('div');
        container.className = 'json-container json-object';
        container.innerHTML = `<div class="container-header">Object {}</div>`;

        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';

        setupDropZone(dropZone, (type, val) => {
            if (type === 'key') {
                promptForValue("Enter Key Name:", (keyName) => {
                    addKeyRow(dropZone, keyName);
                });
            } else {
                playTone('error');
                alert("Objects need Keys first!");
            }
        });

        container.appendChild(dropZone);
        parent.appendChild(container);
        playTone('pop');
        checkWinCondition();
    }

    function createArray(parent) {
        const container = document.createElement('div');
        container.className = 'json-container json-array';
        container.innerHTML = `<div class="container-header">Array []</div>`;

        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';

        setupDropZone(dropZone, (type, val) => {
            if (type === 'key') {
                playTone('error');
                alert("Arrays don't use Keys!");
            } else {
                // Add value directly
                addValueToContainer(dropZone, type);
            }
        });

        container.appendChild(dropZone);
        parent.appendChild(container);
        playTone('pop');
        checkWinCondition();
    }

    function addKeyRow(parent, keyName) {
        const row = document.createElement('div');
        row.className = 'kv-row';
        row.dataset.key = keyName;

        row.innerHTML = `
        <div class="key-slot">"${keyName}"</div>
        <div class="colon">:</div>
      `;

        const valSlot = document.createElement('div');
        valSlot.className = 'value-slot empty';
        valSlot.textContent = 'Value?';

        setupDropZone(valSlot, (type, val) => {
            valSlot.innerHTML = '';
            valSlot.className = 'value-slot';

            if (type === 'object') createObject(valSlot);
            else if (type === 'array') createArray(valSlot);
            else addValueToSlot(valSlot, type);
        });

        row.appendChild(valSlot);
        parent.appendChild(row);
        playTone('pop');
        checkWinCondition();
    }

    function addValueToContainer(parent, type) {
        // Wrapper for array items
        const wrapper = document.createElement('div');
        addValueToSlot(wrapper, type);
        parent.appendChild(wrapper);
    }

    function addValueToSlot(slot, type) {
        if (type === 'string' || type === 'number' || type === 'boolean') {
            promptForValue(`Enter ${type} value:`, (val) => {
                // Cast
                if (type === 'number') val = Number(val);
                if (type === 'boolean') val = (val.toLowerCase() === 'true');

                const span = document.createElement('span');
                span.className = `json-val val-${type}`;

                if (type === 'string') span.textContent = `"${val}"`;
                else span.textContent = val;

                span.dataset.val = val;
                span.dataset.type = type;

                slot.appendChild(span);
                playTone('pop');
                checkWinCondition();
            });
        }
    }

    function setupDropZone(el, callback) {
        el.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add('hover');
        });
        el.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('hover');
        });
        el.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('hover');
            const type = e.dataTransfer.getData('type');
            callback(type);
        });
    }

    // Very simple modal prompt
    let currentPromptCallback = null;
    function promptForValue(msg, cb) {
        el.promptOverlay.querySelector('h3').textContent = msg;
        el.promptInput.value = '';
        el.promptOverlay.classList.remove('hidden');
        el.promptInput.focus();
        currentPromptCallback = cb;
    }

    function confirmPrompt() {
        const val = el.promptInput.value;
        if (val && currentPromptCallback) {
            currentPromptCallback(val);
            el.promptOverlay.classList.add('hidden');
            currentPromptCallback = null;
        }
    }

    // Enter key support
    el.promptInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmPrompt();
    });

    function checkWinCondition() {
        // Reconstruct JSON from DOM
        const constructed = parseDOM(el.stage.firstElementChild);
        const target = state.config.levels[state.levelIdx].target;

        // Compare
        if (JSON.stringify(constructed) === JSON.stringify(target)) {
            playTone('success');
            setTimeout(() => {
                showResult(true, "JSON Validated!");
            }, 500);
        }
    }

    function parseDOM(node) {
        if (!node) return null;

        if (node.classList.contains('json-object')) {
            const obj = {};
            const rows = node.querySelectorAll(':scope > .drop-zone > .kv-row');
            rows.forEach(row => {
                const key = row.dataset.key;
                const valContainer = row.querySelector('.value-slot').firstElementChild;
                if (valContainer) {
                    obj[key] = parseDOM(valContainer);
                }
            });
            return obj;
        }

        if (node.classList.contains('json-array')) {
            const arr = [];
            const items = node.querySelectorAll(':scope > .drop-zone > div'); // items wrappers
            items.forEach(item => {
                const valNode = item.firstElementChild; // json-container or json-val
                if (valNode) arr.push(parseDOM(valNode));
            });
            return arr;
        }

        if (node.classList.contains('json-val')) {
            const type = node.dataset.type;
            let val = node.dataset.val;
            if (type === 'number') return Number(val);
            if (type === 'boolean') return val === 'true';
            return val;
        }

        // Wrapper div case
        if (node.tagName === 'DIV' && !node.classList.contains('json-container')) {
            return parseDOM(node.firstElementChild);
        }

        return null;
    }

    function showResult(win, msg) {
        el.finalResult.textContent = msg;
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
