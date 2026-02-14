(function (global) {
  'use strict';

  const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
  const FIREBASE_RTDB_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
  const FIREBASE_FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
  const CONFIG_SCRIPT_CANDIDATES = [
    '/firebase.config.local.js',
    '/databases/Teil01%20Grundlagen/config.local.js'
  ];

  let runtimeConfig = null;
  let initPromise = null;
  const loadedScriptCache = new Set();

  function loadOptionalScript(src) {
    if (!src) return Promise.resolve(false);
    if (loadedScriptCache.has(src)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        loadedScriptCache.add(src);
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  function readRawConfig() {
    if (global.EASYPV_FIREBASE_CONFIG && typeof global.EASYPV_FIREBASE_CONFIG === 'object') {
      return global.EASYPV_FIREBASE_CONFIG;
    }
    if (global.FEEDBACK_CONFIG && typeof global.FEEDBACK_CONFIG === 'object') {
      return global.FEEDBACK_CONFIG;
    }
    return null;
  }

  function normalizeConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') return null;
    const firebase = rawConfig.firebase && typeof rawConfig.firebase === 'object' ? rawConfig.firebase : {};
    const feedback = rawConfig.feedback && typeof rawConfig.feedback === 'object' ? rawConfig.feedback : {};

    const provider = String(feedback.provider || (rawConfig.collection ? 'rtdb' : 'firestore'))
      .toLowerCase()
      .trim();
    const normalizedProvider = provider === 'rtdb' ? 'rtdb' : 'firestore';
    const collection = String(feedback.collection || rawConfig.collection || 'game_feedback').trim() || 'game_feedback';
    const enabled = feedback.enabled !== false;

    return {
      firebase: firebase,
      feedback: {
        provider: normalizedProvider,
        collection: collection,
        enabled: enabled
      }
    };
  }

  async function ensureRuntimeConfig() {
    if (runtimeConfig) return runtimeConfig;

    const fromWindow = normalizeConfig(readRawConfig());
    if (fromWindow) {
      runtimeConfig = fromWindow;
      return runtimeConfig;
    }

    for (let i = 0; i < CONFIG_SCRIPT_CANDIDATES.length; i += 1) {
      await loadOptionalScript(CONFIG_SCRIPT_CANDIDATES[i]);
      const loaded = normalizeConfig(readRawConfig());
      if (loaded) {
        runtimeConfig = loaded;
        return runtimeConfig;
      }
    }

    return null;
  }

  async function ensureFirebaseReady() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const config = await ensureRuntimeConfig();
      if (!config || !config.firebase || !config.firebase.apiKey) {
        return { ok: false, reason: 'CONFIG_MISSING' };
      }
      if (!config.feedback.enabled) {
        return { ok: false, reason: 'FEEDBACK_DISABLED' };
      }

      const appOk = await loadOptionalScript(FIREBASE_APP_URL);
      if (!appOk) return { ok: false, reason: 'FIREBASE_APP_SDK_LOAD_FAILED' };

      const providerUrl = config.feedback.provider === 'rtdb' ? FIREBASE_RTDB_URL : FIREBASE_FIRESTORE_URL;
      const providerOk = await loadOptionalScript(providerUrl);
      if (!providerOk) return { ok: false, reason: 'FIREBASE_PROVIDER_SDK_LOAD_FAILED' };

      if (!global.firebase || !global.firebase.apps) {
        return { ok: false, reason: 'FIREBASE_GLOBAL_MISSING' };
      }

      if (!global.firebase.apps.length) {
        global.firebase.initializeApp(config.firebase);
      }

      return { ok: true, config: config };
    })();

    return initPromise;
  }

  function sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch (_) {
      return {};
    }
  }

  async function submitFeedback(payload) {
    const init = await ensureFirebaseReady();
    if (!init.ok) return init;

    const config = init.config;
    const body = sanitizePayload(payload);
    const comment = String(body.comment || '').trim();
    if (!comment) {
      return { ok: false, reason: 'COMMENT_REQUIRED' };
    }

    body.comment = comment;
    body.createdAtIso = new Date().toISOString();

    if (config.feedback.provider === 'rtdb') {
      if (!global.firebase.database) {
        return { ok: false, reason: 'RTDB_UNAVAILABLE' };
      }
      const ref = global.firebase.database().ref(config.feedback.collection).push();
      await ref.set(body);
      return { ok: true, id: ref.key || null, provider: 'rtdb' };
    }

    if (!global.firebase.firestore || !global.firebase.firestore.FieldValue) {
      return { ok: false, reason: 'FIRESTORE_UNAVAILABLE' };
    }

    const ref = await global.firebase.firestore().collection(config.feedback.collection).add({
      ...body,
      createdAt: global.firebase.firestore.FieldValue.serverTimestamp()
    });
    return { ok: true, id: ref.id || null, provider: 'firestore' };
  }

  function getStatus() {
    const config = runtimeConfig || normalizeConfig(readRawConfig());
    return {
      configured: !!(config && config.firebase && config.firebase.apiKey),
      provider: config ? config.feedback.provider : null,
      collection: config ? config.feedback.collection : null
    };
  }

  global.EasyPvFirebaseFeedback = {
    submitFeedback,
    getStatus
  };
})(window);
