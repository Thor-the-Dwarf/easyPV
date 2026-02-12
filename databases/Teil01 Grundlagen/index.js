(function () {
  'use strict';

  const THEME_KEY = 'globalTheme_v1';
  const STATE_KEY = 'paukerAppState_v1';

  const themeToggleApp = document.getElementById('theme-toggle-app');
  const menuBtn = document.getElementById('menu-tree-btn');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const viewTitleEl = document.getElementById('view-title');
  const viewPathEl = document.getElementById('view-path');
  const viewBodyEl = document.getElementById('view-body');
  const contentEl = document.querySelector('.content');
  const contentHeader = document.getElementById('content-header');
  const treeRootEl = document.getElementById('tree-root');
  const drawerTitleEl = document.getElementById('drawer-title');
  const drawerResizer = document.getElementById('drawer-resizer');
  const treeDrawer = document.getElementById('tree-drawer');
  const searchInput = document.getElementById('tree-search');
  const autocompleteEl = document.getElementById('autocomplete');
  const filterTeilEl = document.getElementById('filter-teil');
  const filterTypEl = document.getElementById('filter-typ');
  const filterLevelEl = document.getElementById('filter-level');

  let appState = {
    selectedId: null,
    openedIds: [],
    drawerOpen: false,
    drawerWidth: 320
  };

  let rootTree = [];
  let rootName = 'Database';
  let searchIndex = [];

  init();

  function init() {
    loadAppState();
    initTheme();

    themeToggleApp.addEventListener('click', toggleTheme);
    menuBtn.onclick = toggleDrawer;
    drawerBackdrop.onclick = () => setDrawer(false);

    initResizer();
    applyDrawerState();
    initSearchUi();
    initFilterUi();
    initLocalApp();
  }

  function applyTheme(theme) {
    const rootEl = document.documentElement;
    if (theme === 'light') {
      rootEl.classList.add('theme-light');
      themeToggleApp.textContent = '☀️';
    } else {
      rootEl.classList.remove('theme-light');
      themeToggleApp.textContent = '🌙';
    }
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    const initial = stored === 'light' ? 'light' : 'dark';
    applyTheme(initial);
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.contains('theme-light');
    const next = isLight ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  function loadAppState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        Object.assign(appState, JSON.parse(raw));
      }
    } catch (_) {
      // ignore invalid local state
    }
  }

  function saveAppState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
  }

  function toggleDrawer() {
    setDrawer(!appState.drawerOpen);
  }

  function setDrawer(isOpen) {
    appState.drawerOpen = isOpen;
    saveAppState();
    applyDrawerState();
  }

  function applyDrawerState() {
    if (appState.drawerWidth) {
      treeDrawer.style.setProperty('--drawer-width', appState.drawerWidth + 'px');
    }

    if (appState.drawerOpen) {
      document.getElementById('app-view').classList.add('tree-open');
      menuBtn.classList.add('active');
      drawerBackdrop.classList.add('active');
    } else {
      document.getElementById('app-view').classList.remove('tree-open');
      menuBtn.classList.remove('active');
      drawerBackdrop.classList.remove('active');
    }
  }

  function initResizer() {
    if (!drawerResizer) return;
    let isResizing = false;

    drawerResizer.addEventListener('mousedown', () => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      drawerResizer.classList.add('resizing');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8;
      appState.drawerWidth = newWidth;
      treeDrawer.style.setProperty('--drawer-width', newWidth + 'px');
    });

    window.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      drawerResizer.classList.remove('resizing');
      saveAppState();
    });
  }

  async function initLocalApp() {
    const cachedIndex = localStorage.getItem('pauker_remote_index_v1');

    if (cachedIndex) {
      try {
        rootTree = JSON.parse(cachedIndex);
      } catch (_) {
        rootTree = [];
      }
    }

    if (!rootTree.length) {
      try {
        const response = await fetch('database-index.json?ts=' + Date.now());
        if (!response.ok) {
          throw new Error('database-index.json konnte nicht geladen werden.');
        }

        const payload = await response.json();
        rootTree = Array.isArray(payload.tree) ? payload.tree : [];
        localStorage.setItem('pauker_remote_index_v1', JSON.stringify(rootTree));
      } catch (error) {
        showOverviewMessage('Fehler beim Laden des Index: ' + error.message);
        return;
      }
    }

    drawerTitleEl.textContent = rootName;
    treeRootEl.innerHTML = '';
    buildTreeHelper(treeRootEl, rootTree, 0);
    searchIndex = buildSearchIndex(rootTree);

    showOverviewMessage('Bitte waehle eine Datei aus dem Menue.');
    applySelectedCss();

    if (appState.selectedId) {
      const node = findNode(rootTree, appState.selectedId);
      if (node) selectNode(node.id);
    }
  }

  function showOverviewMessage(message) {
    viewTitleEl.textContent = 'Bereit';
    viewPathEl.textContent = rootName;
    viewBodyEl.innerHTML = '<p style="padding:2rem; color:hsl(var(--txt-muted))">' + escapeHtml(message) + '</p>';
    contentHeader.classList.remove('hidden');
    contentEl.classList.remove('full-screen');
    viewBodyEl.classList.remove('iframe-container');
    viewBodyEl.classList.add('card');
  }

  window.goToOverview = function () {
    appState.selectedId = null;
    saveAppState();
    applySelectedCss();
    showOverviewMessage('Bitte waehle eine Datei aus dem Menue.');
  };

  function buildSearchIndex(nodes, path) {
    const index = [];
    const currentPath = path || [];

    nodes.forEach((node) => {
      const pathParts = currentPath.concat(node.name);

      if (node.isFolder && node.children) {
        index.push.apply(index, buildSearchIndex(node.children, pathParts));
        return;
      }

      if (!node.isFolder) {
        const title = (node.name || '').replace(/\.[^.]+$/, '');
        index.push({
          id: node.id,
          title: title,
          path: pathParts.join(' / '),
          kind: node.kind || ''
        });
      }
    });

    return index;
  }

  function tokenizeForSearch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\- ]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function searchEntries(query, limit) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const tokens = tokenizeForSearch(q);
    const results = [];

    searchIndex.forEach((entry) => {
      let score = 0;
      tokens.forEach((t) => {
        if (entry.title.toLowerCase().includes(t)) score += 3;
        if (entry.path.toLowerCase().includes(t)) score += 2;
      });

      if (score > 0) results.push({ entry: entry, score: score });
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit || 10).map((x) => x.entry);
  }

  function initSearchUi() {
    if (!searchInput || !autocompleteEl) return;

    let activeIndex = -1;
    let currentResults = [];

    const hide = () => {
      autocompleteEl.classList.add('hidden');
      autocompleteEl.innerHTML = '';
      activeIndex = -1;
      currentResults = [];
    };

    const showResults = (results) => {
      if (!results.length) {
        hide();
        return;
      }

      currentResults = results;
      autocompleteEl.innerHTML = results
        .map((r, idx) => {
          return '<div class="autocomplete-item" data-idx="' + idx + '" role="option" tabindex="0">'
            + '<div class="autocomplete-title">' + escapeHtml(r.title) + '</div>'
            + '<div class="autocomplete-path">' + escapeHtml(r.path) + '</div>'
            + '</div>';
        })
        .join('');
      autocompleteEl.classList.remove('hidden');
    };

    const pickActive = (idx) => {
      const items = autocompleteEl.querySelectorAll('.autocomplete-item');
      items.forEach((i) => i.classList.remove('is-active'));
      if (idx >= 0 && idx < items.length) {
        items[idx].classList.add('is-active');
        items[idx].focus();
      }
    };

    const openEntry = (entry) => {
      if (!entry) return;
      selectNode(entry.id);
      hide();
    };

    searchInput.addEventListener('input', (e) => {
      const results = searchEntries(e.target.value, 10);
      showResults(results);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (autocompleteEl.classList.contains('hidden')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
        pickActive(activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        pickActive(activeIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openEntry(currentResults[activeIndex] || currentResults[0]);
      } else if (e.key === 'Escape') {
        hide();
      }
    });

    autocompleteEl.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      openEntry(currentResults[Number(item.dataset.idx)]);
    });

    document.addEventListener('click', (e) => {
      if (e.target === searchInput || autocompleteEl.contains(e.target)) return;
      hide();
    });
  }

  function initFilterUi() {
    const groups = [filterTeilEl, filterTypEl, filterLevelEl].filter(Boolean);
    groups.forEach((groupEl) => {
      groupEl.querySelectorAll('.filter-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('is-active');
          btn.setAttribute('aria-pressed', btn.classList.contains('is-active') ? 'true' : 'false');
          applyFilters();
        });
      });
    });
  }

  function getActiveFilterValues(groupEl) {
    if (!groupEl) return [];
    return Array.from(groupEl.querySelectorAll('.filter-chip.is-active')).map((btn) => btn.textContent.trim().toLowerCase());
  }

  function applyFilters() {
    const teilFilters = getActiveFilterValues(filterTeilEl);
    const typFilters = getActiveFilterValues(filterTypEl);
    const levelFilters = getActiveFilterValues(filterLevelEl);
    const hasAnyFilter = teilFilters.length || typFilters.length || levelFilters.length;

    const nodes = Array.from(document.querySelectorAll('.tree-node'));

    nodes.forEach((nodeEl) => {
      const isFolder = nodeEl.dataset.isFolder === '1';
      const kind = nodeEl.dataset.kind;

      if (isFolder) {
        nodeEl.classList.remove('is-filtered');
        return;
      }

      if (!hasAnyFilter) {
        nodeEl.classList.remove('is-filtered');
        return;
      }

      if (kind !== 'json') {
        nodeEl.classList.add('is-filtered');
        return;
      }

      const teil = (nodeEl.dataset.teil || '').toLowerCase();
      const typ = (nodeEl.dataset.typ || '').toLowerCase();
      const level = (nodeEl.dataset.level || 'unbekannt').toLowerCase();

      const teilOk = !teilFilters.length || teilFilters.includes(teil);
      const typOk = !typFilters.length || typFilters.includes(typ);
      const levelOk = !levelFilters.length || levelFilters.includes(level);

      nodeEl.classList.toggle('is-filtered', !(teilOk && typOk && levelOk));
    });

    nodes.slice().reverse().forEach((nodeEl) => {
      if (nodeEl.dataset.isFolder !== '1') return;

      if (!hasAnyFilter) {
        nodeEl.classList.remove('is-filtered');
        return;
      }

      const children = nodeEl.querySelectorAll('.tree-children .tree-node');
      const hasVisibleChild = Array.from(children).some((child) => !child.classList.contains('is-filtered'));
      nodeEl.classList.toggle('is-filtered', !hasVisibleChild);
      if (hasVisibleChild) {
        nodeEl.classList.remove('tree-node--collapsed');
        const btn = nodeEl.querySelector('.tree-toggle');
        if (btn) btn.textContent = '▾';
      }
    });
  }

  function inferTeil(node) {
    const val = ((node.relPath || node.id || '') + ' ' + (node.name || '')).toLowerCase();
    if (val.includes('teil01')) return 'teil01';
    if (val.includes('teil02')) return 'teil02';
    if (val.includes('teil03')) return 'teil03';
    return '';
  }

  function inferSpieltyp(node) {
    const val = ((node.relPath || node.id || '') + ' ' + (node.name || '')).toLowerCase();
    if (val.includes('quiz')) return 'quiz';
    if (val.includes('matching')) return 'matching';
    if (val.includes('escape')) return 'escape';
    if (val.includes('what') || val.includes('why')) return 'what&why';
    if (val.includes('wer bin ich')) return 'wer bin ich';
    return '';
  }

  function inferLevel(node) {
    const val = ((node.relPath || node.id || '') + ' ' + (node.name || '')).toLowerCase();
    if (val.includes('leicht')) return 'leicht';
    if (val.includes('mittel')) return 'mittel';
    if (val.includes('schwer')) return 'schwer';
    return 'unbekannt';
  }

  function buildTreeHelper(container, nodes, level) {
    nodes.forEach((node) => {
      const div = document.createElement('div');
      div.className = 'tree-node';
      div.dataset.id = node.id;
      div.dataset.kind = node.kind || '';
      div.dataset.isFolder = node.isFolder ? '1' : '0';

      if (!node.isFolder && node.kind === 'json') {
        div.dataset.teil = inferTeil(node);
        div.dataset.typ = inferSpieltyp(node);
        div.dataset.level = inferLevel(node);
      }

      const isCollapsed = !appState.openedIds.includes(node.id);
      if (isCollapsed) div.classList.add('tree-node--collapsed');

      const row = document.createElement('div');
      row.className = 'tree-row';
      row.style.setProperty('--level', level);
      row.onclick = () => onNodeClick(node);

      if (node.isFolder) {
        const btn = document.createElement('button');
        btn.className = 'tree-toggle';
        btn.textContent = isCollapsed ? '▸' : '▾';
        btn.onclick = (e) => {
          e.stopPropagation();
          toggleNode(div, node.id, btn);
        };
        row.appendChild(btn);
      } else {
        const sp = document.createElement('span');
        sp.className = 'tree-spacer';
        row.appendChild(sp);
      }

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = node.isFolder ? (appState.openedIds.includes(node.id) ? '📂' : '📁') : iconForKind(node.kind);
      row.appendChild(icon);

      const label = document.createElement('button');
      label.className = 'tree-label';
      const cleanLabel = node.name.replace(/\.[^.]+$/, '');
      label.textContent = cleanLabel;
      label.title = cleanLabel;
      row.appendChild(label);

      div.appendChild(row);

      const childCont = document.createElement('div');
      childCont.className = 'tree-children';
      if (node.isFolder && node.children) {
        buildTreeHelper(childCont, node.children, level + 1);
      }
      div.appendChild(childCont);
      container.appendChild(div);
    });
  }

  function iconForKind(kind) {
    if (kind === 'json') return '🏋';
    if (kind === 'pdf') return '📄';
    if (kind === 'pptx') return '📊';
    return '👁';
  }

  function toggleNode(div, id, btn) {
    const idx = appState.openedIds.indexOf(id);
    if (idx >= 0) {
      appState.openedIds.splice(idx, 1);
      div.classList.add('tree-node--collapsed');
      btn.textContent = '▸';
    } else {
      appState.openedIds.push(id);
      div.classList.remove('tree-node--collapsed');
      btn.textContent = '▾';
    }

    saveAppState();
    const icon = div.querySelector('.tree-icon');
    const node = findNode(rootTree, id);
    if (icon && node && node.isFolder) {
      icon.textContent = appState.openedIds.includes(id) ? '📂' : '📁';
    }
  }

  function onNodeClick(node) {
    if (node.isFolder) {
      const div = document.querySelector('.tree-node[data-id="' + cssEscape(node.id) + '"]');
      if (div) {
        const btn = div.querySelector('.tree-toggle');
        if (btn) toggleNode(div, node.id, btn);
      }
      return;
    }

    selectNode(node.id);
  }

  function selectNode(id) {
    appState.selectedId = id;
    saveAppState();
    applySelectedCss();
    updateFeedbackContextById(id);
    renderViewForId(id);
  }

  function applySelectedCss() {
    document.querySelectorAll('.tree-node').forEach((n) => {
      if (n.dataset.id === appState.selectedId) n.classList.add('tree-node--selected');
      else n.classList.remove('tree-node--selected');
    });
  }

  function findNode(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const f = findNode(n.children, id);
        if (f) return f;
      }
    }
    return null;
  }

  function findPath(nodes, id, path) {
    const p = path || [];
    for (const n of nodes) {
      const sub = p.concat(n.name);
      if (n.id === id) return sub;
      if (n.children) {
        const f = findPath(n.children, id, sub);
        if (f) return f;
      }
    }
    return null;
  }

  async function renderViewForId(id) {
    const node = findNode(rootTree, id);
    if (!node) return;

    viewTitleEl.textContent = node.name;
    const p = findPath(rootTree, id) || [node.name];
    viewPathEl.textContent = p.join(' / ');

    if (node.isFolder) {
      contentHeader.classList.remove('hidden');
      contentEl.classList.remove('full-screen');
      viewBodyEl.classList.remove('iframe-container');
      viewBodyEl.classList.add('card');
      const list = (node.children || []).map((c) => '<li>' + escapeHtml(c.name) + '</li>').join('');
      viewBodyEl.innerHTML = '<h3>Inhalt:</h3><ul>' + (list || '<li>Leer</li>') + '</ul>';
      return;
    }

    contentHeader.classList.remove('hidden');
    contentEl.classList.remove('full-screen');
    viewBodyEl.classList.remove('iframe-container');
    viewBodyEl.classList.add('card');
    viewBodyEl.innerHTML = '<div style="padding:2rem; color:hsl(var(--txt-muted));">Lade Datei...</div>';

    const url = resolveNodeUrl(node);
    if (!url) {
      viewBodyEl.innerHTML = '<div style="padding:2rem; color:hsl(var(--error));">Datei-Pfad fehlt im Index.</div>';
      return;
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error('Datei nicht gefunden (' + resp.status + ').');
      }

      const raw = await resp.text();
      let rendered = raw;

      if (node.kind === 'json') {
        try {
          rendered = JSON.stringify(JSON.parse(raw), null, 2);
        } catch (_) {
          rendered = raw;
        }
      }

      viewBodyEl.innerHTML = '<pre style="margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font-family: ui-monospace, Menlo, Monaco, Consolas, Liberation Mono, monospace;">'
        + escapeHtml(rendered)
        + '</pre>';
    } catch (error) {
      viewBodyEl.innerHTML = '<div style="padding:2rem; color:hsl(var(--error));">'
        + escapeHtml(error.message)
        + '</div>';
    }
  }

  function resolveNodeUrl(node) {
    if (node.relPath) {
      return 'database/' + node.relPath.split('/').map(encodeURIComponent).join('/');
    }

    if (node.id && node.id.startsWith('database/')) {
      return node.id.split('/').map(encodeURIComponent).join('/');
    }

    return '';
  }

  function updateFeedbackContextById(id) {
    const node = findNode(rootTree, id);
    if (!node || node.isFolder) return;
    const path = findPath(rootTree, id) || [node.name];
    const relPath = node.relPath || path.join('/');
    const payload = {
      file_id: id,
      rel_path: relPath,
      title: node.name.replace(/\.[^.]+$/, ''),
      game_type: node.kind || null
    };
    sessionStorage.setItem('feedback_context_v1', JSON.stringify(payload));
    sessionStorage.setItem('game_payload_id', id);
    sessionStorage.setItem('game_payload_' + id, JSON.stringify(payload));
  }

  window.clearDriveCache = async function () {
    if (!confirm('Moechtest du den lokalen Index-Cache leeren?')) return;

    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem('pauker_remote_index_v1');
    sessionStorage.clear();
    window.location.reload();
  };

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
