(function () {
  'use strict';

  const messages = [
    {
      short: 'CEO',
      long: 'Chief Executive Officer',
      time: '08:45',
      text: 'Guten Morgen, ich brauche bis 10 Uhr ein kurzes Risikobild fuer das neue Rollout.',
      self: false
    },
    {
      short: 'CSO',
      long: 'Chief Security Officer',
      time: '08:46',
      text: 'Aus Security-Sicht sind Endpoint-Hardening und Rechtekonzept die zwei kritischen Punkte. Ich sende gleich eine priorisierte Liste.',
      self: false
    },
    {
      short: 'CTO',
      long: 'Chief Technology Officer',
      time: '08:48',
      text: 'Technisch ist der Pfad klar. Wir koennen den Pilot in einer isolierten Stage mit Feature-Flag fahren.',
      self: false
    },
    {
      short: 'CIO',
      long: 'Chief Information Officer',
      time: '08:50',
      text: 'Ich empfehle, den Start auf die Teams mit vorhandenem Schulungsstand zu begrenzen. So bleibt das Incident-Volumen kontrollierbar.',
      self: true
    },
    {
      short: 'CFO',
      long: 'Chief Financial Officer',
      time: '08:52',
      text: 'Bitte die Kostenannahmen dokumentieren: Setup-Aufwand, Run-Rate und benoetigte externe Leistungen.',
      self: false
    },
    {
      short: 'COO',
      long: 'Chief Operating Officer',
      time: '08:55',
      text: 'Operativ passt es, wenn wir einen klaren Rollback-Plan haben und Support-Slots fuer die ersten 48h reservieren.',
      self: false
    }
  ];

  const thread = document.getElementById('chat-thread');
  if (!thread) return;

  thread.innerHTML = messages.map(renderMessage).join('');

  function renderMessage(item) {
    const cls = item.self ? 'message self' : 'message';

    return (
      '<article class="' + cls + '">' +
      '<div class="message-head">' +
      '<div class="identity">' +
      '<span class="short">' + escapeHtml(item.short) + '</span>' +
      '<span class="long">' + escapeHtml(item.long) + '</span>' +
      '</div>' +
      '<span class="time">' + escapeHtml(item.time) + '</span>' +
      '</div>' +
      '<p>' + escapeHtml(item.text) + '</p>' +
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
