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
    const messages = [];

    messages.push({
      short: 'CEO',
      long: 'Chief Executive Officer',
      time: '08:45',
      text: data.ceo_message || ''
    });
    messages.push({
      short: 'COO',
      long: 'Chief Operating Officer',
      time: '08:46',
      text: data.coo_message || ''
    });
    messages.push({
      short: 'CFO',
      long: 'Chief Financial Officer',
      time: '08:47',
      text: data.cfo_message || ''
    });
    messages.push({
      short: 'CTO',
      long: 'Chief Technology Officer',
      time: '08:48',
      text: data.cto_message || ''
    });
    messages.push({
      short: 'CIO',
      long: 'Chief Information Officer',
      time: '08:49',
      text: data.cio_message || ''
    });
    messages.push({
      short: 'CISO',
      long: 'Chief Information Security Officer',
      time: '08:50',
      text: data.ciso_message || ''
    });
    messages.push({
      short: data.self_titel || 'CPU',
      long: data.self_subtitel || 'Central Processing Unit',
      time: '08:51',
      text: data.self_message || ''
    });

    return messages.filter(function (item) {
      return String(item.text || '').trim().length > 0;
    });
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
