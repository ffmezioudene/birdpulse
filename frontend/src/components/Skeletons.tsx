// Skeleton primitives — content-shaped placeholders with a subtle
// left-to-right shimmer sweep. Dark base, light sage-tinted highlight.
// Use these to unambiguously communicate "real content is loading here."
import { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { colors, radii, spacing, type as ftype } from '@/src/theme';

const SHIMMER_DURATION = 1400;
const BASE = colors.bgTertiary;
const SHIMMER_COLORS = [
  'rgba(255,255,255,0)',
  'rgba(123,160,91,0.10)',
  'rgba(255,255,255,0.06)',
  'rgba(123,160,91,0.10)',
  'rgba(255,255,255,0)',
] as const;

/** Single skeleton block with an animated shimmer sweep across the surface. */
export function SkeletonBlock({
  width = '100%',
  height = 14,
  radius = 7,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shift = useSharedValue(0);

  useEffect(() => {
    shift.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(shift);
  }, [shift]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shift.value, [0, 1], [-220, 220]) }],
  }));

  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: BASE, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, sweep]} pointerEvents="none">
        <LinearGradient
          colors={SHIMMER_COLORS as unknown as string[]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Single skeleton-shaped card mirroring an ExpandableCard layout
 *  (title bar + 2-3 body lines) so the user understands a text section
 *  is loading here. */
export function SkeletonParagraphCard({
  titleWidth = '40%',
  lines = 3,
}: {
  titleWidth?: `${number}%`;
  lines?: 2 | 3 | 4;
}) {
  const widths: (`${number}%`)[] = ['100%', '96%', '88%', '72%'];
  return (
    <View style={styles.card}>
      <SkeletonBlock width={titleWidth} height={16} radius={5} />
      <View style={{ height: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ marginTop: i === 0 ? 0 : 8 }}>
          <SkeletonBlock width={widths[i] ?? '90%'} height={12} radius={4} />
        </View>
      ))}
    </View>
  );
}

/** Bullet/key-facts shaped skeleton — label dot + line. */
export function SkeletonBulletsCard({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="45%" height={16} radius={5} />
      <View style={{ height: 12 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.bulletRow}>
          <SkeletonBlock width={6 as any} height={6} radius={3} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <SkeletonBlock width={(['80%', '90%', '70%', '85%'] as const)[i % 4]} height={12} radius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Horizontal "confused-with" placeholder row — three image+text tiles. */
export function SkeletonConfusedRow() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="55%" height={16} radius={5} />
      <View style={{ height: 12 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.confused}>
            <SkeletonBlock width="100%" height={90} radius={12} />
            <View style={{ height: 8 }} />
            <SkeletonBlock width="80%" height={14} radius={5} />
            <View style={{ height: 6 }} />
            <SkeletonBlock width="95%" height={10} radius={4} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width="70%" height={10} radius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A single inline status row used near the top of the page while
 *  enrichment is in progress. Uses a small dot + the literal text
 *  "Gathering detailed info…" so the user has zero ambiguity. */
export function SkeletonStatusRow({ label = 'Gathering detailed info…' }: { label?: string }) {
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.statusRow}>
      <Animated.View style={[styles.statusDot, dotStyle]} />
      <Animated.Text style={styles.statusLabel}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  confused: {
    width: 180,
    backgroundColor: colors.bgTertiary,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  statusLabel: { ...ftype.caption, color: colors.textSecondary, fontStyle: 'italic' },
});
