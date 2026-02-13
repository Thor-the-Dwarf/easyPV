(function () {
  'use strict';

  const frame = document.getElementById('content-frame');
  if (!frame) return;

  const params = new URLSearchParams(window.location.search);
  const json = params.get('json');
  const folder = params.get('folder');

  const targetParams = new URLSearchParams();
  if (json) targetParams.set('json', json);
  if (folder) targetParams.set('folder', folder);

  frame.src = './generic_c_suite/generic_c_suite.html' + (targetParams.toString() ? '?' + targetParams.toString() : '');
})();
