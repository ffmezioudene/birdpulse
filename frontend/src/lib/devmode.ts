// === DEVELOPER TOGGLES =======================================================
// Tied to React Native's built-in `__DEV__` flag:
//   • Dev / Expo Go / EAS dev-client / EAS preview builds  → __DEV__ === true
//   • EAS / store production builds                        → __DEV__ === false
//
// So the Developer section is automatically HIDDEN in production builds
// shipped to real users, and the Unlock-Pro toggle never leaks out.
//
// To fully strip dev tooling later, delete this file + the Developer section
// in /app/settings.tsx + the OR-clause in isProEffective() inside state.ts.
// =============================================================================

import { storage } from '@/src/utils/storage';

export const IS_DEV_MODE = __DEV__;

// Storage key for the in-app "Unlock Pro (Testing)" toggle
export const DEV_PRO_KEY = 'birdlens.dev.unlock_pro';

// Freemium model: 3 free identifications + 3 free chats. Same in dev & prod —
// no counters are surfaced to the user; gating is silent and triggers the
// paywall when limits are hit.
export const FREE_IDENTIFICATIONS_INITIAL = 3;
export const FREE_CHATS_INITIAL = 3;

export async function getDevProUnlocked(): Promise<boolean> {
  if (!IS_DEV_MODE) return false;
  return !!(await storage.getItem<boolean>(DEV_PRO_KEY, false));
}

export async function setDevProUnlocked(v: boolean): Promise<void> {
  await storage.setItem(DEV_PRO_KEY, v);
}
