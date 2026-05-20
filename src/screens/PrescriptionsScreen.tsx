import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import {
  getNearestAvailablePharmacies,
  getPrescriptionOrders,
  getUserPrescriptions,
  markPrescriptionDoseTaken,
  orderPrescription,
  recordManualPrescriptionPurchase,
  type Pharmacy,
} from '../utils/localDataService';

function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'حسناً', onPress: onOk }]);
  }
}

const ORDER_STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'جاري التوصيل': { color: COLORS.accentWarm, bg: COLORS.accentWarm + '22', icon: 'delivery' },
  'تم التوصيل': { color: COLORS.secondary, bg: COLORS.secondary + '22', icon: 'checkmark-circle' },
  'تم الشراء يدوياً': { color: COLORS.secondary, bg: COLORS.secondary + '22', icon: 'bag-check-outline' },
  'قيد المراجعة': { color: COLORS.primaryLight, bg: COLORS.primaryLight + '22', icon: 'hourglass' },
  'ملغي': { color: COLORS.danger, bg: COLORS.danger + '22', icon: 'close-circle' },
};

const resolveUserLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 10 * 60 * 1000 }
    );
  });
};

export default function PrescriptionsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [pharmacyOptions, setPharmacyOptions] = useState<Record<string, (Pharmacy & { distanceKm: number })[]>>({});

  const fetchData = async () => {
    if (!user?.uid) return;
    const location = await resolveUserLocation();
    const [prescs, ords] = await Promise.all([
      getUserPrescriptions(user.uid),
      getPrescriptionOrders(user.uid),
    ]);
    const pharmaciesByPrescription = await prescs.reduce<Promise<Record<string, (Pharmacy & { distanceKm: number })[]>>>(async (promise, prescription) => {
      const next = await promise;
      next[prescription.id] = await getNearestAvailablePharmacies(prescription, location);
      return next;
    }, Promise.resolve({}));
    setPrescriptions(prescs);
    setOrders(ords);
    setPharmacyOptions(pharmaciesByPrescription);
  };

  useEffect(() => {
    fetchData();
  }, [user?.uid]);

  const handleOrder = async (item: any) => {
    const selectedPharmacy = pharmacyOptions[item.id]?.[0];
    if (!selectedPharmacy) {
      showAlert('غير متوفر', 'لا توجد صيدلية متاحة لهذا الدواء حالياً.');
      return;
    }
    const success = await orderPrescription(user!.uid, item, selectedPharmacy);
    if (success) {
      showAlert('تم الطلب', `جاري توصيل ${item.med} من ${selectedPharmacy.name}\n${selectedPharmacy.address}\nرقم الصيدلية: ${selectedPharmacy.phone}`, () => {
        fetchData();
      });
    } else {
      showAlert('خطأ', 'فشل في إرسال الطلب');
    }
  };

  const handleDoseTaken = async (item: any) => {
    if (!user?.uid) return;
    const updated = await markPrescriptionDoseTaken(user.uid, item.id);
    if (updated) {
      fetchData();
    } else {
      showAlert('خطأ', 'تعذر تحديث الجرعة.');
    }
  };

  const handleManualPurchase = async (item: any) => {
    if (!user?.uid) return;
    const success = await recordManualPrescriptionPurchase(user.uid, item);
    if (success) {
      showAlert('تم التسجيل', 'تم تسجيل شراء الجرعة يدوياً وإضافتها في عداد الجرعات.', () => {
        fetchData();
      });
    } else {
      showAlert('خطأ', 'تعذر تسجيل الشراء اليدوي.');
    }
  };

  const getPrescriptionOrder = (prescriptionId: string) => {
    return orders.find((o) => o.prescriptionId === prescriptionId);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الوصفات الطبية</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={prescriptions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا توجد وصفات طبية</Text>
        }
        renderItem={({ item }) => {
          const order = getPrescriptionOrder(item.id);
          const statusConfig = order ? ORDER_STATUS_CONFIG[order.status] : null;
          const totalDoses = item.totalDoses || ((item.timesPerDay || 0) * (item.durationDays || 0));
          const takenDoses = item.takenDoses || 0;
          const remainingDoses = totalDoses > 0 ? Math.max(0, totalDoses - takenDoses) : null;
          const progressPercent = totalDoses > 0 ? Math.min(100, Math.round((takenDoses / totalDoses) * 100)) : 0;
          const nearestPharmacy = pharmacyOptions[item.id]?.[0];

          return (
            <GlassCard style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.medIconBox}>
                  <FontAwesome5 name="pills" size={20} color={COLORS.accentWarm} />
                </View>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{item.med}</Text>
                  <Text style={styles.dosage}>{item.dosage}</Text>
                  {item.frequency ? <Text style={styles.scheduleText}>{item.frequency}</Text> : null}
                  {item.instructions ? <Text style={styles.instructionsText}>{item.instructions}</Text> : null}
                </View>
              </View>

              {remainingDoses !== null && (
                <View style={styles.dosePanel}>
                  <View style={styles.doseHeader}>
                    <Text style={styles.doseText}>المتبقي: {remainingDoses} جرعة</Text>
                    <Text style={styles.doseText}>تم: {takenDoses} / {totalDoses}</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                  </View>
                  <TouchableOpacity
                    style={[styles.doseBtn, remainingDoses === 0 && styles.doseBtnDisabled]}
                    disabled={remainingDoses === 0}
                    onPress={() => handleDoseTaken(item)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.bgBase} />
                    <Text style={styles.doseBtnText}>{remainingDoses === 0 ? 'اكتمل العلاج' : 'تم أخذ جرعة'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {order && (
                <View style={[styles.statusBadge, { backgroundColor: statusConfig?.bg || 'transparent' }]}>
                  <Ionicons name={statusConfig?.icon as any} size={16} color={statusConfig?.color || '#FFF'} />
                  <Text style={[styles.statusText, { color: statusConfig?.color || '#FFF' }]}>
                    {order.status} • {order.orderedAt}
                  </Text>
                </View>
              )}

              <View style={styles.pharmacyPanel}>
                <View style={styles.pharmacyHeader}>
                  <Ionicons name="location-outline" size={17} color={COLORS.primaryLight} />
                  <Text style={styles.pharmacyTitle}>{order?.pharmacyName ? 'الصيدلية المختارة' : 'أقرب صيدلية متاح فيها الدواء'}</Text>
                </View>
                {order?.pharmacyName ? (
                  <>
                    <Text style={styles.pharmacyName}>{order.pharmacyName}</Text>
                    <Text style={styles.pharmacyMeta}>{order.pharmacyAddress}</Text>
                    <Text style={styles.pharmacyMeta}>الهاتف: {order.pharmacyPhone}{order.distanceKm ? ` • ${order.distanceKm} كم` : ''}</Text>
                  </>
                ) : nearestPharmacy ? (
                  <>
                    <Text style={styles.pharmacyName}>{nearestPharmacy.name}</Text>
                    <Text style={styles.pharmacyMeta}>{nearestPharmacy.address}</Text>
                    <Text style={styles.pharmacyMeta}>الهاتف: {nearestPharmacy.phone} • {nearestPharmacy.distanceKm} كم • توصيل {nearestPharmacy.deliveryMinutes}</Text>
                  </>
                ) : (
                  <Text style={styles.pharmacyMeta}>لا توجد صيدلية متاحة لهذا الدواء حالياً.</Text>
                )}
              </View>

              <View style={styles.bottomRow}>
                <Text style={styles.footerText}>بواسطة: {item.doctor}</Text>
                <Text style={styles.footerText}>{item.date}</Text>
                {(!order || order.source === 'manual') && (
                  <TouchableOpacity style={styles.orderBtn} onPress={() => handleOrder(item)}>
                    <Ionicons name="cart" size={12} color="#000" />
                    <Text style={styles.orderText}>طلب من الصيدلية</Text>
                  </TouchableOpacity>
                )}
                {(!order || order.status !== 'جاري التوصيل') && remainingDoses !== 0 && (
                  <TouchableOpacity style={styles.manualBtn} onPress={() => handleManualPurchase(item)}>
                    <Ionicons name="bag-check-outline" size={13} color={COLORS.primaryLight} />
                    <Text style={styles.manualText}>اشتريت جرعة بنفسي</Text>
                  </TouchableOpacity>
                )}
                {order && order.status === 'جاري التوصيل' && (
                  <View style={styles.deliveringBadge}>
                    <Ionicons name="bicycle" size={14} color="#FFF" />
                    <Text style={styles.deliveringText}>قيد التوصيل</Text>
                  </View>
                )}
              </View>
            </GlassCard>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  list: { padding: 24 },
  card: { marginBottom: 16, padding: 16 },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  medIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.accentWarm + '22', justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  medInfo: { flex: 1 },
  medName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  dosage: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  scheduleText: { color: COLORS.accentWarm, fontSize: 12, textAlign: 'right', marginTop: 4, fontWeight: 'bold' },
  instructionsText: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, lineHeight: 16 },
  dosePanel: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12, marginBottom: 12 },
  doseHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  doseText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold' },
  progressBg: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: COLORS.accentWarm, borderRadius: 999 },
  doseBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.accentWarm, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  doseBtnDisabled: { opacity: 0.55 },
  doseBtnText: { color: COLORS.bgBase, fontSize: 12, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', padding: 8, borderRadius: 8, marginBottom: 12, gap: 8 },
  statusText: { fontSize: 13, fontWeight: 'bold' },
  pharmacyPanel: { backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight + '55', borderRadius: 12, padding: 12, marginBottom: 12 },
  pharmacyHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 7 },
  pharmacyTitle: { color: COLORS.primaryLight, fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  pharmacyName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  pharmacyMeta: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'right', lineHeight: 17 },
  bottomRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  footerText: { color: COLORS.textMuted, fontSize: 11 },
  orderBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  orderText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  manualBtn: { backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight + '66', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  manualText: { color: COLORS.primaryLight, fontSize: 11, fontWeight: 'bold' },
  deliveringBadge: { backgroundColor: COLORS.accentWarm, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  deliveringText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
