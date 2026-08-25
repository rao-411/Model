import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudSyncEnabled, saveCloudDoc, subscribeCloudDoc } from "./cloudSync";

export type CloudSyncStatus = "cloud-off" | "connecting" | "synced" | "error";

/**
 * Drop-in replacement for the old `useState(() => JSON.parse(localStorage...))`
 * + `useEffect(() => localStorage.setItem(...))` pattern, extended with
 * optional cloud sync (Firestore) so the value follows the user across
 * devices/browsers instead of being stuck on one machine.
 *
 * Behavior:
 * - Always reads/writes localStorage immediately, so the UI still loads
 *   instantly and still works if cloud sync isn't configured.
 * - If cloud sync is configured, subscribes to the matching cloud document.
 *   When the first snapshot arrives, the cloud value (if any) wins and
 *   overwrites local state — that's what makes "open on a new device" work.
 * - After that initial load, local edits are pushed to the cloud
 *   (debounced) so other devices pick them up too.
 */
export function useCloudSyncedState<T>(
  storageKey: string,
  cloudDocId: string,
  defaultValue: T | (() => T)
): [T, (v: T | ((prev: T) => T)) => void, CloudSyncStatus] {
  const [value, setValueState] = useState<T>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved) as T;
      } catch (e) {
        console.error(`Error parsing saved "${storageKey}"`, e);
      }
    }
    return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
  });

  const [status, setStatus] = useState<CloudSyncStatus>(
    isCloudSyncEnabled() ? "connecting" : "cloud-off"
  );

  // Guards against the write-effect re-pushing a value that just arrived
  // *from* the cloud (which would otherwise loop, and is also pointless).
  const skipNextPush = useRef(false);
  // Until the first cloud snapshot arrives, we don't know yet whether the
  // cloud has data — don't push local defaults over it in the meantime.
  const readyToPush = useRef(false);

  // Keep localStorage as an always-current local cache.
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);

  // Subscribe to the cloud document.
  useEffect(() => {
    if (!isCloudSyncEnabled()) return;
    const unsubscribe = subscribeCloudDoc(cloudDocId, (cloudValue) => {
      if (cloudValue !== undefined) {
        skipNextPush.current = true;
        setValueState(cloudValue as T);
      }
      readyToPush.current = true;
      setStatus("synced");
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudDocId]);

  // Push local changes up to the cloud (debounced).
  useEffect(() => {
    if (!isCloudSyncEnabled()) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    if (!readyToPush.current) return;

    const timer = setTimeout(() => {
      saveCloudDoc(cloudDocId, value)
        .then(() => setStatus("synced"))
        .catch((e) => {
          console.error(`Cloud sync: failed to save "${cloudDocId}"`, e);
          setStatus("error");
        });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cloudDocId]);

  const setValue = useCallback((v: T | ((prev: T) => T)) => {
    setValueState(v);
  }, []);

  return [value, setValue, status];
}
