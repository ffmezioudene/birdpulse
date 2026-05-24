import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, type } from '@/src/theme';

function CenterFab({ onPress }: { onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.fabWrap}>
      {/* Outer glow ring */}
      <View style={styles.fabRing} />
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.fab}
        onPress={onPress}
        testID="tab-identify-fab"
      >
        <Ionicons name="scan" size={26} color="#FFFFFF" />
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
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },
          tabBarItemStyle: { paddingTop: 8 },
          tabBarStyle: styles.tabBar,
          tabBarBackground: () => (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView
                intensity={Platform.OS === 'ios' ? 70 : 0}
                tint="dark"
                style={StyleSheet.absoluteFillObject}
              />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,17,14,0.95)' }]} />
            </View>
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
    height: 92,
    paddingTop: 6,
    paddingBottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
    elevation: 0,
  },
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    top: -18,
  },
  fabRing: {
    position: 'absolute',
    top: -10,
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(123,160,91,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(123,160,91,0.35)',
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#0E0F0D',
    shadowColor: '#7BA05B',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
  fabLabel: {
    ...type.caption,
    color: colors.primary,
    marginTop: 8,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
