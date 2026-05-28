// Unified collection picker / creator modal.
//
// Two modes:
//   • `mode="save"`  — user picks a collection to save a bird into (with an
//                       inline "+ New Collection" row that prompts for a name)
//   • `mode="create"` — bare text-input modal that just asks for a name and
//                        creates an empty collection
//
// Pure local-storage; no auth.
import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, type, spacing, radii } from '@/src/theme';
import {
  Collection,
  CollectionBird,
  addBirdToCollection,
  createCollection,
  getCollections,
} from '@/src/lib/state';

type SaveProps = {
  mode: 'save';
  visible: boolean;
  bird: Omit<CollectionBird, 'addedAt'>;
  onClose: () => void;
  onSaved?: (collection: Collection) => void;
};

type CreateProps = {
  mode: 'create';
  visible: boolean;
  onClose: () => void;
  onCreated?: (collection: Collection) => void;
};

type Props = SaveProps | CreateProps;

export function CollectionPickerModal(props: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [creating, setCreating] = useState(props.mode === 'create');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.visible) return;
    setCreating(props.mode === 'create');
    setName('');
    if (props.mode === 'save') {
      getCollections().then(setCollections);
    }
  }, [props.visible, props.mode]);

  const pickExisting = async (c: Collection) => {
    if (props.mode !== 'save') return;
    Haptics.selectionAsync().catch(() => {});
    setSaving(true);
    try {
      await addBirdToCollection(c.id, props.bird);
      props.onSaved?.(c);
      props.onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmCreate = async () => {
    const clean = name.trim();
    if (!clean) {
      Alert.alert('Name required', 'Give your collection a name.');
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setSaving(true);
    try {
      const created = await createCollection(clean);
      if (props.mode === 'save') {
        await addBirdToCollection(created.id, props.bird);
        props.onSaved?.(created);
      } else {
        props.onCreated?.(created);
      }
      props.onClose();
    } catch (e: any) {
      Alert.alert('Could not create collection', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const title =
    props.mode === 'create'
      ? 'New Collection'
      : creating
        ? 'Name your collection'
        : 'Save to collection';

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={props.onClose}
        testID="collection-picker-backdrop"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.center}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.sheet}
            testID="collection-picker-sheet"
          >
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={props.onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {props.mode === 'save' && (
              <View style={styles.birdRow}>
                {props.bird.image ? (
                  <Image source={{ uri: props.bird.image }} style={styles.birdImg} />
                ) : (
                  <View style={[styles.birdImg, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="leaf-outline" size={18} color={colors.textTertiary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.birdName} numberOfLines={1}>{props.bird.commonName}</Text>
                  {!!props.bird.scientificName && (
                    <Text style={styles.birdSci} numberOfLines={1}>{props.bird.scientificName}</Text>
                  )}
                </View>
              </View>
            )}

            {creating ? (
              <View style={{ gap: spacing.md }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Backyard Birds"
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  maxLength={40}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={confirmCreate}
                  testID="collection-name-input"
                />
                <View style={styles.btnRow}>
                  {props.mode === 'save' && (
                    <TouchableOpacity
                      onPress={() => setCreating(false)}
                      style={[styles.btn, styles.btnGhost]}
                      testID="collection-cancel-create"
                    >
                      <Text style={styles.btnGhostText}>Back</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={confirmCreate}
                    disabled={saving || !name.trim()}
                    style={[styles.btn, styles.btnPrimary, (!name.trim() || saving) && { opacity: 0.5 }]}
                    testID="collection-confirm-create"
                  >
                    <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : (props.mode === 'save' ? 'Create & Save' : 'Create')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setCreating(true)}
                  style={styles.newRow}
                  testID="collection-new-row"
                >
                  <View style={styles.newIcon}>
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.newText}>New Collection</Text>
                </TouchableOpacity>

                {collections.length === 0 ? (
                  <Text style={styles.emptyHint}>You don't have any collections yet — create your first one.</Text>
                ) : (
                  collections.map((c) => {
                    const alreadyIn = props.mode === 'save'
                      ? c.birds.some((b) => b.id === (props as SaveProps).bird.id)
                      : false;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => !alreadyIn && pickExisting(c)}
                        disabled={alreadyIn || saving}
                        style={[styles.collRow, alreadyIn && { opacity: 0.55 }]}
                        testID={`collection-pick-${c.id}`}
                      >
                        <Ionicons name="bookmark" size={18} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.collName} numberOfLines={1}>{c.name}</Text>
                          <Text style={styles.collMeta}>{c.birds.length} {c.birds.length === 1 ? 'bird' : 'birds'}</Text>
                        </View>
                        {alreadyIn ? (
                          <Text style={styles.inText}>Saved</Text>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...type.h3, color: colors.textPrimary, fontSize: 20 },
  birdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  birdImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.bgTertiary },
  birdName: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  birdSci: { ...type.bodySm, color: colors.textTertiary, fontStyle: 'italic' },
  input: {
    ...type.body,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { ...type.bodyLg, color: '#0E0F0D', fontWeight: '800' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.hairline },
  btnGhostText: { ...type.bodyLg, color: colors.textSecondary, fontWeight: '700' },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(123,160,91,0.08)',
  },
  newIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(123,160,91,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  newText: { ...type.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  collRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  collName: { ...type.body, color: colors.textPrimary, fontWeight: '700' },
  collMeta: { ...type.caption, color: colors.textTertiary, marginTop: 2 },
  inText: { ...type.caption, color: colors.primary, fontWeight: '700' },
  emptyHint: {
    ...type.bodySm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
