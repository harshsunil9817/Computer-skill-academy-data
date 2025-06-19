
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

console.log("Firebase Config Check (initial values from process.env):", {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

// Check for essential config before attempting initialization
if (!firebaseConfig.projectId) {
  console.error(
    "Firebase initialization SKIPPED: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not defined. " +
    "Ensure all NEXT_PUBLIC_FIREBASE_ environment variables are set correctly in your environment."
  );
  // Log the config to show what's missing
  console.log("Current Firebase Config state:", firebaseConfig);
} else {
  // Proceed with initialization only if projectId is present
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully.");
    } catch (e) {
      console.error("Firebase initialization error during initializeApp():", e);
      // It's good practice to log the config that caused the error
      console.error("Firebase config used at time of error:", firebaseConfig);
      // app remains null
    }
  } else {
    app = getApp();
    console.log("Firebase app already initialized.");
  }

  if (app) {
    try {
      db = getFirestore(app);
      console.log("Firestore instance initialized successfully.");
    } catch (e) {
      console.error("Error getting Firestore instance:", e);
      // db remains null
    }
  } else {
    // This else block will be reached if initializeApp failed or if getApps().length was > 0 but getApp() somehow failed (less common)
    // Only log "app not initialized" if we actually had a projectId to begin with, to avoid redundant logs.
    if (firebaseConfig.projectId) {
        console.error("Firebase app is not initialized (or getApp() failed), cannot get Firestore instance.");
    }
  }
}

export { app, db };
