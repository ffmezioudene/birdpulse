import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CustomerInfo } from 'react-native-purchases';

import {
  IS_RC_AVAILABLE,
  PaywallResult,
  addCustomerInfoListener,
  configureRevenueCat,
  getCustomerInfo,
  isProActive,
  presentCustomerCenter,
  presentPaywall,
  presentPaywallIfNeeded,
  restorePurchases,
} from '@/src/lib/revenuecat';
import { storage } from '@/src/utils/storage';
import { KEYS } from '@/src/lib/state';
import { bootMark } from '@/src/lib/boot-trace';

/** Wrap an arbitrary promise with a hard timeout so a hung native bridge
 *  never blocks the rest of the app. Resolves to `null` on timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        if (__DEV__) console.log(`[RC] operation timed out after ${ms}ms`);
        resolve(null);
      }
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        if (__DEV__) console.log('[RC] operation rejected:', e?.message ?? e);
        resolve(null);
      },
    );
  });
}

type Ctx = {
  /** True once configure() has been awaited (or skipped on web). */
  initialized: boolean;
  /** Latest CustomerInfo snapshot, or null on web / before first fetch. */
  customerInfo: CustomerInfo | null;
  /** True iff the BirdPulse Pro entitlement is currently active. */
  isPro: boolean;
  /** Pull a fresh CustomerInfo from the network. */
  refresh: () => Promise<void>;
  /** Trigger the hosted paywall. Returns the outcome enum. */
  presentPaywall: () => Promise<PaywallResult>;
  /** Smart variant — only shows if the user lacks the entitlement. */
  presentPaywallIfNeeded: () => Promise<PaywallResult>;
  /** Open the hosted Customer Center (manage subscription / restore / cancel). */
  openCustomerCenter: () => Promise<void>;
  /** Restore previous purchases bound to the store account. */
  restore: () => Promise<{ ok: boolean; isPro: boolean }>;
};

const RevenueCatContext = createContext<Ctx | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Persist the live entitlement state into AsyncStorage so the existing
  // (non-React) `isProEffective()` helper keeps working from anywhere in the
  // app without needing a hook context.
  const syncProFlag = useCallback(async (info: CustomerInfo | null) => {
    const active = isProActive(info);
    try {
      await storage.setItem(KEYS.isPro, active);
    } catch {}
  }, []);

  useEffect(() => {
    bootMark('rc:effect-start');
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      if (!IS_RC_AVAILABLE) {
        bootMark('rc:platform-unavailable');
        if (!cancelled) setInitialized(true);
        return;
      }
      // configure() — capped at 5s so a hung native bridge can't block boot.
      bootMark('rc:configure-start');
      const ok = await withTimeout(configureRevenueCat(), 5000);
      bootMark(ok ? 'rc:configure-ok' : 'rc:configure-failed');
      if (cancelled) return;
      // Whatever happens, mark initialized so the rest of the app proceeds.
      setInitialized(true);
      if (!ok) return;

      // getCustomerInfo() — also timeout-bounded. If the network is dead,
      // the user simply starts in the non-Pro state until the next refresh.
      bootMark('rc:customer-info-start');
      const info = await withTimeout(getCustomerInfo(), 5000);
      bootMark(info ? 'rc:customer-info-ok' : 'rc:customer-info-failed');
      if (cancelled) return;
      if (info) {
        setCustomerInfo(info);
        syncProFlag(info);
      }

      unsub = addCustomerInfoListener((next) => {
        setCustomerInfo(next);
        syncProFlag(next);
      });
      bootMark('rc:listener-attached');
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [syncProFlag]);

  const refresh = useCallback(async () => {
    const info = await getCustomerInfo();
    if (info) {
      setCustomerInfo(info);
      syncProFlag(info);
    }
  }, [syncProFlag]);

  const restore = useCallback(async () => {
    const info = await restorePurchases();
    if (info) {
      setCustomerInfo(info);
      await syncProFlag(info);
      return { ok: true, isPro: isProActive(info) };
    }
    return { ok: false, isPro: isProActive(customerInfo) };
  }, [customerInfo, syncProFlag]);

  const presentPaywallCb = useCallback(async () => {
    const res = await presentPaywall();
    if (res === PaywallResult.Purchased || res === PaywallResult.Restored) {
      await refresh();
    }
    return res;
  }, [refresh]);

  const presentPaywallIfNeededCb = useCallback(async () => {
    const res = await presentPaywallIfNeeded();
    if (res === PaywallResult.Purchased || res === PaywallResult.Restored) {
      await refresh();
    }
    return res;
  }, [refresh]);

  const openCustomerCenterCb = useCallback(async () => {
    await presentCustomerCenter();
    // Customer Center may have produced a restore / cancel — re-sync.
    await refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      initialized,
      customerInfo,
      isPro: isProActive(customerInfo),
      refresh,
      presentPaywall: presentPaywallCb,
      presentPaywallIfNeeded: presentPaywallIfNeededCb,
      openCustomerCenter: openCustomerCenterCb,
      restore,
    }),
    [initialized, customerInfo, refresh, presentPaywallCb, presentPaywallIfNeededCb, openCustomerCenterCb, restore],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): Ctx {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error('useRevenueCat must be used inside a RevenueCatProvider');
  }
  return ctx;
}
