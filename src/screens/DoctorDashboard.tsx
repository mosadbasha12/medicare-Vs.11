import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform, TextInput } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getDoctorAppointments, getDoctorStats, updateAppointmentStatus, getUserPrescriptions, updateUserProfile, getPlatformSettings } from '../utils/localDataService';

function showConfirmation(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: onConfirm },
    ]);
  }
}

function showInfo(title: string, message: string) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function DoctorDashboard({ navigation }: any) {
  const { user, setUser } = useUser();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPatients: 0, upcoming: 0, completed: 0, cancelled: 0 });
  const [activeTab, setActiveTab] = useState<'appointments' | 'schedule' | 'prescriptions'>('appointments');
  const [loading, setLoading] = useState(true);
  const [videoPrice, setVideoPrice] = useState(String(user?.doctorVideoPrice ?? 60));
  const [clinicPrice, setClinicPrice] = useState(String(user?.doctorClinicPrice ?? user?.doctorVideoPrice ?? 60));
  const [commissionRate, setCommissionRate] = useState(5);

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    const [apts, st] = await Promise.all([
      getDoctorAppointments(user.uid),
      getDoctorStats(user.uid),
    ]);
    setAppointments(apts);
    setStats(st);
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getPlatformSettings().then((settings) => setCommissionRate(settings.commissionRate));
  }, []);

  const handleSavePrices = async () => {
    if (!user?.uid) return;
    const nextVideo = Number(videoPrice.replace(',', '.'));
    const nextClinic = Number(clinicPrice.replace(',', '.'));
    if (!Number.isFinite(nextVideo) || nextVideo < 0 || !Number.isFinite(nextClinic) || nextClinic < 0) {
      showInfo('تنبيه', 'اكتب أسعار صحيحة للاستشارة والحجز.');
      return;
    }
    const success = await updateUserProfile(user.uid, { doctorVideoPrice: nextVideo, doctorClinicPrice: nextClinic });
    if (success) {
      setUser({ ...user, doctorVideoPrice: nextVideo, doctorClinicPrice: nextClinic });
      showInfo('تم', 'تم تحديث أسعارك بنجاح.');
    } else {
      showInfo('خطأ', 'فشل تحديث الأسعار.');
    }
  };

  const handleStatusChange = async (aptId: string, patientId: string, newStatus: 'مكتمل' | 'ملغي') => {
    showConfirmation(
      newStatus === 'ملغي' ? 'إلغاء الموعد' : 'إكمال الموعد',
      newStatus === 'ملغي' ? 'هل أنت متأكد من إلغاء هذا الموعد؟' : 'هل تريد تأكيد إكمال هذا الموعد؟',
      async () => {
        const success = await updateAppointmentStatus(aptId, patientId, newStatus);
        if (success) {
          showInfo('تم', newStatus === 'ملغي' ? 'تم إلغاء الموعد' : 'تم إكمال الموعد بنجاح');
          fetchData();
        } else {
          showInfo('خطأ', 'فشل في تحديث الحالة');
        }
      }
    );
  };

  const handleSignOut = () => {
    showConfirmation('تسجيل خروج', 'هل تريد تسجيل الخروج؟', () => {
      setUser(null);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة تحكم الطبيب</Text>
        <TouchableOpacity onPress={() => navigation.navigate('DoctorSchedule')}>
          <Ionicons name="settings-outline" size={24} color={COLORS.primaryLight} />
        </TouchableOpacity>
      </View>

      <View style={styles.signOutRow}>
        <TouchableOpacity onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.signOutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.mainInfoCard}>
          <View style={styles.doctorInfoRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarEmoji}>👨‍⚕️</Text>
            </View>
            <View style={styles.doctorTexts}>
              <Text style={styles.docName}>{user?.name}</Text>
              <Text style={styles.docSpec}>{user?.specialty || 'طبيب عام'}</Text>
              <Text style={styles.docId}>رقم القيد: {user?.medicalId || 'غير محدد'}</Text>
              <Text style={styles.feeNotice}>التطبيق يخصم {commissionRate}% من كل استشارة أو حجز، وصافي المبلغ يضاف لرصيدك.</Text>
            </View>
          </View>
          <View style={styles.priceEditor}>
            <View style={styles.priceInputGroup}>
              <Text style={styles.priceLabel}>سعر الاستشارة</Text>
              <TextInput style={styles.priceInput} value={videoPrice} onChangeText={setVideoPrice} keyboardType="numeric" placeholder="60" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={styles.priceInputGroup}>
              <Text style={styles.priceLabel}>سعر زيارة العيادة</Text>
              <TextInput style={styles.priceInput} value={clinicPrice} onChangeText={setClinicPrice} keyboardType="numeric" placeholder="60" placeholderTextColor={COLORS.textMuted} />
            </View>
            <TouchableOpacity style={styles.savePriceBtn} onPress={handleSavePrices}>
              <Text style={styles.savePriceText}>حفظ الأسعار</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={styles.summaryRow}>
          <StatBox label="المرضى" val={stats.totalPatients.toString()} icon="users" color={COLORS.primaryLight} />
          <StatBox label="قادم" val={stats.upcoming.toString()} icon="calendar" color={COLORS.accentWarm} />
          <StatBox label="مكتمل" val={stats.completed.toString()} icon="check-circle" color={COLORS.secondary} />
          <StatBox label="ملغي" val={stats.cancelled.toString()} icon="times-circle" color={COLORS.danger} />
        </View>

        <View style={styles.tabRow}>
          {(['appointments', 'schedule', 'prescriptions'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'appointments' ? 'المواعيد' : tab === 'schedule' ? 'الجدول' : 'الوصفات'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        )}

        {!loading && activeTab === 'appointments' && (
          <>
            {appointments.length === 0 ? (
              <Text style={styles.emptyText}>لا توجد مواعيد حالياً</Text>
            ) : (
              appointments.map((apt) => (
                <GlassCard key={apt.id} style={styles.appointmentCard}>
                  <View style={styles.aptHeader}>
                    <View style={styles.patientInfo}>
                      <FontAwesome5 name="user" size={16} color={COLORS.primaryLight} />
                      <Text style={styles.patientName}>{apt.patientName}</Text>
                    </View>
                    <View style={[styles.statusBadge, getStatusStyle(apt.status)]}>
                      <Text style={styles.statusText}>{apt.status}</Text>
                    </View>
                  </View>
                  <View style={styles.aptDetails}>
                    <View style={styles.detailItem}>
                      <FontAwesome5 name="calendar" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>{apt.date}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <FontAwesome5 name="clock" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>{apt.time}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <FontAwesome5 name="video" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>{apt.type}</Text>
                    </View>
                  </View>
                  {apt.status === 'قادم' && (
                    <View style={styles.aptActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.completeBtn]}
                        onPress={() => handleStatusChange(apt.id, apt.patientId, 'مكتمل')}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                        <Text style={styles.actionBtnText}>إكمال</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.cancelBtn]}
                        onPress={() => handleStatusChange(apt.id, apt.patientId, 'ملغي')}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                        <Text style={styles.actionBtnText}>إلغاء</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => navigation.navigate('Chat', { doctorName: user?.name, doctorId: user?.uid })}
                      >
                        <Ionicons name="chatbubble-outline" size={18} color={COLORS.primaryLight} />
                      </TouchableOpacity>
                    </View>
                  )}
                </GlassCard>
              ))
            )}
          </>
        )}

        {!loading && activeTab === 'schedule' && (
          <View style={styles.schedulePlaceholder}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.placeholderText}>إدارة الجدول</Text>
            <Text style={styles.placeholderSubtext}>اضغط على أيقونة الإعدادات في الأعلى لتعديل جدولك</Text>
            <TouchableOpacity
              style={styles.openScheduleBtn}
              onPress={() => navigation.navigate('DoctorSchedule')}
            >
              <Text style={styles.openScheduleText}>فتح إدارة الجدول</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && activeTab === 'prescriptions' && (
          <PrescriptionsTab doctorId={user?.uid || ''} doctorName={user?.name || ''} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrescriptionsTab({ doctorId, doctorName }: { doctorId: string; doctorName: string }) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const allUsers = await (await import('../utils/localDataService')).getAllUsers();
      const allPrescs: any[] = [];
      for (const u of allUsers) {
        const data = await getUserPrescriptions(u.uid);
        for (const p of data) {
          if (p.doctor === doctorName) {
            allPrescs.push({ ...p, patientName: u.name });
          }
        }
      }
      setPrescriptions(allPrescs);
      setLoading(false);
    };
    fetch();
  }, [doctorId, doctorName]);

  if (loading) return <Text style={styles.loadingText}>جاري التحميل...</Text>;
  if (prescriptions.length === 0) return <Text style={styles.emptyText}>لا توجد وصفات مكتوبة</Text>;

  return (
    <>
      {prescriptions.map((p) => (
        <GlassCard key={p.id} style={styles.prescCard}>
          <View style={styles.prescRow}>
            <FontAwesome5 name="pills" size={20} color={COLORS.accentWarm} />
            <View style={styles.prescInfo}>
              <Text style={styles.prescMed}>{p.med}</Text>
              <Text style={styles.prescDosage}>{p.dosage}</Text>
            </View>
          </View>
          <Text style={styles.prescFooter}>المريض: {p.patientName || 'غير محدد'} • {p.date}</Text>
        </GlassCard>
      ))}
    </>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'قادم': return { backgroundColor: COLORS.accentWarm + '22' };
    case 'مكتمل': return { backgroundColor: COLORS.secondary + '22' };
    case 'ملغي': return { backgroundColor: 'rgba(227,26,26,0.2)' };
    default: return { backgroundColor: 'rgba(255,255,255,0.1)' };
  }
}

