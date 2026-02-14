(function () {
  'use strict';

  const THEME_KEY = 'globalTheme_v1';
  const frame = document.getElementById('content-frame');
  const drawers = document.querySelectorAll('.generic-drawer');
  const drawerToggles = document.querySelectorAll('[data-drawer-toggle]');
  const fabPractice = document.getElementById('fab-practice');
  const fabFeedback = document.getElementById('fab-feedback');
  const imageGridList = document.getElementById('image-grid-listview');
  const imageDrawerTitle = document.getElementById('image-drawer-title');
  if (!frame || !drawers.length || !fabPractice || !drawerToggles.length) return;

  initThemeSync();

  const params = new URLSearchParams(window.location.search);
  const json = params.get('json');
  const folder = params.get('folder');
  const game = params.get('game');

  const targetParams = new URLSearchParams();
  if (json) targetParams.set('json', json);
  if (folder) targetParams.set('folder', folder);

  frame.src = './generic_c_suite/generic_c_suite.html' + (targetParams.toString() ? '?' + targetParams.toString() : '');

  function initThemeSync() {
    applyThemeFromParentOrStorage();

    window.addEventListener('storage', function (event) {
      if (!event || event.key === THEME_KEY || event.key === null) {
        applyThemeFromParentOrStorage();
      }
    });
    window.addEventListener('message', function (event) {
      const data = event && event.data;
      if (!data || data.type !== 'global:theme') return;
      applyTheme(String(data.theme || '').toLowerCase() === 'light' ? 'light' : 'dark');
    });

    try {
      if (!window.parent || window.parent === window) return;
      const parentRoot = window.parent.document.documentElement;
      if (!parentRoot) return;

      const observer = new MutationObserver(function () {
        applyThemeFromParentOrStorage();
      });
      observer.observe(parentRoot, { attributes: true, attributeFilter: ['class'] });
    } catch (_) {
      // ignore cross-window access issues
    }
  }

  function applyThemeFromParentOrStorage() {
    let isLight = false;

    try {
      if (window.parent && window.parent !== window) {
        isLight = window.parent.document.documentElement.classList.contains('theme-light');
      } else {
        isLight = localStorage.getItem(THEME_KEY) === 'light';
      }
    } catch (_) {
      isLight = localStorage.getItem(THEME_KEY) === 'light';
    }

    applyTheme(isLight ? 'light' : 'dark');
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
  }

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

  function buildAddTileDataUri() {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">' +
      '<defs><linearGradient id="g2" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#0f2e52"/><stop offset="100%" stop-color="#0a1d34"/></linearGradient></defs>' +
      '<rect width="1200" height="900" fill="url(#g2)"/>' +
      '<text x="600" y="500" text-anchor="middle" fill="#93c5fd" font-size="220" font-family="Segoe UI, Arial">+</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function detectContextKey() {
    const raw = String(folder || '').toLowerCase();
    if (raw.indexOf('leasing') !== -1) return 'leasing';
    if (raw.indexOf('nutzwert') !== -1) return 'nutzwertanalyse';
    if (raw.indexOf('change') !== -1) return 'change_management';
    if (raw.indexOf('fremdvergabe') !== -1 || raw.indexOf('make or buy') !== -1) return 'fremdvergabe';
    if (raw.indexOf('4-ohren') !== -1 || raw.indexOf('kommunikation') !== -1) return 'kommunikation';
    return 'default_it';
  }

  function buildDefaultImageItems(contextKey) {
    const pools = {
      leasing: [
        {
          href: 'https://commons.wikimedia.org/wiki/File:Network_switches.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Network_switches.jpg',
          alt: 'Netzwerk-Switches',
          meta: 'Wikimedia Commons',
          title: 'Leasingobjekt Netzwerk-Switches'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:BalticServers_data_center.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/BalticServers_data_center.jpg',
          alt: 'Serverraum',
          meta: 'Wikimedia Commons',
          title: 'Leasingobjekt Serverraum'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:ThinkPad_X200_and_T400.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/ThinkPad_X200_and_T400.jpg',
          alt: 'Business-Laptops',
          meta: 'Wikimedia Commons',
          title: 'Leasingobjekt Notebook-Flotte'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:HP_LaserJet_laser_printer.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/HP_LaserJet_laser_printer.jpg',
          alt: 'Laserdrucker',
          meta: 'Wikimedia Commons',
          title: 'Leasingobjekt Drucker'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Ethernet_Switch_(Front_View).jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ethernet%20Switch%20%28Front%20View%29.jpg',
          alt: 'Ethernet-Switch',
          meta: 'Wikimedia Commons',
          title: 'Leasingobjekt Access-Switch'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1600&q=80',
          alt: 'IT-Arbeitsplatz',
          meta: 'Unsplash',
          title: 'Leasingobjekt Arbeitsplatz-IT'
        }
      ],
      nutzwertanalyse: [
        {
          href: 'https://commons.wikimedia.org/wiki/File:Gantt_or_Bar_Chart.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gantt_or_Bar_Chart.jpg',
          alt: 'Balkendiagramm',
          meta: 'Wikimedia Commons',
          title: 'Kriterienvergleich mit Balken'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:UML_class_diagram_example.svg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/UML_class_diagram_example.svg',
          alt: 'Strukturdiagramm',
          meta: 'Wikimedia Commons',
          title: 'Strukturiertes Bewertungsmodell'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Network_switches.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Network_switches.jpg',
          alt: 'Technische Alternative',
          meta: 'Wikimedia Commons',
          title: 'Option A: Netzwerk-Switches'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:BalticServers_data_center.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/BalticServers_data_center.jpg',
          alt: 'Technische Alternative',
          meta: 'Wikimedia Commons',
          title: 'Option B: Rechenzentrum'
        },
        {
          href: 'https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Team am Laptop',
          meta: 'Pexels',
          title: 'Bewertung im Team'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1600&q=80',
          alt: 'IT-Option',
          meta: 'Unsplash',
          title: 'Option C: Arbeitsplatz-Hardware'
        }
      ],
      change_management: [
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
          alt: 'Workshop-Situation',
          meta: 'Unsplash',
          title: 'Change-Workshop'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
          alt: 'Teamarbeit',
          meta: 'Unsplash',
          title: 'Team in Veraenderung'
        },
        {
          href: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Meeting',
          meta: 'Pexels',
          title: 'Kommunikation im Change'
        },
        {
          href: 'https://images.pexels.com/photos/1181533/pexels-photo-1181533.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/1181533/pexels-photo-1181533.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Planung',
          meta: 'Pexels',
          title: 'Roadmap und Planung'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Gantt_or_Bar_Chart.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gantt_or_Bar_Chart.jpg',
          alt: 'Planungsdiagramm',
          meta: 'Wikimedia Commons',
          title: 'Zeitplan im Change'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:UML_Activity_Diagram.svg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/UML_Activity_Diagram.svg',
          alt: 'Ablaufdiagramm',
          meta: 'Wikimedia Commons',
          title: 'Prozessveraenderung'
        }
      ],
      fremdvergabe: [
        {
          href: 'https://commons.wikimedia.org/wiki/File:Handshake-icon.svg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Handshake-icon.svg',
          alt: 'Vertragsabschluss',
          meta: 'Wikimedia Commons',
          title: 'Partnerauswahl'
        },
        {
          href: 'https://images.pexels.com/photos/3183198/pexels-photo-3183198.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/3183198/pexels-photo-3183198.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Business Meeting',
          meta: 'Pexels',
          title: 'Anbietergespraech'
        },
        {
          href: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Verhandlung',
          meta: 'Pexels',
          title: 'Verhandlung'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
          alt: 'Dokumente',
          meta: 'Unsplash',
          title: 'Anforderungsdokumente'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Gantt_or_Bar_Chart.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gantt_or_Bar_Chart.jpg',
          alt: 'Projektplan',
          meta: 'Wikimedia Commons',
          title: 'Lieferzeitplanung'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Network_switches.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Network_switches.jpg',
          alt: 'IT-Komponente',
          meta: 'Wikimedia Commons',
          title: 'Outsourcing-Objekt IT'
        }
      ],
      kommunikation: [
        {
          href: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Gesprächsrunde',
          meta: 'Pexels',
          title: 'Kommunikationssituation'
        },
        {
          href: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'Meeting',
          meta: 'Pexels',
          title: 'Feedback-Gespraech'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80',
          alt: 'Diskussion',
          meta: 'Unsplash',
          title: 'Perspektiven abgleichen'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80',
          alt: 'Besprechung',
          meta: 'Unsplash',
          title: 'Moderation'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Communication_icon.svg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Communication_icon.svg',
          alt: 'Kommunikation Symbol',
          meta: 'Wikimedia Commons',
          title: 'Kommunikationsmodell'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:Teamwork_icon.svg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Teamwork_icon.svg',
          alt: 'Teamwork Symbol',
          meta: 'Wikimedia Commons',
          title: 'Zusammenarbeit'
        }
      ],
      default_it: [
        {
          href: 'https://commons.wikimedia.org/wiki/File:Network_switches.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Network_switches.jpg',
          alt: 'Netzwerk-Switches',
          meta: 'Wikimedia Commons',
          title: 'Netzwerk-Switches'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:BalticServers_data_center.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/BalticServers_data_center.jpg',
          alt: 'Serverraum',
          meta: 'Wikimedia Commons',
          title: 'Serverraum'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:ThinkPad_X200_and_T400.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/ThinkPad_X200_and_T400.jpg',
          alt: 'Business-Laptops',
          meta: 'Wikimedia Commons',
          title: 'Business-Laptops'
        },
        {
          href: 'https://commons.wikimedia.org/wiki/File:HP_LaserJet_laser_printer.jpg',
          src: 'https://commons.wikimedia.org/wiki/Special:FilePath/HP_LaserJet_laser_printer.jpg',
          alt: 'Laserdrucker',
          meta: 'Wikimedia Commons',
          title: 'Laserdrucker'
        },
        {
          href: 'https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1600',
          src: 'https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1600',
          alt: 'IT-Arbeitsplatz',
          meta: 'Pexels',
          title: 'IT-Arbeitsplatz'
        },
        {
          href: 'https://unsplash.com/license',
          src: 'https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1600&q=80',
          alt: 'Elektronik',
          meta: 'Unsplash',
          title: 'Elektronik und Hardware'
        }
      ]
    };
    return pools[contextKey] || pools.default_it;
  }

  function ensureSixImageItems(items, contextKey) {
    const valid = Array.isArray(items) ? items.filter(Boolean) : [];
    const defaults = buildDefaultImageItems(contextKey);
    const out = valid.slice(0, 6);
    let fallbackIndex = 0;
    while (out.length < 6) {
      out.push(defaults[fallbackIndex % defaults.length]);
      fallbackIndex += 1;
    }
    return out;
  }

  function customImageStorageKey(contextKey) {
    return 'genericPageCustomImage:' + contextKey;
  }

  function loadCustomImageItem(contextKey) {
    try {
      const raw = localStorage.getItem(customImageStorageKey(contextKey));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const src = String(parsed && parsed.src ? parsed.src : '').trim();
      if (!src) return null;
      return {
        src: src,
        href: String(parsed.href || src).trim() || src,
        title: String(parsed.title || 'Eigenes Bild').trim() || 'Eigenes Bild',
        meta: String(parsed.meta || 'Eigene Bild-URL').trim() || 'Eigene Bild-URL',
        alt: String(parsed.alt || 'Benutzerdefiniertes Bild').trim() || 'Benutzerdefiniertes Bild'
      };
    } catch (_) {
      return null;
    }
  }

  function isLikelyImageUrl(url) {
    try {
      const parsed = new URL(String(url || '').trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function setCustomImageItem(contextKey, url) {
    const nextUrl = String(url || '').trim();
    try {
      if (!nextUrl) {
        localStorage.removeItem(customImageStorageKey(contextKey));
        return { ok: true, cleared: true };
      }
      if (!isLikelyImageUrl(nextUrl)) {
        return { ok: false };
      }
      const payload = {
        src: nextUrl,
        href: nextUrl,
        title: 'Eigenes Bild',
        meta: 'Eigene Bild-URL',
        alt: 'Benutzerdefiniertes Bild'
      };
      localStorage.setItem(customImageStorageKey(contextKey), JSON.stringify(payload));
      return { ok: true, cleared: false };
    } catch (_) {
      return { ok: false };
    }
  }

  async function loadImageItemsFromJson() {
    const contextKey = detectContextKey();
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
        const parsed = list
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
        return ensureSixImageItems(parsed, contextKey);
      } catch (_) {
        // keep trying additional sources
      }
    }
    return ensureSixImageItems([], contextKey);
  }

  async function renderImageList() {
    if (!imageGridList) return;
    const contextKey = detectContextKey();
    const imageItems = await loadImageItemsFromJson();
    const baseItems = imageItems.slice(0, 5);
    const customItem = loadCustomImageItem(contextKey);

    if (imageDrawerTitle) {
      imageDrawerTitle.textContent = 'Bilder';
    }

    const baseHtml = baseItems
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

    const customHtml = customItem
      ? '<button type="button" class="image-grid-item image-grid-item--add has-custom" id="custom-image-slot" aria-label="Eigenes Bild aendern">' +
        '<img src="' +
        escapeHtml(customItem.src) +
        '" alt="' +
        escapeHtml(customItem.alt) +
        '" data-placeholder-src="' +
        escapeHtml(buildPlaceholderDataUri(customItem.title)) +
        '" loading="lazy" />' +
        '<span class="add-plus-badge">+</span>' +
        '<span class="image-meta">' +
        escapeHtml(customItem.meta) +
        '</span>' +
        '</button>'
      : '<button type="button" class="image-grid-item image-grid-item--add" id="custom-image-slot" aria-label="Bild-URL hinzufuegen">' +
        '<img src="' +
        escapeHtml(buildAddTileDataUri()) +
        '" alt="Bild hinzufuegen" loading="lazy" />' +
        '<span class="image-meta">Bild per URL hinzufuegen</span>' +
        '</button>';

    imageGridList.innerHTML = baseHtml + customHtml;

    const images = imageGridList.querySelectorAll('img[data-placeholder-src]');
    images.forEach(function (img) {
      img.addEventListener('error', function onError() {
        const fallback = img.getAttribute('data-placeholder-src');
        if (!fallback || img.getAttribute('src') === fallback) return;
        img.setAttribute('src', fallback);
      });
    });

    const customSlot = document.getElementById('custom-image-slot');
    if (customSlot) {
      customSlot.addEventListener('click', function () {
        const existing = loadCustomImageItem(contextKey);
        const current = existing ? existing.src : '';
        const entered = window.prompt(
          'Bild-URL einfügen (https://...). Leer lassen und bestätigen, um eigenes Bild zu entfernen.',
          current
        );
        if (entered === null) return;
        const result = setCustomImageItem(contextKey, entered);
        if (!result.ok) {
          window.alert('Bitte eine gueltige http(s)-Bild-URL eingeben.');
          return;
        }
        renderImageList();
      });
    }
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
