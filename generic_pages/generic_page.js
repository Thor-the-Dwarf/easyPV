(function () {
  'use strict';

  const frame = document.getElementById('content-frame');
  const drawer = document.getElementById('c-suite-drawer');
  const drawerToggle = document.getElementById('drawer-toggle');
  const fabPractice = document.getElementById('fab-practice');
  const fabFeedback = document.getElementById('fab-feedback');
  if (!frame || !drawer || !fabPractice || !drawerToggle) return;

  const params = new URLSearchParams(window.location.search);
  const json = params.get('json');
  const folder = params.get('folder');

  const targetParams = new URLSearchParams();
  if (json) targetParams.set('json', json);
  if (folder) targetParams.set('folder', folder);

  frame.src = './generic_c_suite/generic_c_suite.html' + (targetParams.toString() ? '?' + targetParams.toString() : '');

  function updateDrawerToggleUi() {
    const isOpen = drawer.classList.contains('is-open');
    drawerToggle.textContent = isOpen ? '▾' : '▴';
    const label = isOpen ? 'C-Suite einklappen' : 'C-Suite aufklappen';
    drawerToggle.setAttribute('aria-label', label);
    drawerToggle.title = label;
  }

  function setDrawerOpen(isOpen) {
    drawer.classList.toggle('is-open', !!isOpen);
    updateDrawerToggleUi();
  }

  function toggleDrawer() {
    setDrawerOpen(!drawer.classList.contains('is-open'));
  }

  updateDrawerToggleUi();
  fabPractice.addEventListener('click', function () {
    const fallbackParams = new URLSearchParams();
    if (json) fallbackParams.set('json', json);
    if (folder) fallbackParams.set('folder', folder);
    const fallbackTarget = './generic_c_suite/generic_c_suite.html' + (fallbackParams.toString() ? '?' + fallbackParams.toString() : '');

    const payload = {
      type: 'generic:start-practice',
      folder: folder || '',
      json: json || ''
    };

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
        // Fallback: falls Parent nicht reagiert, im aktuellen Frame starten.
        window.setTimeout(function () {
          if (window.location.href.indexOf('generic_page') !== -1) {
            window.location.href = fallbackTarget;
          }
        }, 180);
        return;
      }
    } catch (_) {
      // ignore cross-window errors
    }
    window.location.href = fallbackTarget;
  });
  drawerToggle.addEventListener('click', toggleDrawer);

  if (fabFeedback) {
    fabFeedback.addEventListener('click', function () {
      // Placeholder for future feedback flow
      window.dispatchEvent(new CustomEvent('generic-feedback-click'));
    });
  }
})();
