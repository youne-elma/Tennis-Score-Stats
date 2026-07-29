import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';

type AppToggleProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function AppToggle({ label, value, onValueChange }: AppToggleProps) {
  return (
    <Pressable style={styles.row} onPress={() => onValueChange(!value)}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  label: {
    color: AppTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: AppTheme.radii.pill,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 52,
  },
  trackOn: {
    backgroundColor: AppTheme.colors.primary,
  },
  thumb: {
    backgroundColor: AppTheme.colors.textSubtle,
    borderRadius: AppTheme.radii.pill,
    height: 24,
    width: 24,
  },
  thumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: AppTheme.colors.textOnPrimary,
  },
});
