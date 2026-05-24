import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { colors, shadows, type } from '@/src/theme';

function CenterFab({ onPress }: { onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.fabWrap}>
      <View style={styles.fabGlow} />
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.fab}
        onPress={onPress}
        testID="tab-identify-fab"
      >
        <Ionicons name="scan" size={28} color="#0E0F0D" />
      </TouchableOpacity>
      <Text style={styles.fabLabel}>Identify</Text>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();

  const openIdentify = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/identify');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
          tabBarStyle: styles.tabBar,
          tabBarBackground: () => (
            <BlurView
              intensity={Platform.OS === 'ios' ? 60 : 0}
              tint="dark"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(20,22,19,0.92)' }]}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="leaf" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="identify-placeholder"
          options={{
            title: '',
            tabBarButton: () => <CenterFab onPress={openIdentify} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              openIdentify();
            },
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Collection',
            tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 0.5,
    borderTopColor: colors.hairline,
    backgroundColor: 'transparent',
  },
  fabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -22,
    width: 78,
  },
  fabGlow: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    opacity: 0.25,
    top: -6,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0E0F0D',
    ...shadows.glowPrimary,
  },
  fabLabel: {
    ...type.caption,
    color: colors.primary,
    marginTop: 6,
    fontWeight: '700',
  },
});
