import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { AppTheme } from '@/constants/theme';

type AppInputProps = TextInputProps & {
  label: string;
};

export function AppInput({ label, style, ...props }: AppInputProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={AppTheme.colors.placeholder}
        {...props}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  label: {
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    backgroundColor: AppTheme.colors.inputSurface,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radii.md,
    borderWidth: 1,
    color: AppTheme.colors.text,
    fontSize: AppTheme.typography.input,
    minHeight: 50,
    paddingHorizontal: 14,
  },
});
