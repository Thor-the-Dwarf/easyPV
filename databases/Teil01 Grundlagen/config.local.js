/*
 * Legacy compatibility config for the old feedback widget.
 * Preferred location for local secrets: /firebase.config.local.js
 */
(function () {
  'use strict';

  if (window.EASYPV_FIREBASE_CONFIG && window.EASYPV_FIREBASE_CONFIG.firebase) {
    window.FEEDBACK_CONFIG = window.EASYPV_FIREBASE_CONFIG;
    return;
  }

  window.FEEDBACK_CONFIG = {
    firebase: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      appId: '',
      databaseURL: ''
    },
    feedback: {
      provider: 'firestore',
      collection: 'game_feedback'
    },
    collection: 'game_feedback'
  };
})();
