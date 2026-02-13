(function () {
  'use strict';

  const roleColors = {
    CEO: { avatar: '16 100% 62%', bubble: '16 82% 58%' },
    CSO: { avatar: '354 88% 64%', bubble: '354 76% 58%' },
    CTO: { avatar: '268 90% 68%', bubble: '268 76% 62%' },
    CIO: { avatar: '195 100% 62%', bubble: '195 82% 56%' },
    CFO: { avatar: '40 96% 58%', bubble: '40 84% 54%' },
    COO: { avatar: '142 76% 54%', bubble: '142 62% 48%' }
  };

  const messages = [
    {
      short: 'CEO',
      long: 'Chief Executive Officer',
      time: '08:45',
      text: 'Guten Morgen, ich brauche bis 10 Uhr ein kurzes Risikobild fuer das neue Rollout.'
    },
    {
      short: 'CSO',
      long: 'Chief Security Officer',
      time: '08:46',
      text: 'Aus Security-Sicht sind Endpoint-Hardening und Rechtekonzept die zwei kritischen Punkte. Ich sende gleich eine priorisierte Liste.'
    },
    {
      short: 'CTO',
      long: 'Chief Technology Officer',
      time: '08:48',
      text: 'Technisch ist der Pfad klar. Wir koennen den Pilot in einer isolierten Stage mit Feature-Flag fahren.'
    },
    {
      short: 'CIO',
      long: 'Chief Information Officer',
      time: '08:50',
      text: 'Ich empfehle, den Start auf die Teams mit vorhandenem Schulungsstand zu begrenzen. So bleibt das Incident-Volumen kontrollierbar.'
    },
    {
      short: 'CFO',
      long: 'Chief Financial Officer',
      time: '08:52',
      text: 'Bitte die Kostenannahmen dokumentieren: Setup-Aufwand, Run-Rate und benoetigte externe Leistungen.'
    },
    {
      short: 'COO',
      long: 'Chief Operating Officer',
      time: '08:55',
      text: 'Operativ passt es, wenn wir einen klaren Rollback-Plan haben und Support-Slots fuer die ersten 48h reservieren.'
    }
  ];

  const thread = document.getElementById('chat-thread');
  if (!thread) return;

  thread.innerHTML = messages.map(renderMessage).join('');

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
