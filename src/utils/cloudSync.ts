/// <reference types="vite/client" />

// Cloud persistence for procurement settings (Quotes, Surcharges, etc.)
//
// Why this exists:
// The app previously stored uploaded Quotes / Surcharges data only in the
// browser's localStorage. localStorage is scoped to a single browser on a
// single device, so opening the app on a different computer (or a different
// browser) always started from empty defaults.
//
// This module adds an optional cloud backing store (Firebase Firestore) so
// the same data is available from any device. It is intentionally written
// so that if no Firebase project is configured (no VITE_FIREBASE_* env
// vars), the app falls back to localStorage-only behavior exactly as before
// — nothing breaks if cloud sync isn't set up.
//
// Setup: see README.md "Cloud sync setup" section.

import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  Firestore,
  Unsubscribe,
} from "firebase/firestore";

const COLLECTION = "vt_procurement_settings";

function readConfig() {
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  };
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null;
  return cfg;
}

let dbInstance: Firestore | null | undefined; // undefined = not yet resolved

function getDb(): Firestore | null {
  if (dbInstance !== undefined) return dbInstance;

  const cfg = readConfig();
  if (!cfg) {
    dbInstance = null;
    return null;
  }

  try {
    const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(cfg);
    dbInstance = getFirestore(app);
  } catch (e) {
    console.error("Failed to initialize Firebase cloud sync", e);
    dbInstance = null;
  }
  return dbInstance;
}

/** True if Firebase env vars are present, i.e. cloud sync is usable. */
export function isCloudSyncEnabled(): boolean {
  return getDb() !== null;
}

/**
 * Listen for changes to a cloud document. Fires once immediately with the
 * current value (or `undefined` if the document doesn't exist yet), then
 * again whenever it changes (including changes made from another device).
 * Returns an unsubscribe function. No-ops (returns a no-op unsubscribe) if
 * cloud sync isn't configured.
 */
export function subscribeCloudDoc(
  id: string,
  cb: (value: any | undefined) => void
): Unsubscribe {
  const database = getDb();
  if (!database) return () => {};

  return onSnapshot(
    doc(database, COLLECTION, id),
    (snap) => {
      cb(snap.exists() ? (snap.data() as any).value : undefined);
    },
    (err) => {
      console.error(`Cloud sync: failed to read "${id}"`, err);
    }
  );
}

/** Write a value to a cloud document. No-ops if cloud sync isn't configured. */
export async function saveCloudDoc(id: string, value: any): Promise<void> {
  const database = getDb();
  if (!database) return;
  await setDoc(doc(database, COLLECTION, id), {
    value,
    updatedAt: Date.now(),
  });
}
