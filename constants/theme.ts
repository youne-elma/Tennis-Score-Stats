/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const AppTheme = {
  colors: {
    background: '#07101F',
    surface: 'rgba(255, 255, 255, 0.08)',
    surfaceStrong: 'rgba(255, 255, 255, 0.12)',
    surfaceMuted: 'rgba(255, 255, 255, 0.06)',
    inputSurface: 'rgba(7, 16, 31, 0.72)',
    overlay: 'rgba(0, 0, 0, 0.58)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderGold: 'rgba(248, 197, 55, 0.22)',
    primarySoft: 'rgba(248, 197, 55, 0.12)',
    primaryWash: 'rgba(248, 197, 55, 0.08)',
    primary: '#F8C537',
    primaryPressed: '#E7B526',
    text: '#F7F9FC',
    textMuted: '#AAB5C8',
    textSubtle: '#8D99AE',
    textDisabled: '#C6CEDB',
    placeholder: '#6E7B91',
    textOnPrimary: '#07101F',
    danger: '#FF6B6B',
    dangerSoft: 'rgba(255, 107, 107, 0.12)',
    dangerBorder: 'rgba(255, 107, 107, 0.28)',
    success: '#65D6A4',
    tabBar: '#0B1628',
  },
  radii: {
    sm: 6,
    md: 8,
    lg: 18,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
  },
  typography: {
    kicker: 12,
    body: 14,
    input: 16,
    subtitle: 18,
    title: 28,
    display: 36,
  },
  shadow: {
    color: '#000',
    offset: { width: 0, height: 10 },
    opacity: 0.3,
    radius: 18,
    elevation: 8,
  },
};

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
