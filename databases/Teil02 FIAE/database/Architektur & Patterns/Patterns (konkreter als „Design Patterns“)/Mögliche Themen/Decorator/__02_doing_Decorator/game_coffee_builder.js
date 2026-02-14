(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        money: 0,
        currentOrder: null,
        composition: [], // List of ingredients [base, dec1, dec2]
        gameOver: false
    };

    const el = {
        hudMoney: document.getElementById('money-val'),
        hudLevel: document.getElementById('level-val'),
        orderText: document.getElementById('order-text'),
        cupContainer: document.getElementById('cup-container'),
        baseRack: document.getElementById('base-rack'),
        decRack: document.getElementById('decorator-rack'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        currentPrice: document.getElementById('current-price'),
        compText: document.getElementById('composition-text'),
        submitBtn: document.getElementById('submit-btn'),
        resetBtn: document.getElementById('reset-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'add') {
            osc.frequency.setValueAtTime(300 + (state.composition.length * 50), now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start();
            osc.stop(now + 0.15);
        } else if (type === 'cash') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_coffee_builder.json');
            state.config = await resp.json();

            setupIngredients();
            el.restartBtn.addEventListener('click', restartGame);
            el.submitBtn.addEventListener('click', submitOrder);
            el.resetBtn.addEventListener('click', resetCup);

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function setupIngredients() {
        // Clear
        el.baseRack.innerHTML = '';
        el.decRack.innerHTML = '';

        const bases = state.config.ingredients.filter(i => i.type === 'base');
        const decorators = state.config.ingredients.filter(i => i.type === 'decorator');

        bases.forEach(ing => createBtn(ing, el.baseRack));
        decorators.forEach(ing => createBtn(ing, el.decRack));
    }

    function createBtn(ing, container) {
        const btn = document.createElement('button');
        btn.className = 'ingredient-btn';
        btn.textContent = `${ing.label} ($${ing.price.toFixed(2)})`;
        btn.addEventListener('click', () => addIngredient(ing.id));
        container.appendChild(btn);
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.money = 0;
        state.gameOver = false;

        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }

        state.levelIdx = idx;

        updateHUD();
        nextOrder();
    }

    function nextOrder() {
        const level = state.config.levels[state.levelIdx];
        const orders = level.orders;

        // Pick random or sequential? Let's do random from list
        const orderData = orders[Math.floor(Math.random() * orders.length)];
        state.currentOrder = orderData;

        el.orderText.textContent = orderData.name;
        resetCup();
    }

    function resetCup() {
        state.composition = [];
        updateCupVisuals();
    }

    function addIngredient(id) {
        const ing = state.config.ingredients.find(i => i.id === id);

        // Validation: Base must be first, and only one base
        if (ing.type === 'base') {
            if (state.composition.length > 0) {
                // Reset if adding new base? Or block?
                state.composition = [id]; // Replace
            } else {
                state.composition.push(id);
            }
        } else {
            // Decorator
            if (state.composition.length === 0) return; // Need base first
            state.composition.push(id);
        }

        playTone('add');
        updateCupVisuals();
    }

    function updateCupVisuals() {
        // Calculate Price & Text
        let price = 0;
        let text = "";

        // Reverse loop for text wrapping logic?
        // Actually standard Decorator: New(Old)
        // We stored order of addition: [Base, Dec1, Dec2] -> Dec2(Dec1(Base))

        if (state.composition.length > 0) {
            const baseId = state.composition[0];
            const base = state.config.ingredients.find(i => i.id === baseId);
            price += base.price;
            text = base.label;

            for (let i = 1; i < state.composition.length; i++) {
                const decId = state.composition[i];
                const dec = state.config.ingredients.find(d => d.id === decId);
                price += dec.price;
                text = `${dec.prefix}${text}${dec.suffix}`;
            }
        }

        el.currentPrice.textContent = `$${price.toFixed(2)}`;
        el.compText.textContent = text || "Empty";

        // Visual Layers
        // Clear old layers except price and handle
        el.cupContainer.querySelectorAll('.drink-layer').forEach(l => l.remove());

        state.composition.forEach(ingId => {
            const ing = state.config.ingredients.find(i => i.id === ingId);
            const layer = document.createElement('div');
            layer.className = 'drink-layer';
            layer.style.backgroundColor = ing.color;
            layer.style.height = '20px'; // Grow
            el.cupContainer.insertBefore(layer, el.cupContainer.firstChild); // Stack up

            // Trigger reflow for transition?
            setTimeout(() => layer.style.height = (180 / Math.max(1, state.composition.length)) + 'px', 10);
        });

        // Add steam if hot
        if (state.composition.length > 0) {
            const steam = document.createElement('div');
            steam.className = 'steam';
            el.cupContainer.appendChild(steam);
            setTimeout(() => steam.remove(), 2000);
        }
    }

    function submitOrder() {
        // Validate
        const required = state.currentOrder.req; // e.g. ["base_coffee", "dec_milk"]

        // Check if composition contains exactly these items (order doesn't matter for ingredients set, but matters for decorator structure technically)
        // For this game, let's just check presence and count

        const currentIds = [...state.composition].sort();
        const reqIds = [...required].sort();

        const match = JSON.stringify(currentIds) === JSON.stringify(reqIds);

        if (match) {
            state.money += parseFloat(el.currentPrice.textContent.substring(1));
            state.score += 100;
            playTone('cash');

            // Animate Cup Leaving?
            el.cupContainer.style.transform = "translateX(200px)";
            setTimeout(() => {
                el.cupContainer.style.transform = "translateX(0)";

                // Proceed
                if (state.score >= (state.levelIdx + 1) * 300) {
                    startLevel(state.levelIdx + 1);
                } else {
                    nextOrder();
                }
            }, 300);

        } else {
            // Shake
            el.cupContainer.animate([
                { transform: 'translate(0)' },
                { transform: 'translate(-10px)' },
                { transform: 'translate(10px)' },
                { transform: 'translate(0)' }
            ], { duration: 300 });
        }

        updateHUD();
    }

    function updateHUD() {
        el.hudMoney.textContent = state.money.toFixed(2);
        el.hudLevel.textContent = state.levelIdx + 1;
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = `$${state.money.toFixed(2)}`;
        el.resultScreen.querySelector('h2').textContent = win ? "Star Barista!" : "Shop Closed!";
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
