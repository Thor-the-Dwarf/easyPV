(function () {
    'use strict';

    const state = {
        config: null,
        score: 0,
        investLevel: 0,
        reels: [
            { id: 'roles', locked: false, currentIdx: 0, items: [] },
            { id: 'goals', locked: false, currentIdx: 0, items: [] },
            { id: 'benefits', locked: false, currentIdx: 0, items: [] }
        ],
        spinning: false,
        storiesTold: 0
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudStories: document.getElementById('stories-val'),
        reelStrips: [
            document.getElementById('reel-strip-1'),
            document.getElementById('reel-strip-2'),
            document.getElementById('reel-strip-3')
        ],
        lockBtns: [
            document.getElementById('lock-btn-1'),
            document.getElementById('lock-btn-2'),
            document.getElementById('lock-btn-3')
        ],
        spinBtn: document.getElementById('spin-btn'),
        checkBtn: document.getElementById('check-btn'),
        feedback: document.getElementById('feedback-msg'),
        investBadges: document.querySelectorAll('.invest-badge'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'spin') {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'win') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.1);
            osc.frequency.setValueAtTime(1000, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start();
            osc.stop(now + 0.4);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_g01_user_story_builder.json');
            state.config = await resp.json();

            // Load Data into Reels
            state.reels[0].items = [...state.config.roles];
            state.reels[1].items = [...state.config.goals];
            state.reels[2].items = [...state.config.benefits];

            renderReels();

            el.spinBtn.addEventListener('click', spin);
            el.checkBtn.addEventListener('click', checkStory);
            el.restartBtn.addEventListener('click', restartGame);

            el.lockBtns.forEach((btn, i) => {
                btn.addEventListener('click', () => toggleLock(i));
            });

            updateHUD();

        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.score = 0;
        state.storiesTold = 0;
        state.reels.forEach(r => r.locked = false);
        el.resultScreen.classList.add('hidden');
        updateHUD();
        updateLocks();
        el.feedback.textContent = "Pull the lever!";
    }

    function renderReels() {
        state.reels.forEach((reel, i) => {
            const strip = el.reelStrips[i];
            strip.innerHTML = '';
            // Render items multiple times for scrolling illusion? 
            // Simple implementation: Just render current item or random shuffle visually.
            // For slot effect, we can just switch text on "Stop".

            // Initial random
            const randIdx = Math.floor(Math.random() * reel.items.length);
            reel.currentIdx = randIdx;
            updateReelView(i);
        });
    }

    function updateReelView(reelIdx) {
        const reel = state.reels[reelIdx];
        const item = reel.items[reel.currentIdx];
        const strip = el.reelStrips[reelIdx];

        // Clear
        strip.innerHTML = '';

        // Previous, Current, Next (for visual context if we want, or just current centered)
        const div = document.createElement('div');
        div.className = 'reel-item';
        div.textContent = item.text;
        strip.appendChild(div);

        // Center it
        strip.style.top = '0px';
    }

    function toggleLock(reelIdx) {
        if (state.spinning) return;
        state.reels[reelIdx].locked = !state.reels[reelIdx].locked;
        updateLocks();
        playTone('spin'); // click sound
    }

    function updateLocks() {
        el.lockBtns.forEach((btn, i) => {
            if (state.reels[i].locked) {
                btn.classList.add('locked');
                btn.textContent = 'LOCKED';
            } else {
                btn.classList.remove('locked');
                btn.textContent = 'LOCK';
            }
        });
    }

    function spin() {
        if (state.spinning) return;

        state.spinning = true;
        el.spinBtn.disabled = true;
        el.checkBtn.disabled = true;
        el.feedback.textContent = "Spinning...";

        let spinsLeft = 10;
        const spinInterval = setInterval(() => {
            state.reels.forEach((reel, i) => {
                if (!reel.locked) {
                    // Randomize current index
                    reel.currentIdx = Math.floor(Math.random() * reel.items.length);
                    updateReelView(i);
                }
            });
            playTone('spin');

            spinsLeft--;
            if (spinsLeft <= 0) {
                clearInterval(spinInterval);
                state.spinning = false;
                el.spinBtn.disabled = false;
                el.checkBtn.disabled = false;
                el.feedback.textContent = "Check your story!";
            }
        }, 100);
    }

    function checkStory() {
        if (state.spinning) return;

        const role = state.reels[0].items[state.reels[0].currentIdx];
        const goal = state.reels[1].items[state.reels[1].currentIdx];
        const benefit = state.reels[2].items[state.reels[2].currentIdx];

        // Logic: Do tags overlap?
        // Role tags + Goal tags must match specific combinations or logic? 
        // Rule: Role must share a tag with Goal. Goal must share a tag with Benefit.

        const roleGoalMatch = hasCommonTag(role.tags, goal.tags);
        const goalBenefitMatch = hasCommonTag(goal.tags, benefit.tags);
        // Optional: Role Benefit match?

        if (roleGoalMatch && goalBenefitMatch) {
            // Success
            const points = 500;
            state.score += points;
            state.storiesTold++;
            el.feedback.textContent = "JACKPOT! Valid Story!";
            el.feedback.style.color = "#0f0";
            playTone('win');

            // Flash INVEST Badges
            highlightInvest(true);

            // Next round resets locks? Or player chooses?
            // Let's reset locks to encourage new spin.
            state.reels.forEach(r => r.locked = false);
            updateLocks();

        } else {
            // Fail
            el.feedback.textContent = "Illogical! Tags don't match.";
            el.feedback.style.color = "red";
            playTone('error');
            state.score = Math.max(0, state.score - 50);
            highlightInvest(false);
        }

        updateHUD();

        if (state.storiesTold >= 5) {
            endGame();
        }
    }

    function hasCommonTag(tags1, tags2) {
        return tags1.some(t => tags2.includes(t));
    }

    function highlightInvest(active) {
        el.investBadges.forEach(b => {
            if (active) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudStories.textContent = state.storiesTold + "/5";
    }

    function endGame() {
        el.finalScore.textContent = state.score;
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
