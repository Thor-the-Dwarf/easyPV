(function () {
  'use strict';

  var THEME_KEY = 'globalTheme_v1';
  var root = document.documentElement;
  if (!root) return;

  function normalizeTheme(raw) {
    var value = String(raw || '').toLowerCase().trim();
    if (value === 'light') return 'light';
    if (value === 'dark') return 'dark';
    return '';
  }

  function applyTheme(theme) {
    var next = normalizeTheme(theme) || 'dark';
    root.classList.toggle('theme-light', next === 'light');
    root.style.colorScheme = next;
  }

  function getCurrentTheme() {
    return root.classList.contains('theme-light') ? 'light' : 'dark';
  }

  function inferInitialTheme() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = normalizeTheme(params.get('theme'));
    if (fromUrl) return fromUrl;

    try {
      var fromStorage = normalizeTheme(localStorage.getItem(THEME_KEY));
      if (fromStorage) return fromStorage;
    } catch (_) {
      // ignore storage errors
    }

    return 'dark';
  }

  function requestThemeFromParent() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'global:theme:request' }, '*');
      }
    } catch (_) {
      // ignore cross-window errors
    }
  }

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.type !== 'global:theme') return;
    applyTheme(data.theme);
  });

  window.addEventListener('storage', function (event) {
    if (!event || event.key === null || event.key === THEME_KEY) {
      applyTheme(inferInitialTheme());
    }
  });

  applyTheme(inferInitialTheme());
  requestThemeFromParent();
})();
