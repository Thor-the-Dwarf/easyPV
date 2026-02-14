(function () {
  'use strict';

  const frame = document.getElementById('content-frame');
  const drawers = document.querySelectorAll('.generic-drawer');
  const drawerToggles = document.querySelectorAll('[data-drawer-toggle]');
  const fabPractice = document.getElementById('fab-practice');
  const fabFeedback = document.getElementById('fab-feedback');
  const imageGridList = document.getElementById('image-grid-listview');
  const imageDrawerTitle = document.getElementById('image-drawer-title');
  if (!frame || !drawers.length || !fabPractice || !drawerToggles.length) return;

  const params = new URLSearchParams(window.location.search);
  const json = params.get('json');
  const folder = params.get('folder');
  const game = params.get('game');

  const targetParams = new URLSearchParams();
  if (json) targetParams.set('json', json);
  if (folder) targetParams.set('folder', folder);

  frame.src = './generic_c_suite/generic_c_suite.html' + (targetParams.toString() ? '?' + targetParams.toString() : '');

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildPlaceholderDataUri(title) {
    const safeTitle = String(title || 'Bild').replace(/"/g, "'");
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">' +
      '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#12345a"/><stop offset="100%" stop-color="#0b1e33"/></linearGradient></defs>' +
      '<rect width="1200" height="900" fill="url(#g)"/>' +
      '<text x="600" y="470" text-anchor="middle" fill="#93c5fd" font-size="40" font-family="Segoe UI, Arial">' +
      safeTitle +
      '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  async function loadImageItemsFromJson() {
    const sources = [];
    if (json) sources.push(json);
    for (let i = 0; i < sources.length; i += 1) {
      const sourceRef = sources[i];
      try {
        const resp = await fetch(sourceRef);
        if (!resp.ok) continue;
        const payload = await resp.json();
        const list = payload && Array.isArray(payload.bild_quellen) ? payload.bild_quellen : [];
        if (!list.length) continue;
        const sourceBase = new URL(sourceRef, window.location.href).href;
        return list
          .map(function (entry) {
            const title = String(entry && entry.titel ? entry.titel : '').trim();
            const topic = String(entry && entry.thema ? entry.thema : '').trim();
            const imageUrl = String(entry && entry.bild_url ? entry.bild_url : '').trim();
            const sourceUrl = String(entry && entry.quelle_url ? entry.quelle_url : '').trim();
            const license = String(entry && entry.lizenz ? entry.lizenz : '').trim();
            if (!imageUrl) return null;
            let resolvedImageUrl = imageUrl;
            let resolvedSourceUrl = sourceUrl || imageUrl;
            try {
              resolvedImageUrl = new URL(imageUrl, sourceBase).href;
            } catch (_) {}
            try {
              resolvedSourceUrl = new URL(sourceUrl || imageUrl, sourceBase).href;
            } catch (_) {}
            const metaParts = [topic, license].filter(Boolean);
            return {
              href: resolvedSourceUrl,
              src: resolvedImageUrl,
              alt: title || topic || 'Externes Bild',
              meta: metaParts.join(' | ') || 'Externe Quelle',
              title: title || topic || 'Bild'
            };
          })
          .filter(Boolean)
          .slice(0, 6);
      } catch (_) {
        // keep trying additional sources
      }
    }
    return [];
  }

  async function renderImageList() {
    if (!imageGridList) return;
    const imageItems = await loadImageItemsFromJson();

    if (imageDrawerTitle) {
      imageDrawerTitle.textContent = 'Bilder';
    }

    if (!imageItems.length) {
      imageGridList.innerHTML = '<p class="drawer-note">Keine Bildquellen in der __cSuite-Datei gefunden.</p>';
      return;
    }

    imageGridList.innerHTML = imageItems
      .map(function (item) {
        return (
          '<a class="image-grid-item" href="' +
          escapeHtml(item.href) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' +
          escapeHtml(item.src) +
          '" alt="' +
          escapeHtml(item.alt) +
          '" data-placeholder-src="' +
          escapeHtml(buildPlaceholderDataUri(item.title)) +
          '" loading="lazy" />' +
          '<span class="image-meta">' +
          escapeHtml(item.meta) +
          '</span>' +
          '</a>'
        );
      })
      .join('');

    const images = imageGridList.querySelectorAll('img[data-placeholder-src]');
    images.forEach(function (img) {
      img.addEventListener('error', function onError() {
        const fallback = img.getAttribute('data-placeholder-src');
        if (!fallback || img.getAttribute('src') === fallback) return;
        img.setAttribute('src', fallback);
      });
    });
  }

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
  renderImageList();

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
