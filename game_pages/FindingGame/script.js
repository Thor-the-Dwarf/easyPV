/**
 * FindingGame Engine
 * Handles "Text/Image Search" gameplay.
 * Loads configuration from a JSON file.
 */

class FindingGame {
    constructor() {
        this.config = null;
        this.score = 0;
        this.foundItems = new Set();
        this.totalTargets = 0;
        this.timeElapsed = 0;
        this.timerId = null;
        this.gameUI = {
            title: document.getElementById('game-title'),
            subtitle: document.getElementById('game-subtitle'),
            startScreen: document.getElementById('start-screen'),
            endScreen: document.getElementById('end-screen'),
            contentViewer: document.getElementById('text-canvas'),
            score: document.getElementById('score-display'),
            timer: document.getElementById('timer-display'),
            foundCount: document.getElementById('found-count'),
            progressBar: document.getElementById('progress-fill'),
            finalScore: document.getElementById('final-score'),
            resultsDetails: document.getElementById('results-details'),
            toast: document.getElementById('feedback-toast')
        };

        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedConfigPath = urlParams.get('config') || 'config.json';
        const configPath = this.resolveConfigPath(requestedConfigPath);

        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawConfig = await response.json();
            this.config = this.normalizeConfig(rawConfig);
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

    normalizeConfig(raw) {
        if (!raw.terms) raw.terms = [];
        return raw;
    }

    setupUI() {
        this.gameUI.title.innerText = this.config.meta?.title || "Such-Spiel";
        if (this.config.meta?.subtitle) {
            this.gameUI.subtitle.innerText = this.config.meta.subtitle;
        }

        document.getElementById('start-btn').addEventListener('click', () => {
            this.gameUI.startScreen.classList.add('hidden');
            this.startGame();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.gameUI.endScreen.classList.add('hidden');
            this.resetGame();
            this.startGame();
        });
    }

    resetGame() {
        this.score = 0;
        this.timeElapsed = 0;
        this.foundItems.clear();
        this.totalTargets = this.config.terms.filter(t => t.is_target).length;
        this.updateStats();
        clearInterval(this.timerId);
    }

    startGame() {
        this.resetGame();
        this.renderContent();
        this.timerId = setInterval(() => {
            this.timeElapsed++;
            this.updateStats();
        }, 1000);
    }

    renderContent() {
        this.gameUI.contentViewer.innerHTML = '';
        const fullText = this.config.contract_excerpt.join('\n\n');

        // We need to parse the text and wrap the "terms" in spans
        // This is tricky if terms overlap or are just substrings.
        // Simple approach: Replace known terms with spans.
        // Caveat: Order matters to avoid replacing inside replacement.

        let processedHTML = this.escapeHtml(fullText);

        // Sort terms by length desc to replace longest first (avoid partial matches)
        const sortedTerms = [...this.config.terms].sort((a, b) => b.label.length - a.label.length);

        sortedTerms.forEach(term => {
            const regex = new RegExp(`(${this.escapeRegExp(term.label)})`, 'gi');
            // We use a placeholder to avoid re-replacing inside tags
            // Or we just replace with a specialized marker and then expand later?
            // Let's try direct replacement but be careful.

            // Better: Tokenize the string?
            // For this MVP, let's assume terms are distinct enough.

            // We need to store the term ID in the span
            const replacement = `<span class="find-term" data-id="${term.id}">$1</span>`;
            processedHTML = processedHTML.replace(regex, replacement);
        });

        this.gameUI.contentViewer.innerHTML = processedHTML;

        // Attach events
        const spanElements = this.gameUI.contentViewer.querySelectorAll('.find-term');
        spanElements.forEach(span => {
            span.addEventListener('click', (e) => this.handleTermClick(e.target));
        });
    }

    handleTermClick(element) {
        const termId = element.dataset.id;
        if (this.foundItems.has(termId)) return; // Already found

        const termData = this.config.terms.find(t => t.id === termId);
        if (!termData) return;

        if (termData.is_target) {
            // Correct!
            element.classList.add('found');
            this.foundItems.add(termId);
            this.score += (this.config.scoring?.max_score / this.totalTargets) || 20;
            this.showToast(`Gefunden: ${termData.label}`, 'success');

            if (this.foundItems.size >= this.totalTargets) {
                this.endGame();
            }
        } else {
            // Mistake!
            element.classList.add('mistake');
            this.score = Math.max(0, this.score - (this.config.scoring?.false_penalty || 10));
            this.showToast(`Das ist leider falsch: ${termData.explanation}`, 'error');
            setTimeout(() => element.classList.remove('mistake'), 1000);
        }

        this.updateStats();
    }

    updateStats() {
        this.gameUI.score.innerText = `Punkte: ${Math.round(this.score)}`;
        this.gameUI.foundCount.innerText = `Gefunden: ${this.foundItems.size}/${this.totalTargets}`;
        this.gameUI.timer.innerText = `Zeit: ${this.formatTime(this.timeElapsed)}`;

        const progress = (this.foundItems.size / this.totalTargets) * 100;
        this.gameUI.progressBar.style.width = `${progress}%`;
    }

    endGame() {
        clearInterval(this.timerId);
        setTimeout(() => {
            this.gameUI.endScreen.classList.remove('hidden');
            this.gameUI.finalScore.innerText = `Score: ${Math.round(this.score)}`;
            this.renderResults();
        }, 1000);
    }

    renderResults() {
        this.gameUI.resultsDetails.innerHTML = '';
        // Show missed items?
        const missed = this.config.terms.filter(t => t.is_target && !this.foundItems.has(t.id));
        if (missed.length > 0) {
            const title = document.createElement('h4');
            title.innerText = "Verpasst:";
            this.gameUI.resultsDetails.appendChild(title);
            missed.forEach(m => {
                const p = document.createElement('div');
                p.className = 'result-item';
                p.innerHTML = `<span class="cross-icon">❌</span> ${m.label}`;
                this.gameUI.resultsDetails.appendChild(p);
            });
        } else {
            this.gameUI.resultsDetails.innerHTML = "<h4>Alle gefunden! Perfekt!</h4>";
        }
    }

    showToast(msg, type) {
        this.gameUI.toast.innerText = msg;
        this.gameUI.toast.className = 'toast show';
        if (type === 'error') this.gameUI.toast.style.backgroundColor = '#dc3545';
        else this.gameUI.toast.style.backgroundColor = '#28a745';

        setTimeout(() => {
            this.gameUI.toast.className = 'toast hidden';
        }, 2000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getMode() {
        const startHidden = this.gameUI.startScreen?.classList.contains('hidden');
        const endVisible = !this.gameUI.endScreen?.classList.contains('hidden');
        if (!startHidden) return 'start';
        if (endVisible) return 'end';
        return this.config ? 'searching' : 'loading';
    }

    getProgressPercent() {
        if (!this.totalTargets || this.totalTargets <= 0) return 0;
        return Math.round((this.foundItems.size / this.totalTargets) * 100);
    }

    renderGameToText() {
        return JSON.stringify({
            mode: this.getMode(),
            coordinate_system: 'origin top-left, x right, y down',
            score: Math.round(this.score),
            time_elapsed_sec: this.timeElapsed,
            found_targets: this.foundItems.size,
            total_targets: this.totalTargets,
            found_item_ids: Array.from(this.foundItems),
            progress_percent: this.getProgressPercent()
        });
    }

    advanceTime() {
        return true;
    }
}

// Start Engine
const findingGame = new FindingGame();
window.render_game_to_text = () => findingGame.renderGameToText();
window.advanceTime = (ms) => findingGame.advanceTime(ms);
