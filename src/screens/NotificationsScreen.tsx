import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { createVideoCallResponseNotification, dismissUserNotifications, getUserNotifications, subscribeNotificationSummary } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.uid) return;
      const data = await getUserNotifications(user.uid);
      setNotifications(data);
    };
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 5000);
    return () => clearInterval(timer);
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => subscribeNotificationSummary(user?.uid, (summary) => {
    setUnreadChats(summary.unreadChats);
    setUnreadTotal(summary.totalUnread);
  }), [user?.uid]);

  const dismissNotificationLocally = async (item: any) => {
    if (user?.uid && item.id) {
      await dismissUserNotifications(user.uid, [item.id]);
      setNotifications((current) => current.filter((notification) => notification.id !== item.id));
    }
  };

  const openVideoCallFromNotification = (item: any) => {
    navigation.navigate('VideoCall', {
      appointmentId: item.appointmentId,
      meetingUrl: item.meetingUrl,
      meetingRoom: item.meetingRoom || (item.appointmentId ? `medicare-${item.appointmentId}` : undefined),
      doctorName: item.callerName || item.participantName || 'مكالمة فيديو',
      participantName: item.callerName || item.participantName || 'مكالمة فيديو',
    });
  };

  const acceptVideoCall = async (item: any) => {
    await dismissNotificationLocally(item);
    if (item.callerId && user?.uid) {
      await createVideoCallResponseNotification({
        callerId: item.callerId,
        responderId: user.uid,
        responderName: user.name || 'المستخدم',
        appointmentId: item.appointmentId,
        accepted: true,
      });
    }
    openVideoCallFromNotification(item);
  };

  const rejectVideoCall = async (item: any) => {
    await dismissNotificationLocally(item);
    if (item.callerId && user?.uid) {
      await createVideoCallResponseNotification({
        callerId: item.callerId,
        responderId: user.uid,
        responderName: user.name || 'المستخدم',
        appointmentId: item.appointmentId,
        accepted: false,
      });
    }
  };

  const navigateFromNotification = async (item: any) => {
    await dismissNotificationLocally(item);

    if (item.targetScreen === 'VideoCall') {
      openVideoCallFromNotification(item);
      return;
    }
    if (item.chatId || item.targetScreen === 'ChatList') {
      navigation.navigate('ChatList');
      return;
    }
    if (item.targetScreen === 'Prescriptions' || item.targetScreen === 'Results' || item.targetScreen === 'DoctorDashboard') {
      navigation.navigate(item.targetScreen);
      return;
    }
    if (item.targetScreen === 'المواعيد') {
      navigation.navigate('MainTabs', { screen: 'المواعيد' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{unreadTotal > 0 ? `${t('notifications')} (${unreadTotal})` : t('notifications')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={[
          ...(unreadChats > 0 ? [{ id: 'unread_chats', type: 'unreadChats' }] : []),
          ...notifications,
        ]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('noNotifications')}</Text>
        }
        renderItem={({ item }) => (
          item.type === 'unreadChats' ? (
            <TouchableOpacity onPress={() => navigation.navigate('ChatList')}>
              <GlassCard style={[styles.card, styles.chatNoticeCard]}>
                <View style={[styles.iconBox, { backgroundColor: COLORS.danger + '22' }]}>
                  <FontAwesome5 name="comments" size={18} color={COLORS.danger} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.title}>رسائل جديدة</Text>
                  <Text style={styles.desc}>عندك {unreadChats} رسالة غير مقروءة. افتح المحادثات للرد.</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => item.action === 'video_call_invite' ? acceptVideoCall(item) : navigateFromNotification(item)}>
              <GlassCard style={[styles.card, !item.read && styles.unreadCard]}>
                <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
                  <FontAwesome5 name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={styles.textContainer}>
                  <View style={styles.row}>
                    <Text style={styles.title}>{item.title}</Text>
                    <View style={styles.timeWrap}>
                      {!item.read && <View style={styles.unreadDot} />}
                      <Text style={styles.time}>{item.time}</Text>
                    </View>
                  </View>
                  <Text style={styles.desc}>{item.desc}</Text>
                  {item.action === 'video_call_invite' && (
                    <View style={styles.callActionRow}>
                      <TouchableOpacity style={[styles.callActionBtn, styles.acceptCallBtn]} onPress={(event: any) => { event?.stopPropagation?.(); acceptVideoCall(item); }}>
                        <Ionicons name="videocam-outline" size={16} color="#FFF" />
                        <Text style={styles.callActionText}>قبول المكالمة</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.callActionBtn, styles.rejectCallBtn]} onPress={(event: any) => { event?.stopPropagation?.(); rejectVideoCall(item); }}>
                        <Ionicons name="close" size={16} color="#FFF" />
                        <Text style={styles.callActionText}>رفض</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </GlassCard>
            </TouchableOpacity>
          )
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  list: { padding: 24 },
  card: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 16, padding: 16 },
  unreadCard: { borderColor: COLORS.accentWarm + '66' },
  chatNoticeCard: { borderColor: COLORS.danger + '66' },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  textContainer: { flex: 1 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  timeWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  time: { color: COLORS.textMuted, fontSize: 11 },
  desc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  callActionRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  callActionBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  acceptCallBtn: { backgroundColor: COLORS.secondary },
  rejectCallBtn: { backgroundColor: COLORS.danger },
  callActionText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
