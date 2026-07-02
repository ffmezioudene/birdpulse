// RevenueCat service — single source of truth for subscription state.
//
// Design:
//   • Native (iOS / Android) → uses `react-native-purchases` +
//     `react-native-purchases-ui` for real subscriptions, paywall UI, and
//     Customer Center.
//   • Web / SSR  → all operations are safe no-ops so Metro web preview keeps
//     bundling and the rest of the BirdPulse app stays usable.
//
// The entitlement identifier, offering, and API keys all come from the
// frontend/.env so we never hardcode dashboard config inside source.
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

// ---- Config ---------------------------------------------------------------

export const RC_ENTITLEMENT =
  (process.env.EXPO_PUBLIC_RC_ENTITLEMENT || 'BirdPulse Pro').trim();
export const RC_OFFERING_ID = (process.env.EXPO_PUBLIC_RC_OFFERING || 'default').trim();

/**
 * Build-time kill-switch for the entire RevenueCat JS layer.
 *
 *   EXPO_PUBLIC_DISABLE_RC=1  → every JS function below is a no-op, and
 *   `require('react-native-purchases')` is NEVER called. Use this to ship a
 *   diagnostic build that proves whether the RC JS layer is the boot-hang
 *   trigger. NOTE: this does NOT remove the native module from the binary
 *   (auto-linking happens at the Pod/Gradle level). If a diagnostic build
 *   with this flag set STILL hangs, the native auto-link is the culprit
 *   and we'll need to also remove the package from package.json.
 */
export const RC_DISABLED =
  (process.env.EXPO_PUBLIC_DISABLE_RC || '').trim() === '1';

// PaywallResult bridges the imperative `presentPaywall*` return values.
// We mirror RevenueCat's enum so callers don't need a direct UI import.
export enum PaywallResult {
  NotPresented = 'NOT_PRESENTED',
  Cancelled = 'CANCELLED',
  Error = 'ERROR',
  Purchased = 'PURCHASED',
  Restored = 'RESTORED',
}

// ---- Platform availability ------------------------------------------------

export const IS_RC_AVAILABLE =
  !RC_DISABLED && (Platform.OS === 'ios' || Platform.OS === 'android');

function getApiKey(): string | null {
  if (RC_DISABLED) return null;
  // In dev / Expo Go dev-client builds we always use the Test Store key.
  // RevenueCat explicitly forbids Test Store keys in production builds.
  if (__DEV__) {
    return (process.env.EXPO_PUBLIC_RC_TEST_KEY || '').trim() || null;
  }
  if (Platform.OS === 'ios') {
    return (process.env.EXPO_PUBLIC_RC_IOS_KEY || '').trim() || null;
  }
  if (Platform.OS === 'android') {
    return (process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '').trim() || null;
  }
  return null;
}

// ---- Lazy native module loader --------------------------------------------
// Only required on native; importing eagerly on web throws because the package
// pulls in expo-modules-core types that aren't web-safe.

type PurchasesMod = typeof import('react-native-purchases');
type PurchasesUiMod = typeof import('react-native-purchases-ui');

let _Purchases: PurchasesMod['default'] | null = null;
let _PurchasesUi: PurchasesUiMod['default'] | null = null;

function loadPurchases(): PurchasesMod['default'] | null {
  if (!IS_RC_AVAILABLE) return null;
  if (_Purchases) return _Purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: PurchasesMod = require('react-native-purchases');
    _Purchases = mod.default;
    return _Purchases;
  } catch (e) {
    if (__DEV__) console.warn('[RC] react-native-purchases not available:', e);
    return null;
  }
}

function loadPurchasesUi(): PurchasesUiMod['default'] | null {
  if (!IS_RC_AVAILABLE) return null;
  if (_PurchasesUi) return _PurchasesUi;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: PurchasesUiMod = require('react-native-purchases-ui');
    _PurchasesUi = mod.default;
    return _PurchasesUi;
  } catch (e) {
    if (__DEV__) console.warn('[RC] react-native-purchases-ui not available:', e);
    return null;
  }
}

// ---- Public API -----------------------------------------------------------

let configured = false;

