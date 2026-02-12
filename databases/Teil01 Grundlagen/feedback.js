(function () {
  'use strict';

  const CONFIG_PATH = './config.local.js';
  const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
  const FIREBASE_DB_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';

  function loadOptionalScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function getConfig() {
    if (window.FEEDBACK_CONFIG && window.FEEDBACK_CONFIG.firebase) return window.FEEDBACK_CONFIG;
    return null;
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.apps && window.firebase.apps.length) return true;

    await loadOptionalScript(CONFIG_PATH);
    const cfg = getConfig();
    if (!cfg || !cfg.firebase || !cfg.firebase.apiKey) return false;

    await loadOptionalScript(FIREBASE_APP_URL);
    await loadOptionalScript(FIREBASE_DB_URL);

    if (!window.firebase || !window.firebase.apps) return false;
    if (!window.firebase.apps.length) window.firebase.initializeApp(cfg.firebase);
    return true;
  }

  function buildDrawer() {
    const fab = document.createElement('button');
    fab.className = 'feedback-fab';
    fab.type = 'button';
    fab.innerHTML = '<span>💬</span><span>Feedback</span>';
    fab.title = 'Stimmt was nicht? Teile es uns mit.';

    const drawer = document.createElement('div');
    drawer.className = 'feedback-drawer';
    drawer.innerHTML = `
      <div class="feedback-resizer" id="feedback-resizer"></div>
      <div class="feedback-header">
        <strong id="feedback-title">Dein Feedback</strong>
        <button class="feedback-close" type="button" aria-label="Schliessen">✕</button>
      </div>
      <div class="feedback-body">
        <div class="feedback-section">
          <div id="feedback-lead" style="font-size:0.9rem; margin-bottom:0.35rem; color:hsl(var(--txt));">
            Du hast einen Verbesserungsvorschlag oder die Aufgabe ist irgendwie komisch?
          </div>
          <div style="position:relative;">
            <textarea class="feedback-textarea" id="feedback-comment" placeholder="Sag mir was du verändern würdest, bzw. was merkwürdig ist"></textarea>
            <button class="feedback-send-inline" id="feedback-send-inline" type="button" aria-label="Feedback senden" title="Feedback senden">➤</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(drawer);

    return { fab, drawer };
  }

  function getFeedbackContext() {
    try {
      const raw = sessionStorage.getItem('feedback_context_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {
      // ignore
    }

    try {
      const id = sessionStorage.getItem('game_payload_id');
      if (id) {
        const payloadRaw = sessionStorage.getItem('game_payload_' + id);
        if (payloadRaw) {
          const payload = JSON.parse(payloadRaw);
          return {
            file_id: id,
            title: payload.title || null,
            game_type: payload.game_type || payload.gameType || null,
            rel_path: payload.rel_path || null
          };
        }
      }
    } catch (_) {
      // ignore
    }

    return null;
  }

  async function submitFeedback(closeDrawer) {
    const commentEl = document.getElementById('feedback-comment');
    const comment = commentEl.value.trim();
    if (!comment) return;

    const ok = await ensureFirebase();
    if (!ok) {
      showToast('Firebase nicht erreichbar');
      return;
    }

    const cfg = getConfig();
    const context = getFeedbackContext();

    const doc = {
      comment,
      url: window.location.href,
      created_at: new Date().toISOString(),
      context: context || null,
      file_id: context && context.file_id ? context.file_id : null,
      file_path: context && context.rel_path ? context.rel_path : null,
      title: context && context.title ? context.title : null
    };

    const db = window.firebase.database();
    const ref = db.ref(cfg.collection || 'feedback');
    await ref.push(doc);

    showToast('Danke für dein Feedback');
    if (typeof closeDrawer === 'function') closeDrawer();
    commentEl.value = '';
  }

  function init() {
    const { fab, drawer } = buildDrawer();
    const closeBtn = drawer.querySelector('.feedback-close');
    const sendInline = drawer.querySelector('#feedback-send-inline');
    const resizer = drawer.querySelector('#feedback-resizer');
    const commentEl = drawer.querySelector('#feedback-comment');

    const openDrawer = () => {
      const title = drawer.querySelector('#feedback-title');
      const context = getFeedbackContext();
      title.textContent = context && context.title ? `Dein Feedback zu ${context.title}` : 'Dein Feedback';

      fab.innerHTML = '<span>✕</span><span>Schliessen</span>';
      fab.title = 'Feedback-Sektion schliessen';
      drawer.classList.add('open');
      updateSendState();
    };

    const closeDrawer = () => {
      drawer.classList.remove('open');
      fab.innerHTML = '<span>💬</span><span>Feedback</span>';
      fab.title = 'Stimmt was nicht? Teile es uns mit.';
    };

    const updateSendState = () => {
      sendInline.disabled = commentEl.value.trim().length === 0;
    };

    fab.addEventListener('click', () => {
      if (drawer.classList.contains('open')) closeDrawer();
      else openDrawer();
    });
    closeBtn.addEventListener('click', closeDrawer);
    sendInline.addEventListener('click', () => submitFeedback(closeDrawer));
    commentEl.addEventListener('input', updateSendState);

    let resizing = false;
    resizer.addEventListener('mousedown', () => { resizing = true; });
    window.addEventListener('mouseup', () => { resizing = false; });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      const h = Math.max(160, Math.min(window.innerHeight * 0.9, window.innerHeight - e.clientY));
      drawer.style.height = `${h}px`;
    });
  }

  function showToast(message) {
    let toast = document.querySelector('.feedback-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'feedback-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
