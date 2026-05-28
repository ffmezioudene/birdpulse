// Collection detail — bird grid for one user-named collection, with rename
// and delete actions. Pure local storage.
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, type, spacing, radii, shadows } from '@/src/theme';
import {
  Collection,
  CollectionBird,
  deleteCollection,
  getCollections,
  removeBirdFromCollection,
  renameCollection,
} from '@/src/lib/state';
import { lookupByScientific, lookupByCommon, getSpecies } from '@/src/lib/catalog';
import { FeatherWave } from '@/src/components/FeatherWave';

export default function CollectionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const collectionId = String(id ?? '');

  const [collection, setCollection] = useState<Collection | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    const all = await getCollections();
    const found = all.find((c) => c.id === collectionId) || null;
    setCollection(found);
    if (found) setRenameValue(found.name);
  }, [collectionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openBird = (b: CollectionBird) => {
    Haptics.selectionAsync().catch(() => {});
    // Try to find the catalog species in three different ways so any bird
    // saved through any flow is navigable.
    let targetId = getSpecies(b.id)?.id;
    if (!targetId && b.scientificName) {
      targetId = lookupByScientific(b.scientificName)?.id;
    }
    if (!targetId && b.commonName) {
      targetId = lookupByCommon(b.commonName)?.id;
    }
    if (!targetId) {
      Alert.alert(
        'Detail unavailable',
        `${b.commonName} isn't in the on-device catalog yet. We're working on adding the long tail of species.`,
      );
      return;
    }
    router.push(`/bird/${targetId}` as any);
  };

  const onRename = async () => {
    if (!collection) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for this collection.');
      return;
    }
    await renameCollection(collection.id, trimmed);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setRenameOpen(false);
    load();
  };

  const onDelete = () => {
    if (!collection) return;
    Alert.alert(
      'Delete collection?',
      `"${collection.name}" and its ${collection.birds.length} ${
        collection.birds.length === 1 ? 'bird' : 'birds'
      } will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCollection(collection.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            router.back();
          },
        },
      ],
    );
  };

  const onRemoveBird = (b: CollectionBird) => {
    if (!collection) return;
    Alert.alert(
      'Remove from collection?',
      `Remove ${b.commonName} from "${collection.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeBirdFromCollection(collection.id, b.id);
            Haptics.selectionAsync().catch(() => {});
            load();
          },
        },
      ],
    );
  };

  const subtitle = useMemo(() => {
    if (!collection) return '';
    const n = collection.birds.length;
    return `${n} ${n === 1 ? 'bird' : 'birds'}  ·  Created ${new Date(
      collection.createdAt,
    ).toLocaleDateString()}`;
  }, [collection]);

  if (!collection) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.back()}
              testID="collection-back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Collection</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>Collection not found</Text>
            <Text style={styles.emptySub}>It may have been deleted from another screen.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="collection-detail-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            testID="collection-back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {collection.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setRenameValue(collection.name);
                setRenameOpen(true);
              }}
              testID="collection-rename"
            >
              <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onDelete} testID="collection-delete">
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.subHeader}>
          <Ionicons name="bookmark" size={16} color={colors.primary} />
          <Text style={styles.subText}>{subtitle}</Text>
        </View>

        {collection.birds.length === 0 ? (
          <View style={styles.empty}>
            <FeatherWave size={60} mode="static" glow />
            <Text style={styles.emptyTitle}>No birds yet</Text>
            <Text style={styles.emptySub}>
              Identify a bird and tap Save to drop it into this collection.
            </Text>
            <TouchableOpacity
              style={styles.identifyCta}
              onPress={() => router.push('/identify')}
              testID="collection-identify-cta"
            >
              <Ionicons name="scan-outline" size={16} color="#0E0F0D" />
              <Text style={styles.identifyCtaText}>Identify a bird</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={collection.birds}
            keyExtractor={(b) => b.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12, paddingHorizontal: spacing.lg }}
            contentContainerStyle={{ gap: 12, paddingVertical: spacing.lg, paddingBottom: 60 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => openBird(item)}
                onLongPress={() => onRemoveBird(item)}
                testID={`collection-bird-${item.id}`}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.cardImg} />
                ) : (
                  <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
                    <Ionicons name="leaf-outline" size={28} color={colors.textTertiary} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.commonName}
                  </Text>
                  {!!item.scientificName && (
                    <Text style={styles.cardSci} numberOfLines={1}>
                      {item.scientificName}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename collection</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              maxLength={48}
              placeholder="Backyard, Migration, Weekend trips…"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              returnKeyType="done"
              onSubmitEditing={onRename}
              testID="collection-rename-input"
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setRenameOpen(false)}
                testID="collection-rename-cancel"
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={onRename}
                testID="collection-rename-save"
              >
                <Text style={styles.modalBtnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingVertical: spacing.sm,
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  headerTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', flex: 1, textAlign: 'center' },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  subText: { ...type.bodySm, color: colors.textTertiary },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 12,
  },
  emptyTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  emptySub: { ...type.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 320 },
  identifyCta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.button,
    ...shadows.glowPrimary,
  },
  identifyCtaText: { ...type.body, color: '#0E0F0D', fontWeight: '800' },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  cardImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.bgTertiary,
  },
  cardImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10, gap: 2 },
  cardName: { ...type.body, color: colors.textPrimary, fontWeight: '700' },
  cardSci: { ...type.caption, color: colors.textTertiary, fontStyle: 'italic' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modalTitle: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  modalInput: {
    ...type.body,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.button },
  modalBtnGhost: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.hairline },
  modalBtnGhostText: { ...type.body, color: colors.textPrimary, fontWeight: '700' },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnPrimaryText: { ...type.body, color: '#0E0F0D', fontWeight: '800' },
});
