// Boot trace — records timestamped checkpoints for every app launch into
// AsyncStorage so we can post-mortem the last boot from the /diagnostics
// screen even if THIS boot also hangs. Kept tiny (< 2 KB) to never become
// a problem itself. Mark only obvious checkpoints, never PII.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_CURRENT = 'birdpulse.boot.trace.current';
const KEY_LAST = 'birdpulse.boot.trace.last';

export type BootStep = {
  t: number; // ms since launchEpoch
  step: string;
  ok?: boolean;
  err?: string;
};

// Captured the moment this module is first imported — which is essentially
// the JS bundle start time on a cold launch.
const launchEpoch = Date.now();
let buffer: BootStep[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Add a single boot checkpoint. Safe to call from any thread, never throws. */
export function bootMark(step: string, ok: boolean = true, err?: unknown): void {
  try {
    const item: BootStep = { t: Date.now() - launchEpoch, step, ok };
    if (err !== undefined) {
      item.err = String((err as { message?: string })?.message ?? err).slice(0, 200);
    }
    buffer.push(item);
    // Debounce-flush so we don't hit AsyncStorage on every mark.
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 250);
  } catch {}
}

async function flush(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_CURRENT, JSON.stringify(buffer));
  } catch {}
}

/**
 * Promote the in-memory buffer to the "last successful boot" slot. Called
 * AFTER we know the app actually reached an interactive state, so the
 * /diagnostics screen on the NEXT launch can show us either:
 *   • a complete trace (boot succeeded), or
 *   • a partial trace (boot hung — last step is the culprit).
 */
export async function bootSealCurrentAsLast(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_LAST, JSON.stringify(buffer));
  } catch {}
}

/** Read the previous boot's trace (for diagnostics). */
export async function getLastBootTrace(): Promise<BootStep[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_LAST);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Read the CURRENT boot's trace — useful inside Diagnostics while the
 *  app is still running to see what already happened this session. */
export async function getCurrentBootTrace(): Promise<BootStep[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CURRENT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const launchTimeMs = launchEpoch;

// Mark the very first checkpoint — JS bundle started executing.
bootMark('bundle:loaded');
