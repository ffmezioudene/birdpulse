// FeatherWave — BirdPulse signature brand motif.
// A vertical "feather spine" with audio-waveform barbs. Reads as feather + soundwave.
// Three modes: static | loading (rippling) | success (spring-up flourish).
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '@/src/theme';

type Mode = 'static' | 'loading' | 'success';

type Props = {
  size?: number;          // overall height in px
  color?: string;
  glow?: boolean;         // amber halo behind it
  mode?: Mode;
  style?: ViewStyle;
  testID?: string;
};

// 12 barbs from tip → base. Heights are the *fraction* of width on each side.
// Taller in the middle, shorter at tips — same shape as a feather and a waveform.
const HEIGHTS = [0.18, 0.32, 0.48, 0.62, 0.78, 0.92, 1.0, 0.94, 0.82, 0.66, 0.5, 0.32];

export function FeatherWave({
  size = 80,
  color = colors.primary,
  glow = false,
  mode = 'static',
  style,
  testID,
}: Props) {
  // One animated value per barb (used for loading + success).
  const anims = useRef(HEIGHTS.map(() => new Animated.Value(mode === 'static' ? 1 : 0))).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (mode === 'loading') {
      // Rippling equalizer left→right, looped.
      const sequence = anims.map((a, i) =>
        Animated.sequence([
          Animated.delay(i * 70),
          Animated.timing(a, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(a, { toValue: 0.35, duration: 360, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ])
      );
      loop = Animated.loop(Animated.stagger(0, sequence));
      loop.start();
    } else if (mode === 'success') {
      // Springs up tip→base then settles. One-shot.
      Animated.stagger(
        45,
        anims.map((a) =>
          Animated.spring(a, { toValue: 1, friction: 5, tension: 120, useNativeDriver: false })
        )
      ).start();
    } else {
      // Static — make sure they're at full height.
      anims.forEach((a) => a.setValue(1));
    }
    return () => {
      loop?.stop?.();
    };
  }, [mode, anims]);

  const spineH = size;
  const barbMaxW = size * 0.42;

  const barbs = useMemo(
    () =>
      HEIGHTS.map((h, i) => {
        const yOffset = (i / (HEIGHTS.length - 1)) * spineH;
        const width = barbMaxW * h;
        return { yOffset, width, key: i };
      }),
    [spineH, barbMaxW]
  );

  return (
    <View style={[styles.wrap, { height: spineH, width: spineH * 1.1 }, style]} testID={testID}>
      {glow && (
        <View
          style={[
            styles.glow,
            { width: spineH * 1.4, height: spineH * 1.4, borderRadius: spineH * 0.7, top: -spineH * 0.2 },
          ]}
        />
      )}
      {/* Spine */}
      <View style={[styles.spine, { height: spineH, backgroundColor: color }]} />
      {/* Left + right barbs */}
      {barbs.map(({ yOffset, width, key }) => (
        <View key={key} style={{ position: 'absolute', top: yOffset - 1.5 }} pointerEvents="none">
          <Animated.View
            style={{
              position: 'absolute',
              right: spineH * 0.55, // align tip near spine
              width: width,
              height: 3,
              backgroundColor: color,
              borderRadius: 2,
              opacity: anims[key].interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
              transform: [{ scaleX: anims[key] }],
              transformOrigin: 'right',
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              left: spineH * 0.55,
              width: width,
              height: 3,
              backgroundColor: color,
              borderRadius: 2,
              opacity: anims[key].interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
              transform: [{ scaleX: anims[key] }],
              transformOrigin: 'left',
            }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    backgroundColor: '#E0A458',
    opacity: 0.12,
  },
  spine: {
    width: 2,
    borderRadius: 1,
  },
});
