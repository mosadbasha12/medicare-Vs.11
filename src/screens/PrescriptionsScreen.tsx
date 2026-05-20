import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import {
  addPrescriptionSupply,
  getUserPrescriptions,
  markPrescriptionDoseTaken,
} from '../utils/localDataService';

function showAlert(title: string, message: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: 'حسناً', onPress: onOk }]);
  }
}

export default function PrescriptionsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  const fetchData = async () => {
    if (!user?.uid) return;
    const prescs = await getUserPrescriptions(user.uid);
    setPrescriptions(prescs);
  };

  useEffect(() => {
    fetchData();
  }, [user?.uid]);

  const handleDoseTaken = async (item: any) => {
    if (!user?.uid) return;
    const updated = await markPrescriptionDoseTaken(user.uid, item.id);
    if (updated) {
      fetchData();
    } else {
      showAlert('خطأ', 'تعذر تحديث الجرعة.');
    }
  };

  const handleSupplyAdded = async (item: any) => {
    if (!user?.uid) return;
    const updated = await addPrescriptionSupply(user.uid, item.id);
    if (updated) {
      const addedDoses = Math.max(1, (item.timesPerDay || 0) * (item.durationDays || 0) || item.totalDoses || 1);
      showAlert('تمت الإضافة', `تمت إضافة كمية جديدة: ${addedDoses} جرعة.`, () => {
        fetchData();
      });
    } else {
      showAlert('خطأ', 'تعذر إضافة الكمية الجديدة.');
    }
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
          const totalDoses = item.totalDoses || ((item.timesPerDay || 0) * (item.durationDays || 0));
          const takenDoses = item.takenDoses || 0;
          const remainingDoses = totalDoses > 0 ? Math.max(0, totalDoses - takenDoses) : null;
          const progressPercent = totalDoses > 0 ? Math.min(100, Math.round((takenDoses / totalDoses) * 100)) : 0;

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
                  <TouchableOpacity
                    style={styles.refillBtn}
                    onPress={() => handleSupplyAdded(item)}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={COLORS.primaryLight} />
                    <Text style={styles.refillBtnText}>اشتريت كمية جديدة</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.bottomRow}>
                <Text style={styles.footerText}>بواسطة: {item.doctor}</Text>
                <Text style={styles.footerText}>{item.date}</Text>
                {!!item.refillCount && <Text style={styles.footerText}>تم شراء كمية جديدة {item.refillCount} مرة</Text>}
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
  refillBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.primarySofter, borderWidth: 1, borderColor: COLORS.primaryLight + '66', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 8 },
  refillBtnText: { color: COLORS.primaryLight, fontSize: 12, fontWeight: 'bold' },
  bottomRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  footerText: { color: COLORS.textMuted, fontSize: 11 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
