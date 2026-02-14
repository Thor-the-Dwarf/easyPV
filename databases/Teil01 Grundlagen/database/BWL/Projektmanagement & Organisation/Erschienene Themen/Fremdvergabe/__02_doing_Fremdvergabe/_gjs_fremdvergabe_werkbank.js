/**
 * Die verlängerte Werkbank - Game Logic
 * Conveyor belt inspection game for quality assurance.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const statTotal = document.getElementById('stat-total');
    const statDefects = document.getElementById('stat-defects');
    const statSatisfaction = document.getElementById('stat-satisfaction');
    const statCosts = document.getElementById('stat-costs');
    const factoryView = document.getElementById('factory-view');
    const productContainer = document.getElementById('product-container');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const feedbackArea = document.getElementById('feedback-area');
    const instructionEl = document.getElementById('instruction');

    // State
    let gameState = {
        data: null,
        isRunning: false,
        totalInspected: 0,
        defectsFound: 0,
        missedDefects: 0,
        falseAlarms: 0,
        satisfaction: 100,
        costs: 0,
        products: [], // Array of active product objects
        lastSpawn: 0,
        interval: null
    };

    // Load Game Data
    fetch('_g01_fremdvergabe_werkbank.json')
        .then(r => r.json())
        .then(data => {
            gameState.data = data;
            instructionEl.innerText = data.instruction;
        })
        .catch(err => console.error("Load failed:", err));

    function initGame() {
        startBtn.addEventListener('click', toggleProduction);
        resetBtn.addEventListener('click', resetGame);
    }

    function toggleProduction() {
        if (gameState.isRunning) {
            stopProduction();
        } else {
            startProduction();
        }
    }

    function startProduction() {
        gameState.isRunning = true;
        startBtn.innerText = "Stopp";
        startBtn.classList.remove('primary');
        startBtn.classList.add('error');
        feedbackArea.innerText = "";

        gameState.interval = requestAnimationFrame(gameLoop);
    }

    function stopProduction() {
        gameState.isRunning = false;
        startBtn.innerText = "Produktion starten";
        startBtn.classList.remove('error');
        startBtn.classList.add('primary');
        cancelAnimationFrame(gameState.interval);

        evaluateGame();
    }

    function gameLoop(time) {
        if (!gameState.isRunning) return;

        // Spawning
        if (time - gameState.lastSpawn > (gameState.data.settings.spawnRate || 1500)) {
            spawnProduct();
            gameState.lastSpawn = time;
        }

        // Moving and Life-cycle
        updateProducts();

        gameState.interval = requestAnimationFrame(gameLoop);
    }

    function spawnProduct() {
        const type = gameState.data.productTypes[Math.floor(Math.random() * gameState.data.productTypes.length)];
        const isDefective = Math.random() < (gameState.data.settings.defectProbability || 0.3);
        const defect = isDefective ? gameState.data.defects[Math.floor(Math.random() * gameState.data.defects.length)] : null;

        const el = document.createElement('div');
        el.className = 'product';
        el.innerHTML = type.icon;
        el.style.left = '-60px';
        el.style.bottom = '80px';

        if (defect) {
            const marker = document.createElement('div');
            marker.className = 'defect-marker';
            marker.style.cssText = defect.visual;
            el.appendChild(marker);
        }

        const productObj = {
            el,
            x: -60,
            type,
            isDefective,
            defect,
            clicked: false
        };

        el.addEventListener('mousedown', () => handleProductClick(productObj));
        productContainer.appendChild(el);
        gameState.products.push(productObj);
    }

    function updateProducts() {
        const speed = gameState.data.settings.speed || 2;
        const width = factoryView.clientWidth;

        for (let i = gameState.products.length - 1; i >= 0; i--) {
            const p = gameState.products[i];
            p.x += speed;
            p.el.style.left = p.x + 'px';

            // Check if left screen
            if (p.x > width) {
                handleProductExit(p);
                removeProduct(p, i);
            }
        }
    }

    function handleProductClick(p) {
        if (!gameState.isRunning || p.clicked) return;
        p.clicked = true;

        if (p.isDefective) {
            gameState.defectsFound++;
            p.el.classList.add('rejected');
            gameState.costs += 5; // Reclamation costs
        } else {
            gameState.falseAlarms++;
            gameState.costs += 50; // High costs for false reclama
            p.el.style.borderColor = 'hsl(var(--error))';
        }

        updateStats();
    }

    function handleProductExit(p) {
        gameState.totalInspected++;
        if (p.isDefective && !p.clicked) {
            gameState.missedDefects++;
            gameState.satisfaction = Math.max(0, gameState.satisfaction - 10);
        }
        updateStats();
    }

    function removeProduct(p, index) {
        p.el.remove();
        gameState.products.splice(index, 1);
    }

    function updateStats() {
        statTotal.innerText = gameState.totalInspected;
        statDefects.innerText = gameState.defectsFound;
        statSatisfaction.innerText = gameState.satisfaction + "%";
        statCosts.innerText = gameState.costs + "€";

        if (gameState.satisfaction < 50) {
            statSatisfaction.style.color = 'hsl(var(--error))';
        }

        if (gameState.satisfaction === 0) {
            stopProduction();
            feedbackArea.innerText = gameState.data.scoring.fail;
            feedbackArea.style.color = 'hsl(var(--error))';
        }
    }

    function evaluateGame() {
        if (gameState.totalInspected === 0) return;

        let msg;
        if (gameState.satisfaction >= 90) msg = gameState.data.scoring.perfect;
        else if (gameState.satisfaction >= 70) msg = gameState.data.scoring.good;
        else msg = gameState.data.scoring.poor;

        feedbackArea.innerText = msg;
        feedbackArea.style.color = gameState.satisfaction >= 70 ? 'hsl(var(--success))' : 'hsl(var(--error))';
    }

    function resetGame() {
        stopProduction();
        gameState.totalInspected = 0;
        gameState.defectsFound = 0;
        gameState.missedDefects = 0;
        gameState.falseAlarms = 0;
        gameState.satisfaction = 100;
        gameState.costs = 0;
        gameState.products.forEach(p => p.el.remove());
        gameState.products = [];

        statSatisfaction.style.color = 'hsl(var(--primary))';
        updateStats();
        feedbackArea.innerText = "";
    }

    initGame();
});
