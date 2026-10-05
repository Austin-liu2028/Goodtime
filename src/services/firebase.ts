// Firebase web config comes from VITE_FIREBASE_* variables (see .env.example). These values
// identify the project rather than grant access; firestore.rules is what protects the data.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Tests never configure Firebase, so they run against the localStorage store.
export const isFirebaseConfigured =
  env.MODE !== 'test' && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
