// Tap-to-play bird call.
//
// Fetches a Xeno-canto recording via our backend (/api/xenocanto, v3)
// and streams it through expo-audio with `player.replace({ uri })`. The
// audio session is configured app-wide in `_layout.tsx` with
// `playsInSilentMode: true`, which is REQUIRED for iOS to actually emit
// sound when the device's hardware silent switch is on.
//
// Only one BirdCallPlayer in the app plays at a time — when one starts,
// all other instances pause via the simple subscriber bus below.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { colors, type } from '@/src/theme';
import { fetchXenoCanto } from '@/src/lib/api';
import { PressableScale } from './PressableScale';

const BAR_HEIGHTS_IDLE = [8, 14, 10, 18, 12, 20, 14, 9, 16, 11, 7, 14];
const BAR_HEIGHTS_PLAY = [14, 6, 20, 11, 18, 8, 22, 12, 16, 9, 19, 7];

type Props = {
  scientificName: string;
  size?: 'sm' | 'md';
  label?: string;
  testID?: string;
};

const subscribers = new Set<(id: string | null) => void>();
function setActiveSpecies(id: string | null) {
  subscribers.forEach((fn) => fn(id));
}

export function BirdCallPlayer({ scientificName, size = 'sm', label, testID }: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  // Player created with no initial source; we feed it via player.replace() —
  // this is the same pattern result.tsx uses successfully.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = !!status?.playing;
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // Pause this instance if another player takes over.
  useEffect(() => {
    const fn = (id: string | null) => {
      if (id !== scientificName && isPlaying) {
        try { player.pause(); } catch {}
      }
    };
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, [isPlaying, player, scientificName]);

  // Waveform tick.
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setTick((x) => x + 1), 140);
    return () => clearInterval(t);
  }, [isPlaying]);

  const doPlay = useCallback(async () => {
    if (loading) return;

    // Already have a loaded source — toggle.
    if (audioUrl) {
      try {
        if (isPlaying) {
          player.pause();
          setActiveSpecies(null);
        } else {
          player.seekTo(0);
          player.play();
          setActiveSpecies(scientificName);
        }
      } catch (e) {
        if (__DEV__) console.warn('[BirdCallPlayer] toggle failed', e);
        setError(true);
      }
      return;
    }

    // First tap — fetch URL, load it into the player, play.
    setLoading(true);
    setError(false);
    try {
      const r = await fetchXenoCanto(scientificName, 1);
      const url = r.recordings?.[0]?.audio_url;
      if (__DEV__) console.log(`[BirdCallPlayer] ${scientificName} → ${url ?? '(no audio)'}`);
      if (!url) {
        setError(true);
        return;
      }
      if (!mounted.current) return;
      setAudioUrl(url);
      // Hand the URL to the player. expo-audio expects an object source.
      try {
        player.replace({ uri: url });
        player.volume = 1.0;
        player.play();
        setActiveSpecies(scientificName);
      } catch (e) {
        if (__DEV__) console.warn('[BirdCallPlayer] play failed', e);
        setError(true);
      }
    } catch (e) {
      if (__DEV__) console.warn('[BirdCallPlayer] fetch failed', e);
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [audioUrl, isPlaying, loading, player, scientificName]);

  // Stop propagation so tapping the player inside a card doesn't trigger
  // the card's onPress on web.
  const onPress = useCallback((e: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (e?.preventDefault) e.preventDefault();
    if (e?.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
    void doPlay();
  }, [doPlay]);

  const dim = size === 'md' ? 32 : 26;
  const radius = dim / 2;
  const iconSize = size === 'md' ? 14 : 11;
  const bars = isPlaying
    ? BAR_HEIGHTS_PLAY.map((h, i) => h + ((tick + i) % 3) * 2)
    : BAR_HEIGHTS_IDLE;
  const text = error
    ? 'Unavailable'
    : loading
      ? 'Loading…'
      : isPlaying
        ? 'Playing'
        : audioUrl
          ? 'Play call'
          : (label ?? 'Play call');

  return (
    <PressableScale
      style={styles.row}
      onPress={onPress}
      testID={testID}
      pressedScale={0.92}
      accessibilityLabel={`Play bird call for ${scientificName}`}
    >
      <View
        style={[
          styles.pill,
          { width: dim, height: dim, borderRadius: radius },
          isPlaying && styles.pillActive,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#0A0B0A" />
        ) : (
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={iconSize} color="#0A0B0A" />
        )}
      </View>
      <View style={styles.waveform}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: h, opacity: isPlaying ? 0.95 : 0.55 },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, error && { color: colors.danger }]} numberOfLines={1}>
        {text}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.secondary,
  },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 2, backgroundColor: colors.primary, borderRadius: 1 },
  label: { ...type.caption, color: colors.textTertiary },
});
