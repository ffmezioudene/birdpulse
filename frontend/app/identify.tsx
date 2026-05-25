import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { FeatherWave } from '@/src/components/FeatherWave';
import {
  consumeFreeUse,
  getFreeUses,
  isProEffective,
} from '@/src/lib/state';
import { identifyPhoto, identifySound } from '@/src/lib/api';

type Mode = 'photo' | 'sound';

export default function Identify() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>((params.mode as Mode) || 'photo');
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  // Permission to START an identification — does NOT consume a use yet.
  // The use is only counted after a successful result lands in the user's lap.
  const canStartIdentification = async (): Promise<boolean> => {
    if (await isProEffective()) return true;
    const left = await getFreeUses();
    if (left <= 0) {
      router.replace('/paywall');
      return false;
    }
    return true;
  };

  // Called AFTER a successful identification result is shown. Pro users are unaffected.
  const recordSuccessfulUse = async (): Promise<void> => {
    if (await isProEffective()) return;
    await consumeFreeUse();
  };

  const runPhoto = async (base64: string) => {
    if (!(await canStartIdentification())) return;
    setAnalyzing(true);
    try {
      const result = await identifyPhoto(base64);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await recordSuccessfulUse();
      router.replace({
        pathname: '/result',
        params: {
          type: 'photo',
          imageBase64: base64,
          payload: JSON.stringify(result),
        },
      });
    } catch (e: any) {
      Alert.alert('Identification failed', e?.message || 'Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const capture = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (photo?.base64) await runPhoto(photo.base64);
    } catch (e: any) {
      Alert.alert('Camera error', e?.message || 'Try again');
    }
  };

  const fromGallery = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access in settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      await runPhoto(res.assets[0].base64);
    }
  };

  const recordSound = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sound ID',
      'Recording bird calls requires a native build. In this preview, we identify from a sample spectrogram. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run sample',
          onPress: async () => {
            if (!(await canStartIdentification())) return;
            setAnalyzing(true);
            try {
              // Tiny placeholder spectrogram-style PNG. Backend may return "Unknown" — acceptable for preview.
              const SAMPLE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
              const result = await identifySound(SAMPLE);
              await recordSuccessfulUse();
              router.replace({
                pathname: '/result',
                params: { type: 'sound', payload: JSON.stringify(result) },
              });
            } catch (e: any) {
              Alert.alert('Sound ID failed', e?.message || 'Try again.');
            } finally {
              setAnalyzing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root} testID="identify-screen">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="identify-close">
            <Ionicons name="chevron-down" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Identify</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Camera preview area */}
        <View style={styles.previewWrap}>
          {mode === 'photo' && permission?.granted ? (
            <CameraView ref={cameraRef} style={styles.preview} facing="back" />
          ) : (
            <LinearGradient colors={['#1F2A1A', '#0E1410']} style={styles.preview}>
              <View style={styles.previewInner}>
                {mode === 'sound' ? (
                  <Ionicons name="mic-outline" size={64} color={colors.primary} />
                ) : (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Ionicons name="camera-outline" size={56} color={colors.primary} />
                    <Text style={styles.permText}>Camera permission needed</Text>
                    <TouchableOpacity style={styles.permBtn} onPress={requestPermission} testID="grant-camera">
                      <Text style={styles.permBtnText}>Allow Camera</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </LinearGradient>
          )}

          {/* Framing guide */}
          {mode === 'photo' && (
            <View pointerEvents="none" style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          )}

          {analyzing && (
            <View style={styles.scanOverlay} testID="analyzing-overlay">
              <FeatherWave size={90} mode="loading" glow />
              <Text style={styles.scanText}>Analyzing…</Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {mode === 'photo' ? (
            <>
              <TouchableOpacity style={styles.sideBtn} onPress={fromGallery} testID="identify-gallery">
                <Ionicons name="images-outline" size={22} color={colors.textPrimary} />
                <Text style={styles.sideText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutter} onPress={capture} testID="identify-shutter">
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <View style={{ width: 60 }} />
            </>
          ) : (
            <>
              <View style={{ width: 60 }} />
              <TouchableOpacity style={[styles.shutter, { backgroundColor: colors.secondary }]} onPress={recordSound} testID="identify-record">
                <Ionicons name="mic" size={28} color="#0E0F0D" />
              </TouchableOpacity>
              <View style={{ width: 60 }} />
            </>
          )}
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'photo' && styles.modeActive]}
            onPress={() => setMode('photo')}
            testID="mode-photo"
          >
            <Ionicons name="camera" size={16} color={mode === 'photo' ? '#0E0F0D' : colors.textPrimary} />
            <Text style={[styles.modeText, mode === 'photo' && styles.modeTextActive]}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'sound' && styles.modeActive]}
            onPress={() => setMode('sound')}
            testID="mode-sound"
          >
            <Ionicons name="mic" size={16} color={mode === 'sound' ? '#0E0F0D' : colors.textPrimary} />
            <Text style={[styles.modeText, mode === 'sound' && styles.modeTextActive]}>Sound</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  previewWrap: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewInner: { alignItems: 'center', justifyContent: 'center' },
  permText: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
  permBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.button,
  },
  permBtnText: { ...type.bodySm, color: '#0E0F0D', fontWeight: '700' },
  frame: { position: 'absolute', top: 40, left: 40, right: 40, bottom: 40 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,15,13,0.55)',
    gap: 12,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  scanText: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  sideBtn: {
    width: 60,
    alignItems: 'center',
    gap: 4,
  },
  sideText: { ...type.caption, color: colors.textSecondary },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.18)',
    ...shadows.glowPrimary,
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#0E0F0D' },
  modeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 4,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
  },
  modeActive: { backgroundColor: colors.primary },
  modeText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  modeTextActive: { color: '#0E0F0D' },
});
