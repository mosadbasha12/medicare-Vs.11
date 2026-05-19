import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { getAllDoctors, getDoctorStats } from '../utils/localDataService';
import type { Doctor } from '../types';
import { useLanguage } from '../context/LanguageContext';

export default function DoctorProfileScreen({ navigation, route }: any) {
  const { t } = useLanguage();
  const doctorId = route.params?.doctorId;
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [stats, setStats] = useState({ totalPatients: 0, completed: 0 });

  useEffect(() => {
    const fetchDoctor = async () => {
      const doctors = await getAllDoctors();
      const found = doctors.find((item) => item.id === doctorId) || null;
      setDoctor(found);
      if (found) {
        const doctorStats = await getDoctorStats(found.id);
        setStats({ totalPatients: doctorStats.totalPatients, completed: doctorStats.completed });
      }
    };
    fetchDoctor();
  }, [doctorId]);

  const currencySymbol = doctor?.currency === 'USD' ? '$' : 'ج.م';
  const reviews = useMemo(() => {
    const name = doctor?.name || 'الطبيب';
    return [
      { id: '1', name: 'مريض موثق', text: `${name} كان واضح في الشرح والمتابعة ممتازة.`, rating: doctor?.rating || 5 },
      { id: '2', name: 'مراجعة بعد استشارة', text: 'الاستشارة بدأت في موعدها والتعامل كان محترم ومنظم.', rating: Math.max(4.5, (doctor?.rating || 5) - 0.1) },
      { id: '3', name: 'مريض سابق', text: 'رد سريع وتوصيات مفهومة بعد الكشف.', rating: Math.max(4.4, (doctor?.rating || 5) - 0.2) },
    ];
  }, [doctor]);

  if (!doctor) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ملف الطبيب</Text>
          <View style={{ width: 28 }} />
        </View>
        <Text style={styles.emptyText}>جاري تحميل بيانات الطبيب...</Text>
      </SafeAreaView>
    );
  }

  const openBooking = () => {
    navigation.navigate('Booking', {
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpec: doctor.specialty,
      doctorPrice: doctor.price,
      doctorClinicPrice: doctor.clinicPrice ?? doctor.price,
      currency: doctor.currency,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ملف الطبيب</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Chat', { doctorId: doctor.id, doctorName: doctor.name, recipientId: doctor.id })}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.primaryLight} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarEmoji}>{doctor.emoji || '👨‍⚕️'}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.specialty}>{doctor.specialty}</Text>
              <View style={styles.ratingRow}>
                <FontAwesome5 name="star" size={14} color={COLORS.accentWarm} solid />
                <Text style={styles.ratingText}>{doctor.rating.toFixed(1)}</Text>
                <Text style={styles.ratingSub}>تقييم المرضى</Text>
              </View>
            </View>
          </View>

          <Text style={styles.bio}>{doctor.bio || `طبيب متخصص في ${doctor.specialty} ويقدم استشارات وحجوزات عبر Medicare.`}</Text>

          <View style={styles.statsRow}>
            <Metric label="مرضى" value={String(doctor.patientsCount || stats.totalPatients || 0)} />
            <Metric label="استشارات مكتملة" value={String(stats.completed || 0)} />
            <Metric label="الحالة" value={doctor.available ? 'متاح' : 'غير متاح'} />
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>معلومات الحجز</Text>
          <InfoRow icon="video" label="استشارة فيديو" value={`${doctor.price} ${currencySymbol}`} />
          <InfoRow icon="hospital" label="زيارة العيادة" value={`${doctor.clinicPrice ?? doctor.price} ${currencySymbol}`} />
          <InfoRow icon="map-marker-alt" label="العيادة" value={doctor.clinicLocation || 'يحددها الطبيب بعد الحجز'} />
          <InfoRow icon="id-card" label="رقم القيد" value={doctor.medicalId || 'موثق داخل المنصة'} />
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>تقييمات المرضى</Text>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>{review.name}</Text>
                <View style={styles.reviewRating}>
                  <FontAwesome5 name="star" size={11} color={COLORS.accentWarm} solid />
                  <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
                </View>
              </View>
              <Text style={styles.reviewText}>{review.text}</Text>
            </View>
          ))}
        </GlassCard>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.chatBtn} onPress={() => navigation.navigate('Chat', { doctorId: doctor.id, doctorName: doctor.name, recipientId: doctor.id })}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color={COLORS.primaryLight} />
            <Text style={styles.chatText}>دردشة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bookBtn} onPress={openBooking}>
            <Text style={styles.bookText}>{t('book')}</Text>
            <Ionicons name="chevron-back" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metricBox}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoLabelBox}>
      <FontAwesome5 name={icon as any} size={14} color={COLORS.primaryLight} />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 110 },
  heroCard: { padding: 18, marginBottom: 16 },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 14 },
  avatarBox: { width: 74, height: 74, borderRadius: 37, backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginLeft: 14 },
  avatarEmoji: { fontSize: 38 },
  heroInfo: { flex: 1 },
  doctorName: { color: COLORS.textPrimary, fontSize: 21, fontWeight: 'bold', textAlign: 'right' },
  specialty: { color: COLORS.secondary, fontSize: 14, marginTop: 5, textAlign: 'right' },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 9 },
  ratingText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold' },
  ratingSub: { color: COLORS.textSecondary, fontSize: 12 },
  bio: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 21, textAlign: 'right', marginBottom: 14 },
  statsRow: { flexDirection: 'row-reverse', gap: 10 },
  metricBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12, alignItems: 'center' },
  metricValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  metricLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'center' },
  sectionCard: { padding: 16, marginBottom: 16 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 12 },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  infoLabelBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 13 },
  infoValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold', textAlign: 'left', flex: 1 },
  reviewCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderColor },
  reviewHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold' },
  reviewRating: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  reviewRatingText: { color: COLORS.accentWarm, fontSize: 12, fontWeight: 'bold' },
  reviewText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  actionRow: { flexDirection: 'row-reverse', gap: 12 },
  chatBtn: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primaryLight + '66', backgroundColor: COLORS.primarySofter, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chatText: { color: COLORS.primaryLight, fontSize: 14, fontWeight: 'bold' },
  bookBtn: { flex: 1.4, minHeight: 50, borderRadius: 14, backgroundColor: COLORS.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
