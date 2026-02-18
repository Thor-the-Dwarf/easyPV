(function () {
  'use strict';

  const roleColors = {
    CEO: { avatar: '16 100% 62%', bubble: '16 82% 58%' },
    CSO: { avatar: '354 88% 64%', bubble: '354 76% 58%' },
    CISO: { avatar: '352 86% 62%', bubble: '352 72% 56%' },
    CTO: { avatar: '268 90% 68%', bubble: '268 76% 62%' },
    CIO: { avatar: '195 100% 62%', bubble: '195 82% 56%' },
    CFO: { avatar: '40 96% 58%', bubble: '40 84% 54%' },
    COO: { avatar: '142 76% 54%', bubble: '142 62% 48%' },
    CPU: { avatar: '206 95% 64%', bubble: '206 82% 56%' }
  };
  const roleMeta = {
    ceo: { short: 'CEO', long: 'Chief Executive Officer' },
    coo: { short: 'COO', long: 'Chief Operating Officer' },
    cfo: { short: 'CFO', long: 'Chief Financial Officer' },
    cto: { short: 'CTO', long: 'Chief Technology Officer' },
    cio: { short: 'CIO', long: 'Chief Information Officer' },
    ciso: { short: 'CISO', long: 'Chief Information Security Officer' },
    cso: { short: 'CSO', long: 'Chief Security Officer' }
  };
  const roleOrder = ['ceo', 'coo', 'cfo', 'cto', 'cio', 'ciso', 'cso'];
  const THEME_KEY = 'globalTheme_v1';
  const params = new URLSearchParams(window.location.search);
  const folderFromQuery = normalizeFolderLabel(params.get('folder'));

  const thread = document.getElementById('chat-thread');
  const headerTitle = document.querySelector('.chat-header h1');
  const headerSubtitle = document.querySelector('.chat-header p');
  if (!thread) return;

  initThemeSync();
  init();

  function initThemeSync() {
    applyThemeFromParentOrStorage();
    requestThemeFromParent();
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
    const themeFromUrl = normalizeTheme(params.get('theme'));
    if (themeFromUrl) {
      applyTheme(themeFromUrl);
      return;
    }

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

  function normalizeTheme(raw) {
    const value = String(raw || '').toLowerCase().trim();
    if (value === 'light') return 'light';
    if (value === 'dark') return 'dark';
    return '';
  }

  function requestThemeFromParent() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'global:theme:request' }, '*');
      }
    } catch (_) {
      // ignore cross-window access issues
    }
  }

  async function init() {
    applyHeaderContext(folderFromQuery);
    const jsonParam = params.get('json');
    const jsonSources = [];
    if (jsonParam) jsonSources.push(jsonParam);
    jsonSources.push('./beispiel.json?ts=' + Date.now());

    try {
      const messages = await loadFirstUsableMessages(jsonSources);
      thread.innerHTML = messages.map(renderMessage).join('');
    } catch (_) {
      thread.innerHTML =
        '<article class="message message--left">' +
        '<div class="message-bubble"><p>JSON konnte nicht geladen werden.</p></div>' +
        '</article>';
    }
  }

  async function loadFirstUsableMessages(sources) {
    const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
    let lastError;

    for (let i = 0; i < list.length; i += 1) {
      const source = list[i];
      try {
        const response = await fetch(source);
        if (!response.ok) throw new Error('JSON nicht verfügbar');
        const payload = await response.json();
        const messages = buildMessagesFromPayload(payload);
        if (Array.isArray(messages) && messages.length > 0) {
          return messages;
        }
        throw new Error('JSON hat keine verwertbaren Nachrichten');
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Keine verwertbare JSON-Quelle verfügbar');
  }

  function buildMessagesFromPayload(payload) {
    const data = payload && payload.c_suite_explanations ? payload.c_suite_explanations : {};
    const keys = Object.keys(data).filter(function (key) {
      return /_message$/i.test(key);
    });

    const roleKeys = keys
      .map(function (key) {
        return key.replace(/_message$/i, '').toLowerCase();
      })
      .filter(function (roleKey) {
        return roleKey !== 'self';
      });

    roleKeys.sort(function (a, b) {
      const ia = roleOrder.indexOf(a);
      const ib = roleOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'de', { sensitivity: 'base' });
    });

    const messages = roleKeys
      .map(function (roleKey) {
        const text = String(data[roleKey + '_message'] || '').trim();
        if (!text) return null;
        const meta = roleMeta[roleKey] || buildFallbackRoleMeta(roleKey, data);
        return {
          short: meta.short,
          long: meta.long,
          text: text,
          isTopic: false
        };
      })
      .filter(Boolean);

    const selfText = String(data.self_message || '').trim();
    if (selfText) {
      const rawSelfShort = String(data.self_titel || '').trim();
      const rawSelfLong = String(data.self_subtitel || '').trim();
      messages.unshift({
        short: pickSelfShort(rawSelfShort, folderFromQuery),
        long: pickSelfLong(rawSelfLong, folderFromQuery),
        text: selfText,
        isTopic: true
      });
    }

    return messages.map(function (message, index) {
      return {
        short: message.short,
        long: message.long,
        text: message.text,
        time: makeTime(index),
        isTopic: Boolean(message.isTopic)
      };
    });
  }

  function buildFallbackRoleMeta(roleKey, data) {
    const short = String(roleKey || 'role').toUpperCase();
    const long = String(data[roleKey + '_subtitel'] || data[roleKey + '_subtitle'] || short).trim();
    return { short: short, long: long };
  }

  function applyHeaderContext(folderLabel) {
    const label = normalizeFolderLabel(folderLabel);
    if (!label) return;
    if (headerTitle) headerTitle.textContent = label;
    if (headerSubtitle) headerSubtitle.textContent = 'Themenordner im C-Suite Dialog';
    document.title = label + ' - C-Suite Chat';
  }

  function normalizeFolderLabel(rawLabel) {
    return String(rawLabel || '').replace(/\s+/g, ' ').trim();
  }

  function isCpuPlaceholder(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'cpu' || normalized === 'central processing unit';
  }

  function pickSelfShort(rawShort, folderLabel) {
    const short = String(rawShort || '').trim();
    const folder = normalizeFolderLabel(folderLabel);
    if (folder && (!short || isCpuPlaceholder(short))) return folder;
    if (short) return short;
    if (folder) return folder;
    return 'Thema';
  }

  function pickSelfLong(rawLong, folderLabel) {
    const long = String(rawLong || '').trim();
    const folder = normalizeFolderLabel(folderLabel);
    if (folder) return folder;
    if (long && !isCpuPlaceholder(long)) return long;
    if (long) return long;
    return 'Fachthema im C-Suite Dialog';
  }

  function makeTime(index) {
    const baseMinutes = 8 * 60 + 45 + index;
    const h = String(Math.floor(baseMinutes / 60)).padStart(2, '0');
    const m = String(baseMinutes % 60).padStart(2, '0');
    return h + ':' + m;
  }

  function renderMessage(item, index) {
    const side = index % 2 === 0 ? 'left' : 'right';
    const palette = item.isTopic
      ? roleColors.CPU
      : roleColors[item.short] || { avatar: '195 100% 62%', bubble: '195 82% 56%' };
    const style = '--avatar-color: ' + palette.avatar + '; --bubble-color: ' + palette.bubble + ';';
    const avatarClass = 'message-avatar' + (item.isTopic ? ' message-avatar--topic' : '');
    const shortClass = 'avatar-short' + (item.isTopic ? ' avatar-short--topic' : '');
    const avatarLong = item.isTopic ? '' : '<span class="avatar-long">' + escapeHtml(item.long) + '</span>';

    return (
      '<article class="message message--' + side + '" style="' + style + '">' +
      '<div class="' + avatarClass + '" aria-label="' + escapeHtml(item.long) + '">' +
      '<span class="' + shortClass + '">' + escapeHtml(item.short) + '</span>' +
      avatarLong +
      '</div>' +
      '<div class="message-bubble">' +
      '<div class="message-topline">' +
      '<span class="author" title="' + escapeHtml(item.long) + '">' + escapeHtml(item.long) + '</span>' +
      '<span class="time">' + escapeHtml(item.time) + '</span>' +
      '</div>' +
      '<p>' + escapeHtml(item.text) + '</p>' +
      '</div>' +
      '</article>'
    );
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
