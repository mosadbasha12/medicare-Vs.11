import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform, TextInput, Modal } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { createPrescription, createVideoCallInviteNotification, getAllUsers, getDoctorAppointments, getDoctorStats, getUserPrescriptions, getUserResults, getUserTransactions, requestDoctorProfileUpdate, sortAppointmentsByWorkflow, subscribeDoctorAppointments, subscribePlatformSettings, subscribeUnreadChatCount, updateAppointmentStatus } from '../utils/localDataService';
import { addMedicineToCatalog, getCachedMedicineCatalog, removeMedicineFromCatalog, searchMedicineCatalog } from '../utils/medicineCatalog';
import type { LabResult, MedicineCatalogItem } from '../types';

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
  const [earnings, setEarnings] = useState({ balance: user?.balance ?? 0, totalNet: 0, completedNet: 0, pendingNet: 0 });
  const [unreadChats, setUnreadChats] = useState(0);
  const hasAdminAccess = (user?.adminPermissions?.length || 0) > 0;
  const currencySymbol = user?.currency === 'USD' ? '$' : 'ج.م';

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    const [apts, st, allUsers, transactions] = await Promise.all([
      getDoctorAppointments(user.uid),
      getDoctorStats(user.uid),
      getAllUsers(),
      getUserTransactions(user.uid),
    ]);
    const latestDoctor = allUsers.find((item) => item.uid === user.uid);
    const completedNet = apts
      .filter((apt) => apt.status === 'مكتمل')
      .reduce((sum, apt) => sum + Number(apt.doctorNet ?? ((apt.price ?? 0) * (1 - commissionRate / 100))), 0);
    const pendingNet = apts
      .filter((apt) => apt.status === 'قادم')
      .reduce((sum, apt) => sum + Number(apt.doctorNet ?? ((apt.price ?? 0) * (1 - commissionRate / 100))), 0);
    const transactionNet = transactions
      .filter((txn) => txn.type === 'in' && txn.provider === 'wallet')
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
    setAppointments(sortAppointmentsByWorkflow(apts));
    setStats(st);
    setEarnings({
      balance: Number(latestDoctor?.balance ?? user.balance ?? 0),
      totalNet: Number((transactionNet || completedNet + pendingNet).toFixed(2)),
      completedNet: Number(completedNet.toFixed(2)),
      pendingNet: Number(pendingNet.toFixed(2)),
    });
    setLoading(false);
  }, [commissionRate, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeDoctorAppointments(user.uid, (nextAppointments) => {
      setAppointments(sortAppointmentsByWorkflow(nextAppointments));
      const uniquePatients = new Set(nextAppointments.map((apt) => apt.patientId)).size;
      setStats({
        totalPatients: uniquePatients,
        upcoming: nextAppointments.filter((apt) => apt.status === 'قادم').length,
        completed: nextAppointments.filter((apt) => apt.status === 'مكتمل').length,
        cancelled: nextAppointments.filter((apt) => apt.status === 'ملغي').length,
      });
      setLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => subscribePlatformSettings((settings) => setCommissionRate(settings.commissionRate)), []);

  useEffect(() => subscribeUnreadChatCount(user?.uid, setUnreadChats), [user?.uid]);

  const handleSavePrices = async () => {
    if (!user?.uid) return;
    const nextVideo = Number(videoPrice.replace(',', '.'));
    const nextClinic = Number(clinicPrice.replace(',', '.'));
    if (!Number.isFinite(nextVideo) || nextVideo < 0 || !Number.isFinite(nextClinic) || nextClinic < 0) {
      showInfo('تنبيه', 'اكتب أسعار صحيحة للاستشارة والحجز.');
      return;
    }
    const success = await requestDoctorProfileUpdate(user, { doctorVideoPrice: nextVideo, doctorClinicPrice: nextClinic });
    if (success) {
      setUser({
        ...user,
        pendingProfileUpdate: {
          updates: { doctorVideoPrice: nextVideo, doctorClinicPrice: nextClinic },
          requestedAt: new Date().toISOString(),
          status: 'pending',
        },
      });
      showInfo('تم إرسال الطلب', 'تم إرسال تعديل الأسعار للأدمن/الأونر. الأسعار لن تتغير إلا بعد الموافقة.');
    } else {
      showInfo('خطأ', 'فشل إرسال طلب تعديل الأسعار.');
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

  const openVideoCall = async (apt: any) => {
    await createVideoCallInviteNotification({
      callerId: user!.uid,
      callerName: user?.name || 'الطبيب',
      recipientId: apt.patientId,
      appointmentId: apt.id,
      meetingUrl: apt.meetingUrl,
      meetingRoom: apt.meetingRoom || `medicare-${apt.id}`,
      participantName: apt.patientName || 'مريض',
    });
    navigation.navigate('VideoCall', {
      appointmentId: apt.id,
      meetingUrl: apt.meetingUrl,
      meetingRoom: apt.meetingRoom || `medicare-${apt.id}`,
      initiatorId: user!.uid,
      doctorName: apt.patientName || 'مريض',
      participantName: apt.patientName || 'مريض',
    });
  };

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs', { screen: 'حسابي' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة تحكم الطبيب</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'حسابي' })}>
          <Ionicons name="settings-outline" size={24} color={COLORS.primaryLight} />
        </TouchableOpacity>
      </View>

      <View style={styles.signOutRow}>
        {hasAdminAccess && (
          <TouchableOpacity style={styles.adminToolsBtn} onPress={() => navigation.navigate('Admin')}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primaryLight} />
            <Text style={styles.adminToolsText}>لوحة الأدمن</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.adminToolsBtn} onPress={() => navigation.navigate('ChatList')}>
          <Ionicons name="chatbubbles-outline" size={18} color={COLORS.primaryLight} />
          <Text style={styles.adminToolsText}>محادثات المرضى</Text>
          {unreadChats > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{unreadChats > 99 ? '99+' : unreadChats}</Text>
            </View>
          )}
        </TouchableOpacity>
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
              {user?.pendingProfileUpdate?.status === 'pending' && (
                <Text style={styles.pendingEditNotice}>لديك طلب تعديل بيانات قيد مراجعة الأدمن/الأونر.</Text>
              )}
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
              <Text style={styles.savePriceText}>إرسال طلب تعديل الأسعار</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <GlassCard style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <View>
              <Text style={styles.earningsTitle}>دخل الطبيب</Text>
              <Text style={styles.earningsHint}>الصافي بعد خصم نسبة التطبيق الحالية {commissionRate}%</Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={22} color={COLORS.accentWarm} />
            </View>
          </View>
          <View style={styles.earningsGrid}>
            <View style={styles.earningItem}>
              <Text style={styles.earningValue}>{earnings.balance.toFixed(2)} {currencySymbol}</Text>
              <Text style={styles.earningLabel}>الرصيد الحالي</Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={styles.earningValue}>{earnings.totalNet.toFixed(2)} {currencySymbol}</Text>
              <Text style={styles.earningLabel}>إجمالي الدخل</Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={styles.earningValue}>{earnings.completedNet.toFixed(2)} {currencySymbol}</Text>
              <Text style={styles.earningLabel}>مكتمل</Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={styles.earningValue}>{earnings.pendingNet.toFixed(2)} {currencySymbol}</Text>
              <Text style={styles.earningLabel}>قادم</Text>
            </View>
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
                  <View style={styles.aptActions}>
                    {apt.status === 'قادم' && (
                      <>
                        {apt.type === 'مكالمة فيديو' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.videoBtn]}
                            onPress={() => openVideoCall(apt)}
                          >
                            <Ionicons name="videocam-outline" size={16} color="#FFF" />
                            <Text style={styles.actionBtnText}>دخول الفيديو</Text>
                          </TouchableOpacity>
                        )}
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
                      </>
                    )}
                    <TouchableOpacity
                      style={styles.patientChatBtn}
                      onPress={() => navigation.navigate('Chat', { doctorName: apt.patientName || 'مريض', doctorId: user?.uid, recipientId: apt.patientId, chatId: `${apt.patientId}_${user?.uid}` })}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primaryLight} />
                      <Text style={styles.patientChatText}>دردشة مع المريض</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.patientFileBtn}
                      onPress={() => navigation.navigate('PatientMedicalFile', { patientId: apt.patientId, patientName: apt.patientName, doctorId: user?.uid })}
                    >
                      <Ionicons name="document-text-outline" size={18} color={COLORS.accentWarm} />
                      <Text style={styles.patientFileText}>الملف الطبي</Text>
                    </TouchableOpacity>
                  </View>
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
          <PrescriptionsTab doctorId={user?.uid || ''} doctorName={user?.name || ''} navigation={navigation} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrescriptionsTab({ doctorId, doctorName, navigation }: { doctorId: string; doctorName: string; navigation: any }) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientResults, setPatientResults] = useState<LabResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [medicineCatalog, setMedicineCatalog] = useState<MedicineCatalogItem[]>([]);
  const [customMedicineName, setCustomMedicineName] = useState('');
  const [customDosage, setCustomDosage] = useState('');
  const [customCatalogInstructions, setCustomCatalogInstructions] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineCatalogItem | null>(null);
  const [prescriptionDosage, setPrescriptionDosage] = useState('');
  const [prescriptionTimesPerDay, setPrescriptionTimesPerDay] = useState('');
  const [prescriptionIntervalHours, setPrescriptionIntervalHours] = useState('');
  const [prescriptionDurationDays, setPrescriptionDurationDays] = useState('');
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [medicineLoading, setMedicineLoading] = useState(false);

  const fetchPrescriptionsData = async () => {
    setLoading(true);
    const allUsers = await getAllUsers();
    const doctorAppointments = await getDoctorAppointments(doctorId);
    const patientMap = new Map<string, any>();

    for (const apt of doctorAppointments) {
      if (apt.status === 'ملغي') continue;
      const user = allUsers.find((u) => u.uid === apt.patientId);
      patientMap.set(apt.patientId, {
        uid: apt.patientId,
        name: apt.patientName || user?.name || 'مريض',
        email: user?.email,
        phone: user?.phone,
        lastAppointment: `${apt.date} • ${apt.time}`,
        status: apt.status,
      });
    }

    const allPrescs: any[] = [];
    for (const u of allUsers) {
      const data = await getUserPrescriptions(u.uid);
      for (const p of data) {
        if (p.doctor === doctorName) {
          allPrescs.push({ ...p, patientName: u.name });
        }
      }
    }

    const nextPatients = Array.from(patientMap.values());
    setPatients(nextPatients);
    setSelectedPatient((current: any | null) => current || nextPatients[0] || null);
    setPrescriptions(allPrescs);
    setLoading(false);
  };

  useEffect(() => {
    fetchPrescriptionsData();
  }, [doctorId, doctorName]);

  useEffect(() => {
    getCachedMedicineCatalog().then(setMedicineCatalog);
  }, []);

  useEffect(() => {
    const fetchPatientResults = async () => {
      if (!selectedPatient?.uid) {
        setPatientResults([]);
        return;
      }
      const results = await getUserResults(selectedPatient.uid);
      setPatientResults(results);
    };
    fetchPatientResults();
  }, [selectedPatient?.uid]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setMedicineLoading(true);
      const data = await searchMedicineCatalog(searchTerm);
      if (!cancelled) {
        setMedicineCatalog(data);
        setMedicineLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const openPrescriptionModal = (medicine: MedicineCatalogItem) => {
    if (!selectedPatient?.uid) {
      showInfo('تنبيه', 'اختر مريضاً أولاً من قائمة الحجوزات.');
      return;
    }
    setSelectedMedicine(medicine);
    setPrescriptionDosage(medicine.dosage === 'تحدد عند إضافة الدواء للمريض' ? '' : medicine.dosage);
    setPrescriptionTimesPerDay('');
    setPrescriptionIntervalHours('');
    setPrescriptionDurationDays('');
    setPrescriptionInstructions(medicine.instructions || '');
  };

  const addPrescriptionForPatient = async () => {
    if (!selectedPatient?.uid || !selectedMedicine) {
      showInfo('تنبيه', 'اختر المريض والدواء أولاً.');
      return;
    }

    const times = Math.max(1, Number(prescriptionTimesPerDay.replace(',', '.')) || 1);
    const intervalHours = Math.max(1, Number(prescriptionIntervalHours.replace(',', '.')) || 0);
    const days = Math.max(1, Number(prescriptionDurationDays.replace(',', '.')) || 1);
    if (!prescriptionTimesPerDay.trim() || !prescriptionIntervalHours.trim() || !prescriptionDurationDays.trim()) {
      showInfo('تنبيه', 'حدد عدد المرات، والفاصل بالساعات، ومدة العلاج قبل إضافة الدواء للمريض.');
      return;
    }
    const dosage = prescriptionDosage.trim() || 'جرعة يحددها الطبيب';
    const instructions = prescriptionInstructions.trim() || selectedMedicine.instructions || 'حسب تعليمات الطبيب.';
    const totalDoses = times * days;
    const saved = await createPrescription({
      userId: selectedPatient.uid,
      med: selectedMedicine.med,
      dosage,
      doctor: doctorName,
      date: new Date().toLocaleDateString('ar-EG'),
      frequency: `${times} مرة يومياً • كل ${intervalHours} ساعة • لمدة ${days} يوم`,
      durationDays: days,
      timesPerDay: times,
      instructions,
      startDate: new Date().toISOString(),
      totalDoses,
      takenDoses: 0,
    });

    if (saved) {
      showInfo('تم', `تمت إضافة ${selectedMedicine.med} إلى وصفات ${selectedPatient.name}.`);
      setSelectedMedicine(null);
      setPrescriptionDosage('');
      setPrescriptionTimesPerDay('');
      setPrescriptionIntervalHours('');
      setPrescriptionDurationDays('');
      setPrescriptionInstructions('');
      fetchPrescriptionsData();
    } else {
      showInfo('خطأ', 'تعذر حفظ الوصفة للمريض.');
    }
  };

  const addCustomMedicineToCatalog = async () => {
    const cleanName = customMedicineName.trim();
    if (cleanName.length < 3) {
      showInfo('تنبيه', 'اكتب اسم الدواء قبل إضافته للكتالوج.');
      return;
    }
    const nextCatalog = await addMedicineToCatalog({
      med: cleanName,
      dosage: customDosage.trim() || 'تحدد عند إضافة الدواء للمريض',
      timesPerDay: 1,
      durationDays: 1,
      instructions: customCatalogInstructions.trim() || 'تحدد التعليمات حسب حالة المريض.',
      source: 'local',
    });
    setMedicineCatalog(nextCatalog);
    setCustomMedicineName('');
    setCustomDosage('');
    setCustomCatalogInstructions('');
    showInfo('تم', 'تمت إضافة الدواء إلى الكتالوج. يمكنك الآن إضافته للمريض وتحديد الجرعة المناسبة.');
  };

  const deleteMedicineFromCatalog = (medicine: MedicineCatalogItem) => {
    showConfirmation('حذف دواء من الكتالوج', `هل تريد حذف ${medicine.med} من كتالوج الأدوية؟`, async () => {
      const nextCatalog = await removeMedicineFromCatalog(medicine.med);
      setMedicineCatalog(nextCatalog);
    });
  };

  const openMedicalFile = (item: LabResult) => {
    if (!item.fileData) {
      showInfo('تنبيه', 'لا يوجد ملف مرفق لهذا السجل.');
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const win = window.open();
      win?.document.write(`<iframe src="${item.fileData}" style="width:100%;height:100%;border:0"></iframe>`);
    } else {
      showInfo('تنبيه', 'فتح الملفات متاح حالياً على نسخة الويب.');
    }
  };

  if (loading) return <Text style={styles.loadingText}>جاري التحميل...</Text>;

  return (
    <>
      <Text style={styles.panelTitle}>اختر المريض من حجوزاتك</Text>
      {patients.length === 0 ? (
        <Text style={styles.emptyText}>لا يوجد مرضى مرتبطين بحجوزات حالياً</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patientChips}>
          {patients.map((patient) => {
            const selected = selectedPatient?.uid === patient.uid;
            return (
              <TouchableOpacity key={patient.uid} style={[styles.patientChip, selected && styles.patientChipActive]} onPress={() => setSelectedPatient(patient)}>
                <FontAwesome5 name="user-injured" size={14} color={selected ? COLORS.bgBase : COLORS.primaryLight} />
                <Text style={[styles.patientChipText, selected && styles.patientChipTextActive]}>{patient.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selectedPatient && (
        <GlassCard style={styles.patientFileCard}>
          <Text style={styles.panelTitle}>ملف المريض: {selectedPatient.name}</Text>
          <Text style={styles.patientMeta}>آخر حجز: {selectedPatient.lastAppointment} • الحالة: {selectedPatient.status}</Text>
          <Text style={styles.patientMeta}>الهاتف: {selectedPatient.phone || 'غير مسجل'} • البريد: {selectedPatient.email || 'غير مسجل'}</Text>
          <TouchableOpacity
            style={styles.openFullFileBtn}
            onPress={() => navigation.navigate('PatientMedicalFile', { patientId: selectedPatient.uid, patientName: selectedPatient.name, doctorId })}
          >
            <Ionicons name="document-text-outline" size={17} color={COLORS.bgBase} />
            <Text style={styles.openFullFileText}>فتح الملف الطبي الكامل وطلب تحاليل</Text>
          </TouchableOpacity>
          <Text style={styles.subPanelTitle}>التحاليل والأشعة والملفات المرفوعة</Text>
          {patientResults.length === 0 ? (
            <Text style={styles.emptyInline}>لا توجد ملفات طبية مرفوعة لهذا المريض.</Text>
          ) : (
            patientResults.map((result) => (
              <TouchableOpacity key={result.id} style={styles.resultMiniCard} onPress={() => openMedicalFile(result)}>
                <FontAwesome5 name={result.category === 'xray' ? 'x-ray' : result.category === 'prescription' ? 'file-prescription' : 'vial'} size={16} color={COLORS.primaryLight} />
                <View style={styles.resultMiniInfo}>
                  <Text style={styles.resultMiniName}>{result.name}</Text>
                  <Text style={styles.resultMiniMeta}>{result.lab} • {result.date}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </GlassCard>
      )}

      <GlassCard style={styles.medicineTableCard}>
        <Text style={styles.panelTitle}>كتالوج الأدوية والجرعات</Text>
        <Text style={styles.catalogHint}>إضافة الدواء هنا تكون للكتالوج فقط. عند إضافة الدواء للمريض ستظهر نافذة لتحديد الجرعة والتكرار حسب الحالة.</Text>
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="ابحث باسم الدواء أو الجرعة"
          placeholderTextColor={COLORS.textMuted}
        />
        {medicineLoading && <Text style={styles.catalogHint}>جاري تحديث نتائج الأدوية...</Text>}
        <View style={styles.customMedicineBox}>
          <Text style={styles.subPanelTitle}>إضافة دواء جديد إلى الكتالوج</Text>
          <TextInput
            style={styles.searchInput}
            value={customMedicineName}
            onChangeText={setCustomMedicineName}
            placeholder="اسم الدواء"
            placeholderTextColor={COLORS.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            value={customDosage}
            onChangeText={setCustomDosage}
            placeholder="وصف عام اختياري: مثال أقراص 500mg"
            placeholderTextColor={COLORS.textMuted}
          />
          <TextInput
            style={styles.instructionsInput}
            value={customCatalogInstructions}
            onChangeText={setCustomCatalogInstructions}
            placeholder="ملاحظات عامة للكتالوج اختيارية"
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <TouchableOpacity style={styles.customMedBtn} onPress={addCustomMedicineToCatalog}>
            <Ionicons name="checkmark-circle-outline" size={17} color="#FFF" />
            <Text style={styles.customMedText}>إضافة الدواء للكتالوج</Text>
          </TouchableOpacity>
        </View>
        {medicineCatalog.map((medicine) => (
          <View key={medicine.med} style={styles.medicineRow}>
            <View style={styles.medicineInfo}>
              <Text style={styles.prescMed}>{medicine.med}</Text>
              <Text style={styles.prescDosage}>{medicine.dosage}</Text>
              <Text style={styles.medicineInstructions}>{medicine.instructions}{medicine.source && medicine.source !== 'local' ? ` • المصدر: ${medicine.source}` : ''}</Text>
            </View>
            <TouchableOpacity style={styles.assignMedBtn} onPress={() => openPrescriptionModal(medicine)}>
              <Ionicons name="add-circle" size={16} color={COLORS.bgBase} />
              <Text style={styles.assignMedText}>إضافة للمريض</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteMedBtn} onPress={() => deleteMedicineFromCatalog(medicine)}>
              <Ionicons name="trash-outline" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}
      </GlassCard>

      <Modal visible={Boolean(selectedMedicine)} transparent animationType="fade" onRequestClose={() => setSelectedMedicine(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.prescriptionModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedMedicine(null)}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <View style={styles.modalTitleBox}>
                <Text style={styles.modalTitle}>إضافة دواء للمريض</Text>
                <Text style={styles.modalSubTitle}>{selectedMedicine?.med} • {selectedPatient?.name}</Text>
              </View>
            </View>

            <TextInput
              style={styles.searchInput}
              value={prescriptionDosage}
              onChangeText={setPrescriptionDosage}
              placeholder="الجرعة: مثال قرص بعد الأكل"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.customDoseRow}>
              <View style={styles.doseField}>
                <Text style={styles.doseLabel}>عدد الجرعات في اليوم</Text>
                <TextInput
                  style={[styles.searchInput, styles.customDoseInput]}
                  value={prescriptionTimesPerDay}
                  onChangeText={setPrescriptionTimesPerDay}
                  placeholder="مثال: 3"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.doseField}>
                <Text style={styles.doseLabel}>الفاصل بين الجرعات بالساعات</Text>
                <TextInput
                  style={[styles.searchInput, styles.customDoseInput]}
                  value={prescriptionIntervalHours}
                  onChangeText={setPrescriptionIntervalHours}
                  placeholder="مثال: 8"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Text style={styles.doseLabel}>مدة العلاج بالأيام</Text>
            <TextInput
              style={styles.searchInput}
              value={prescriptionDurationDays}
              onChangeText={setPrescriptionDurationDays}
              placeholder="مثال: 3"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.instructionsInput}
              value={prescriptionInstructions}
              onChangeText={setPrescriptionInstructions}
              placeholder="تعليمات خاصة للمريض"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.confirmPrescriptionBtn} onPress={addPrescriptionForPatient}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.confirmPrescriptionText}>إضافة الدواء للمريض المحدد</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={styles.panelTitle}>وصفات كتبتها مؤخراً</Text>
      {prescriptions.length === 0 ? (
        <Text style={styles.emptyText}>لا توجد وصفات مكتوبة</Text>
      ) : (
        prescriptions.map((p) => (
          <GlassCard key={p.id} style={styles.prescCard}>
            <View style={styles.prescRow}>
              <FontAwesome5 name="pills" size={20} color={COLORS.accentWarm} />
              <View style={styles.prescInfo}>
                <Text style={styles.prescMed}>{p.med}</Text>
                <Text style={styles.prescDosage}>{p.dosage} {p.frequency ? `• ${p.frequency}` : ''}</Text>
              </View>
            </View>
            <Text style={styles.prescFooter}>المريض: {p.patientName || 'غير محدد'} • {p.date}</Text>
          </GlassCard>
        ))
      )}
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
  signOutRow: { paddingHorizontal: 24, paddingVertical: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  adminToolsBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight + '55', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, gap: 6 },
  adminToolsText: { color: COLORS.primaryLight, fontSize: 13, fontWeight: 'bold' },
  chatBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  chatBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
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
  pendingEditNotice: { color: COLORS.accentWarm, fontSize: 11, marginTop: 6, textAlign: 'right', lineHeight: 17, fontWeight: 'bold' },
  priceEditor: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.borderColor, gap: 10 },
  priceInputGroup: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  priceLabel: { color: COLORS.textSecondary, fontSize: 12, flex: 1, textAlign: 'right' },
  priceInput: { width: 110, color: COLORS.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, textAlign: 'center' },
  savePriceBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  savePriceText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  earningsCard: { padding: 16, marginBottom: 24 },
  earningsHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  earningsTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  earningsHint: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3, textAlign: 'right' },
  walletIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.accentWarm + '22', justifyContent: 'center', alignItems: 'center' },
  earningsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  earningItem: { width: '48%', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12 },
  earningValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  earningLabel: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'right', marginTop: 4 },
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
  videoBtn: { backgroundColor: COLORS.primary },
  completeBtn: { backgroundColor: COLORS.secondary },
  cancelBtn: { backgroundColor: COLORS.danger },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  chatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  patientChatBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight + '55' },
  patientChatText: { color: COLORS.primaryLight, fontSize: 12, fontWeight: 'bold' },
  patientFileBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.accentWarm + '18', borderWidth: 1, borderColor: COLORS.accentWarm + '55' },
  patientFileText: { color: COLORS.accentWarm, fontSize: 12, fontWeight: 'bold' },
  schedulePlaceholder: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  placeholderText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  placeholderSubtext: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  openScheduleBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  openScheduleText: { color: '#FFF', fontWeight: 'bold' },
  panelTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  subPanelTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginTop: 14, marginBottom: 8 },
  patientChips: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 },
  patientChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  patientChipActive: { backgroundColor: COLORS.accentWarm, borderColor: COLORS.accentWarm },
  patientChipText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: 'bold' },
  patientChipTextActive: { color: COLORS.bgBase },
  patientFileCard: { padding: 16, marginBottom: 16 },
  patientMeta: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 3 },
  openFullFileBtn: { marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.accentWarm, borderRadius: 12, paddingVertical: 10 },
  openFullFileText: { color: COLORS.bgBase, fontSize: 12, fontWeight: 'bold' },
  emptyInline: { color: COLORS.textMuted, fontSize: 12, textAlign: 'right', marginTop: 8 },
  resultMiniCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 10, marginTop: 8, gap: 10 },
  resultMiniInfo: { flex: 1 },
  resultMiniName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  resultMiniMeta: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'right', marginTop: 3 },
  medicineTableCard: { padding: 16, marginBottom: 18 },
  catalogHint: { color: COLORS.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'right', marginBottom: 10 },
  searchInput: { color: COLORS.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12, marginBottom: 10, textAlign: 'right' },
  instructionsInput: { minHeight: 58, color: COLORS.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12, marginBottom: 12, textAlign: 'right', textAlignVertical: 'top' },
  customMedicineBox: { borderTopWidth: 1, borderTopColor: COLORS.borderColor, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor, paddingVertical: 12, marginBottom: 6 },
  customDoseRow: { flexDirection: 'row-reverse', gap: 10 },
  doseField: { flex: 1 },
  doseLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 },
  customDoseInput: { flex: 1 },
  customMedBtn: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 11 },
  customMedText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  medicineRow: { flexDirection: 'row-reverse', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingVertical: 12, gap: 10 },
  medicineInfo: { flex: 1 },
  medicineInstructions: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4, textAlign: 'right' },
  assignMedBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: COLORS.accentWarm, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  assignMedText: { color: COLORS.bgBase, fontSize: 12, fontWeight: 'bold' },
  deleteMedBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  prescriptionModal: { width: '100%', maxWidth: 560, backgroundColor: COLORS.bgBase, borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 18, padding: 16 },
  modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalCloseBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor },
  modalTitleBox: { flex: 1, alignItems: 'flex-start' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  modalSubTitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'right' },
  confirmPrescriptionBtn: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12 },
  confirmPrescriptionText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  prescCard: { padding: 16, marginBottom: 12 },
  prescRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  prescInfo: { flex: 1, marginLeft: 12 },
  prescMed: { color: COLORS.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  prescDosage: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  prescFooter: { color: COLORS.textMuted, fontSize: 11, borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 10 },
});
