import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { createUserResult, getAllUsers, getDoctorAppointments, getUserPrescriptions, getUserResults } from '../utils/localDataService';
import type { LabResult, Prescription } from '../types';

type RequestCategory = NonNullable<LabResult['category']>;

const categoryLabels: Record<RequestCategory, string> = {
  lab: 'تحليل',
  xray: 'أشعة',
  prescription: 'روشتة / ملف طبي',
};

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function PatientMedicalFileScreen({ navigation, route }: any) {
  const { user } = useUser();
  const patientId = route?.params?.patientId;
  const patientNameParam = route?.params?.patientName || 'المريض';
  const doctorId = route?.params?.doctorId || user?.uid;
  const [patientName, setPatientName] = useState(patientNameParam);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<LabResult[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [requestCategory, setRequestCategory] = useState<RequestCategory>('lab');
  const [requestName, setRequestName] = useState('');
  const [requestNotes, setRequestNotes] = useState('');

  const canManage = useMemo(() => user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'owner', [user?.role]);

  const loadFile = async () => {
    if (!patientId || !user?.uid || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [appointments, users, patientResults, patientPrescriptions] = await Promise.all([
      getDoctorAppointments(doctorId),
      getAllUsers(),
      getUserResults(patientId),
      getUserPrescriptions(patientId),
    ]);
    const patient = users.find((item) => item.uid === patientId);
    const linkedByBooking = appointments.some((apt) => apt.patientId === patientId && apt.status !== 'ملغي');
    const adminAccess = user.role === 'admin' || user.role === 'owner';

    setPatientName(patient?.name || patientNameParam);
    setHasAccess(linkedByBooking || adminAccess);
    setResults(patientResults);
    setPrescriptions(patientPrescriptions);
    setLoading(false);
  };

  useEffect(() => {
    loadFile();
  }, [patientId, doctorId, user?.uid]);

  const openMedicalFile = (item: LabResult) => {
    if (!item.fileData) {
      showMessage('تنبيه', 'هذا السجل طلب من الطبيب ولم يتم رفع ملف له حتى الآن.');
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const win = window.open();
      win?.document.write(`<iframe src="${item.fileData}" style="width:100%;height:100%;border:0"></iframe>`);
      return;
    }

    Linking.openURL(item.fileData).catch(() => showMessage('تنبيه', 'تعذر فتح الملف على هذا الجهاز.'));
  };

  const addMedicalRequest = async () => {
    const cleanName = requestName.trim();
    if (!cleanName) {
      showMessage('تنبيه', 'اكتب اسم التحليل أو الأشعة المطلوبة أولاً.');
      return;
    }

    const saved = await createUserResult({
      userId: patientId,
      name: cleanName,
      date: new Date().toLocaleDateString('ar-EG'),
      lab: `${categoryLabels[requestCategory]} مطلوب من الطبيب`,
      status: 'يحتاج مراجعة',
      category: requestCategory,
      doctorId: user?.uid,
      doctorName: user?.name || 'الطبيب',
      notes: requestNotes.trim(),
    });

    if (!saved) {
      showMessage('خطأ', 'تعذر حفظ الطلب في ملف المريض.');
      return;
    }

    setRequestName('');
    setRequestNotes('');
    await loadFile();
    showMessage('تم', 'تمت إضافة الطلب وسيظهر للمريض داخل نتائج التحاليل والملفات.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.loadingText}>جاري تحميل الملف الطبي...</Text>
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ملف المريض</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.blockedBox}>
          <Ionicons name="lock-closed-outline" size={42} color={COLORS.textMuted} />
          <Text style={styles.blockedTitle}>لا يمكن فتح الملف</Text>
          <Text style={styles.blockedText}>الملف الطبي يظهر للطبيب فقط بعد وجود حجز بينه وبين المريض.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ملف المريض الطبي</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.avatarBox}>
              <FontAwesome5 name="user-injured" size={22} color={COLORS.primaryLight} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.patientMeta}>متاح للطبيب لأن المريض لديه حجز مسجل معك.</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.requestCard}>
          <Text style={styles.sectionTitle}>طلب تحليل أو أشعة للمريض</Text>
          <View style={styles.categoryRow}>
            {(['lab', 'xray', 'prescription'] as RequestCategory[]).map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.categoryBtn, requestCategory === category && styles.categoryBtnActive]}
                onPress={() => setRequestCategory(category)}
              >
                <Text style={[styles.categoryText, requestCategory === category && styles.categoryTextActive]}>{categoryLabels[category]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={requestName}
            onChangeText={setRequestName}
            placeholder="مثال: CBC أو أشعة صدر"
            placeholderTextColor={COLORS.textMuted}
          />
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={requestNotes}
            onChangeText={setRequestNotes}
            placeholder="تعليمات للمريض أو ملاحظات للطبيب"
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={addMedicalRequest}>
            <Ionicons name="add-circle-outline" size={18} color="#FFF" />
            <Text style={styles.primaryBtnText}>إضافة الطلب لملف المريض</Text>
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.sectionTitle}>التحاليل والأشعة والملفات</Text>
        {results.length === 0 ? (
          <Text style={styles.emptyText}>لا توجد ملفات أو طلبات طبية حتى الآن.</Text>
        ) : (
          results.map((item) => (
            <TouchableOpacity key={item.id} style={styles.recordCard} onPress={() => openMedicalFile(item)}>
              <FontAwesome5 name={item.category === 'xray' ? 'x-ray' : item.category === 'prescription' ? 'file-prescription' : 'vial'} size={17} color={COLORS.primaryLight} />
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>{item.name}</Text>
                <Text style={styles.recordMeta}>{item.lab} • {item.date}</Text>
                {!!item.notes && <Text style={styles.recordNotes}>{item.notes}</Text>}
              </View>
              <View style={[styles.statusBadge, item.fileData ? styles.uploadedBadge : styles.requestBadge]}>
                <Text style={[styles.statusText, { color: item.fileData ? COLORS.secondary : COLORS.accentWarm }]}>
                  {item.fileData ? 'مرفوع' : 'مطلوب'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionTitle}>الأدوية المضافة للمريض</Text>
        {prescriptions.length === 0 ? (
          <Text style={styles.emptyText}>لا توجد وصفات محفوظة لهذا المريض.</Text>
        ) : (
          prescriptions.map((item) => (
            <View key={item.id} style={styles.recordCard}>
              <FontAwesome5 name="pills" size={17} color={COLORS.accentWarm} />
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>{item.med}</Text>
                <Text style={styles.recordMeta}>{item.dosage} • {item.frequency || item.date}</Text>
                {!!item.instructions && <Text style={styles.recordNotes}>{item.instructions}</Text>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  loadingText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 80, fontSize: 16 },
  content: { padding: 24, paddingBottom: 70 },
  summaryCard: { padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatarBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight + '55', alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1 },
  patientName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  patientMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'right' },
  requestCard: { padding: 16, marginBottom: 20 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 10, marginTop: 8 },
  categoryRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  categoryBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor },
  categoryBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold' },
  categoryTextActive: { color: '#FFF' },
  input: { color: COLORS.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12, marginBottom: 10, textAlign: 'right' },
  notesInput: { minHeight: 76, textAlignVertical: 'top' },
  primaryBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12 },
  primaryBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  recordCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 14, padding: 12, marginBottom: 10, gap: 10 },
  recordInfo: { flex: 1 },
  recordTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  recordMeta: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  recordNotes: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right', marginTop: 5, lineHeight: 17 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  uploadedBadge: { backgroundColor: COLORS.secondary + '22' },
  requestBadge: { backgroundColor: COLORS.accentWarm + '22' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 18, fontSize: 13 },
  blockedBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, marginTop: 90 },
  blockedTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', marginTop: 14 },
  blockedText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 8 },
});
