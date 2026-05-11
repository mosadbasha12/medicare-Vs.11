import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getDoctorSchedule, saveDoctorSchedule } from '../utils/localDataService';
import type { DoctorSchedule } from '../utils/localDataService';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function DoctorScheduleScreen({ navigation }: any) {
  const { user } = useUser();
  const [schedule, setSchedule] = useState<DoctorSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      const data = await getDoctorSchedule(user.uid);
      setSchedule(data);
      setLoading(false);
    };
    load();
  }, [user?.uid]);

  const toggleDay = (index: number) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setSchedule(updated);
  };

  const updateTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    setSchedule(updated);
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    const success = await saveDoctorSchedule(user.uid, schedule);
    setSaving(false);
    if (success) {
      showAlert('تم', 'تم حفظ جدولك بنجاح');
    } else {
      showAlert('خطأ', 'فشل في حفظ الجدول');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الجدول</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>حدد أيام عملك وأوقات الدوام</Text>

          {schedule.map((day, index) => (
            <GlassCard key={day.day} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Switch
                  value={day.enabled}
                  onValueChange={() => toggleDay(index)}
                  trackColor={{ false: COLORS.textMuted, true: COLORS.primary }}
                  thumbColor="#FFF"
                />
                <Text style={[styles.dayName, !day.enabled && styles.dayNameDisabled]}>{day.day}</Text>
              </View>
              {day.enabled && (
                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={styles.timeLabel}>من</Text>
                    <TextInput
                      style={styles.timeField}
                      value={day.startTime}
                      onChangeText={(v) => updateTime(index, 'startTime', v)}
                      placeholder="09:00"
                      placeholderTextColor={COLORS.textMuted}
                      textAlign="center"
                      keyboardType="default"
                    />
                  </View>
                  <Text style={styles.timeSeparator}>إلى</Text>
                  <View style={styles.timeInput}>
                    <Text style={styles.timeLabel}>إلى</Text>
                    <TextInput
                      style={styles.timeField}
                      value={day.endTime}
                      onChangeText={(v) => updateTime(index, 'endTime', v)}
                      placeholder="17:00"
                      placeholderTextColor={COLORS.textMuted}
                      textAlign="center"
                      keyboardType="default"
                    />
                  </View>
                </View>
              )}
            </GlassCard>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'حفظ الجدول'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 40 },
  loadingText: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', marginTop: 40 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'right', marginBottom: 20 },
  dayCard: { padding: 16, marginBottom: 12 },
  dayHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
  dayName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginRight: 12 },
  dayNameDisabled: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  timeRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 },
  timeInput: { alignItems: 'center' },
  timeLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  timeField: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, color: COLORS.textPrimary, fontSize: 16, width: 80, textAlign: 'center' },
  timeSeparator: { color: COLORS.textMuted, fontSize: 14, marginTop: 20 },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 24 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
