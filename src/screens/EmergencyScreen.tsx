import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';

type EmergencyNumber = { icon: string; label: string; number: string; color: string };
type Coordinates = { latitude: number; longitude: number; accuracy?: number | null };
type Hospital = { id: string; name: string; address: string; phone?: string; latitude?: number; longitude?: number; distanceKm?: number };
type EmergencyRegion = {
  id: string;
  label: string;
  bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  primary: string;
  numbers: EmergencyNumber[];
  fallbackHospitals: Hospital[];
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
    fallbackHospitals: [
      { id: 'kasr-alainy', name: 'مستشفى القصر العيني', address: 'القاهرة • طوارئ 24 ساعة', phone: '123', latitude: 30.0319, longitude: 31.2306 },
      { id: 'demerdash', name: 'مستشفى الدمرداش', address: 'العباسية • طوارئ 24 ساعة', phone: '123', latitude: 30.0776, longitude: 31.2851 },
      { id: 'ahmed-maher', name: 'مستشفى أحمد ماهر', address: 'مصر القديمة • طوارئ 24 ساعة', phone: '123', latitude: 30.0444, longitude: 31.2387 },
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
    fallbackHospitals: [
      { id: 'amiri', name: 'المستشفى الأميري الجامعي', address: 'محطة الرمل • طوارئ 24 ساعة', phone: '123', latitude: 31.2001, longitude: 29.9187 },
      { id: 'smouha', name: 'مستشفى سموحة الجامعي', address: 'سموحة • طوارئ 24 ساعة', phone: '123', latitude: 31.2071, longitude: 29.9604 },
      { id: 'ras-el-tin', name: 'مستشفى رأس التين العام', address: 'بحري • طوارئ 24 ساعة', phone: '123', latitude: 31.2079, longitude: 29.8734 },
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
    fallbackHospitals: [
      { id: 'king-saud-medical', name: 'مدينة الملك سعود الطبية', address: 'الرياض • طوارئ 24 ساعة', phone: '997', latitude: 24.6408, longitude: 46.7178 },
      { id: 'king-faisal-specialist', name: 'مستشفى الملك فيصل التخصصي', address: 'المعذر • طوارئ 24 ساعة', phone: '997', latitude: 24.6716, longitude: 46.6727 },
      { id: 'al-iman', name: 'مستشفى الإيمان العام', address: 'جنوب الرياض • طوارئ 24 ساعة', phone: '997', latitude: 24.5929, longitude: 46.7460 },
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
    fallbackHospitals: [
      { id: 'rashid-hospital', name: 'Rashid Hospital', address: 'Dubai • Emergency 24/7', phone: '998', latitude: 25.2328, longitude: 55.3219 },
      { id: 'dubai-hospital', name: 'Dubai Hospital', address: 'Deira • Emergency 24/7', phone: '998', latitude: 25.2780, longitude: 55.3192 },
      { id: 'latifa-hospital', name: 'Latifa Hospital', address: 'Oud Metha • Emergency 24/7', phone: '998', latitude: 25.2339, longitude: 55.3157 },
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
    fallbackHospitals: [
      { id: 'nearest-general', name: 'أقرب مستشفى عام', address: 'فعّل الموقع لعرض أقرب 3 مستشفيات بدقة', phone: '123' },
      { id: 'nearest-emergency', name: 'أقرب مركز طوارئ', address: 'اتصل بالإسعاف لتوجيهك حسب موقعك', phone: '123' },
      { id: 'nearest-health', name: 'أقرب نقطة رعاية عاجلة', address: 'يتم تحديدها عند السماح بالموقع', phone: '123' },
    ],
  },
];

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceKm = (from: Coordinates, to: Coordinates) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getRegionByCoords = (latitude: number, longitude: number) =>
  EMERGENCY_REGIONS.find((region) => region.bounds && latitude >= region.bounds.minLat && latitude <= region.bounds.maxLat && longitude >= region.bounds.minLng && longitude <= region.bounds.maxLng) ||
  EMERGENCY_REGIONS.find((region) => region.id === 'default')!;

const formatAddress = (tags: Record<string, string> = {}) => {
  const parts = [tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'مستشفى قريب من موقعك';
};

const getHospitalCoords = (item: any): Coordinates | null => {
  const latitude = item.lat ?? item.center?.lat;
  const longitude = item.lon ?? item.center?.lon;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
};

const OVERPASS_RADII_METERS = [25000, 50000, 100000, 200000];
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];
const LOCATION_TIMEOUT_MS = Platform.OS === 'web' ? 20000 : 18000;
const PRECISE_LOCATION_THRESHOLD_METERS = 100;
const ROUGH_LOCATION_THRESHOLD_METERS = 1000;

const buildNearbyHospitalsQuery = (coords: Coordinates, radiusMeters: number) => `
  [out:json][timeout:18];
  (
    node["amenity"="hospital"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    way["amenity"="hospital"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    relation["amenity"="hospital"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    node["healthcare"="hospital"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    way["healthcare"="hospital"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    relation["healthcare"="hospital"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    node["healthcare"="clinic"]["emergency"="yes"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    way["healthcare"="clinic"]["emergency"="yes"](around:${radiusMeters},${coords.latitude},${coords.longitude});
    relation["healthcare"="clinic"]["emergency"="yes"](around:${radiusMeters},${coords.latitude},${coords.longitude});
  );
  out center tags 80;
`;

const parseHospitalElements = (elements: any[], coords: Coordinates): Hospital[] => {
  const seen = new Set<string>();
  return elements
    .map((item: any) => {
      const hospitalCoords = getHospitalCoords(item);
      const name = item.tags?.['name:ar'] || item.tags?.name || item.tags?.['name:en'] || item.tags?.operator;
      if (!hospitalCoords || !name) return null;
      const key = `${name}-${hospitalCoords.latitude.toFixed(4)}-${hospitalCoords.longitude.toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: String(item.id),
        name,
        address: formatAddress(item.tags),
        phone: item.tags?.phone || item.tags?.['contact:phone'],
        latitude: hospitalCoords.latitude,
        longitude: hospitalCoords.longitude,
        distanceKm: distanceKm(coords, hospitalCoords),
      } as Hospital;
    })
    .filter((hospital): hospital is Hospital => Boolean(hospital))
    .sort((a: Hospital, b: Hospital) => (a.distanceKm || 0) - (b.distanceKm || 0));
};

const fetchNearbyHospitals = async (coords: Coordinates): Promise<Hospital[]> => {
  let collected: Hospital[] = [];
  let lastError: unknown = null;

  for (const radiusMeters of OVERPASS_RADII_METERS) {
    const query = buildNearbyHospitalsQuery(coords, radiusMeters);

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`Overpass ${response.status}`);

        const data = await response.json();
        collected = parseHospitalElements(data.elements || [], coords);
        break;
      } catch (error) {
        lastError = error;
        collected = [];
      }
    }

    if (collected.length >= 3) break;
  }

  if (collected.length === 0 && lastError) {
    throw lastError;
  }

  return collected.slice(0, 3);
};

const addDistanceToFallbacks = (fallbackHospitals: Hospital[], coords: Coordinates | null): Hospital[] =>
  fallbackHospitals
    .map((hospital) => ({
      ...hospital,
      distanceKm: coords && hospital.latitude && hospital.longitude
        ? distanceKm(coords, { latitude: hospital.latitude, longitude: hospital.longitude })
        : hospital.distanceKm,
    }))
    .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 3);

const withTimeout = async <T,>(task: Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    task,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Location request timed out')), timeoutMs);
    }),
  ]);

const getBrowserCoords = async (): Promise<Coordinates | null> => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 }
    );
  });
};

const getDeviceCoords = async (): Promise<Coordinates | null> => {
  const candidateResults = await Promise.allSettled([
    getBrowserCoords(),
    withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), LOCATION_TIMEOUT_MS).then((position) => ({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    })),
    withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), LOCATION_TIMEOUT_MS).then((position) => ({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    })),
  ]);
  const candidates = candidateResults
    .filter((result): result is PromiseFulfilledResult<Coordinates | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item): item is Coordinates => Boolean(item));

  if (Platform.OS !== 'web' && candidates.length === 0) {
    try {
      const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), LOCATION_TIMEOUT_MS);
      candidates.push({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch {
      // If balanced accuracy is unavailable too, use only a fresh last-known reading below.
    }
  }

  const preciseCandidate = candidates.find((item) => typeof item.accuracy === 'number' && item.accuracy <= PRECISE_LOCATION_THRESHOLD_METERS);
  if (preciseCandidate) return preciseCandidate;
  if (candidates.length > 0) {
    return [...candidates].sort((a, b) => (a.accuracy ?? Number.MAX_SAFE_INTEGER) - (b.accuracy ?? Number.MAX_SAFE_INTEGER))[0];
  }

  try {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60 * 1000, requiredAccuracy: ROUGH_LOCATION_THRESHOLD_METERS });
    if (lastKnown) return {
      latitude: lastKnown.coords.latitude,
      longitude: lastKnown.coords.longitude,
      accuracy: lastKnown.coords.accuracy,
    };
  } catch {
    // If there is no fresh location, the caller will show emergency fallbacks.
  }

  return null;
};

const formatAccuracy = (accuracy?: number | null) => {
  if (typeof accuracy !== 'number') return '';
  return accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} كم` : `${Math.round(accuracy)} متر`;
};

const isPreciseLocation = (nextCoords: Coordinates | null) =>
  Boolean(nextCoords && typeof nextCoords.accuracy === 'number' && nextCoords.accuracy <= PRECISE_LOCATION_THRESHOLD_METERS);

const getLocationQualityText = (nextCoords: Coordinates | null) => {
  if (!nextCoords) return '';
  const accuracyText = formatAccuracy(nextCoords.accuracy);
  if (!accuracyText) return 'تم تحديد موقعك، لكن المتصفح لم يرسل نسبة الدقة.';
  if (isPreciseLocation(nextCoords)) return `موقع دقيق بدقة حوالي ${accuracyText}.`;
  if ((nextCoords.accuracy ?? 0) <= ROUGH_LOCATION_THRESHOLD_METERS) return `الموقع تقريبي بدقة حوالي ${accuracyText}. اضغط تحديث الموقع في مكان مفتوح لتحسين الدقة.`;
  return `تحذير: الموقع غير دقيق بدقة حوالي ${accuracyText}. فعّل GPS/Precise Location ثم اضغط تحديث الموقع.`;
};

export default function EmergencyScreen({ navigation }: any) {
  const [region, setRegion] = useState<EmergencyRegion>(EMERGENCY_REGIONS.find((item) => item.id === 'default')!);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>(region.fallbackHospitals);
  const [locationStatus, setLocationStatus] = useState('اسمح بالوصول للموقع لعرض أقرب المستشفيات بدقة.');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const didAutoDetectRef = useRef(false);

  const callNumber = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const openDirections = (hospital: Hospital) => {
    if (!hospital.latitude || !hospital.longitude) {
      const query = encodeURIComponent(`${hospital.name} ${hospital.address}`);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      return;
    }
    const destination = encodeURIComponent(`${hospital.latitude},${hospital.longitude}`);
    const label = encodeURIComponent(hospital.name);
    const origin = coords ? `&origin=${coords.latitude},${coords.longitude}` : '';
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destination}&q=${label}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`;
    Linking.openURL(url);
  };

  const loadNearbyHospitals = useCallback(async (nextCoords: Coordinates, nextRegion: EmergencyRegion) => {
    setLoadingHospitals(true);
    const qualityText = getLocationQualityText(nextCoords);
    try {
      const nearby = await fetchNearbyHospitals(nextCoords);
      if (nearby.length > 0) {
        setHospitals(nearby);
        setLocationStatus(`${qualityText} تم العثور على أقرب ${nearby.length} مستشفيات حسب موقعك الحالي.`);
      } else {
        setHospitals(addDistanceToFallbacks(nextRegion.fallbackHospitals, nextCoords));
        setLocationStatus(`${qualityText} لم نجد نتائج كافية من الخريطة، يتم عرض بدائل طوارئ قابلة للفتح على Google Maps.`);
      }
    } catch {
      setHospitals(addDistanceToFallbacks(nextRegion.fallbackHospitals, nextCoords));
      setLocationStatus(`${qualityText} تعذر تحميل المستشفيات من الخريطة الآن، يتم عرض بدائل طوارئ قابلة للفتح على Google Maps.`);
    } finally {
      setLoadingHospitals(false);
    }
  }, []);

  const detectLocation = useCallback(async () => {
    setLoadingLocation(true);
    setLocationStatus('جاري تحديد موقعك بدقة عالية...');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationStatus('لم يتم السماح بالوصول للموقع. فعّل الموقع لعرض أقرب 3 مستشفيات.');
        setHospitals(addDistanceToFallbacks(region.fallbackHospitals, null));
        return;
      }

      const nextCoords = await getDeviceCoords();
      if (!nextCoords) {
        setLocationStatus('تعذر قراءة موقع دقيق من المتصفح الآن. فعّل GPS/Precise Location ثم اضغط تحديث الموقع.');
        setHospitals(addDistanceToFallbacks(region.fallbackHospitals, null));
        return;
      }
      const nextRegion = getRegionByCoords(nextCoords.latitude, nextCoords.longitude);
      setCoords(nextCoords);
      setRegion(nextRegion);
      await loadNearbyHospitals(nextCoords, nextRegion);
    } catch {
      setLocationStatus('تعذر تحديد الموقع بسرعة. يتم عرض بدائل الطوارئ الآن، وحاول تحديث الموقع مرة أخرى بعد تشغيل خدمات الموقع.');
      setHospitals(addDistanceToFallbacks(region.fallbackHospitals, null));
    } finally {
      setLoadingLocation(false);
    }
  }, [loadNearbyHospitals, region.fallbackHospitals]);

  useEffect(() => {
    if (didAutoDetectRef.current) return;
    didAutoDetectRef.current = true;
    detectLocation();
  }, [detectLocation]);

  const primaryNumber = useMemo(() => region.numbers[0], [region]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle}>مركز الطوارئ</Text>
          <Text style={styles.headerSubtitle}>{region.label}</Text>
        </View>
        <View style={styles.statusPill}>
          <Ionicons name={coords ? 'location' : 'location-outline'} size={14} color={isPreciseLocation(coords) ? COLORS.accentWarm : COLORS.textSecondary} />
          <Text style={[styles.statusPillText, coords && { color: isPreciseLocation(coords) ? COLORS.accentWarm : COLORS.textSecondary }]}>{coords ? (isPreciseLocation(coords) ? 'موقع دقيق' : 'موقع تقريبي') : 'بانتظار الموقع'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>مساعدة فورية عند الطوارئ</Text>
              <Text style={styles.heroText}>اتصل بالطوارئ، شارك موقعك، أو افتح أقرب مستشفى على الخريطة من مكانك الحالي.</Text>
            </View>
            <TouchableOpacity style={styles.sosButton} onPress={() => callNumber(region.primary)}>
              <View style={styles.sosInner}>
                <MaterialIcons name="touch-app" size={34} color="#FFF" />
                <Text style={styles.sosText}>SOS</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.locationPanel}>
            <View style={styles.locationLine}>
              {loadingLocation || loadingHospitals ? <ActivityIndicator size="small" color={COLORS.accentWarm} /> : <Ionicons name="navigate-circle-outline" size={22} color={COLORS.accentWarm} />}
              <Text style={styles.locationText}>{locationStatus}</Text>
            </View>
            <TouchableOpacity style={styles.detectBtn} onPress={detectLocation} disabled={loadingLocation || loadingHospitals}>
              <Ionicons name="locate" size={16} color={COLORS.bgBase} />
              <Text style={styles.detectText}>تحديث الموقع</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>أرقام الطوارئ السريعة</Text>
        <View style={styles.numberGrid}>
          {region.numbers.map((item) => (
            <EmergencyItem key={`${item.label}-${item.number}`} {...item} primary={item.number === primaryNumber.number} onPress={() => callNumber(item.number)} />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>أقرب 3 مستشفيات</Text>
            <Text style={styles.sectionHint}>مرتبة حسب المسافة من موقعك الحالي</Text>
          </View>
          {loadingHospitals && <ActivityIndicator size="small" color={COLORS.primaryLight} />}
        </View>

        {hospitals.slice(0, 3).map((hospital, index) => (
          <GlassCard key={hospital.id} style={styles.hospitalCard}>
            <View style={styles.hospitalRank}>
              <Text style={styles.hospitalRankText}>{index + 1}</Text>
            </View>
            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName}>{hospital.name}</Text>
              <Text style={styles.hospitalAddress}>{hospital.address}</Text>
              <View style={styles.distanceRow}>
                <Ionicons name="navigate-outline" size={14} color={COLORS.accentWarm} />
                <Text style={styles.hospitalDistance}>
                  {hospital.distanceKm != null ? `${hospital.distanceKm.toFixed(1)} كم تقريباً` : 'المسافة تظهر بعد السماح بالموقع'}
                </Text>
              </View>
            </View>
            <View style={styles.hospitalActions}>
              <TouchableOpacity style={styles.mapBtn} onPress={() => openDirections(hospital)}>
                <Ionicons name="map-outline" size={18} color={COLORS.bgBase} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.callBtn} onPress={() => callNumber(hospital.phone || region.primary)}>
                <Ionicons name="call" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const EmergencyItem = ({ icon, label, number, color, primary, onPress }: any) => (
  <TouchableOpacity style={[styles.numberCard, primary && styles.numberCardPrimary]} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
      <FontAwesome5 name={icon} size={18} color={primary ? '#FFF' : color} />
    </View>
    <View style={styles.numberTexts}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={[styles.itemNumber, primary ? { color: '#FFF' } : { color }]}>{number}</Text>
    </View>
    <Ionicons name="call" size={18} color={primary ? '#FFF' : color} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  backBtn: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor },
  headerTexts: { alignItems: 'center' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statusPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor },
  statusPillText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 90 },
  heroCard: { padding: 18, marginBottom: 24 },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
  heroCopy: { flex: 1 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'right', lineHeight: 30 },
  heroText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'right', lineHeight: 22, marginTop: 8 },
  sosButton: { width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(227, 26, 26, 0.16)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger },
  sosInner: { width: 104, height: 104, borderRadius: 52, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center', elevation: 20, shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 20 },
  sosText: { color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 2 },
  locationPanel: { marginTop: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 16, padding: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  locationLine: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  locationText: { flex: 1, color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', lineHeight: 18 },
  detectBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: COLORS.accentWarm, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  detectText: { color: COLORS.bgBase, fontSize: 12, fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 14 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 12 },
  sectionHint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'right' },
  numberGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 22 },
  numberCard: { width: '48%', minHeight: 86, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 16, padding: 14, marginBottom: 12, gap: 10 },
  numberCardPrimary: { backgroundColor: COLORS.danger, borderColor: COLORS.primaryLight },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  numberTexts: { flex: 1, alignItems: 'flex-start' },
  itemLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  itemNumber: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  hospitalCard: { flexDirection: 'row-reverse', alignItems: 'center', padding: 14, marginBottom: 12, gap: 12 },
  hospitalRank: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderColor },
  hospitalRankText: { color: COLORS.primaryLight, fontWeight: '900', fontSize: 15 },
  hospitalInfo: { flex: 1 },
  hospitalName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  hospitalAddress: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4, lineHeight: 18 },
  distanceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 6 },
  hospitalDistance: { color: COLORS.accentWarm, fontSize: 12, fontWeight: 'bold' },
  hospitalActions: { flexDirection: 'row-reverse', gap: 8 },
  mapBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.accentWarm, justifyContent: 'center', alignItems: 'center' },
  callBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center' },
});
