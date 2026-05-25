// PolaroidCard — the reveal frame for an identified bird.
// Image "develops" in from faint→full color, caption sits below in handwritten-ish weight.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, type } from '@/src/theme';

type Props = {
  imageUri: string;
  commonName: string;
  scientificName: string;
  date?: string;        // e.g. "May 25, 2026"
  developing?: boolean; // when true, runs the develop animation
  style?: ViewStyle;
  rotate?: number;      // degrees, small tilt for that authentic Polaroid feel
  testID?: string;
};

export function PolaroidCard({
  imageUri, commonName, scientificName, date, developing = false, style, rotate = -1.5, testID,
}: Props) {
  const opacity = useRef(new Animated.Value(developing ? 0 : 1)).current;
  const sat = useRef(new Animated.Value(developing ? 0 : 1)).current;

  useEffect(() => {
    if (developing) {
      opacity.setValue(0);
      sat.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(sat, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start();
    } else {
      opacity.setValue(1);
      sat.setValue(1);
    }
  }, [developing, imageUri, opacity, sat]);

  // Overlay: a dark veil that lifts as it develops (simulates color coming in).
  const veilOpacity = sat.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });

  return (
    <View
      style={[styles.outer, { transform: [{ rotate: `${rotate}deg` }] }, style]}
      testID={testID}
    >
      <View style={styles.frame}>
        <View style={styles.photoWrap}>
          <Animated.View style={{ opacity, flex: 1 }}>
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0E0F0D', opacity: veilOpacity }]}
            />
          </Animated.View>
        </View>
        <View style={styles.caption}>
          <Text style={styles.name} numberOfLines={1}>{commonName}</Text>
          <Text style={styles.latin} numberOfLines={1}>{scientificName}</Text>
          {date && <Text style={styles.date}>{date}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  frame: {
    width: 280,
    backgroundColor: '#F2EDE2',
    padding: 12,
    paddingBottom: 18,
    borderRadius: 6,
  },
  photoWrap: {
    width: '100%',
    height: 280,
    backgroundColor: '#0E0F0D',
    overflow: 'hidden',
    borderRadius: 2,
  },
  photo: { width: '100%', height: '100%' },
  caption: { marginTop: 10, paddingHorizontal: 4 },
  name: { ...type.bodyLg, color: '#1A1A1A', fontWeight: '800', fontSize: 18 },
  latin: { ...type.bodySm, color: '#5C5247', fontStyle: 'italic', marginTop: 2 },
  date: { ...type.caption, color: '#8A7E6E', marginTop: 6 },
});
