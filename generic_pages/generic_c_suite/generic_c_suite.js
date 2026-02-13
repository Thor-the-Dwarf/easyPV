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

  const thread = document.getElementById('chat-thread');
  if (!thread) return;

  init();

  async function init() {
    try {
      const response = await fetch('./beispiel.json?ts=' + Date.now());
      if (!response.ok) throw new Error('beispiel.json konnte nicht geladen werden');
      const payload = await response.json();
      const messages = buildMessagesFromPayload(payload);
      thread.innerHTML = messages.map(renderMessage).join('');
    } catch (_) {
      thread.innerHTML =
        '<article class="message message--left">' +
        '<div class="message-bubble"><p>JSON konnte nicht geladen werden.</p></div>' +
        '</article>';
    }
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
          text: text
        };
      })
      .filter(Boolean);

    const selfText = String(data.self_message || '').trim();
    if (selfText) {
      messages.push({
        short: String(data.self_titel || 'CPU').trim(),
        long: String(data.self_subtitel || 'Central Processing Unit').trim(),
        text: selfText
      });
    }

    return messages.map(function (message, index) {
      return {
        short: message.short,
        long: message.long,
        text: message.text,
        time: makeTime(index)
      };
    });
  }

  function buildFallbackRoleMeta(roleKey, data) {
    const short = String(roleKey || 'role').toUpperCase();
    const long = String(data[roleKey + '_subtitel'] || data[roleKey + '_subtitle'] || short).trim();
    return { short: short, long: long };
  }

  function makeTime(index) {
    const baseMinutes = 8 * 60 + 45 + index;
    const h = String(Math.floor(baseMinutes / 60)).padStart(2, '0');
    const m = String(baseMinutes % 60).padStart(2, '0');
    return h + ':' + m;
  }

  function renderMessage(item, index) {
    const side = index % 2 === 0 ? 'left' : 'right';
    const palette = roleColors[item.short] || { avatar: '195 100% 62%', bubble: '195 82% 56%' };
    const style = '--avatar-color: ' + palette.avatar + '; --bubble-color: ' + palette.bubble + ';';

    return (
      '<article class="message message--' + side + '" style="' + style + '">' +
      '<div class="message-avatar" aria-label="' + escapeHtml(item.long) + '">' +
      '<span class="avatar-short">' + escapeHtml(item.short) + '</span>' +
      '<span class="avatar-long">' + escapeHtml(item.long) + '</span>' +
      '</div>' +
      '<div class="message-bubble">' +
      '<div class="message-topline"><span class="time">' + escapeHtml(item.time) + '</span></div>' +
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
