import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';

type EmergencyNumber = { icon: string; label: string; number: string; color: string };
type Hospital = { name: string; area: string; phone: string };
type EmergencyRegion = {
  id: string;
  label: string;
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  primary: string;
  numbers: EmergencyNumber[];
  hospitals: Hospital[];
};

const EMERGENCY_REGIONS: EmergencyRegion[] = [
  {
    id: 'egypt-cairo',
    label: 'مصر - القاهرة الكبرى',
    bounds: { minLat: 29.7, maxLat: 30.35, minLng: 30.75, maxLng: 31.65 },
    primary: '123',
    numbers: [
      { icon: 'ambulance', label: 'الإسعاف', number: '123', color: COLORS.danger },
      { icon: 'shield-alt', label: 'الشرطة', number: '122', color: COLORS.primary },
      { icon: 'fire-extinguisher', label: 'الحماية المدنية', number: '180', color: COLORS.accentWarm },
      { icon: 'car-crash', label: 'المرور', number: '128', color: COLORS.primaryLight },
    ],
    hospitals: [
      { name: 'مستشفى القصر العيني', area: 'القاهرة • طوارئ 24 ساعة', phone: '123' },
      { name: 'مستشفى الدمرداش', area: 'العباسية • طوارئ 24 ساعة', phone: '123' },
      { name: 'مستشفى أحمد ماهر', area: 'مصر القديمة • طوارئ 24 ساعة', phone: '123' },
    ],
  },
  {
    id: 'egypt-alex',
    label: 'مصر - الإسكندرية',
    bounds: { minLat: 30.95, maxLat: 31.45, minLng: 29.65, maxLng: 30.2 },
    primary: '123',
    numbers: [
      { icon: 'ambulance', label: 'الإسعاف', number: '123', color: COLORS.danger },
      { icon: 'shield-alt', label: 'الشرطة', number: '122', color: COLORS.primary },
      { icon: 'fire-extinguisher', label: 'الحماية المدنية', number: '180', color: COLORS.accentWarm },
      { icon: 'car-crash', label: 'المرور', number: '128', color: COLORS.primaryLight },
    ],
    hospitals: [
      { name: 'المستشفى الأميري الجامعي', area: 'محطة الرمل • طوارئ 24 ساعة', phone: '123' },
      { name: 'مستشفى سموحة الجامعي', area: 'سموحة • طوارئ 24 ساعة', phone: '123' },
      { name: 'مستشفى رأس التين العام', area: 'بحري • طوارئ 24 ساعة', phone: '123' },
    ],
  },
  {
    id: 'saudi-riyadh',
    label: 'السعودية - الرياض',
    bounds: { minLat: 24.35, maxLat: 25.1, minLng: 46.25, maxLng: 47.15 },
    primary: '997',
    numbers: [
      { icon: 'ambulance', label: 'الهلال الأحمر', number: '997', color: COLORS.danger },
      { icon: 'shield-alt', label: 'الشرطة', number: '999', color: COLORS.primary },
      { icon: 'fire-extinguisher', label: 'الدفاع المدني', number: '998', color: COLORS.accentWarm },
      { icon: 'car-crash', label: 'المرور', number: '993', color: COLORS.primaryLight },
    ],
    hospitals: [
      { name: 'مدينة الملك سعود الطبية', area: 'الرياض • طوارئ 24 ساعة', phone: '997' },
      { name: 'مستشفى الملك فيصل التخصصي', area: 'المعذر • طوارئ 24 ساعة', phone: '997' },
      { name: 'مستشفى الإيمان العام', area: 'جنوب الرياض • طوارئ 24 ساعة', phone: '997' },
    ],
  },
  {
    id: 'uae-dubai',
    label: 'الإمارات - دبي',
    bounds: { minLat: 24.85, maxLat: 25.45, minLng: 54.9, maxLng: 55.65 },
    primary: '998',
    numbers: [
      { icon: 'ambulance', label: 'الإسعاف', number: '998', color: COLORS.danger },
      { icon: 'shield-alt', label: 'الشرطة', number: '999', color: COLORS.primary },
      { icon: 'fire-extinguisher', label: 'الدفاع المدني', number: '997', color: COLORS.accentWarm },
      { icon: 'phone', label: 'الحالات غير الطارئة', number: '901', color: COLORS.primaryLight },
    ],
    hospitals: [
      { name: 'Rashid Hospital', area: 'Dubai • Emergency 24/7', phone: '998' },
      { name: 'Dubai Hospital', area: 'Deira • Emergency 24/7', phone: '998' },
      { name: 'Latifa Hospital', area: 'Oud Metha • Emergency 24/7', phone: '998' },
    ],
  },
  {
    id: 'default',
    label: 'مصر - افتراضي',
    primary: '123',
    numbers: [
      { icon: 'ambulance', label: 'الإسعاف', number: '123', color: COLORS.danger },
      { icon: 'shield-alt', label: 'الشرطة', number: '122', color: COLORS.primary },
      { icon: 'fire-extinguisher', label: 'الحماية المدنية', number: '180', color: COLORS.accentWarm },
      { icon: 'phone', label: 'الطوارئ العامة', number: '112', color: COLORS.primaryLight },
    ],
    hospitals: [
      { name: 'أقرب مستشفى عام', area: 'استخدم الاتصال بالإسعاف لتوجيهك حسب موقعك', phone: '123' },
      { name: 'أقرب مركز طوارئ', area: 'يتم تحديده حسب المحافظة الحالية', phone: '123' },
    ],
  },
];

