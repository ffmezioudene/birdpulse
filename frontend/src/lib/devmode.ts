// === DEVELOPER TOGGLES — REMOVE BEFORE PRODUCTION ============================
// Everything in this file is dev-only. Set IS_DEV_MODE=false (or delete the file
// and the Developer section in Settings + the OR-clause in isProEffective()) to
// ship a clean production build.
// =============================================================================

import { storage } from '@/src/utils/storage';

export const IS_DEV_MODE = true;

// Storage key for the in-app "Unlock Pro (Testing)" toggle
export const DEV_PRO_KEY = 'birdlens.dev.unlock_pro';

// In dev we raise free uses from 2 → 20 so casual testing never hits the gate.
export const FREE_USES_INITIAL = IS_DEV_MODE ? 20 : 2;

export async function getDevProUnlocked(): Promise<boolean> {
  if (!IS_DEV_MODE) return false;
  return !!(await storage.getItem<boolean>(DEV_PRO_KEY, false));
}

export async function setDevProUnlocked(v: boolean): Promise<void> {
  await storage.setItem(DEV_PRO_KEY, v);
}
