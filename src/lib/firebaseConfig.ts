import appletConfig from '../../firebase-applet-config.json';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export const firebaseConfig: FirebaseAppletConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'studio-220898577-eb945',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '1:581771018338:web:ae1ee8b0b858d868bd113b',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || 'AIzaSyDA5AmD1-Ctl_kJXXJaULALnCWxW7dJocU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || 'studio-220898577-eb945.firebaseapp.com',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || 'ai-studio-dailytillcashing-ee0456f3-fd09-4eea-82da-bcad70f77b6e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || 'studio-220898577-eb945.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '581771018338',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || '',
  oAuthClientId: appletConfig.oAuthClientId || '',
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || appletConfig.recaptchaSiteKey || '',
};

export default firebaseConfig;
