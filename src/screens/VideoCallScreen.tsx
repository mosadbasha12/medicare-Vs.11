import React, { useMemo } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { useUser } from '../context/UserContext';

const getRoomFromUrl = (meetingUrl?: string, fallbackRoom?: string) => {
  if (fallbackRoom) return fallbackRoom;
  if (!meetingUrl) return '';
  const clean = meetingUrl.split('#')[0].split('?')[0];
  return decodeURIComponent(clean.split('/').filter(Boolean).pop() || '');
};

export default function VideoCallScreen({ navigation, route }: any) {
  const { user } = useUser();
  const room = getRoomFromUrl(route?.params?.meetingUrl, route?.params?.meetingRoom) || `medicare-${route?.params?.appointmentId || Date.now()}`;
  const displayName = encodeURIComponent(user?.name || route?.params?.participantName || 'Medicare User');
  const subject = encodeURIComponent(route?.params?.doctorName ? `Medicare - ${route.params.doctorName}` : 'Medicare Video Call');
  const callUrl = useMemo(() => {
    const params = [
      'config.prejoinPageEnabled=false',
      'config.disableDeepLinking=true',
      'config.startWithAudioMuted=false',
      'config.startWithVideoMuted=false',
      `userInfo.displayName="${displayName}"`,
    ].join('&');
    return `https://meet.jit.si/${encodeURIComponent(room)}#${params}&interfaceConfig.APP_NAME="Medicare"&interfaceConfig.SUBJECT="${subject}"`;
  }, [displayName, room, subject]);

  const webCall = Platform.OS === 'web'
    ? React.createElement('iframe', {
        src: callUrl,
        title: 'Medicare video call',
        allow: 'camera; microphone; fullscreen; display-capture; autoplay',
        style: {
          width: '100%',
          height: '100%',
          border: 0,
          backgroundColor: '#000',
        },
      })
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextBox}>
          <Text style={styles.title}>مكالمة الفيديو</Text>
          <Text style={styles.subtitle}>{route?.params?.doctorName || route?.params?.participantName || 'جلسة Medicare'}</Text>
        </View>
        <TouchableOpacity style={[styles.headerBtn, styles.endBtn]} onPress={() => navigation.goBack()}>
          <Ionicons name="call" size={18} color="#FFF" />
          <Text style={styles.endText}>إنهاء</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.callFrame}>
        {Platform.OS === 'web' ? (
          webCall
        ) : (
          <View style={styles.unsupportedBox}>
            <Ionicons name="videocam-outline" size={42} color={COLORS.primaryLight} />
            <Text style={styles.unsupportedTitle}>مكالمة الفيديو تعمل داخل نسخة الويب</Text>
            <Text style={styles.unsupportedText}>افتح التطبيق من المتصفح للدخول للمكالمة داخل Medicare.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { height: 84, marginTop: 24, paddingHorizontal: 18, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerBtn: { minWidth: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor },
  headerTextBox: { flex: 1, alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  endBtn: { flexDirection: 'row-reverse', gap: 6, backgroundColor: COLORS.danger, borderColor: COLORS.danger, paddingHorizontal: 12 },
  endText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  callFrame: { flex: 1, marginHorizontal: 18, marginBottom: 18, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderColor, backgroundColor: '#000' },
  unsupportedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  unsupportedTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 14, textAlign: 'center' },
  unsupportedText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
