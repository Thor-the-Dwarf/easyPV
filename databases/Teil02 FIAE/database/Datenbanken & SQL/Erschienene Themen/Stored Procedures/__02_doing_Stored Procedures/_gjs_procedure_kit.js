(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        isRunning: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        levelDesc: document.getElementById('level-desc'),
        inlet: document.getElementById('factory-inlet'),
        outlet: document.getElementById('factory-outlet'),
        codeBlock: document.getElementById('code-block'),
        pulse: document.getElementById('data-pulse'),
        btnCall: document.getElementById('btn-call'),
        resultOverlay: document.getElementById('result-overlay'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'start') {
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'tick') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_gg01_procedure_kit.json');
            state.config = await resp.json();

            el.btnCall.addEventListener('click', callProcedure);
            el.btnNext.addEventListener('click', () => {
                el.resultOverlay.classList.add('hidden');
                if (state.levelIdx < state.config.levels.length - 1) {
                    startLevel(state.levelIdx + 1);
                } else {
                    location.reload();
                }
            });

            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.isRunning = false;
        const level = state.config.levels[idx];

        el.levelTitle.textContent = level.title;
        el.levelDesc.textContent = level.description;
        el.btnCall.disabled = false;

        renderInputs(level.inputs);
        renderOutputs(level.outputs);
        renderCode(level);
    }

    function renderInputs(inputs) {
        el.inlet.innerHTML = '<div class="section-label">Inlet (IN Params)</div>';
        inputs.forEach(inp => {
            const card = document.createElement('div');
            card.className = 'param-card';
            card.innerHTML = `
        <div class="param-name">${inp.name}</div>
        <div class="param-type">${inp.type}</div>
        <input type="number" class="param-input" id="inp-${inp.name}" 
               value="${inp.default}" min="${inp.min}" max="${inp.max}">
      `;
            el.inlet.appendChild(card);
        });
    }

    function renderOutputs(outputs) {
        el.outlet.innerHTML = '<div class="section-label">Outlet (OUT Params)</div>';
        outputs.forEach(out => {
            const card = document.createElement('div');
            card.className = 'param-card';
            card.innerHTML = `
        <div class="param-name">${out.name}</div>
        <div class="param-type">${out.type}</div>
        <div class="out-value" id="out-${out.name}">?</div>
      `;
            el.outlet.appendChild(card);
        });
    }

    function renderCode(level) {
        const l = level.logic[0];
        el.codeBlock.innerHTML = `
      <span class="keyword">CREATE PROCEDURE</span> calc_logic(<br>
      &nbsp;&nbsp;<span class="keyword">IN</span> params...<br>
      )<br>
      <span class="keyword">BEGIN</span><br>
      &nbsp;&nbsp;<span class="keyword">IF</span> <span class="condition">${l.condition}</span> <span class="keyword">THEN</span><br>
      &nbsp;&nbsp;&nbsp;&nbsp;<span class="assignment">${l.then}</span>;<br>
      &nbsp;&nbsp;<span class="keyword">ELSE</span><br>
      &nbsp;&nbsp;&nbsp;&nbsp;<span class="assignment">${l.else}</span>;<br>
      &nbsp;&nbsp;<span class="keyword">END IF</span>;<br>
      <span class="keyword">END</span>;
    `;
    }

    async function callProcedure() {
        if (state.isRunning) return;
        state.isRunning = true;
        el.btnCall.disabled = true;

        const level = state.config.levels[state.levelIdx];
        const inputs = {};
        level.inputs.forEach(inp => {
            inputs[inp.name] = parseFloat(document.getElementById(`inp-${inp.name}`).value);
        });

        playSound('start');
        await animateLogicFlow(level, inputs);
    }

    async function animateLogicFlow(level, inputs) {
        const pulse = el.pulse;
        pulse.style.display = 'block';

        // Position at inlet
        const inletRect = el.inlet.getBoundingClientRect();
        const engineRect = document.querySelector('.logic-engine').getBoundingClientRect();

        pulse.style.left = `${inletRect.right - engineRect.left}px`;
        pulse.style.top = `${inletRect.top - engineRect.top + 50}px`;

        // Move to center
        await movePulse(pulse, {
            left: engineRect.width / 2,
            top: engineRect.height / 2
        }, 1000);

        playSound('tick');

        // Evaluate logic
        const logic = level.logic[0];
        let result = {};

        // Simple expression evaluator (very basic for this game)
        const conditionMet = evaluateCondition(logic.condition, inputs);
        const assignment = conditionMet ? logic.then : logic.else;

        const [varName, expr] = assignment.split('=').map(s => s.trim());
        result[varName] = evaluateExpression(expr, inputs);

        // Final move to outlet
        const outletRect = el.outlet.getBoundingClientRect();
        await movePulse(pulse, {
            left: outletRect.left - engineRect.left,
            top: outletRect.top - engineRect.top + 50
        }, 1000);

        pulse.style.display = 'none';

        // Update display
        Object.keys(result).forEach(name => {
            document.getElementById(`out-${name}`).textContent = result[name];
        });

        playSound('success');

        setTimeout(() => {
            el.resultOverlay.classList.remove('hidden');
        }, 800);
    }

    function movePulse(p, pos, duration) {
        return new Promise(resolve => {
            const startLeft = parseFloat(p.style.left);
            const startTop = parseFloat(p.style.top);
            const startTime = performance.now();

            function step(now) {
                const progress = Math.min((now - startTime) / duration, 1);
                p.style.left = `${startLeft + (pos.left - startLeft) * progress}px`;
                p.style.top = `${startTop + (pos.top - startTop) * progress}px`;
                if (progress < 1) requestAnimationFrame(step);
                else resolve();
            }
            requestAnimationFrame(step);
        });
    }

    function evaluateCondition(cond, inputs) {
        // Basic logic replacement
        let processed = cond;
        Object.keys(inputs).forEach(k => {
            processed = processed.replace(new RegExp(k, 'g'), inputs[k]);
        });
        processed = processed.replace(/AND/g, '&&').replace(/OR/g, '||');

        try {
            return eval(processed);
        } catch (e) {
            return false;
        }
    }

    function evaluateExpression(expr, inputs) {
        let processed = expr;
        Object.keys(inputs).forEach(k => {
            processed = processed.replace(new RegExp(k, 'g'), inputs[k]);
        });
        try {
            return eval(processed);
        } catch (e) {
            return 0;
        }
    }

    init();
})();
