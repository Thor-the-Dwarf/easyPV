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

  function buildSourceImageItems() {
    return [
      {
        href: 'https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia',
        src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Network_switches.jpg',
        alt: 'Netzwerk-Switches',
        meta: 'Wikimedia Commons (freie Lizenzen)'
      },
      {
        href: 'https://unsplash.com/license',
        src: 'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1200&q=80',
        alt: 'Elektronik und IT-Hardware',
        meta: 'Unsplash (kommerzielle Nutzung erlaubt)'
      },
      {
        href: 'https://www.pexels.com/license/',
        src: 'https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1200',
        alt: 'Laptop und Arbeitsplatz',
        meta: 'Pexels (kostenlos, kommerziell nutzbar)'
      },
      {
        href: 'https://pixabay.com/service/license-summary/',
        src: 'https://cdn.pixabay.com/photo/2015/01/08/18/24/laptop-593673_1280.jpg',
        alt: 'IT-Projektarbeit am Laptop',
        meta: 'Pixabay (freie Nutzung laut Lizenz)'
      },
      {
        href: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
        src: 'https://images-assets.nasa.gov/image/PIA12235/PIA12235~large.jpg',
        alt: 'NASA Bildarchiv Beispielbild',
        meta: 'NASA Images (Nutzungsrichtlinien beachten)'
      },
      {
        href: 'https://www.loc.gov/free-to-use/',
        src: 'https://cdn.loc.gov/service/pnp/highsm/15400/15457v.jpg',
        alt: 'Bibliothek der digitalen Sammlung',
        meta: 'Library of Congress (free to use & reuse)'
      }
    ];
  }

  function renderImageList() {
    if (!imageGridList) return;
    const imageItems = buildSourceImageItems();

    if (imageDrawerTitle) {
      imageDrawerTitle.textContent = 'Bildquellen: 6 externe Quellen (3x2 Grid)';
    }

    if (!imageItems.length) {
      imageGridList.innerHTML = '<p class="drawer-note">Keine thematisch passenden Bilder gefunden.</p>';
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
          '" loading="lazy" />' +
          '<span class="image-meta">' +
          escapeHtml(item.meta) +
          '</span>' +
          '</a>'
        );
      })
      .join('');
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
