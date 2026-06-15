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
  Image,
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { FeatherWave } from '@/src/components/FeatherWave';
import {
  consumeFreeUse,
  getFreeUses,
  isProEffective,
} from '@/src/lib/state';
import { identifyPhoto, identifySoundPerch, perchToIdentifyResult, warmupSoundPerch } from '@/src/lib/api';

type Mode = 'photo' | 'sound';
type PhotoPhase = 'idle' | 'captured' | 'uploading' | 'identifying' | 'enriching' | 'error';

export default function Identify() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>((params.mode as Mode) || 'photo');
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // ---- Photo capture state machine ---------------------------------------
  //
  //   idle      → showing camera viewfinder, shutter enabled
  //   captured  → very brief (~250ms) flash + freeze preview of the shot
  //   uploading → showing the captured image + "Uploading image…" copy
  //   identifying → "Running identification…"
  //   enriching → "Loading species info…" (any post-identify enrichment)
  //   error     → "Couldn't identify" with Try Again / Retake
  //
  // The shutter is disabled in every state except `idle` so a frantic user
  // can't fire 3 concurrent identifications by tapping repeatedly.
  const [photoPhase, setPhotoPhase] = useState<PhotoPhase>('idle');
  const [capturedB64, setCapturedB64] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const photoAbortRef = useRef<AbortController | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // -------------------- Camera zoom --------------------
  // expo-camera's `zoom` prop is normalized 0..1 across all devices. The
  // jump from 0 → 1 is non-linear (roughly logarithmic on iOS), so the
  // visual values below were tuned by hand to match what users expect
  // from an iPhone Camera-style 1x / 2x / 5x pill:
  //   1x → 0     (no zoom)
  //   2x → 0.18  (looks ~2× on most iPhones)
  //   5x → 0.45  (looks ~5× — digital on most devices, telephoto on Pros)
  // Pinch is mapped to the same 0..1 range via a soft multiplier so a
  // natural-feeling pinch traverses about half the range.
  const ZOOM_LEVELS: { label: string; value: number }[] = [
    { label: '1x', value: 0 },
    { label: '2x', value: 0.18 },
    { label: '5x', value: 0.45 },
  ];
  const [zoom, setZoom] = useState(0);
  // Refs mirror state so gesture worklets (which can't read React state
  // directly) and rAF-driven button animations both see fresh values.
  const zoomRef = useRef(0);
  const pinchBaseRef = useRef(0);
  const zoomAnimRafRef = useRef<number | null>(null);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  // Reset zoom whenever the user flips between Photo / Sound mode. The
  // mode-switch reset also covers the "navigate away and come back" case
  // because the screen remounts (state is initial-value 0 on next mount).
  useEffect(() => {
    setZoom(0);
    zoomRef.current = 0;
    pinchBaseRef.current = 0;
    if (zoomAnimRafRef.current) {
      cancelAnimationFrame(zoomAnimRafRef.current);
      zoomAnimRafRef.current = null;
    }
  }, [mode]);

  /** Smoothly animate zoom to a target over ~200 ms (ease-out quad).
   *  Used when the user taps a 1x / 2x / 5x button so the change feels
   *  intentional rather than a jump-cut. */
  const animateZoomTo = (target: number) => {
    if (zoomAnimRafRef.current) cancelAnimationFrame(zoomAnimRafRef.current);
    const start = zoomRef.current;
    const t0 = Date.now();
    const DURATION_MS = 200;
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out quad
      const next = start + (target - start) * eased;
      setZoom(next);
      zoomRef.current = next;
      if (t < 1) {
        zoomAnimRafRef.current = requestAnimationFrame(tick);
      } else {
        zoomAnimRafRef.current = null;
      }
    };
    tick();
  };

  /** Tap handler for the 1x / 2x / 5x pill buttons. */
  const onZoomBtn = (target: number) => {
    if (Math.abs(zoomRef.current - target) < 0.005) return; // no-op on the active one
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animateZoomTo(target);
  };

  /** Two-finger pinch gesture on the camera viewfinder. Uses the native
   *  RNGH gesture system + a `runOnJS` bridge to feed setZoom. The base
   *  zoom at pinch-start is captured so multiple pinches compose naturally
   *  rather than always starting from 0. */
  const onPinchBegin = () => {
    pinchBaseRef.current = zoomRef.current;
    if (zoomAnimRafRef.current) {
      cancelAnimationFrame(zoomAnimRafRef.current);
      zoomAnimRafRef.current = null;
    }
  };
  const onPinchChange = (scale: number) => {
    // scale starts at 1.0 and grows as fingers spread. The 0.35 multiplier
    // makes a typical pinch (~2× spread) cover about a third of the range,
    // which feels right on a phone-sized viewport without being twitchy.
    const next = Math.max(0, Math.min(1, pinchBaseRef.current + (scale - 1) * 0.35));
    setZoom(next);
    zoomRef.current = next;
  };
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      runOnJS(onPinchBegin)();
    })
    .onChange((e) => {
      'worklet';
      runOnJS(onPinchChange)(e.scale);
    });
  // -------------------- /Camera zoom --------------------

  // Sound ID — Perch 2.0 real audio path.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const isRecording = recorderState.isRecording;
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [analyzingText, setAnalyzingText] = useState('Analyzing audio…');

  // Warmup the Modal Perch container as soon as the user enters Sound mode.
  // Fire-and-forget; the HTTP call returns instantly when Perch is warm and
  // in 20-40 s when it was cold. Either way the user's recording time covers
  // most of the wake budget so by the time they tap stop, Perch is ready.
  useEffect(() => {
    if (mode === 'sound') {
      warmupSoundPerch();
    }
  }, [mode]);

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
    if (!(await canStartIdentification())) {
      // Reset back to camera viewfinder if gated by paywall.
      setPhotoPhase('idle');
      setCapturedB64(null);
      return;
    }
    setCapturedB64(base64);
    setErrorMsg('');
    // Phase 1: uploading. We show this immediately so the user has visual
    // confirmation their tap registered, even if the network call hasn't
    // started yet.
    setPhotoPhase('uploading');
    const abort = new AbortController();
    photoAbortRef.current = abort;
    // A short timeout-driven phase progression so the user gets at least one
    // visible status update even on very fast network. ID typically takes
    // 2-5 s end-to-end; we move to "identifying" after 600ms.
    const phaseT1 = setTimeout(() => {
      if (photoAbortRef.current === abort) setPhotoPhase('identifying');
    }, 600);
    try {
      const result = await identifyPhoto(base64);
      if (abort.signal.aborted) return;
      clearTimeout(phaseT1);
      setPhotoPhase('enriching');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await recordSuccessfulUse();
      // Tiny pause so the "Loading species info…" message reads, then route.
      setTimeout(() => {
        if (abort.signal.aborted) return;
        router.replace({
          pathname: '/result',
          params: {
            type: 'photo',
            imageBase64: base64,
            payload: JSON.stringify(result),
          },
        });
      }, 250);
    } catch (e: any) {
      clearTimeout(phaseT1);
      if (abort.signal.aborted) return;
      setErrorMsg(e?.message || 'Please check your connection and try again.');
      setPhotoPhase('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  /** Returns to the live camera viewfinder, ready for a fresh shot. */
  const cancelOrRetake = () => {
    if (photoAbortRef.current) {
      photoAbortRef.current.abort();
      photoAbortRef.current = null;
    }
    setPhotoPhase('idle');
    setCapturedB64(null);
    setErrorMsg('');
    // Per spec: zoom returns to 1x when the user retakes a photo after a
    // failed ID. Stops any in-flight button animation too.
    if (zoomAnimRafRef.current) {
      cancelAnimationFrame(zoomAnimRafRef.current);
      zoomAnimRafRef.current = null;
    }
    setZoom(0);
    zoomRef.current = 0;
    pinchBaseRef.current = 0;
  };

  /** Re-runs identification on the SAME captured photo (Try Again button). */
  const retryPhoto = () => {
    if (!capturedB64) {
      cancelOrRetake();
      return;
    }
    runPhoto(capturedB64);
  };

  const capture = async () => {
    if (photoPhase !== 'idle') return; // hard guard against double-tap
    // Strong, immediate haptic so the user feels the shutter even on a
    // device with the speaker muted.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    if (!cameraRef.current) return;
    // Mark captured immediately so the shutter visually disables AND the
    // processing overlay slides over the viewfinder within one render frame.
    // The overlay has its own opaque background, so the camera view is
    // covered even before takePictureAsync() resolves (~200-500 ms later).
    setPhotoPhase('captured');
    // White flash — quick ramp to 0.95, brief hold, smooth fade. Total
    // ~280 ms, with a clear PEAK so the moment of capture is unmistakable.
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 0.95,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // Hold the peak for a beat — this is what makes the flash feel real
      // rather than a barely-perceptible blink.
      Animated.delay(50),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (photo?.base64) {
        await runPhoto(photo.base64);
      } else {
        cancelOrRetake();
        Alert.alert('Camera error', 'Could not capture an image. Please try again.');
      }
    } catch (e: any) {
      cancelOrRetake();
      Alert.alert('Camera error', e?.message || 'Try again');
    }
  };

  const fromGallery = async () => {
    if (photoPhase !== 'idle') return;
    Haptics.selectionAsync().catch(() => {});
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
      // Gallery photos go through the same identification overlay so the UX
      // is consistent with the camera capture path.
      setPhotoPhase('captured');
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
          'Enable microphone in Settings so BirdPulse can listen to bird calls.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert('Microphone access needed', 'BirdPulse uses the microphone to listen to bird calls.');
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
    setAnalyzingText('Stopping recording…');
    try {
      await recorder.stop();
      setAnalyzingText('Listening to the call…');
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

      setAnalyzingText('Matching to 14,000+ species…');
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
            <>
              {/* Two-finger pinch on the viewfinder maps to the camera's
                  zoom prop. The GestureDetector wraps just the CameraView
                  so it doesn't fight with taps on overlay UI (buttons,
                  framing guide, processing overlay). */}
              <GestureDetector gesture={pinchGesture}>
                <CameraView
                  ref={cameraRef}
                  style={styles.preview}
                  facing="back"
                  zoom={zoom}
                />
              </GestureDetector>
              {/* White-flash overlay — fades from 1 → 0 in ~280 ms on capture. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: '#FFFFFF', opacity: flashAnim },
                ]}
              />
            </>
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
                      {/* Apple Guideline 5.1.1(iv): pre-permission button labels must
                          NOT use words like "Allow" / "Grant" that imply we're
                          granting permission ourselves. "Continue" hands the user
                          off to Apple's official system dialog without confusion. */}
                      <Text style={styles.permBtnText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </LinearGradient>
          )}

          {/* Framing guide */}
          {mode === 'photo' && photoPhase === 'idle' && (
            <View pointerEvents="none" style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          )}

          {/* Zoom pill — iPhone-Camera-style 1x / 2x / 5x selector. Only
              shown in the live photo viewfinder (not during processing,
              not in Sound mode). Sits above the framing guide's bottom
              edge so it doesn't crowd the shutter or block the subject. */}
          {mode === 'photo' && photoPhase === 'idle' && permission?.granted && (
            <View pointerEvents="box-none" style={styles.zoomWrap}>
              <View style={styles.zoomPill} testID="zoom-pill">
                {ZOOM_LEVELS.map((lvl) => {
                  const active = Math.abs(zoom - lvl.value) < 0.005;
                  return (
                    <TouchableOpacity
                      key={lvl.label}
                      activeOpacity={0.7}
                      onPress={() => onZoomBtn(lvl.value)}
                      style={[styles.zoomBtn, active && styles.zoomBtnActive]}
                      testID={`zoom-${lvl.label}`}
                    >
                      <Text style={[styles.zoomText, active && styles.zoomTextActive]}>
                        {lvl.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Sound-mode legacy spinner */}
          {analyzing && mode === 'sound' && (
            <View style={styles.scanOverlay} testID="analyzing-overlay">
              <FeatherWave size={90} mode="loading" glow />
              <Text style={styles.scanText}>{analyzingText}</Text>
            </View>
          )}

          {/* Photo processing overlay — shown for every phase except idle.
              Renders the captured image so the user has clear confirmation
              that their tap registered. */}
          {mode === 'photo' && photoPhase !== 'idle' && (
            <View style={styles.processingOverlay} testID="photo-processing-overlay">
              {capturedB64 && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${capturedB64}` }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              )}
              <View style={styles.processingScrim} />
              <View style={styles.processingInner}>
                {photoPhase === 'error' ? (
                  <View style={styles.errorCard} testID="photo-error-card">
                    <View style={styles.errorIconWrap}>
                      <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
                    </View>
                    <Text style={styles.errorTitle}>Couldn’t identify this bird</Text>
                    <Text style={styles.errorBody} numberOfLines={3}>
                      {errorMsg || 'Please check your connection and try again.'}
                    </Text>
                    <View style={styles.errorBtnRow}>
                      <TouchableOpacity
                        style={[styles.errorBtn, styles.errorBtnGhost]}
                        onPress={cancelOrRetake}
                        testID="photo-error-retake"
                      >
                        <Ionicons name="camera-outline" size={16} color={colors.textPrimary} />
                        <Text style={styles.errorBtnGhostText}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.errorBtn, styles.errorBtnPrimary]}
                        onPress={retryPhoto}
                        testID="photo-error-retry"
                      >
                        <Ionicons name="refresh-outline" size={16} color="#0E0F0D" />
                        <Text style={styles.errorBtnPrimaryText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.processingCard}>
                    <FeatherWave size={64} mode="loading" glow />
                    <Text style={styles.processingTitle}>
                      {photoPhase === 'captured'
                        ? 'Got it!'
                        : photoPhase === 'uploading'
                          ? 'Uploading image…'
                          : photoPhase === 'identifying'
                            ? 'Running identification…'
                            : 'Loading species info…'}
                    </Text>
                    <Text style={styles.processingSub}>
                      {photoPhase === 'captured'
                        ? 'Preparing your photo'
                        : photoPhase === 'uploading'
                          ? 'Sending to BirdPulse AI'
                          : photoPhase === 'identifying'
                            ? 'Matching against 10,000+ species'
                            : 'Almost there'}
                    </Text>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={cancelOrRetake}
                      testID="photo-cancel"
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {mode === 'photo' ? (
            <>
              <TouchableOpacity
                style={[styles.sideBtn, photoPhase !== 'idle' && { opacity: 0.35 }]}
                onPress={fromGallery}
                disabled={photoPhase !== 'idle'}
                testID="identify-gallery"
              >
                <Ionicons name="images-outline" size={22} color={colors.textPrimary} />
                <Text style={styles.sideText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shutter, photoPhase !== 'idle' && styles.shutterDisabled]}
                onPress={capture}
                disabled={photoPhase !== 'idle'}
                testID="identify-shutter"
              >
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
  // ---- Zoom pill (1x / 2x / 5x) ----
  zoomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
  },
  zoomPill: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(14, 15, 13, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  zoomBtn: {
    minWidth: 44,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  zoomBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  zoomText: {
    ...type.bodySm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  zoomTextActive: {
    color: '#0E0F0D',
  },
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
  shutterDisabled: { opacity: 0.4 },
  // ---- Photo processing overlay ------------------------------------------
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.card,
    overflow: 'hidden',
    // CRITICAL: opaque background so the camera viewfinder is fully
    // covered the instant photoPhase !== 'idle' — even before the
    // captured Image has loaded. Without this, there's a ~200-500 ms
    // window where the live camera bleeds through and users wonder
    // whether their tap registered.
    backgroundColor: colors.bg,
  },
  processingScrim: {
    ...StyleSheet.absoluteFillObject,
    // Darker scrim makes the captured photo recede into the background
    // so the "Identifying species…" card is the clear focus.
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  processingInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  processingCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14,15,13,0.85)',
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  processingTitle: {
    ...type.bodyLg,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  processingSub: {
    ...type.bodySm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.button,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cancelText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '600' },
  errorCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14,15,13,0.92)',
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  errorIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(226,92,92,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  errorTitle: {
    ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', textAlign: 'center', marginTop: 4,
  },
  errorBody: {
    ...type.bodySm, color: colors.textTertiary, textAlign: 'center', lineHeight: 18,
  },
  errorBtnRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md, width: '100%' },
  errorBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: radii.button,
  },
  errorBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.hairline,
  },
  errorBtnGhostText: { ...type.bodySm, color: colors.textPrimary, fontWeight: '700' },
  errorBtnPrimary: { backgroundColor: colors.primary },
  errorBtnPrimaryText: { ...type.bodySm, color: '#0E0F0D', fontWeight: '800' },
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
