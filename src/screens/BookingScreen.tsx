import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { createAppointment } from '../utils/localDataService';

const TIME_SLOTS = [
  '09:00 ص', '09:30 ص', '10:00 ص', '10:30 ص',
  '11:00 ص', '11:30 ص', '12:00 م', '12:30 م',
  '01:00 م', '01:30 م', '02:00 م', '02:30 م',
  '03:00 م', '03:30 م', '04:00 م', '04:30 م',
];

const APPOINTMENT_TYPES = [
  { id: 'video', label: 'مكالمة فيديو', icon: 'video' },
  { id: 'clinic', label: 'زيارة العيادة', icon: 'hospital' },
];

function getArabicDate(date: Date): string {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getWeekDates(): { date: Date; label: string; dayName: string }[] {
  const dates = [];
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      date: d,
      dayName: dayNames[d.getDay()],
      label: `${d.getDate()}/${d.getMonth() + 1}`,
    });
  }
  return dates;
}

function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'حسناً', onPress: onOk }]);
  }
}

export default function BookingScreen({ navigation, route }: any) {
  const { user } = useUser();
  const doctorName = route?.params?.doctorName || 'الطبيب';
  const doctorId = route?.params?.doctorId || '';
  const doctorSpec = route?.params?.doctorSpec || '';
  const doctorPrice = route?.params?.doctorPrice || 50;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('video');
  const [loading, setLoading] = useState(false);

  const weekDates = getWeekDates();

  const handleBook = async () => {
    if (!selectedDate) {
      showAlert('تنبيه', 'يرجى اختيار التاريخ');
      return;
    }
    if (!selectedTime) {
      showAlert('تنبيه', 'يرجى اختيار الوقت');
      return;
    }
    if (!user?.uid) {
      showAlert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }

    setLoading(true);
    const success = await createAppointment({
      userId: user.uid,
      doctorId,
      doctorName,
      date: getArabicDate(selectedDate),
      time: selectedTime,
      type: selectedType === 'video' ? 'مكالمة فيديو' : 'زيارة عيادة',
      status: 'قادم',
    });

    setLoading(false);

    if (success) {
      showAlert('تم الحجز', `تم حجز موعدك مع ${doctorName}\nالتاريخ: ${getArabicDate(selectedDate)}\nالوقت: ${selectedTime}`, () => {
        navigation.goBack();
      });
    } else {
      showAlert('خطأ', 'فشل في إنشاء الموعد');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>حجز موعد</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.doctorCard}>
          <View style={styles.doctorRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarEmoji}>👨‍⚕️</Text>
            </View>
            <View style={styles.doctorInfo}>
              <Text style={styles.doctorName}>{doctorName}</Text>
              {doctorSpec ? <Text style={styles.doctorSpec}>{doctorSpec}</Text> : null}
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>نوع الموعد</Text>
        <View style={styles.typeRow}>
          {APPOINTMENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, selectedType === type.id && styles.typeCardSelected]}
              onPress={() => setSelectedType(type.id)}
            >
              <FontAwesome5 name={type.icon as any} size={24} color={selectedType === type.id ? COLORS.primaryLight : COLORS.textSecondary} />
              <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelSelected]}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>اختر التاريخ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll} contentContainerStyle={styles.dateContainer}>
          {weekDates.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.dateCard, selectedDate?.getTime() === item.date.getTime() && styles.dateCardSelected]}
              onPress={() => setSelectedDate(item.date)}
            >
              <Text style={[styles.dateDayName, selectedDate?.getTime() === item.date.getTime() && styles.dateDayNameSelected]}>{item.dayName}</Text>
              <Text style={[styles.dateDay, selectedDate?.getTime() === item.date.getTime() && styles.dateDaySelected]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>اختر الوقت</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => (
            <TouchableOpacity
              key={time}
              style={[styles.timeCard, selectedTime === time && styles.timeCardSelected]}
              onPress={() => setSelectedTime(time)}
            >
              <Text style={[styles.timeText, selectedTime === time && styles.timeTextSelected]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.bookBtn, (!selectedDate || !selectedTime || loading) && styles.bookBtnDisabled]}
          onPress={handleBook}
          disabled={!selectedDate || !selectedTime || loading}
        >
          <Text style={styles.bookBtnText}>{loading ? 'جاري الحجز...' : `تأكيد الحجز ${doctorPrice > 0 ? `(${doctorPrice}$)` : ''}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 40 },
  doctorCard: { marginBottom: 24, padding: 16 },
  doctorRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatarBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primarySofter, justifyContent: 'center', alignItems: 'center', marginLeft: 12, borderWidth: 1, borderColor: COLORS.primaryLight },
  avatarEmoji: { fontSize: 28 },
  doctorInfo: { flex: 1 },
  doctorName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  doctorSpec: { color: COLORS.secondary, fontSize: 14, marginTop: 4, textAlign: 'right' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'right' },
  typeRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 24 },
  typeCard: { flex: 1, paddingVertical: 20, borderRadius: 16, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center', gap: 8 },
  typeCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  typeLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: 'bold' },
  typeLabelSelected: { color: COLORS.primaryLight },
  dateScroll: { marginBottom: 24 },
  dateContainer: { gap: 12 },
  dateCard: { width: 72, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center', gap: 6 },
  dateCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  dateDayName: { color: COLORS.textSecondary, fontSize: 11 },
  dateDayNameSelected: { color: COLORS.primaryLight },
  dateDay: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  dateDaySelected: { color: COLORS.primaryLight },
  timeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  timeCard: { width: '30%', paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center' },
  timeCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  timeText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: 'bold' },
  timeTextSelected: { color: COLORS.primaryLight },
  bookBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  bookBtnDisabled: { opacity: 0.5 },
  bookBtnText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
});