const getRegionByCoords = (lat: number, lng: number) =>
  EMERGENCY_REGIONS.find((region) => region.bounds && lat >= region.bounds.minLat && lat <= region.bounds.maxLat && lng >= region.bounds.minLng && lng <= region.bounds.maxLng) ||
  EMERGENCY_REGIONS.find((region) => region.id === 'default')!;

export default function EmergencyScreen({ navigation }: any) {
  const [region, setRegion] = useState<EmergencyRegion>(EMERGENCY_REGIONS.find((item) => item.id === 'default')!);
  const [locationStatus, setLocationStatus] = useState('جاري تحديد الموقع...');

  const callEmergency = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const detectLocation = () => {
    const nav = (globalThis as any).navigator;
    if (Platform.OS !== 'web' || !nav?.geolocation) {
      setLocationStatus('تحديد الموقع التلقائي غير متاح على هذا الجهاز، يتم عرض أرقام افتراضية.');
      return;
    }

    setLocationStatus('جاري تحديد الموقع...');
    nav.geolocation.getCurrentPosition(
      (position: any) => {
        const nextRegion = getRegionByCoords(position.coords.latitude, position.coords.longitude);
        setRegion(nextRegion);
        setLocationStatus(`تم اختيار أرقام الطوارئ حسب موقعك: ${nextRegion.label}`);
      },
      () => {
        setLocationStatus('لم يتم السماح بالوصول للموقع، يتم عرض أرقام افتراضية.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const otherNumbers = useMemo(() => region.numbers.slice(1), [region]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>مركز الطوارئ</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sosSection}>
           <TouchableOpacity style={styles.sosButton} onPress={() => callEmergency(region.primary)}>
              <View style={styles.sosInner}>
                 <MaterialIcons name="touch-app" size={40} color="#FFF" />
                 <Text style={styles.sosText}>SOS</Text>
              </View>
           </TouchableOpacity>
           <Text style={styles.sosWarning}>اضغط للاتصال بالطوارئ فوراً</Text>
           <Text style={styles.locationText}>{locationStatus}</Text>
           <TouchableOpacity style={styles.detectBtn} onPress={detectLocation}>
             <Ionicons name="location-outline" size={16} color={COLORS.primaryLight} />
             <Text style={styles.detectText}>تحديث الموقع</Text>
           </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>أرقام الطوارئ السريعة - {region.label}</Text>
        <GlassCard style={styles.card}>
          {region.numbers.map((item) => (
            <EmergencyItem key={`${item.label}-${item.number}`} {...item} onPress={() => callEmergency(item.number)} />
          ))}
        </GlassCard>

        <Text style={styles.sectionTitle}>أرقام الطوارئ الأخرى</Text>
        <GlassCard style={styles.card}>
          {otherNumbers.map((item) => (
            <EmergencyItem key={`other-${item.label}-${item.number}`} {...item} onPress={() => callEmergency(item.number)} />
          ))}
        </GlassCard>

        <Text style={styles.sectionTitle}>أقرب المستشفيات</Text>
        {region.hospitals.map((hospital) => (
          <GlassCard key={hospital.name} style={styles.hospitalCard}>
            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName}>{hospital.name}</Text>
              <Text style={styles.hospitalDist}>{hospital.area}</Text>
            </View>
            <TouchableOpacity style={styles.navBtn} onPress={() => callEmergency(hospital.phone)}>
              <Ionicons name="call" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </GlassCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const EmergencyItem = ({ icon, label, number, color, onPress }: any) => (
  <TouchableOpacity style={styles.item} onPress={onPress}>
    <View style={styles.itemRight}>
       <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
         <FontAwesome5 name={icon} size={18} color={color} />
       </View>
       <Text style={styles.itemLabel}>{label}</Text>
    </View>
    <View style={styles.itemLeft}>
       <Text style={[styles.itemNumber, { color }]}>{number}</Text>
       <Ionicons name="call" size={18} color={color} />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24 },
  sosSection: { alignItems: 'center', marginBottom: 40 },
  sosButton: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(227, 26, 26, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.danger },
  sosInner: { width: 130, height: 130, borderRadius: 65, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center', elevation: 20, shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  sosText: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4 },
  sosWarning: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 20, lineHeight: 20 },
  locationText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  detectBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderColor },
  detectText: { color: COLORS.primaryLight, fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 16 },
  card: { padding: 8, marginBottom: 32 },
  item: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  itemRight: { flexDirection: 'row-reverse', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  itemLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  itemLeft: { flexDirection: 'row-reverse', alignItems: 'center' },
  itemNumber: { fontSize: 18, fontWeight: '900', marginLeft: 10 },
  hospitalCard: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 12 },
  hospitalInfo: { flex: 1 },
  hospitalName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  hospitalDist: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  navBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.secondary + '22', justifyContent: 'center', alignItems: 'center' }
});
