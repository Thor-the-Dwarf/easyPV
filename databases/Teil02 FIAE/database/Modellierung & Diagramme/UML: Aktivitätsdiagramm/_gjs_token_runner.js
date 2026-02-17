(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        running: false,
        tokens: [], // {id, currentNode, nextNode, progress, pathIndex}
        syncNodes: new Map(), // nodeId -> [tokenId1, tokenId2, ...]
        isDecisionPending: false
    };

    const el = {
        svg: document.getElementById('pipeline-svg'),
        syncText: document.getElementById('sync-text'),
        overlay: document.getElementById('overlay'),
        decisionBox: document.getElementById('decision-box'),
        guardText: document.getElementById('guard-text'),
        btnNext: document.getElementById('btn-next'),
        btnRelease: document.getElementById('btn-release')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'flow') {
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'ping') {
            osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_token_runner.json');
            state.config = await resp.json();

            el.btnRelease.addEventListener('click', startFlow);
            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
            requestAnimationFrame(gameLoop);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.running = false;
        state.tokens = [];
        state.syncNodes.clear();
        state.isDecisionPending = false;

        const s = state.config.scenarios[idx];
        el.overlay.classList.add('hidden');
        el.decisionBox.classList.add('hidden');
        el.svg.innerHTML = '';

        renderDiagram(s);
        updateSyncStatus('READY');
    }

    function renderDiagram(s) {
        // Render Edges (Pipes)
        s.edges.forEach(edge => {
            const fromNode = s.nodes.find(n => n.id === edge.from);
            const toNode = s.nodes.find(n => n.id === edge.to);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute('id', `pipe-${edge.from}-${edge.to}`);
            line.setAttribute('x1', fromNode.x);
            line.setAttribute('y1', fromNode.y);
            line.setAttribute('x2', toNode.x);
            line.setAttribute('y2', toNode.y);
            line.className.baseVal = 'pipe-line';
            el.svg.appendChild(line);

            if (edge.guard) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute('x', (fromNode.x + toNode.x) / 2);
                text.setAttribute('y', (fromNode.y + toNode.y) / 2 - 10);
                text.setAttribute('fill', 'var(--neon-blue)');
                text.setAttribute('font-size', '10px');
                text.textContent = edge.guard;
                el.svg.appendChild(text);
            }
        });

        // Render Nodes
        s.nodes.forEach(node => {
            if (node.type === 'task') {
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute('x', node.x - 60);
                rect.setAttribute('y', node.y - 30);
                rect.setAttribute('width', 120);
                rect.setAttribute('height', 60);
                rect.className.baseVal = 'node-task';
                el.svg.appendChild(rect);
            } else if (node.type === 'decision') {
                const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                const pts = `${node.x},${node.y - 30} ${node.x + 40},${node.y} ${node.x},${node.y + 30} ${node.x - 40},${node.y}`;
                poly.setAttribute('points', pts);
                poly.className.baseVal = 'node-decision';
                el.svg.appendChild(poly);
            } else if (node.type === 'fork' || node.type === 'join') {
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute('x', node.x - 5);
                rect.setAttribute('y', node.y - 40);
                rect.setAttribute('width', 10);
                rect.setAttribute('height', 80);
                rect.className.baseVal = 'node-task'; // Use similar style but vertical
                el.svg.appendChild(rect);
            } else {
                const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circ.setAttribute('cx', node.x);
                circ.setAttribute('cy', node.y);
                circ.setAttribute('r', 20);
                circ.className.baseVal = node.type === 'start' ? 'node-start' : 'node-end';
                el.svg.appendChild(circ);
            }

            if (node.label) {
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute('x', node.x);
                label.setAttribute('y', node.y + 5);
                label.setAttribute('text-anchor', 'middle');
                label.className.baseVal = 'node-label';
                label.textContent = node.label;
                el.svg.appendChild(label);
            }
        });
    }

    function startFlow() {
        if (state.running) return;
        state.running = true;
        playSound('flow');
        const s = state.config.scenarios[state.scenarioIdx];
        const startNode = s.nodes.find(n => n.type === 'start');
        const firstEdge = s.edges.find(e => e.from === startNode.id);

        state.tokens.push({
            id: 1,
            currentNode: startNode.id,
            nextNode: firstEdge.to,
            progress: 0,
            active: true
        });
    }

    function gameLoop() {
        if (state.running && !state.isDecisionPending) {
            updateTokens();
        }
        renderTokens();
        requestAnimationFrame(gameLoop);
    }

    function updateTokens() {
        const s = state.config.scenarios[state.scenarioIdx];
        const speed = 0.01;

        state.tokens.forEach(t => {
            if (!t.active) return;

            t.progress += speed;

            if (t.progress >= 1) {
                t.progress = 0;
                t.currentNode = t.nextNode;
                const node = s.nodes.find(n => n.id === t.currentNode);

                if (node.type === 'end') {
                    t.active = false;
                    if (state.tokens.every(token => !token.active)) {
                        finishScenario(true);
                    }
                } else if (node.type === 'decision') {
                    state.isDecisionPending = true;
                    showDecision(node);
                } else if (node.type === 'fork') {
                    const edges = s.edges.filter(e => e.from === node.id);
                    t.nextNode = edges[0].to;
                    // Create second token
                    state.tokens.push({
                        id: state.tokens.length + 1,
                        currentNode: node.id,
                        nextNode: edges[1].to,
                        progress: 0,
                        active: true
                    });
                } else if (node.type === 'join') {
                    t.active = false;
                    let waiters = state.syncNodes.get(node.id) || [];
                    waiters.push(t.id);
                    state.syncNodes.set(node.id, waiters);
                    updateSyncStatus(`WAITING: ${waiters.length}/2`);

                    if (waiters.length === 2) {
                        const firstEdge = s.edges.find(e => e.from === node.id);
                        state.tokens.push({
                            id: state.tokens.length + 1,
                            currentNode: node.id,
                            nextNode: firstEdge.to,
                            progress: 0,
                            active: true
                        });
                        playSound('ping');
                        updateSyncStatus('SYNCED');
                    }
                } else {
                    const nextEdge = s.edges.find(e => e.from === t.currentNode);
                    t.nextNode = nextEdge.to;
                }
            }
        });
    }

    function renderTokens() {
        const s = state.config.scenarios[state.scenarioIdx];
        // Remove old token visuals
        const old = el.svg.querySelectorAll('.token-pulse');
        old.forEach(o => o.remove());

        state.tokens.forEach(t => {
            if (!t.active) return;
            const from = s.nodes.find(n => n.id === t.currentNode);
            const to = s.nodes.find(n => n.id === t.nextNode);

            const x = from.x + (to.x - from.x) * t.progress;
            const y = from.y + (to.y - from.y) * t.progress;

            const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circ.setAttribute('cx', x);
            circ.setAttribute('cy', y);
            circ.setAttribute('r', 8);
            circ.className.baseVal = 'token-pulse';
            el.svg.appendChild(circ);
        });
    }

    function showDecision(node) {
        el.guardText.textContent = node.label;
        el.decisionBox.classList.remove('hidden');

        const btns = el.decisionBox.querySelectorAll('.guard-btn');
        btns.forEach(btn => {
            btn.onclick = () => {
                const val = btn.dataset.val;
                el.decisionBox.classList.add('hidden');
                const s = state.config.scenarios[state.scenarioIdx];
                const edge = s.edges.find(e => e.from === node.id && e.guard === val);

                if (edge) {
                    const token = state.tokens.find(t => t.currentNode === node.id);
                    token.nextNode = edge.to;
                    state.isDecisionPending = false;
                    playSound('ping');
                } else {
                    finishScenario(false);
                }
            };
        });
    }

    function updateSyncStatus(text) {
        el.syncText.textContent = text;
    }

    function finishScenario(success) {
        state.running = false;
        if (success) {
            el.overlay.classList.remove('hidden');
            playSound('flow');
        } else {
            alert("Pipeline Failure! Wrong guard selected.");
            startScenario(state.scenarioIdx);
        }
    }

    function nextScenario() {
        if (state.scenarioIdx < state.config.scenarios.length - 1) {
            startScenario(state.scenarioIdx + 1);
        } else {
            location.reload();
        }
    }

    init();
})();
