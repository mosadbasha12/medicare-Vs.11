import { useEffect } from 'react';
import { subscribePlatformSettings } from '../utils/localDataService';
import { applyAppTheme } from '../theme';
import { useUser } from '../context/UserContext';

export default function AppThemeSync() {
  const { user } = useUser();

  useEffect(() => {
    const unsubscribe = subscribePlatformSettings((settings) => {
      applyAppTheme(user?.themeId || settings.themeId);
    });

    return unsubscribe;
  }, [user?.themeId]);

  return null;
}
