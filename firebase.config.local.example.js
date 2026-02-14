/*
 * Local runtime config for browser-side Firebase usage.
 * Copy to `firebase.config.local.js` and fill in your project values.
 */
window.EASYPV_FIREBASE_CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
    storageBucket: '',
    messagingSenderId: '',
    databaseURL: ''
  },
  feedback: {
    provider: 'firestore',
    collection: 'game_feedback'
  }
};
