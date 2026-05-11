import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Platform, Linking } from 'react-native';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { FontAwesome5 } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { getUserAppointments, cancelAppointment } from '../utils/localDataService';
import type { Appointment } from '../types';

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

export default function AppointmentsScreen() {
  const { user } = useUser();
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const fetchAppointments = async () => {
    if (!user?.uid) return;
    const data = await getUserAppointments(user.uid);
    setAppointments(data);
  };

  useEffect(() => {
    fetchAppointments();
  }, [user?.uid]);

  const handleCancel = (aptId: string) => {
    showConfirmation('تأكيد الإلغاء', 'هل أنت متأكد من إلغاء هذا الموعد؟', async () => {
      const success = await cancelAppointment(aptId, user!.uid);
      if (success) {
        showInfo('تم', 'تم إلغاء الموعد بنجاح');
        fetchAppointments();
      } else {
        showInfo('خطأ', 'فشل في إلغاء الموعد');
      }
    });
  };

  const handleJoin = (item: Appointment) => {
    if (item.type === 'مكالمة فيديو') {
      const room = `https://meet.jit.si/medicare-${item.id}`;
      Linking.openURL(room);
      return;
    }
    showInfo('زيارة عيادة', `موعدك زيارة عيادة مع ${item.doctorName}\nالتاريخ: ${item.date}\nالوقت: ${item.time}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مواعيدي</Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا توجد مواعيد حالياً. احجز موعد من صفحة الأطباء</Text>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.topRow}>
               <Text style={styles.docName}>{item.doctorName}</Text>
               <View style={[styles.statusBadge, item.status === 'قادم' ? styles.statusActive : item.status === 'مكتمل' ? styles.statusDone : styles.statusCancelled]}>
                 <Text style={styles.statusText}>{item.status}</Text>
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
                 <Text style={styles.infoText}>{item.type}</Text>
               </View>
            </View>
            {item.status === 'قادم' && (
              <View style={styles.actionRow}>
                 <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
                   <Text style={styles.cancelText}>إلغاء الموعد</Text>
                 </TouchableOpacity>
                  <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(item)}>
                   <Text style={styles.joinText}>{item.type === 'مكالمة فيديو' ? 'انضمام الآن' : 'تفاصيل الزيارة'}</Text>
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
