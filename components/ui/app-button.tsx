import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';

import { AppTheme } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = PressableProps & {
  title: string;
  icon?: ComponentProps<typeof MaterialIcons>['name'];
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export function AppButton({
  title,
  icon,
  variant = 'primary',
  fullWidth = false,
  style,
  disabled,
  accessibilityRole = 'button',
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(disabled);

  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style as ViewStyle,
      ]}>
      <Text style={[styles.text, styles[`${variant}Text`], isDisabled && styles.disabledText]}>
        {title}
      </Text>
      {icon ? (
        <MaterialIcons
          name={icon}
          size={20}
          color={
            isDisabled
              ? AppTheme.colors.textSubtle
              : variant === 'primary'
                ? AppTheme.colors.textOnPrimary
                : AppTheme.colors.primary
          }
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: AppTheme.radii.md,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: AppTheme.colors.primary,
  },
  secondary: {
    backgroundColor: AppTheme.colors.surface,
    borderColor: AppTheme.colors.border,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: AppTheme.colors.dangerSoft,
    borderColor: AppTheme.colors.dangerBorder,
    borderWidth: 1,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.48,
  },
  text: {
    fontSize: 16,
    fontWeight: '900',
  },
  primaryText: {
    color: AppTheme.colors.textOnPrimary,
  },
  secondaryText: {
    color: AppTheme.colors.text,
  },
  ghostText: {
    color: AppTheme.colors.primary,
  },
  dangerText: {
    color: AppTheme.colors.danger,
  },
  disabledText: {
    color: AppTheme.colors.textSubtle,
  },
});
