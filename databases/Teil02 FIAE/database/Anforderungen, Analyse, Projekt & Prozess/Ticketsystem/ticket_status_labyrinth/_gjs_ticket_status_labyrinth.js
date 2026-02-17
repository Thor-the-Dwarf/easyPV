(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        currentNodeId: null,
        currentRole: 'dev', // Default
        pathHistory: [],
        gameOver: false,
        nodes: {},
        transitions: []
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudRole: document.getElementById('role-val'),
        hudLevel: document.getElementById('level-val'),
        svgContainer: document.getElementById('circuit-svg'),
        nodesGroup: document.getElementById('nodes-layer'),
        pathsGroup: document.getElementById('paths-layer'),
        avatarGroup: document.getElementById('avatar-group'),
        roleMenu: document.getElementById('role-menu'),
        roleBtn: document.getElementById('role-display'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        feedback: document.getElementById('feedback-msg')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'move') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'win') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('data/_gg01_ticket_status_labyrinth.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            el.roleBtn.addEventListener('click', toggleRoleMenu);

            loadLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        loadLevel(0);
    }

    function toggleRoleMenu() {
        const level = state.config.levels[state.levelIdx];
        // Populate
        el.roleMenu.innerHTML = level.roles_allowed.map(r => {
            const def = state.config.roles[r];
            return `<button class="role-btn" data-role="${r}">${def.icon} ${def.label}</button>`;
        }).join('');

        // Add click handlers
        el.roleMenu.querySelectorAll('.role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setRole(btn.dataset.role);
                el.roleMenu.classList.add('hidden');
            });
        });

        el.roleMenu.classList.toggle('hidden');
    }

    function setRole(roleId) {
        state.currentRole = roleId;
        const def = state.config.roles[roleId];
        el.hudRole.innerHTML = `${def.icon} ${def.label}`;
        el.hudRole.style.borderColor = def.color;
        el.hudRole.style.color = def.color;
    }

    function loadLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }

        state.levelIdx = idx;
        const level = state.config.levels[idx];

        // Reset State
        state.score = (idx === 0) ? 0 : state.score;
        state.currentNodeId = level.start_node;
        state.nodes = {};
        state.transitions = level.transitions;
        state.pathHistory = [];
        state.gameOver = false;

        // Set Initial Role (First in allowed list)
        setRole(level.roles_allowed[0]);

        el.hudLevel.textContent = level.id;
        el.resultScreen.classList.add('hidden');
        el.roleMenu.classList.add('hidden');
        updateHUD();

        renderMap(level);
        moveAvatarTo(state.currentNodeId, false);
    }

    function renderMap(level) {
        el.nodesGroup.innerHTML = '';
        el.pathsGroup.innerHTML = '';

        // Index Nodes
        level.nodes.forEach(n => state.nodes[n.id] = n);

        // Draw Paths (Transitions)
        level.transitions.forEach(t => {
            const from = state.nodes[t.from];
            const to = state.nodes[t.to];
            if (!from || !to) return;

            const pathOps = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
            // Or curve? cubic-bezier? Straight line is simpler for circuit look

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathOps);
            path.setAttribute('class', 'connection-line');
            path.setAttribute('id', `path-${t.from}-${t.to}`);
            el.pathsGroup.appendChild(path);
        });

        // Draw Nodes
        level.nodes.forEach(n => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'node-group');
            g.dataset.id = n.id;
            g.dataset.type = n.type;
            g.setAttribute('transform', `translate(${n.x}, ${n.y})`);

            // Circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', 40);
            circle.setAttribute('class', 'node-circle');
            g.appendChild(circle);

            // Text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.textContent = n.label;
            text.setAttribute('class', 'node-label');
            // Wrap text logic? Assuming short labels
            g.appendChild(text);

            // Click Handler
            g.addEventListener('click', () => onNodeClick(n.id));

            el.nodesGroup.appendChild(g);
        });
    }

    function moveAvatarTo(nodeId, animate = true) {
        const node = state.nodes[nodeId];
        if (!node) return;

        if (animate) {
            el.avatarGroup.style.transform = `translate(${node.x}px, ${node.y}px)`;
            // Highlight Lines logic could go here
        } else {
            el.avatarGroup.style.transition = 'none';
            el.avatarGroup.style.transform = `translate(${node.x}px, ${node.y}px)`;
            // Force reflow
            el.avatarGroup.offsetHeight;
            el.avatarGroup.style.transition = '';
        }
    }

    function onNodeClick(targetId) {
        if (state.gameOver) return;
        if (targetId === state.currentNodeId) return;

        // Validate Transition
        // Find transition from Current to Target
        const validTrans = state.transitions.find(t =>
            t.from === state.currentNodeId &&
            t.to === targetId
        );

        if (validTrans) {
            // Check Role
            if (validTrans.role && validTrans.role !== state.currentRole) {
                // Role Mismatch
                showFeedback(`Role Denied! Needs: ${validTrans.role}`, 'error');
                playTone('error');
                state.score = Math.max(0, state.score - 50);
                return;
            }

            // Success Move
            state.pathHistory.push(state.currentNodeId);
            state.currentNodeId = targetId;
            state.score += 100;
            moveAvatarTo(targetId);
            playTone('move');

            // Check if End Node
            const targetNode = state.nodes[targetId];
            if (targetNode.type === 'end') {
                setTimeout(() => {
                    playTone('win');
                    alert("Workflow Completed!");
                    loadLevel(state.levelIdx + 1);
                }, 600);
            }
        } else {
            // Invalid Transition
            showFeedback("Invalid Transition!", 'error');
            playTone('error');
            state.score = Math.max(0, state.score - 20);

            // Visual Shake
            const currentG = document.querySelector(`.node-group[data-id="${state.currentNodeId}"]`);
            if (currentG) {
                currentG.classList.add('pulse-red');
                setTimeout(() => currentG.classList.remove('pulse-red'), 500);
            }
        }
        updateHUD();
    }

    function showFeedback(text, type) {
        el.feedback.textContent = text;
        el.feedback.className = `feedback-msg show ${type}`;
        el.feedback.style.opacity = 1;
        setTimeout(() => el.feedback.style.opacity = 0, 1000);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.classList.remove('hidden');
    }

    // Debug
    window.render_game_to_text = () => JSON.stringify(state);

    init();
})();
