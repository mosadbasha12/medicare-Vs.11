import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Platform } from 'react-native';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { FontAwesome5 } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { cancelAppointment, createVideoCallInviteNotification, sortAppointmentsByWorkflow, subscribeUserAppointments } from '../utils/localDataService';
import type { Appointment } from '../types';
import { useLanguage } from '../context/LanguageContext';

function showConfirmation(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function showInfo(title: string, message: string) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message);
  }
}

export default function AppointmentsScreen({ navigation }: any) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeUserAppointments(user.uid, (data) => {
      setAppointments(sortAppointmentsByWorkflow(data));
    });
  }, [user?.uid]);

  const handleCancel = (aptId: string) => {
    showConfirmation(t('cancelConfirmTitle'), t('cancelConfirmMessage'), async () => {
      const success = await cancelAppointment(aptId, user!.uid);
      if (success) {
        showInfo(t('done'), t('appointmentCancelled'));
      } else {
        showInfo(t('error'), t('appointmentCancelFailed'));
      }
    });
  };

  const handleJoin = async (item: Appointment) => {
    if (item.type === 'مكالمة فيديو') {
      await createVideoCallInviteNotification({
        callerId: user!.uid,
        callerName: user?.name || 'المريض',
        recipientId: item.doctorId,
        appointmentId: item.id,
        meetingUrl: item.meetingUrl,
        meetingRoom: item.meetingRoom || `medicare-${item.id}`,
        participantName: item.doctorName,
      });
      navigation.navigate('VideoCall', {
        appointmentId: item.id,
        meetingUrl: item.meetingUrl,
        meetingRoom: item.meetingRoom || `medicare-${item.id}`,
        doctorName: item.doctorName,
      });
      return;
    }
    showInfo(t('clinicVisit'), `${t('clinicVisitDetails')} ${item.doctorName}\n${t('dateLabel')}: ${item.date}\n${t('timeLabel')}: ${item.time}`);
  };

  const getStatusLabel = (status: Appointment['status']) => {
    if (status === 'قادم') return t('upcoming');
    if (status === 'مكتمل') return t('completed');
    return t('cancelled');
  };

  const getTypeLabel = (type: Appointment['type']) => type === 'مكالمة فيديو' ? t('videoCall') : t('clinicVisit');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('myAppointments')}</Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('noAppointments')}</Text>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.topRow}>
               <Text style={styles.docName}>{item.doctorName}</Text>
               <View style={[styles.statusBadge, item.status === 'قادم' ? styles.statusActive : item.status === 'مكتمل' ? styles.statusDone : styles.statusCancelled]}>
                 <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
               </View>
            </View>
            <View style={styles.infoRow}>
               <View style={styles.infoItem}>
                 <FontAwesome5 name="calendar" size={14} color={COLORS.primaryLight} />
                 <Text style={styles.infoText}>{item.date}</Text>
               </View>
               <View style={styles.infoItem}>
                 <FontAwesome5 name="clock" size={14} color={COLORS.accentWarm} />
                 <Text style={styles.infoText}>{item.time}</Text>
               </View>
               <View style={styles.infoItem}>
                 <FontAwesome5 name="video" size={14} color={COLORS.secondary} />
                 <Text style={styles.infoText}>{getTypeLabel(item.type)}</Text>
               </View>
            </View>
            {item.status === 'قادم' && (
              <View style={styles.actionRow}>
                 <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
                   <Text style={styles.cancelText}>{t('cancelAppointment')}</Text>
                 </TouchableOpacity>
                  <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(item)}>
                   <Text style={styles.joinText}>{item.type === 'مكالمة فيديو' ? t('joinNow') : t('visitDetails')}</Text>
                 </TouchableOpacity>
              </View>
            )}
          </GlassCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { paddingHorizontal: 24, paddingVertical: 20, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', textAlign: 'right' },
  list: { paddingHorizontal: 24, paddingBottom: 100 },
  card: { marginBottom: 16 },
  topRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  docName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: COLORS.primarySoft },
  statusDone: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  statusCancelled: { backgroundColor: 'rgba(227, 26, 26, 0.2)' },
  statusText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 16 },
  infoItem: { flexDirection: 'row-reverse', alignItems: 'center' },
  infoText: { color: COLORS.textSecondary, fontSize: 12, marginRight: 6 },
  actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center', marginLeft: 8 },
  cancelText: { color: COLORS.danger, fontWeight: 'bold' },
  joinBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', marginRight: 8 },
  joinText: { color: COLORS.textPrimary, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
