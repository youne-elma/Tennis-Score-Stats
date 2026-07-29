import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, StyleSheet, View } from 'react-native';

import { AppTheme } from '@/constants/theme';

type PlayerAvatarProps = {
  photoUri?: string;
  size?: number;
};

export function PlayerAvatar({ photoUri, size = 48 }: PlayerAvatarProps) {
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={[styles.image, { borderRadius: size / 2, height: size, width: size }]}
      />
    );
  }

  return (
    <View style={[styles.fallback, { borderRadius: size / 2, height: size, width: size }]}>
      <MaterialIcons name="person" size={Math.round(size * 0.58)} color={AppTheme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: AppTheme.colors.primarySoft,
    justifyContent: 'center',
  },
  image: {
    backgroundColor: AppTheme.colors.surface,
  },
});
