// Centralized external URLs + helper to open them in the in-app browser.
// Update once here and every screen picks up the new URL.
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { colors } from '@/src/theme';

export const PRIVACY_POLICY_URL = 'https://bird-identifier.app/privacy';
export const TERMS_OF_USE_URL = 'https://bird-identifier.app/terms';

/**
 * Open a URL inside the OS in-app browser sheet (SFSafariViewController on iOS,
 * Custom Tab on Android) so the user stays inside the BirdPulse session and
 * lands back here with a single tap on "Done" / system back.
 *
 * Falls back to a regular `Linking.openURL` call if the in-app browser
 * isn't available for some reason — that way we never dead-end the user.
 */
export async function openInAppBrowser(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, {
      // Match the dark BirdPulse theme so the system browser UI blends in.
      toolbarColor: colors.bg,
      controlsColor: colors.primary,
      // iOS: present as a sheet so the back-gesture still works on iOS 18+.
      presentationStyle:
        Platform.OS === 'ios'
          ? WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
          : undefined,
      // Android: enable bottom-sheet, default redirect behavior.
      enableBarCollapsing: true,
      showInRecents: false,
    });
  } catch {
    // Last resort — hand off to the OS default browser. Better than nothing.
    try {
      await Linking.openURL(url);
    } catch {}
  }
}

export const openPrivacyPolicy = () => openInAppBrowser(PRIVACY_POLICY_URL);
export const openTermsOfUse = () => openInAppBrowser(TERMS_OF_USE_URL);
