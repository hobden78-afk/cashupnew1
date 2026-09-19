export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  recaptchaSiteKey?: string;
}

export const firebaseConfig: FirebaseAppletConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'studio-220898577-eb945',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:581771018338:web:ae1ee8b0b858d868bd113b',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDA5AmD1-Ctl_kJXXJaULALnCWxW7dJocU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'studio-220898577-eb945.firebaseapp.com',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-dailytillcashing-ee0456f3-fd09-4eea-82da-bcad70f77b6e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'studio-220898577-eb945.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '581771018338',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || '',
};

export default firebaseConfig;
