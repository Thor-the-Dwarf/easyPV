(function () {
  'use strict';

  const frame = document.getElementById('content-frame');
  const drawer = document.getElementById('c-suite-drawer');
  const drawerClose = document.getElementById('drawer-close');
  const fabPractice = document.getElementById('fab-practice');
  const fabFeedback = document.getElementById('fab-feedback');
  if (!frame || !drawer || !fabPractice) return;

  const params = new URLSearchParams(window.location.search);
  const json = params.get('json');
  const folder = params.get('folder');

  const targetParams = new URLSearchParams();
  if (json) targetParams.set('json', json);
  if (folder) targetParams.set('folder', folder);

  frame.src = './generic_c_suite/generic_c_suite.html' + (targetParams.toString() ? '?' + targetParams.toString() : '');

  function setDrawerOpen(isOpen) {
    drawer.classList.toggle('is-open', !!isOpen);
  }

  function toggleDrawer() {
    setDrawerOpen(!drawer.classList.contains('is-open'));
  }

  fabPractice.addEventListener('click', toggleDrawer);
  if (drawerClose) drawerClose.addEventListener('click', function () { setDrawerOpen(false); });

  if (fabFeedback) {
    fabFeedback.addEventListener('click', function () {
      // Placeholder for future feedback flow
      window.dispatchEvent(new CustomEvent('generic-feedback-click'));
    });
  }
})();
