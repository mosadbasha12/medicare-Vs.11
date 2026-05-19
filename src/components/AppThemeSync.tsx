import { useEffect } from 'react';
import { Platform } from 'react-native';
import { subscribePlatformSettings } from '../utils/localDataService';
import { applyAppTheme, getAppliedThemeId } from '../theme';
import { useUser } from '../context/UserContext';

export default function AppThemeSync() {
  const { user } = useUser();

  useEffect(() => {
    const unsubscribe = subscribePlatformSettings((settings) => {
      const currentTheme = getAppliedThemeId();
      const nextTheme = applyAppTheme(user?.themeId || settings.themeId);
      if (Platform.OS === 'web' && currentTheme !== nextTheme && typeof window !== 'undefined') {
        window.location.reload();
      }
    });

    return unsubscribe;
  }, [user?.themeId]);

  return null;
}
