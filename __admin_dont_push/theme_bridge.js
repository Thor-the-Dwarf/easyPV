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

  function usesSharedThemeCss() {
    var links = document.querySelectorAll('link[rel=\"stylesheet\"]');
    for (var i = 0; i < links.length; i += 1) {
      var href = String(links[i].getAttribute('href') || '').toLowerCase();
      if (href.indexOf('shared_theme.css') !== -1) return true;
    }
    return false;
  }

  function ensureLightFallbackStyles() {
    if (usesSharedThemeCss()) return;
    if (document.getElementById('theme-bridge-light-fallback')) return;

    var style = document.createElement('style');
    style.id = 'theme-bridge-light-fallback';
    style.textContent =
      ':root.theme-light body {' +
      'background:#ecf2fa !important;' +
      'color:#122033 !important;' +
      '}' +
      ':root.theme-light .app,' +
      ':root.theme-light .game-app,' +
      ':root.theme-light .card,' +
      ':root.theme-light .kpi,' +
      ':root.theme-light .profile,' +
      ':root.theme-light .slot,' +
      ':root.theme-light .opt,' +
      ':root.theme-light .conflict,' +
      ':root.theme-light .task,' +
      ':root.theme-light .feedback,' +
      ':root.theme-light [class*=\"card\"],' +
      ':root.theme-light [class*=\"panel\"],' +
      ':root.theme-light [class*=\"tile\"],' +
      ':root.theme-light [class*=\"box\"] {' +
      'background:#ffffff !important;' +
      'color:#142235 !important;' +
      'border-color:#b7c6da !important;' +
      'box-shadow:none !important;' +
      '}' +
      ':root.theme-light .head p,' +
      ':root.theme-light .kpi span,' +
      ':root.theme-light .section-sub,' +
      ':root.theme-light [class*=\"muted\"] {' +
      'color:#3f5b78 !important;' +
      '}' +
      ':root.theme-light button,' +
      ':root.theme-light .btn {' +
      'background:#e7edf7 !important;' +
      'color:#122033 !important;' +
      'border-color:#a9bbd4 !important;' +
      '}' +
      ':root.theme-light .btn.primary {' +
      'background:#d6e7ff !important;' +
      'color:#0f2847 !important;' +
      'border-color:#7ca9df !important;' +
      '}' +
      ':root.theme-light input,' +
      ':root.theme-light select,' +
      ':root.theme-light textarea {' +
      'background:#f7faff !important;' +
      'color:#142235 !important;' +
      'border-color:#afc2db !important;' +
      '}' +
      ':root.theme-light canvas {' +
      'filter:brightness(1.05) contrast(0.97);' +
      '}';

    (document.head || document.documentElement).appendChild(style);
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

  ensureLightFallbackStyles();
  applyTheme(inferInitialTheme());
  requestThemeFromParent();
})();
