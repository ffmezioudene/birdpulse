// =============================================================================
// BirdLens DESIGN SYSTEM — ONE source of truth, consumed everywhere.
// Inspired by Spotify/Netflix immersion + Linear precision.
// Do not introduce magic numbers in screens — extend tokens here instead.
// =============================================================================

// ----- COLOR (layered near-blacks + restrained sage + sparing amber) ---------
export const colors = {
  // Backgrounds, layered for hierarchy (base → surface1 → surface2)
  bg: '#0A0B0A',
  bgSecondary: '#0F1110',
  bgTertiary: '#141614',
  card: '#141614',     // surface 1 — default card
  surface2: '#1C1F1B', // surface 2 — elevated sheets, modals
  overlay: 'rgba(10, 11, 10, 0.65)',

  // Hairlines
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineStrong: 'rgba(255, 255, 255, 0.14)',

  // Accents
  primary: '#7BA05B',
  primaryDim: '#5C7A44',
  primaryGlow: 'rgba(123, 160, 91, 0.35)',
  secondary: '#E0A458',
  secondaryGlow: 'rgba(224, 164, 88, 0.30)',

  // Text (near-white, never pure)
  textPrimary: '#F4F6F2',
  textSecondary: '#9DA399',
  textTertiary: '#6B7065',

  danger: '#E25C5C',
  success: '#7BA05B',
};

// ----- SPACING (strict 4-pt scale — only these values may be used) -----------
export const spacing = {
  xs: 4,
  sm: 8,
  s12: 12,
  md: 16,
  s20: 20,    // standard screen edge padding
  lg: 24,
  xl: 32,
  s40: 40,
  xxl: 48,
  section: 64,
};

// ----- RADII -----------------------------------------------------------------
export const radii = {
  pill: 9999,
  button: 16,
  card: 20,
  modal: 28,
};

// ----- TYPOGRAPHY ------------------------------------------------------------
// One family (Plus Jakarta Sans) with multiple weights. Tight headlines,
// generous body line-height. Numbers/headlines feel like a feature.
const PJS = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
  // Big numbers / hero titles
  displayXL: {
    fontFamily: PJS['800'], fontWeight: '800' as const,
    fontSize: 40, lineHeight: 44, letterSpacing: -0.8,
  },
  displayL: {
    fontFamily: PJS['700'], fontWeight: '700' as const,
    fontSize: 32, lineHeight: 36, letterSpacing: -0.64,
  },
  title: {
    fontFamily: PJS['700'], fontWeight: '700' as const,
    fontSize: 24, lineHeight: 30, letterSpacing: -0.24,
  },
  heading: {
    fontFamily: PJS['600'], fontWeight: '600' as const,
    fontSize: 20, lineHeight: 26, letterSpacing: -0.2,
  },
  bodyL: {
    fontFamily: PJS['400'], fontWeight: '400' as const,
    fontSize: 17, lineHeight: 26,
  },
  body: {
    fontFamily: PJS['400'], fontWeight: '400' as const,
    fontSize: 15, lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: PJS['600'], fontWeight: '600' as const,
    fontSize: 15, lineHeight: 22,
  },
  caption: {
    fontFamily: PJS['500'], fontWeight: '500' as const,
    fontSize: 13, lineHeight: 18, letterSpacing: 0.13,
  },
  micro: {
    // For UPPERCASE eyebrows — apply textTransform: 'uppercase' in components.
    fontFamily: PJS['600'], fontWeight: '600' as const,
    fontSize: 11, lineHeight: 14, letterSpacing: 0.66,
  },

  // ---- Legacy aliases (so existing screens keep working post-token rewrite) ----
  h1: {
    fontFamily: PJS['800'], fontWeight: '800' as const,
    fontSize: 40, lineHeight: 44, letterSpacing: -0.8,
  },
  h2: {
    fontFamily: PJS['700'], fontWeight: '700' as const,
    fontSize: 32, lineHeight: 36, letterSpacing: -0.64,
  },
  h3: {
    fontFamily: PJS['700'], fontWeight: '700' as const,
    fontSize: 22, lineHeight: 28, letterSpacing: -0.22,
  },
  bodyLg: {
    fontFamily: PJS['500'], fontWeight: '500' as const,
    fontSize: 17, lineHeight: 26,
  },
  bodySm: {
    fontFamily: PJS['400'], fontWeight: '400' as const,
    fontSize: 13, lineHeight: 18,
  },
};

// ----- SHADOWS / GLOWS (soft, large, low-opacity — depth via layers not heavy drop) -
export const shadows = {
  glowPrimary: {
    shadowColor: '#7BA05B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 28,
    elevation: 14,
  },
  glowSecondary: {
    shadowColor: '#E0A458',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
};
