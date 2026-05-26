// SpeciesThumb — drop-in thumbnail for any species row.
// Shows a subtle dark shimmer while loading, the real Wikipedia photo when
// resolved (with expo-image's persistent disk cache), and only falls back to
// the leaf placeholder if Wikipedia genuinely has no image for this species.
import { useEffect, useRef } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

import { colors } from '@/src/theme';
import { useThumb } from '@/src/lib/thumb-cache';
import type { Species } from '@/src/lib/catalog';

type Props = {
  species: Species;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  height?: number;
  testID?: string;
};

const BLURHASH = 'L24eiHWB00xtxutQ%MM_00j[~qfQ';

export function SpeciesThumb({
  species,
  size,
  radius = 12,
  style,
  fullWidth = false,
  height,
  testID,
}: Props) {
  const { url, status } = useThumb(species);

  const sizeStyle: ViewStyle = fullWidth
    ? { width: '100%', height: height ?? 130 }
    : { width: size ?? 56, height: size ?? 56 };

  return (
    <View style={[styles.wrap, sizeStyle, { borderRadius: radius }, style]} testID={testID}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
          contentFit="cover"
          transition={220}
          placeholder={BLURHASH}
          placeholderContentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={species.id}
        />
      ) : status === 'none' ? (
        <View style={styles.fallback}>
          <Ionicons name="leaf-outline" size={Math.max(14, (size ?? 56) * 0.36)} color={colors.primary} />
        </View>
      ) : (
        <Shimmer radius={radius} />
      )}
    </View>
  );
}

function Shimmer({ radius }: { radius: number }) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.06)' },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgTertiary,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgTertiary,
  },
});
