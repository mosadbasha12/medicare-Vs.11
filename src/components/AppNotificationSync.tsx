import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { getUserNotifications } from '../utils/localDataService';

export default function AppNotificationSync() {
  const { user } = useUser();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
      return undefined;
    }

    let disposed = false;
    const shownKey = `@browser_notified_${user.uid}`;

    const sync = async () => {
      if (disposed || Notification.permission !== 'granted') return;
      const notifications = await getUserNotifications(user.uid);
      const stored = await AsyncStorage.getItem(shownKey);
      const shownIds = new Set<string>(stored ? JSON.parse(stored) : []);

      if (!initializedRef.current) {
        notifications.forEach((item) => shownIds.add(item.id));
        initializedRef.current = true;
        await AsyncStorage.setItem(shownKey, JSON.stringify(Array.from(shownIds).slice(-300)));
        return;
      }

      const fresh = notifications.filter((item) => !item.read && !shownIds.has(item.id));
      fresh.forEach((item) => {
        shownIds.add(item.id);
        const notification = new Notification(item.title || 'Medicare', {
          body: item.desc || 'لديك تنبيه جديد',
          tag: item.id,
        });
        notification.onclick = () => {
          window.focus();
        };
      });

      if (fresh.length > 0) {
        await AsyncStorage.setItem(shownKey, JSON.stringify(Array.from(shownIds).slice(-300)));
      }
    };

    sync();
    const timer = setInterval(sync, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [user?.uid]);

  return null;
}
