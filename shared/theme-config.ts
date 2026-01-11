export const THEME_CONFIGS = {
  default: {
    name: "Controly",
    primaryColor: "hsl(240, 10%, 3.9%)", // Negro actual
    brandColor: "#000000",
  }
} as const;

export type ThemeType = keyof typeof THEME_CONFIGS;

// Esta variable controla qué tema usar
export const CURRENT_THEME: ThemeType = 'default';

export const getCurrentThemeConfig = () => THEME_CONFIGS[CURRENT_THEME];