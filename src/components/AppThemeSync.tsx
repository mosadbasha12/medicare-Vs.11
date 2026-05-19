import { useEffect } from 'react';
import { Platform } from 'react-native';
import { subscribePlatformSettings } from '../utils/localDataService';
import { applyAppTheme, getAppliedThemeId } from '../theme';

export default function AppThemeSync() {
  useEffect(() => {
    const unsubscribe = subscribePlatformSettings((settings) => {
      const currentTheme = getAppliedThemeId();
      const nextTheme = applyAppTheme(settings.themeId);
      if (Platform.OS === 'web' && currentTheme !== nextTheme && typeof window !== 'undefined') {
        window.location.reload();
      }
    });

    return unsubscribe;
  }, []);

  return null;
}
