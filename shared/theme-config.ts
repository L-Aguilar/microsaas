export const THEME_CONFIGS = {
  default: {
    name: "CRM Moderno",
    primaryColor: "hsl(240, 10%, 3.9%)", // Negro actual
    brandColor: "#000000",
  },
  shimli: {
    name: "Shimli Admin",
    primaryColor: "hsl(277, 98%, 39%)", // #7e02c6 convertido a HSL
    brandColor: "#7e02c6",
  }
} as const;

export type ThemeType = keyof typeof THEME_CONFIGS;

// Esta variable controla qué tema usar
// Cambia entre 'default' y 'shimli' según necesites
export const CURRENT_THEME: ThemeType = 'shimli';

export const getCurrentThemeConfig = () => THEME_CONFIGS[CURRENT_THEME];