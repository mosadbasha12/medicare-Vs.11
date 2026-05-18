import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { createPaidAppointment, getPlatformSettings } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';
import type { Currency } from '../types';

const TIME_SLOTS = [
  '09:00 ص', '09:30 ص', '10:00 ص', '10:30 ص',
  '11:00 ص', '11:30 ص', '12:00 م', '12:30 م',
  '01:00 م', '01:30 م', '02:00 م', '02:30 م',
  '03:00 م', '03:30 م', '04:00 م', '04:30 م',
];

const APPOINTMENT_TYPES = [
  { id: 'video', labelKey: 'videoCall', icon: 'video' },
  { id: 'clinic', labelKey: 'clinicAppointment', icon: 'hospital' },
];

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function getArabicDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthDates(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1));
}

function isSameDate(first: Date | null, second: Date): boolean {
  if (!first) return false;
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getYearOptions(currentYear: number): number[] {
  const start = currentYear - 2;
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function getMonthLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getShortDayName(date: Date): string {
  const name = DAY_NAMES[date.getDay()];
  if (name === 'الإثنين') return 'إث';
  if (name === 'الثلاثاء') return 'ثل';
  if (name === 'الأربعاء') return 'أر';
  if (name === 'الخميس') return 'خم';
  if (name === 'الجمعة') return 'جم';
  if (name === 'السبت') return 'سب';
  return 'أح';
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
  const { user, setUser } = useUser();
  const { t } = useLanguage();
  const doctorName = route?.params?.doctorName || t('doctor');
  const doctorId = route?.params?.doctorId || '';
  const doctorSpec = route?.params?.doctorSpec || '';
  const doctorPrice = Number(route?.params?.doctorPrice || 50);
  const doctorClinicPrice = Number(route?.params?.doctorClinicPrice || doctorPrice);
  const currency: Currency = user?.currency || route?.params?.currency || 'EGP';
  const currencySymbol = currency === 'EGP' ? 'ج.م' : '$';

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('video');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [loading, setLoading] = useState(false);
  const [commissionRate, setCommissionRate] = useState(5);

  const monthDates = getMonthDates(visibleMonth);
  const yearOptions = getYearOptions(visibleMonth.getFullYear());
  const bookingPrice = selectedType === 'clinic' ? doctorClinicPrice : doctorPrice;
  const platformFee = Number((bookingPrice * commissionRate / 100).toFixed(2));
  const doctorNet = Number((bookingPrice - platformFee).toFixed(2));

  React.useEffect(() => {
    getPlatformSettings().then((settings) => setCommissionRate(settings.commissionRate));
  }, []);

  const handleBook = async () => {
    if (!selectedDate) {
      showAlert(t('warning'), t('selectDateWarning'));
      return;
    }
    if (!selectedTime) {
      showAlert(t('warning'), t('selectTimeWarning'));
      return;
    }
    if (!user?.uid) {
      showAlert(t('error'), t('loginRequired'));
      return;
    }

    setLoading(true);
    const result = await createPaidAppointment({
      userId: user.uid,
      doctorId,
      doctorName,
      date: getArabicDate(selectedDate),
      time: selectedTime,
      type: selectedType === 'video' ? 'مكالمة فيديو' : 'زيارة عيادة',
      status: 'قادم',
      price: bookingPrice,
      currency,
    });

    setLoading(false);

    if (result.status === 'success') {
      setUser(result.updatedUser);
      showAlert(t('bookingSuccess'), `${t('bookingSuccess')} ${doctorName}\n${t('dateLabel')}: ${getArabicDate(selectedDate)}\n${t('timeLabel')}: ${selectedTime}\nتم خصم: ${bookingPrice} ${currencySymbol}\nرسوم التطبيق: ${result.platformFee} ${currencySymbol}`, () => {
        navigation.goBack();
      });
    } else if (result.status === 'insufficient_balance') {
      showAlert('الرصيد غير كافي', `رصيدك الحالي ${result.balance.toFixed(2)} ${currencySymbol}\nالمطلوب ${result.required.toFixed(2)} ${currencySymbol}\nاشحن حسابك أولاً عشان تقدر تدفع الحجز.`, () => {
        navigation.navigate('Payment');
      });
    } else if (result.status === 'doctor_not_found') {
      showAlert(t('error'), 'تعذر العثور على حساب الطبيب لتحويل صافي الحجز.');
    } else {
      showAlert(t('error'), t('bookingFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('bookAppointment')}</Text>
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
          <View style={styles.pricePanel}>
            <Text style={styles.priceTitle}>تفاصيل الدفع</Text>
            <Text style={styles.priceLine}>سعر {selectedType === 'clinic' ? 'زيارة العيادة' : 'الاستشارة'}: {bookingPrice.toFixed(2)} {currencySymbol}</Text>
            <Text style={styles.priceLine}>رسوم التطبيق ({commissionRate}%): {platformFee.toFixed(2)} {currencySymbol}</Text>
            <Text style={styles.priceLine}>صافي الطبيب: {doctorNet.toFixed(2)} {currencySymbol}</Text>
            <Text style={styles.feeNotice}>يتم خصم رسوم التطبيق من كل حجز أو استشارة حسب النسبة التي يحددها الأونر.</Text>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('appointmentType')}</Text>
        <View style={styles.typeRow}>
          {APPOINTMENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, selectedType === type.id && styles.typeCardSelected]}
              onPress={() => setSelectedType(type.id)}
            >
              <FontAwesome5 name={type.icon as any} size={24} color={selectedType === type.id ? COLORS.primaryLight : COLORS.textSecondary} />
              <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelSelected]}>{t(type.labelKey as any)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('chooseDate')}</Text>
        <GlassCard style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity style={styles.calendarArrow} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear() - 1, visibleMonth.getMonth(), 1))}>
              <Ionicons name="play-skip-forward" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.calendarArrow} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>{getMonthLabel(visibleMonth)}</Text>
            <TouchableOpacity style={styles.calendarArrow} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.calendarArrow} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear() + 1, visibleMonth.getMonth(), 1))}>
              <Ionicons name="play-skip-back" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearContainer}>
            {yearOptions.map((year) => {
              const selected = year === visibleMonth.getFullYear();
              return (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearOption, selected && styles.yearOptionSelected]}
                  onPress={() => setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))}
                >
                  <Text style={[styles.yearOptionText, selected && styles.yearOptionTextSelected]}>{year}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.dateContainer}>
            {monthDates.map((day) => {
              const selected = isSameDate(selectedDate, day);
              return (
                <TouchableOpacity
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  style={[styles.dateCard, selected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[styles.dateDayName, selected && styles.dateDayNameSelected]}>{getShortDayName(day)}</Text>
                  <Text style={[styles.dateDay, selected && styles.dateDaySelected]}>{day.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.selectedDateText}>{selectedDate ? getArabicDate(selectedDate) : t('chooseSuitableDay')}</Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('chooseTime')}</Text>
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
          <Text style={styles.bookBtnText}>{loading ? t('bookingLoading') : `${t('confirmBooking')} (${bookingPrice.toFixed(2)} ${currencySymbol})`}</Text>
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
  pricePanel: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.borderColor },
  priceTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  priceLine: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 3 },
  feeNotice: { color: COLORS.accentWarm, fontSize: 11, textAlign: 'right', marginTop: 8, lineHeight: 17 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'right' },
  typeRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 24 },
  typeCard: { flex: 1, paddingVertical: 20, borderRadius: 16, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center', gap: 8 },
  typeCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  typeLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: 'bold' },
  typeLabelSelected: { color: COLORS.primaryLight },
  calendarCard: { padding: 16, marginBottom: 24 },
  calendarHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarArrow: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor },
  calendarTitle: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  yearContainer: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 },
  yearOption: { minWidth: 68, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor },
  yearOptionSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  yearOptionText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: 'bold' },
  yearOptionTextSelected: { color: COLORS.primaryLight },
  dateContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  dateCard: { width: '13.2%', minWidth: 44, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center', gap: 4 },
  dateCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  dateDayName: { color: COLORS.textSecondary, fontSize: 11 },
  dateDayNameSelected: { color: COLORS.primaryLight },
  dateDay: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  dateDaySelected: { color: COLORS.primaryLight },
  selectedDateText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 14 },
  timeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  timeCard: { width: '30%', paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center' },
  timeCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  timeText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: 'bold' },
  timeTextSelected: { color: COLORS.primaryLight },
  bookBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  bookBtnDisabled: { opacity: 0.5 },
  bookBtnText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
});
