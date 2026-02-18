/**
 * SimulationGame Engine
 * Handles "Parameter Input -> Real-time Calculation" gameplay.
 * Loads configuration from a JSON file.
 */

class SimulationGame {
    constructor() {
        this.config = null;
        this.controls = {};
        this.gameUI = {
            title: document.getElementById('game-title'),
            instruction: document.getElementById('instruction-text'),
            startScreen: document.getElementById('start-screen'),
            endScreen: document.getElementById('end-screen'),
            controls: document.querySelector('.controls-grid'),
            resultDisplay: document.getElementById('result-display'),
            targetDisplay: document.getElementById('target-display'),
            gaugeFill: document.querySelector('.gauge-fill'),
            gaugeValue: document.getElementById('gauge-value'),
            gaugeMarker: document.getElementById('gauge-target-marker'),
            feedbackMsg: document.getElementById('feedback-message'),
            submitBtn: document.getElementById('submit-btn'),
            currentDisplay: document.getElementById('current-display')
        };

        this.currentValue = 0;

        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedConfigPath = urlParams.get('config') || 'config.json';
        const configPath = this.resolveConfigPath(requestedConfigPath);

        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.config = await response.json();
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

    setupUI() {
        this.gameUI.title.innerText = this.config.title || "Simulation";
        if (this.config.goal) {
            this.gameUI.targetDisplay.innerText = `Ziel: Max ${this.config.goal.targetRateEur} € / Monat (Anzahlung max ${this.config.goal.maxDownPaymentEur} €)`;
            this.gameUI.instruction.innerText = `Finde eine Kombi für unter ${this.config.goal.targetRateEur} € monatlich!`;
        }

        // Setup Controls
        const limits = this.config.limits;
        if (limits) {
            for (const [key, settings] of Object.entries(limits)) {
                this.createControl(key, settings);
            }
        }

        // Setup Gauge Marker position
        if (this.config.goal && this.config.pricing) {
            const maxRange = this.config.pricing.baseRate * 1.5;
            const targetPos = (this.config.goal.targetRateEur / maxRange) * 100;
            if (this.gameUI.gaugeMarker) this.gameUI.gaugeMarker.style.left = `${Math.min(100, Math.max(0, targetPos))}%`;
        }

        // Initial Calc
        this.calculate();

        // Event Listeners
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            location.reload();
        });

