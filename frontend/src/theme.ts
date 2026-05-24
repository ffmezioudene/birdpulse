// BirdLens theme tokens
export const colors = {
  bg: '#0E0F0D',
  bgSecondary: '#141613',
  bgTertiary: '#1B1E1A',
  card: '#1B1E1A',
  overlay: 'rgba(14, 15, 13, 0.6)',
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineStrong: 'rgba(255, 255, 255, 0.15)',
  primary: '#7BA05B',
  primaryDim: '#5C7A44',
  primaryGlow: 'rgba(123, 160, 91, 0.35)',
  secondary: '#E0A458',
  secondaryGlow: 'rgba(224, 164, 88, 0.3)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textTertiary: 'rgba(255, 255, 255, 0.45)',
  danger: '#E25C5C',
  success: '#7BA05B',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
};

export const radii = {
  pill: 9999,
  button: 16,
  card: 24,
  modal: 32,
};

export const type = {
  h1: { fontSize: 40, lineHeight: 48, fontWeight: '800' as const, letterSpacing: -1.5 },
  h2: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -1 },
  h3: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  bodyLg: { fontSize: 17, lineHeight: 26, fontWeight: '500' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
};

export const shadows = {
  glowPrimary: {
    shadowColor: '#7BA05B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  glowSecondary: {
    shadowColor: '#E0A458',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
};
