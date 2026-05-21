import { Dimensions } from 'react-native';

export type ThemeId =
  | 'ruby'
  | 'ocean'
  | 'emerald'
  | 'violet'
  | 'graphite'
  | 'clinicalLight'
  | 'midnight'
  | 'tealCare'
  | 'roseQuartz'
  | 'amberClinic'
  | 'skyPulse'
  | 'navyGold';

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
  {
    id: 'clinicalLight',
    name: 'عيادة فاتحة',
    preview: ['#F8FAFC', '#2563EB', '#06B6D4', '#16A34A'],
    colors: {
      primary: '#2563EB',
      primaryLight: '#60A5FA',
      primarySoft: 'rgba(37, 99, 235, 0.16)',
      primarySofter: 'rgba(37, 99, 235, 0.09)',
      secondary: '#06B6D4',
      accentWarm: '#16A34A',
      danger: '#DC2626',
      bgBase: '#F8FAFC',
      bgCard: 'rgba(15, 23, 42, 0.055)',
      bgSidebar: 'rgba(248, 250, 252, 0.94)',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
      borderColor: 'rgba(37, 99, 235, 0.16)',
    },
  },
  {
    id: 'midnight',
    name: 'منتصف الليل',
    preview: ['#050816', '#2563EB', '#22D3EE', '#A78BFA'],
    colors: {
      primary: '#2563EB',
      primaryLight: '#93C5FD',
      primarySoft: 'rgba(37, 99, 235, 0.22)',
      primarySofter: 'rgba(37, 99, 235, 0.12)',
      secondary: '#22D3EE',
      accentWarm: '#A78BFA',
      danger: '#F43F5E',
      bgBase: '#050816',
      bgCard: 'rgba(255, 255, 255, 0.07)',
      bgSidebar: 'rgba(5, 8, 22, 0.91)',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      borderColor: 'rgba(147, 197, 253, 0.18)',
    },
  },
  {
    id: 'tealCare',
    name: 'تركواز رعاية',
    preview: ['#042F2E', '#0D9488', '#5EEAD4', '#A3E635'],
    colors: {
      primary: '#0D9488',
      primaryLight: '#5EEAD4',
      primarySoft: 'rgba(13, 148, 136, 0.2)',
      primarySofter: 'rgba(13, 148, 136, 0.12)',
      secondary: '#A3E635',
      accentWarm: '#FACC15',
      danger: '#F43F5E',
      bgBase: '#042F2E',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(4, 47, 46, 0.9)',
      textPrimary: '#F0FDFA',
      textSecondary: '#B6F2E9',
      textMuted: '#79CFC3',
      borderColor: 'rgba(94, 234, 212, 0.18)',
    },
  },
  {
    id: 'roseQuartz',
    name: 'روز كوارتز',
    preview: ['#221018', '#E11D48', '#FDA4AF', '#FBBF24'],
    colors: {
      primary: '#E11D48',
      primaryLight: '#FDA4AF',
      primarySoft: 'rgba(225, 29, 72, 0.2)',
      primarySofter: 'rgba(225, 29, 72, 0.12)',
      secondary: '#FB7185',
      accentWarm: '#FBBF24',
      danger: '#BE123C',
      bgBase: '#221018',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(34, 16, 24, 0.9)',
      textPrimary: '#FFF7F9',
      textSecondary: '#F7C3CD',
      textMuted: '#C98E9C',
      borderColor: 'rgba(253, 164, 175, 0.18)',
    },
  },
  {
    id: 'amberClinic',
    name: 'كهرماني دافئ',
    preview: ['#1C1205', '#F59E0B', '#FCD34D', '#10B981'],
    colors: {
      primary: '#F59E0B',
      primaryLight: '#FCD34D',
      primarySoft: 'rgba(245, 158, 11, 0.2)',
      primarySofter: 'rgba(245, 158, 11, 0.12)',
      secondary: '#10B981',
      accentWarm: '#FB923C',
      danger: '#DC2626',
      bgBase: '#1C1205',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(28, 18, 5, 0.9)',
      textPrimary: '#FFFBEB',
      textSecondary: '#FDECC8',
      textMuted: '#D7B16F',
      borderColor: 'rgba(252, 211, 77, 0.18)',
    },
  },
  {
    id: 'skyPulse',
    name: 'نبض سماوي',
    preview: ['#071826', '#0284C7', '#7DD3FC', '#F472B6'],
    colors: {
      primary: '#0284C7',
      primaryLight: '#7DD3FC',
      primarySoft: 'rgba(2, 132, 199, 0.2)',
      primarySofter: 'rgba(2, 132, 199, 0.12)',
      secondary: '#F472B6',
      accentWarm: '#34D399',
      danger: '#F43F5E',
      bgBase: '#071826',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(7, 24, 38, 0.9)',
      textPrimary: '#F0F9FF',
      textSecondary: '#BEE6FA',
      textMuted: '#83B8D3',
      borderColor: 'rgba(125, 211, 252, 0.18)',
    },
  },
  {
    id: 'navyGold',
    name: 'كحلي ذهبي',
    preview: ['#09111F', '#1D4ED8', '#F59E0B', '#E0F2FE'],
    colors: {
      primary: '#1D4ED8',
      primaryLight: '#93C5FD',
      primarySoft: 'rgba(29, 78, 216, 0.2)',
      primarySofter: 'rgba(29, 78, 216, 0.12)',
      secondary: '#F59E0B',
      accentWarm: '#FCD34D',
      danger: '#EF4444',
      bgBase: '#09111F',
      bgCard: 'rgba(255, 255, 255, 0.065)',
      bgSidebar: 'rgba(9, 17, 31, 0.9)',
      textPrimary: '#F8FAFC',
      textSecondary: '#C7D2FE',
      textMuted: '#94A3B8',
      borderColor: 'rgba(245, 158, 11, 0.2)',
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
