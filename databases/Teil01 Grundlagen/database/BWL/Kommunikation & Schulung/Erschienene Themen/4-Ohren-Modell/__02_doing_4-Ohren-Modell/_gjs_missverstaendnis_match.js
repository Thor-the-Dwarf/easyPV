/**
 * Missverständnis-Match
 * Zweck: Aussagen mit Interpretationen des "gereizten Beifahrers" verknüpfen.
 * Inputs: _gg01_missverstaendnis_match.json
 * Outputs: Game State, Scoring
 */

(function () {
    'use strict';

    const state = {
        cfg: null,
        selectedStatement: null,
        selectedInterpretation: null,
        matchesFound: 0,
        tries: 0,
        startTime: null,
        timerInterval: null,
        isGameOver: false
    };

    const el = {
        statementsCol: document.getElementById('statements-col'),
        interpretationsCol: document.getElementById('interpretations-col'),
        kpiMatches: document.getElementById('kpi-matches'),
        kpiTries: document.getElementById('kpi-tries'),
        kpiTimer: document.getElementById('kpi-timer'),
        feedback: document.getElementById('feedback'),
        resultArea: document.getElementById('result-area'),
        matchArea: document.getElementById('match-area')
    };

    init();

    async function init() {
        try {
            const resp = await fetch('./_gg01_missverstaendnis_match.json');
            if (!resp.ok) throw new Error('Konfiguration fehlt.');
            state.cfg = await resp.json();
            setupGame();
        } catch (err) {
            console.error(err);
            showFeedback('Kritischer Fehler: Spieldaten konnten nicht geladen werden.', 'bad');
        }
    }

    function setupGame() {
        state.startTime = Date.now();
        state.timerInterval = setInterval(updateTimer, 1000);

        const statements = [...state.cfg.pairs];
        const interpretations = [...state.cfg.pairs];

        shuffle(statements);
        shuffle(interpretations);

        renderColumn(el.statementsCol, statements, 'statement');
        renderColumn(el.interpretationsCol, interpretations, 'interpretation');

        el.kpiMatches.textContent = `0/${state.cfg.pairs.length}`;
    }

    function renderColumn(container, items, type) {
        container.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = type === 'statement' ? item.statement : item.interpretation;
            div.dataset.id = item.id;
            div.dataset.type = type;
            div.onclick = () => handleSelect(div);
            container.appendChild(div);
        });
    }

    function handleSelect(element) {
        if (state.isGameOver || element.classList.contains('matched')) return;

        const type = element.dataset.type;
        const id = element.dataset.id;

        if (type === 'statement') {
            if (state.selectedStatement) state.selectedStatement.classList.remove('selected');
            state.selectedStatement = element;
        } else {
            if (state.selectedInterpretation) state.selectedInterpretation.classList.remove('selected');
            state.selectedInterpretation = element;
        }

        element.classList.add('selected');

        checkMatch();
    }

    function checkMatch() {
        if (state.selectedStatement && state.selectedInterpretation) {
            state.tries++;
            el.kpiTries.textContent = state.tries;

            const sId = state.selectedStatement.dataset.id;
            const iId = state.selectedInterpretation.dataset.id;

            if (sId === iId) {
                // Match!
                state.selectedStatement.classList.remove('selected');
                state.selectedInterpretation.classList.remove('selected');
                state.selectedStatement.classList.add('matched');
                state.selectedInterpretation.classList.add('matched');

                state.matchesFound++;
                el.kpiMatches.textContent = `${state.matchesFound}/${state.cfg.pairs.length}`;

                state.selectedStatement = null;
                state.selectedInterpretation = null;

                if (state.matchesFound === state.cfg.pairs.length) {
                    endGame();
                }
            } else {
                // No match
                const s = state.selectedStatement;
                const i = state.selectedInterpretation;

                s.classList.add('incorrect');
                i.classList.add('incorrect');

                setTimeout(() => {
                    s.classList.remove('selected', 'incorrect');
                    i.classList.remove('selected', 'incorrect');
                }, 500);

                state.selectedStatement = null;
                state.selectedInterpretation = null;
            }
        }
    }

    function endGame() {
        state.isGameOver = true;
        clearInterval(state.timerInterval);
        el.matchArea.classList.add('hidden');
        el.resultArea.classList.remove('hidden');
    }

    function updateTimer() {
        const diff = Math.floor((Date.now() - state.startTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        el.kpiTimer.textContent = `${mins}:${secs}`;
    }

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function showFeedback(text, type) {
        el.feedback.textContent = text;
        el.feedback.className = `feedback ${type}`;
        el.feedback.classList.remove('hidden');
    }

    // Bridge integration
    window.render_game_to_text = function () {
        return JSON.stringify({
            found: state.matchesFound,
            total: state.cfg ? state.cfg.pairs.length : 0,
            tries: state.tries,
            isGameOver: state.isGameOver
        });
    };

})();
