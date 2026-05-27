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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { File as FsFile } from 'expo-file-system';
import * as Location from 'expo-location';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { FeatherWave } from '@/src/components/FeatherWave';
import {
  consumeFreeUse,
  getFreeUses,
  isProEffective,
} from '@/src/lib/state';
import { identifyPhoto, identifySoundPerch, perchToIdentifyResult } from '@/src/lib/api';

type Mode = 'photo' | 'sound';

export default function Identify() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>((params.mode as Mode) || 'photo');
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // Sound ID — Perch 2.0 real audio path.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const isRecording = recorderState.isRecording;
  const [recordSeconds, setRecordSeconds] = useState(0);

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

  // -------- Sound ID via Perch 2.0 (real audio recording) --------

  const startSoundRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Request microphone permission (contextual flow per system guidelines)
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain === false) {
        Alert.alert(
          'Microphone access needed',
          'Enable microphone in Settings so BirdLens can listen to bird calls.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert('Microphone access needed', 'BirdLens uses the microphone to listen to bird calls.');
      }
      return;
    }
    if (!(await canStartIdentification())) return;

    try {
      // iOS requires recording mode on the audio session before record() will fire.
      // Keep playsInSilentMode:true so we don't regress silent-switch playback after recording.
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordSeconds(0);
    } catch (e: any) {
      // Restore playback mode on failure so the rest of the app stays correct.
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {}
      Alert.alert('Recording failed', e?.message || 'Could not start recording.');
    }
  };

  const stopSoundRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAnalyzing(true);
    try {
      await recorder.stop();
      // Restore playback-friendly audio session as soon as we've stopped — so
      // any follow-up bird-call playback (or returning to the rest of the app)
      // keeps working with the silent switch on.
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {}
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio captured.');

      // Read recorded m4a as base64.
      // expo-file-system v19 (SDK 54+) dropped EncodingType / readAsStringAsync
      // from the root export — use the new File class. Fall back to the legacy
      // API for older SDKs.
      let audioBase64 = '';
      try {
        // New API: File(uri).base64()
        audioBase64 = await new FsFile(uri).base64();
      } catch (newApiErr) {
        // Legacy fallback (expo-file-system <= v18 or /legacy subpath).
        const legacyRead = (FileSystem as any)?.readAsStringAsync;
        const legacyEnum = (FileSystem as any)?.EncodingType?.Base64;
        if (typeof legacyRead === 'function' && legacyEnum) {
          audioBase64 = await legacyRead(uri, { encoding: legacyEnum });
        } else {
          throw newApiErr;
        }
      }
      if (!audioBase64 || audioBase64.length < 100) {
        throw new Error('Could not read the recorded audio file.');
      }

      // Best-effort location + month (no prompt if not previously granted)
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const status = await Location.getForegroundPermissionsAsync();
        if (status.granted) {
          const pos = await Location.getLastKnownPositionAsync({});
          latitude = pos?.coords.latitude;
          longitude = pos?.coords.longitude;
        }
      } catch {}
      const month = new Date().toLocaleString('en-US', { month: 'long' });

      const perch = await identifySoundPerch(audioBase64, 'audio/mp4', {
        latitude,
        longitude,
        month,
        topK: 5,
      });
      const result = perchToIdentifyResult(perch);
      await recordSuccessfulUse();

      router.replace({
        pathname: '/result',
        params: { type: 'sound', payload: JSON.stringify(result) },
      });
    } catch (e: any) {
      // Make sure we don't leave the session stuck in recording mode on any failure.
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {}
      Alert.alert('Sound ID failed', e?.message || 'Try again with a clearer recording.');
    } finally {
      setAnalyzing(false);
      setRecordSeconds(0);
    }
  };

  // Safety net — if the screen unmounts mid-recording, restore playback mode.
  useEffect(() => {
    return () => {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
  }, []);

  // Live recording timer
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const onSoundMicPress = () => (isRecording ? stopSoundRecording() : startSoundRecording());

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
                  <View style={{ alignItems: 'center', gap: 12 }}>
                    {isRecording ? (
                      <>
                        <View style={styles.recDot} />
                        <Text style={styles.recTime}>
                          {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                        </Text>
                        <Text style={styles.recHint}>Listening… tap stop when done</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="mic-outline" size={64} color={colors.primary} />
                        <Text style={styles.recHint}>Hold the phone toward the bird — tap to record</Text>
                      </>
                    )}
                  </View>
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
              <TouchableOpacity
                style={[
                  styles.shutter,
                  { backgroundColor: isRecording ? '#E04F4F' : colors.secondary },
                ]}
                onPress={onSoundMicPress}
                disabled={analyzing}
                testID="identify-record"
              >
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={28} color="#0E0F0D" />
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
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E04F4F',
  },
  recTime: {
    ...type.title,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  recHint: {
    ...type.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
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