const StatBox = ({ label, val, icon, color }: any) => (
  <GlassCard style={styles.statBox}>
    <FontAwesome5 name={icon} size={18} color={color} />
    <Text style={styles.statVal}>{val}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </GlassCard>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  signOutRow: { paddingHorizontal: 24, paddingVertical: 8, flexDirection: 'row-reverse', justifyContent: 'flex-end' },
  signOutText: { color: COLORS.danger, fontSize: 13, fontWeight: 'bold', marginRight: 4 },
  content: { padding: 24, paddingBottom: 60 },
  mainInfoCard: { padding: 20, marginBottom: 24, backgroundColor: COLORS.primarySofter },
  doctorInfoRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatarBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.bgBase, justifyContent: 'center', alignItems: 'center', marginLeft: 16, borderWidth: 1, borderColor: COLORS.primaryLight },
  avatarEmoji: { fontSize: 32 },
  doctorTexts: { flex: 1, alignItems: 'flex-start' },
  docName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  docSpec: { color: COLORS.secondary, fontSize: 14, marginTop: 4, textAlign: 'right' },
  docId: { color: COLORS.textMuted, fontSize: 11, marginTop: 4, textAlign: 'right' },
  feeNotice: { color: COLORS.accentWarm, fontSize: 11, marginTop: 6, textAlign: 'right', lineHeight: 17 },
  priceEditor: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.borderColor, gap: 10 },
  priceInputGroup: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  priceLabel: { color: COLORS.textSecondary, fontSize: 12, flex: 1, textAlign: 'right' },
  priceInput: { width: 110, color: COLORS.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, textAlign: 'center' },
  savePriceBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  savePriceText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  statBox: { width: '22%', padding: 12, alignItems: 'center' },
  statVal: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginVertical: 6 },
  statLabel: { color: COLORS.textSecondary, fontSize: 10, textAlign: 'center' },
  tabRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 13 },
  tabTextActive: { color: '#FFF' },
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: COLORS.textSecondary, fontSize: 16 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
  appointmentCard: { padding: 16, marginBottom: 12 },
  aptHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  patientInfo: { flexDirection: 'row-reverse', alignItems: 'center' },
  patientName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginLeft: 8, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  aptDetails: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, marginBottom: 12 },
  detailItem: { flexDirection: 'row-reverse', alignItems: 'center' },
  detailText: { color: COLORS.textSecondary, fontSize: 12, marginRight: 6 },
  aptActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  actionBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, gap: 6 },
  completeBtn: { backgroundColor: COLORS.secondary },
  cancelBtn: { backgroundColor: COLORS.danger },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  chatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  schedulePlaceholder: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  placeholderText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  placeholderSubtext: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  openScheduleBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  openScheduleText: { color: '#FFF', fontWeight: 'bold' },
  prescCard: { padding: 16, marginBottom: 12 },
  prescRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  prescInfo: { flex: 1, marginLeft: 12 },
  prescMed: { color: COLORS.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  prescDosage: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  prescFooter: { color: COLORS.textMuted, fontSize: 11, borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 10 },
});
