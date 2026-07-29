import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppTheme } from '@/constants/theme';

type AppCardProps = ViewProps & {
  tone?: 'default' | 'gold' | 'muted';
};

export function AppCard({ tone = 'default', style, ...props }: AppCardProps) {
  return <View {...props} style={[styles.base, styles[tone], style]} />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    padding: 16,
  },
  default: {
    backgroundColor: AppTheme.colors.surface,
    borderColor: AppTheme.colors.border,
  },
  gold: {
    backgroundColor: AppTheme.colors.primaryWash,
    borderColor: AppTheme.colors.borderGold,
  },
  muted: {
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderColor: AppTheme.colors.border,
  },
});
