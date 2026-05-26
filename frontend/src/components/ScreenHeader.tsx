// Shared header with back chevron + title. Used by all sub-pages off Home.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, type } from '@/src/theme';

export function ScreenHeader({ title, eyebrow, testID }: { title: string; eyebrow?: string; testID?: string }) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} testID={testID}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="screen-header-back" hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { ...type.micro, color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  title: { ...type.title, color: colors.textPrimary },
});