/** Configure the Purchases singleton exactly once. Safe to call repeatedly. */
export async function configureRevenueCat(): Promise<boolean> {
  if (RC_DISABLED) {
    if (__DEV__) console.log('[RC] disabled via EXPO_PUBLIC_DISABLE_RC=1');
    return false;
  }
  const Purchases = loadPurchases();
  if (!Purchases) return false;
  if (configured) return true;

  const apiKey = getApiKey();
  if (!apiKey) {
    if (__DEV__) console.warn('[RC] No API key configured for this platform.');
    return false;
  }
  try {
    // Verbose logs in dev help diagnose dashboard / product config issues.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LOG_LEVEL } = require('react-native-purchases');
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    await Purchases.configure({ apiKey });
    // Apple Search Ads attribution — collects the AdServices attribution
    // token so install attribution can flow into RevenueCat for ROAS/LTV
    // measurement. No-op on Android and on devices that don't support
    // AdServices (no user-facing prompt). Must come AFTER configure().
    try {
      // Method exists on iOS only; guard so Android builds don't crash.
      (Purchases as any).enableAdServicesAttributionTokenCollection?.();
    } catch {
      /* silent — ASA token is best-effort */
    }
    configured = true;
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[RC] configure failed:', e);
    return false;
  }
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    if (__DEV__) console.warn('[RC] getCustomerInfo failed:', e);
    return null;
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return (
      offerings.all?.[RC_OFFERING_ID] ||
      offerings.current ||
      null
    );
  } catch (e) {
    if (__DEV__) console.warn('[RC] getOfferings failed:', e);
    return null;
  }
}

/** True if the customer holds the BirdPulse Pro entitlement right now. */
export function isProActive(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const ent = info.entitlements?.active?.[RC_ENTITLEMENT];
  return !!ent?.isActive;
}

export type PurchaseOutcome =
  | { kind: 'purchased'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) {
    return { kind: 'error', message: 'Subscriptions not available on this build.' };
  }
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { kind: 'purchased', customerInfo: result.customerInfo };
  } catch (e: any) {
    if (e?.userCancelled) return { kind: 'cancelled' };
    return { kind: 'error', message: e?.message || 'Purchase failed.' };
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const Purchases = loadPurchases();
  if (!Purchases || !configured) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    if (__DEV__) console.warn('[RC] restorePurchases failed:', e);
    return null;
  }
}

export async function presentPaywallIfNeeded(): Promise<PaywallResult> {
  const Ui = loadPurchasesUi();
  if (!Ui) return PaywallResult.NotPresented;
  try {
    const res = await Ui.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: RC_ENTITLEMENT,
    });
    // Bridge string / numeric variants → our enum
    const s = String(res).toUpperCase();
    if (s.includes('PURCHASED')) return PaywallResult.Purchased;
    if (s.includes('RESTORED')) return PaywallResult.Restored;
    if (s.includes('CANCELLED') || s.includes('CANCELED'))
      return PaywallResult.Cancelled;
    if (s.includes('NOT_PRESENTED') || s.includes('NOTPRESENTED'))
      return PaywallResult.NotPresented;
    if (s.includes('ERROR')) return PaywallResult.Error;
    return PaywallResult.NotPresented;
  } catch (e) {
    if (__DEV__) console.warn('[RC] presentPaywallIfNeeded failed:', e);
    return PaywallResult.Error;
  }
}

export async function presentPaywall(): Promise<PaywallResult> {
  const Ui = loadPurchasesUi();
  if (!Ui) return PaywallResult.NotPresented;
  try {
    const res = await Ui.presentPaywall();
    const s = String(res).toUpperCase();
    if (s.includes('PURCHASED')) return PaywallResult.Purchased;
    if (s.includes('RESTORED')) return PaywallResult.Restored;
    if (s.includes('CANCELLED') || s.includes('CANCELED'))
      return PaywallResult.Cancelled;
    if (s.includes('ERROR')) return PaywallResult.Error;
    return PaywallResult.NotPresented;
  } catch (e) {
    if (__DEV__) console.warn('[RC] presentPaywall failed:', e);
    return PaywallResult.Error;
  }
}

export async function presentCustomerCenter(): Promise<void> {
  const Ui = loadPurchasesUi();
  if (!Ui) return;
  try {
    await Ui.presentCustomerCenter();
  } catch (e) {
    if (__DEV__) console.warn('[RC] presentCustomerCenter failed:', e);
  }
}

/** Subscribe to CustomerInfo updates; returns an unsubscribe fn. */
export function addCustomerInfoListener(
  cb: (info: CustomerInfo) => void,
): () => void {
  const Purchases = loadPurchases();
  if (!Purchases) return () => {};
  try {
    Purchases.addCustomerInfoUpdateListener(cb);
    return () => {
      try {
        Purchases.removeCustomerInfoUpdateListener(cb);
      } catch {}
    };
  } catch (e) {
    if (__DEV__) console.warn('[RC] addCustomerInfoUpdateListener failed:', e);
    return () => {};
  }
}
