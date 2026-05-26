import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import { OWL_AVATAR } from '@/src/lib/birds';
import { chat } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';
import { KEYS, getHistory } from '@/src/lib/state';
import { FeatherWave } from '@/src/components/FeatherWave';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'What birds are near me now?',
  "What's that bird singing at dawn?",
  'How do I attract cardinals?',
  'Best time to birdwatch this week?',
];

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ birdId?: string; birdName?: string; birdSci?: string }>();
  const birdContext = params.birdName
    ? { id: String(params.birdId ?? ''), name: String(params.birdName), sci: String(params.birdSci ?? '') }
    : null;

  const [messages, setMessages] = useState<Msg[]>(() =>
    birdContext
      ? [{
          id: 'welcome',
          role: 'assistant',
          content: `Hi — I'm your birding companion. We're looking at the ${birdContext.name}${
            birdContext.sci ? ` (${birdContext.sci})` : ''
          }. Ask me anything: how to attract it, how to tell it apart from look-alikes, when it's most active, or whether it's rare in your area.`,
        }]
      : [{
          id: 'welcome',
          role: 'assistant',
          content:
            "Hi — I'm your birding companion. Tell me where you are or what you've seen and I'll help you find more.",
        }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [recentFinds, setRecentFinds] = useState<string[]>([]);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    storage.getItem<string>(KEYS.chatSession, '').then((s) => s && setSessionId(s));
    // Pull recent finds from local history for context
    getHistory().then((h) => {
      const names = h
        .map((x) => x.commonName)
        .filter((n) => n && n.toLowerCase() !== 'unknown')
        .slice(0, 5);
      setRecentFinds(names);
    });
    // Quietly try to grab location (only if user already granted)
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {}
    })();
  }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    Haptics.selectionAsync();
    setInput('');
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const month = new Date().toLocaleString('en-US', { month: 'long' });
      const prefix = birdContext
        ? `[Context: User is reading about ${birdContext.name} (${birdContext.sci}). Answer in the context of this species.]\n`
        : '';
      const res = await chat(prefix + content, sessionId || undefined, {
        latitude: coords?.lat,
        longitude: coords?.lng,
        month,
        recent_finds: recentFinds,
      });
      if (!sessionId) {
        setSessionId(res.session_id);
        await storage.setItem(KEYS.chatSession, res.session_id);
      }
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: res.reply }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { id: `e-${Date.now()}`, role: 'assistant', content: 'Sorry, I had trouble reaching the nest. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="chat-screen">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="chat-close">
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Image source={{ uri: OWL_AVATAR }} style={styles.avatar} />
            <View>
              <Text style={styles.title}>Wise</Text>
              <Text style={styles.subtitle}>Your owl bird expert</Text>
            </View>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={{ flex: 1 }}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.lg, gap: 10, paddingBottom: 20 }}
            renderItem={({ item }) => <Bubble msg={item} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />

          {messages.length <= 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestion} onPress={() => send(s)} testID={`suggestion-${s.slice(0,10)}`}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {loading && (
            <View style={styles.typing}>
              <FeatherWave size={22} mode="loading" />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask Wise about birds…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              onSubmitEditing={() => send()}
              returnKeyType="send"
              testID="chat-input"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => send()} testID="chat-send">
              <Ionicons name="arrow-up" size={20} color="#0E0F0D" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.alignRight : styles.alignLeft]}>
      {!isUser && <Image source={{ uri: OWL_AVATAR }} style={styles.bubbleAvatar} />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && { color: '#0E0F0D' }]}>{msg.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.hairline,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.secondary },
  title: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  subtitle: { ...type.caption, color: colors.textTertiary },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '90%' },
  alignLeft: { alignSelf: 'flex-start' },
  alignRight: { alignSelf: 'flex-end' },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14 },
  bubble: { padding: 14, borderRadius: 20, maxWidth: '100%' },
  bubbleAssistant: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, borderBottomLeftRadius: 6 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleText: { ...type.body, color: colors.textPrimary, lineHeight: 22 },
  suggestions: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.sm },
  suggestion: {
    paddingHorizontal: 14, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(123,160,91,0.12)', borderWidth: 1, borderColor: 'rgba(123,160,91,0.4)',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  suggestionText: { ...type.bodySm, color: colors.primary, fontWeight: '600' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  typingText: { ...type.caption, color: colors.textTertiary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline,
    backgroundColor: colors.bgSecondary,
  },
  input: {
    flex: 1, height: 48, paddingHorizontal: spacing.md, borderRadius: 24,
    backgroundColor: colors.card, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.hairline,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadows.glowPrimary,
  },
});