        if (this.gameUI.submitBtn) this.gameUI.submitBtn.addEventListener('click', () => this.endGame());
    }

    createControl(key, settings) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-group';

        const labelText = key === 'termMonths' ? 'Laufzeit (Monate)' :
            key === 'downPaymentEur' ? 'Anzahlung (€)' :
                key === 'kmPerYear' ? 'KM / Jahr' : key;

        const label = document.createElement('label');
        label.className = 'control-label';
        label.innerHTML = `<span>${labelText}</span> <span id="val-${key}">${settings.default}</span>`;

        const input = document.createElement('input');
        input.type = 'range';
        input.min = settings.min;
        input.max = settings.max;
        input.step = settings.step || 1;
        input.value = settings.default;
        input.id = `input-${key}`;

        input.addEventListener('input', (e) => {
            document.getElementById(`val-${key}`).innerText = e.target.value;
            this.calculate();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        this.gameUI.controls.appendChild(wrapper);

        this.controls[key] = input;
    }

    calculate() {
        if (!this.config.pricing) return;
        const pricing = this.config.pricing;

        // Get Values safety check
        if (!this.controls['termMonths']) return;

        const term = parseFloat(this.controls['termMonths'].value);
        const downPayment = parseFloat(this.controls['downPaymentEur'].value);
        const km = parseFloat(this.controls['kmPerYear'].value);

        let rate = pricing.baseRate;

        // Apply formulation
        rate -= (term * (pricing.termPerMonthDiscount || 0));
        rate -= ((downPayment / 100) * (pricing.downPaymentPer100Discount || 0));
        rate += ((km / 1000) * (pricing.kmPer1000Surcharge || 0));

        if (rate < (pricing.minRate || 0)) rate = pricing.minRate;

        this.currentValue = Math.round(rate * 100) / 100;
        this.updateVisualization();
        this.checkWinCondition(downPayment);
    }

    updateVisualization() {
        if (this.gameUI.currentDisplay) this.gameUI.currentDisplay.innerText = `Aktuell: ${this.currentValue} €`;
        if (this.gameUI.gaugeValue) this.gameUI.gaugeValue.innerText = `${this.currentValue} €`;

        const maxRange = (this.config.pricing.baseRate || 400) * 1.5;
        const percent = Math.min(100, Math.max(0, (this.currentValue / maxRange) * 100));
        if (this.gameUI.gaugeFill) this.gameUI.gaugeFill.style.width = `${percent}%`;

        const target = this.config.goal.targetRateEur;
        if (this.gameUI.gaugeFill) {
            if (this.currentValue <= target) this.gameUI.gaugeFill.style.background = "#28a745";
            else this.gameUI.gaugeFill.style.background = "#dc3545";
        }
    }

    checkWinCondition(currentDownPayment) {
        const targetRate = this.config.goal.targetRateEur;
        const maxDown = this.config.goal.maxDownPaymentEur;

        if (this.currentValue <= targetRate && currentDownPayment <= maxDown) {
            this.gameUI.feedbackMsg.innerText = "Ziel erreicht! Rate und Anzahlung passen.";
            this.gameUI.feedbackMsg.style.color = "green";
            this.gameUI.submitBtn.classList.remove('hidden');
        } else {
            let msg = "";
            if (this.currentValue > targetRate) msg = "Rate zu hoch! ";
            if (currentDownPayment > maxDown) msg += "Anzahlung zu hoch!";
            this.gameUI.feedbackMsg.innerText = msg;
            this.gameUI.feedbackMsg.style.color = "red";
            this.gameUI.submitBtn.classList.add('hidden');
        }
    }

    endGame() {
        this.gameUI.endScreen.classList.remove('hidden');
        document.getElementById('final-message').innerText =
            `Glückwunsch! Du hast eine Rate von ${this.currentValue} € erzielt.`;
    }

    getMode() {
        const startHidden = this.gameUI.startScreen?.classList.contains('hidden');
        const endVisible = !this.gameUI.endScreen?.classList.contains('hidden');
        if (!startHidden) return 'start';
        if (endVisible) return 'end';
        return this.config ? 'active' : 'loading';
    }

    getProgressPercent() {
        if (!this.config || !this.config.goal || !this.config.goal.targetRateEur) return 0;
        const targetRate = this.config.goal.targetRateEur;
        const diff = Math.max(0, this.currentValue - targetRate);
        const ratio = 1 - Math.min(1, diff / Math.max(1, targetRate));
        return Math.round(ratio * 100);
    }

    renderGameToText() {
        const term = this.controls['termMonths'] ? Number(this.controls['termMonths'].value) : 0;
        const downPayment = this.controls['downPaymentEur'] ? Number(this.controls['downPaymentEur'].value) : 0;
        const km = this.controls['kmPerYear'] ? Number(this.controls['kmPerYear'].value) : 0;
        const goal = this.config?.goal || {};
        const solved = !!(this.config && this.currentValue <= (goal.targetRateEur || 0) && downPayment <= (goal.maxDownPaymentEur || 0));
        return JSON.stringify({
            mode: this.getMode(),
            coordinate_system: 'origin top-left, x right, y down',
            term_months: term,
            down_payment_eur: downPayment,
            km_per_year: km,
            monthly_rate_eur: this.currentValue,
            target_rate_eur: goal.targetRateEur || 0,
            max_down_payment_eur: goal.maxDownPaymentEur || 0,
            solved: solved,
            progress_percent: solved ? 100 : this.getProgressPercent()
        });
    }

    advanceTime() {
        return true;
    }
}

// Start Engine
const simulationGame = new SimulationGame();
window.render_game_to_text = () => simulationGame.renderGameToText();
window.advanceTime = (ms) => simulationGame.advanceTime(ms);
