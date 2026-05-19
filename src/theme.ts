import { Dimensions } from 'react-native';

export type ThemeId = 'ruby' | 'ocean' | 'emerald' | 'violet' | 'graphite';

export type AppTheme = {
  id: ThemeId;
  name: string;
  preview: string[];
  colors: typeof DEFAULT_COLORS;
};

const THEME_STORAGE_KEY = 'medicare_theme_id';

const DEFAULT_COLORS = {
  primary: '#D7263D',
  primaryLight: '#FF6B7A',
  primarySoft: 'rgba(215, 38, 61, 0.18)',
  primarySofter: 'rgba(215, 38, 61, 0.1)',
  secondary: '#F05A68',
  accentWarm: '#FF9D76',
  danger: '#B91C2E',
  bgBase: '#190A12',
  bgCard: 'rgba(255, 255, 255, 0.06)',
  bgSidebar: 'rgba(25, 10, 18, 0.88)',
  textPrimary: '#FFFFFF',
  textSecondary: '#E6B7C1',
  textMuted: '#B4828F',
  borderColor: 'rgba(255, 107, 122, 0.16)',
};

export const APP_THEMES: AppTheme[] = [
  {
    id: 'ruby',
    name: 'روبي طبي',
    preview: ['#190A12', '#D7263D', '#FF6B7A', '#FF9D76'],
    colors: DEFAULT_COLORS,
  },
  {
    id: 'ocean',
    name: 'أزرق هادئ',
    preview: ['#06151E', '#0E7490', '#67E8F9', '#22C55E'],
    colors: {
      primary: '#0E7490',
      primaryLight: '#67E8F9',
      primarySoft: 'rgba(14, 116, 144, 0.2)',
      primarySofter: 'rgba(14, 116, 144, 0.12)',
      secondary: '#22C55E',
      accentWarm: '#FBBF24',
      danger: '#F43F5E',
      bgBase: '#06151E',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(6, 21, 30, 0.9)',
      textPrimary: '#F8FAFC',
      textSecondary: '#B6DDE8',
      textMuted: '#7EA6B2',
      borderColor: 'rgba(103, 232, 249, 0.18)',
    },
  },
  {
    id: 'emerald',
    name: 'أخضر رعاية',
    preview: ['#061A14', '#059669', '#6EE7B7', '#F59E0B'],
    colors: {
      primary: '#059669',
      primaryLight: '#6EE7B7',
      primarySoft: 'rgba(5, 150, 105, 0.2)',
      primarySofter: 'rgba(5, 150, 105, 0.12)',
      secondary: '#14B8A6',
      accentWarm: '#F59E0B',
      danger: '#DC2626',
      bgBase: '#061A14',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(6, 26, 20, 0.9)',
      textPrimary: '#F8FAFC',
      textSecondary: '#BFE9D7',
      textMuted: '#85B8A1',
      borderColor: 'rgba(110, 231, 183, 0.18)',
    },
  },
  {
    id: 'violet',
    name: 'بنفسجي احترافي',
    preview: ['#130B22', '#7C3AED', '#C4B5FD', '#F472B6'],
    colors: {
      primary: '#7C3AED',
      primaryLight: '#C4B5FD',
      primarySoft: 'rgba(124, 58, 237, 0.2)',
      primarySofter: 'rgba(124, 58, 237, 0.12)',
      secondary: '#F472B6',
      accentWarm: '#FCD34D',
      danger: '#FB7185',
      bgBase: '#130B22',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(19, 11, 34, 0.9)',
      textPrimary: '#FFFFFF',
      textSecondary: '#DCCBFF',
      textMuted: '#A995CF',
      borderColor: 'rgba(196, 181, 253, 0.18)',
    },
  },
  {
    id: 'graphite',
    name: 'جرافيت فاخر',
    preview: ['#0F1115', '#D97706', '#FCD34D', '#38BDF8'],
    colors: {
      primary: '#D97706',
      primaryLight: '#FCD34D',
      primarySoft: 'rgba(217, 119, 6, 0.2)',
      primarySofter: 'rgba(217, 119, 6, 0.12)',
      secondary: '#38BDF8',
      accentWarm: '#F97316',
      danger: '#EF4444',
      bgBase: '#0F1115',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(15, 17, 21, 0.9)',
      textPrimary: '#F9FAFB',
      textSecondary: '#D1D5DB',
      textMuted: '#9CA3AF',
      borderColor: 'rgba(252, 211, 77, 0.18)',
    },
  },
];

const getThemeById = (themeId?: string): AppTheme =>
  APP_THEMES.find((theme) => theme.id === themeId) || APP_THEMES[0];

const getInitialThemeId = (): ThemeId => {
  try {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || 'ruby';
    }
  } catch {}
  return 'ruby';
};

export const COLORS = { ...getThemeById(getInitialThemeId()).colors };

export const applyAppTheme = (themeId?: string): ThemeId => {
  const theme = getThemeById(themeId);
  Object.assign(COLORS, theme.colors);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    }
  } catch {}
  return theme.id;
};

export const getAppliedThemeId = (): ThemeId => {
  try {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || 'ruby';
    }
  } catch {}
  return 'ruby';
};

export const SIZES = Dimensions.get('window');
