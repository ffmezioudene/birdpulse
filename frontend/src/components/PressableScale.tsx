// Universal press feedback for BirdLens — animated spring scale + selection haptic.
// Use this in place of TouchableOpacity for any tappable card on Home and sub-pages.
import { ReactNode } from 'react';
import { Pressable, ViewStyle, StyleProp, GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  haptic?: boolean;
  testID?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  hitSlop?: number;
};

export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedScale = 0.965,
  haptic = true,
  testID,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlop,
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.value = withSpring(pressedScale, { damping: 18, stiffness: 320, mass: 0.6 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.7 });
      }}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync();
        onPress?.(e);
      }}
      onLongPress={onLongPress}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
