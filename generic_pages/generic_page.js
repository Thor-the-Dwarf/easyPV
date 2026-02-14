(function () {
  'use strict';

  const frame = document.getElementById('content-frame');
  const drawers = document.querySelectorAll('.generic-drawer');
  const drawerToggles = document.querySelectorAll('[data-drawer-toggle]');
  const fabPractice = document.getElementById('fab-practice');
  const fabFeedback = document.getElementById('fab-feedback');
  if (!frame || !drawers.length || !fabPractice || !drawerToggles.length) return;

  const params = new URLSearchParams(window.location.search);
  const json = params.get('json');
  const folder = params.get('folder');
  const game = params.get('game');

  const targetParams = new URLSearchParams();
  if (json) targetParams.set('json', json);
  if (folder) targetParams.set('folder', folder);

  frame.src = './generic_c_suite/generic_c_suite.html' + (targetParams.toString() ? '?' + targetParams.toString() : '');

  function getDrawerTitle(drawer) {
    const titleEl = drawer.querySelector('.drawer-title');
    return titleEl ? titleEl.textContent.trim() : 'Drawer';
  }

  function updateDrawerToggleUi(drawer) {
    const toggle = drawer.querySelector('[data-drawer-toggle]');
    if (!toggle) return;
    const isOpen = drawer.classList.contains('is-open');
    const drawerTitle = getDrawerTitle(drawer);
    toggle.textContent = isOpen ? '▾' : '▴';
    const label = isOpen ? drawerTitle + ' einklappen' : drawerTitle + ' aufklappen';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  function setDrawerOpen(drawer, isOpen) {
    drawer.classList.toggle('is-open', !!isOpen);
    updateDrawerToggleUi(drawer);
  }

  function toggleDrawer(drawer) {
    setDrawerOpen(drawer, !drawer.classList.contains('is-open'));
  }

  drawers.forEach(function (drawer) {
    updateDrawerToggleUi(drawer);
  });

  drawerToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      const drawerId = toggle.getAttribute('data-drawer-toggle');
      if (!drawerId) return;
      const drawer = document.getElementById(drawerId);
      if (!drawer) return;
      toggleDrawer(drawer);
    });
  });

  fabPractice.addEventListener('click', function () {
    const fallbackParams = new URLSearchParams();
    if (json) fallbackParams.set('json', json);
    if (folder) fallbackParams.set('folder', folder);
    if (game) fallbackParams.set('game', game);
    const fallbackTarget = './generic_c_suite/generic_c_suite.html' + (fallbackParams.toString() ? '?' + fallbackParams.toString() : '');
    const practiceTarget = game || fallbackTarget;

    const payload = {
      type: 'generic:start-practice',
      folder: folder || '',
      json: json || '',
      game: game || ''
    };

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
        // Fallback: falls Parent nicht reagiert, im aktuellen Frame starten.
        window.setTimeout(function () {
          if (window.location.href.indexOf('generic_page') !== -1) {
            window.location.href = practiceTarget;
          }
        }, 180);
        return;
      }
    } catch (_) {
      // ignore cross-window errors
    }
    window.location.href = practiceTarget;
  });

  if (fabFeedback) {
    fabFeedback.addEventListener('click', function () {
      // Placeholder for future feedback flow
      window.dispatchEvent(new CustomEvent('generic-feedback-click'));
    });
  }
})();
