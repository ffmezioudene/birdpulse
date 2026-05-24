import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ONBOARDING_IMAGES } from '@/src/lib/birds';
import { storage } from '@/src/utils/storage';
import { KEYS } from '@/src/lib/state';
import { colors, type, spacing, radii, shadows } from '@/src/theme';

const { width } = Dimensions.get('window');

type Slide = {
  image: string;
  eyebrow: string;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    image: ONBOARDING_IMAGES[0],
    eyebrow: 'WELCOME',
    title: 'Identify\n10,000+ birds.',
    subtitle: 'By sound, by sight. Anywhere in the world.',
  },
  {
    image: ONBOARDING_IMAGES[1],
    eyebrow: 'INSTANT ID',
    title: 'Snap a photo\nor record a call.',
    subtitle: 'Our AI pinpoints species in seconds.',
  },
  {
    image: ONBOARDING_IMAGES[2],
    eyebrow: 'DEEP INSIGHT',
    title: 'Beautifully detailed\nbird profiles.',
    subtitle: 'Photos, songs, habitat, range maps.',
  },
  {
    image: ONBOARDING_IMAGES[3],
    eyebrow: 'YOUR NATURE JOURNAL',
    title: 'Log every sighting.\nBuild your story.',
    subtitle: 'Collections, favorites, hotspots near you.',
  },
  {
    image: ONBOARDING_IMAGES[4],
    eyebrow: 'BIRDLENS PRO',
    title: 'Loved by birders\nworldwide.',
    subtitle: 'Start your journey today.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const next = async () => {
    Haptics.selectionAsync();
    if (index < SLIDES.length - 1) {
      const ni = index + 1;
      setIndex(ni);
      listRef.current?.scrollToIndex({ index: ni, animated: true });
    } else {
      await storage.setItem(KEYS.onboardingDone, true);
      router.replace('/paywall');
    }
  };

  return (
    <View style={styles.root} testID="onboarding-screen">
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => `slide-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item }) => <SlideView slide={item} />}
      />

      <SafeAreaView edges={['bottom']} style={styles.footer} pointerEvents="box-none">
        <View style={styles.dots} testID="onboarding-dots">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.cta}
          onPress={next}
          testID="onboarding-continue-button"
        >
          <Text style={styles.ctaText}>
            {index === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <ImageBackground
      source={{ uri: slide.image }}
      style={{ width, flex: 1 }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          'rgba(14,15,13,0.1)',
          'rgba(14,15,13,0.55)',
          'rgba(14,15,13,0.95)',
          '#0E0F0D',
        ]}
        locations={[0, 0.45, 0.85, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.slideInner} edges={['top']}>
        <View style={styles.brand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>BirdLens</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  slideInner: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  brandText: { ...type.bodyLg, color: colors.textPrimary, letterSpacing: 0.5, fontWeight: '700' },
  copy: { paddingBottom: 160 },
  eyebrow: {
    ...type.caption,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  title: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.md },
  subtitle: { ...type.bodyLg, color: colors.textSecondary, maxWidth: '92%' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairlineStrong },
  dotActive: { width: 22, backgroundColor: colors.primary },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: radii.button,
    alignItems: 'center',
    ...shadows.glowPrimary,
  },
  ctaText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800', letterSpacing: 0.2 },
});
