import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getUserAppointments, getUserResults, getUserPrescriptions } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';

interface HomeScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
  };
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [resultsCount, setResultsCount] = useState(0);
  const [prescriptionsCount, setPrescriptionsCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;
      const [apts, results, presc] = await Promise.all([
        getUserAppointments(user.uid),
        getUserResults(user.uid),
        getUserPrescriptions(user.uid),
      ]);
      setAppointmentsCount(apts.filter((a: any) => a.status === 'قادم').length);
      setResultsCount(results.length);
      setPrescriptionsCount(presc.length);
    };
    fetchData();
  }, [user?.uid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.bgCircle, { top: -100, right: -50, backgroundColor: COLORS.primarySofter }]} />
      <View style={[styles.bgCircle, { bottom: 100, left: -80, backgroundColor: COLORS.primarySofter }]} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoEmoji}>🏥</Text>
          </View>
          <View>
            <Text style={styles.greeting}>{t('greetingPrefix')} {user?.name || t('userFallback')} 👋</Text>
            <Text style={styles.subGreeting}>{t('homeSubtitle')}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.gridContainer}>
          <StatCard label={t('appointments')} value={String(appointmentsCount)} icon="calendar-check" color={COLORS.primaryLight} bgColor={COLORS.primarySoft} onPress={() => navigation.navigate('المواعيد')} />
          <StatCard label={t('results')} value={String(resultsCount)} icon="flask" color={COLORS.secondary} bgColor={COLORS.secondary + '22'} onPress={() => navigation.navigate('Results')} />
          <StatCard label={t('prescriptions')} value={String(prescriptionsCount)} icon="pills" color={COLORS.accentWarm} bgColor={COLORS.accentWarm + '22'} onPress={() => navigation.navigate('Prescriptions')} />
          <StatCard label={t('wallet')} value={`${user?.balance?.toFixed(0) || 0}$`} icon="wallet" color={COLORS.danger} bgColor="rgba(227, 26, 26, 0.15)" onPress={() => navigation.navigate('Payment')} />
        </View>

        <View style={styles.gradientCard}>
          <View style={styles.gradientCardHeader}>
            <Text style={styles.gradientCardEmoji}>💡</Text>
            <View style={styles.gradientCardTexts}>
              <Text style={styles.gradientCardTitle}>{t('healthTipTitle')}</Text>
              <Text style={styles.gradientCardDesc}>{t('healthTipDesc')}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
        <View style={styles.quickActionsContainer}>
          <QuickAction icon="user-md" label={t('doctor')} onPress={() => navigation.navigate('الأطباء')} />
          <QuickAction icon="comments" label={t('chat')} onPress={() => navigation.navigate('الأطباء')} />
          <QuickAction icon="vial" label={t('results')} onPress={() => navigation.navigate('Results')} />
          <QuickAction icon="first-aid" label={t('emergency')} onPress={() => navigation.navigate('Emergency')} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('healthOverview')}</Text>
        <GlassCard style={{ marginBottom: 120 }}>
           <HealthMetric label={t('pulseRate')} value="72 bpm" percent={70} color={COLORS.danger} />
           <HealthMetric label={t('bloodPressure')} value="120/80" percent={60} color={COLORS.secondary} />
           <HealthMetric label={t('bloodSugar')} value="95 mg/dl" percent={85} color={COLORS.accentWarm} />
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ label, value, icon, color, bgColor, onPress }: { label: string; value: string; icon: string; color: string; bgColor: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress}>
    <View style={styles.statCardHeader}>
      <Text style={styles.statValue}>{value}</Text>
      <View style={[styles.iconWrapper, { backgroundColor: bgColor }]}>
        <FontAwesome5 name={icon as any} size={18} color={color} />
      </View>
    </View>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const QuickAction = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <View style={styles.quickActionIconBox}>
      <FontAwesome5 name={icon as any} size={20} color={COLORS.primaryLight} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

const HealthMetric = ({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) => (
  <View style={styles.healthMetricContainer}>
    <Text style={styles.healthMetricLabel}>{label}</Text>
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
    <Text style={[styles.healthMetricValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  bgCircle: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, zIndex: 1, marginTop: 40 },
  headerLeft: { flexDirection: 'row-reverse', alignItems: 'center' },
  logoBox: { width: 44, height: 44, backgroundColor: COLORS.primarySofter, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  logoEmoji: { fontSize: 24 },
  greeting: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  subGreeting: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderColor },
  badge: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger, borderWidth: 1, borderColor: COLORS.bgBase },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 16 },
  gridContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { width: '48%', backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderColor },
  statCardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statValue: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold' },
  iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  gradientCard: { backgroundColor: COLORS.primary, borderRadius: 24, padding: 24, marginBottom: 24 },
  gradientCardHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
  gradientCardEmoji: { fontSize: 32, marginLeft: 16 },
  gradientCardTexts: { flex: 1 },
  gradientCardTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4, textAlign: 'right' },
  gradientCardDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 20, textAlign: 'right' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'right' },
  quickActionsContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderColor },
  quickAction: { alignItems: 'center' },
  quickActionIconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: COLORS.borderColor },
  quickActionLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  healthMetricContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  healthMetricLabel: { color: COLORS.textSecondary, fontSize: 12, width: 80, textAlign: 'right' },
  progressBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginHorizontal: 12, flexDirection: 'row-reverse' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  healthMetricValue: { width: 70, textAlign: 'left', fontSize: 12, fontWeight: 'bold' },
});
