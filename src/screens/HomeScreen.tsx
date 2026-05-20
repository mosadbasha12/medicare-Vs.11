import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getUserResults, getUserPrescriptions, subscribeNotificationSummary, subscribeUserAppointments } from '../utils/localDataService';
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
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const healthFields = [
    user?.age && user.age > 0 ? user.age : undefined,
    user?.weight && user.weight > 0 ? user.weight : undefined,
    user?.bloodType,
  ];
  const completedHealthFields = healthFields.filter(Boolean).length;
  const profileCompletion = Math.round((completedHealthFields / healthFields.length) * 100);
  const hasHealthData = completedHealthFields > 0;
  const consultationsCount = user?.consultationsCount ?? 0;
  const currencySymbol = user?.currency === 'USD' ? '$' : 'ج.م';

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;
      const [results, presc] = await Promise.all([
        getUserResults(user.uid),
        getUserPrescriptions(user.uid),
      ]);
      setResultsCount(results.length);
      setPrescriptionsCount(presc.length);
    };
    fetchData();
  }, [user?.uid]);

  useEffect(() => subscribeUserAppointments(user?.uid, (apts) => {
    setAppointmentsCount(apts.filter((a: any) => a.status === 'قادم').length);
  }), [user?.uid]);

  useEffect(() => subscribeNotificationSummary(user?.uid, (summary) => {
    setUnreadNotifications(summary.totalUnread);
    setUnreadChats(summary.unreadChats);
  }), [user?.uid]);

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
          {unreadNotifications > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.gridContainer}>
          <StatCard label={t('appointments')} value={String(appointmentsCount)} icon="calendar-check" color={COLORS.primaryLight} bgColor={COLORS.primarySoft} onPress={() => navigation.navigate('المواعيد')} />
          <StatCard label={t('results')} value={String(resultsCount)} icon="flask" color={COLORS.secondary} bgColor={COLORS.secondary + '22'} onPress={() => navigation.navigate('Results')} />
          <StatCard label={t('prescriptions')} value={String(prescriptionsCount)} icon="pills" color={COLORS.accentWarm} bgColor={COLORS.accentWarm + '22'} onPress={() => navigation.navigate('Prescriptions')} />
          <StatCard label={t('wallet')} value={`${user?.balance?.toFixed(0) || 0} ${currencySymbol}`} icon="wallet" color={COLORS.danger} bgColor="rgba(227, 26, 26, 0.15)" onPress={() => navigation.navigate('Payment')} />
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
          <QuickAction icon="comments" label={unreadChats > 0 ? `${t('chat')} (${unreadChats})` : t('chat')} onPress={() => navigation.navigate('ChatList')} />
          <QuickAction icon="vial" label={t('results')} onPress={() => navigation.navigate('Results')} />
          <QuickAction icon="first-aid" label={t('emergency')} onPress={() => navigation.navigate('Emergency')} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('healthOverview')}</Text>
        <GlassCard style={styles.healthOverviewCard}>
          <View style={styles.healthOverviewHeader}>
            <View style={styles.healthOverviewIcon}>
              <FontAwesome5 name="notes-medical" size={18} color={COLORS.accentWarm} />
            </View>
            <View style={styles.healthOverviewTexts}>
              <Text style={styles.healthOverviewTitle}>
                {hasHealthData ? t('profileComplete') : t('manageProfileData')}
              </Text>
              <Text style={styles.healthOverviewSubtitle}>
                {hasHealthData ? `${t('profileCompletion')} ${profileCompletion}%` : t('dataPrivacyNote')}
              </Text>
            </View>
          </View>

          <View style={styles.healthGrid}>
            <HealthMetric label={t('consultation')} value={String(consultationsCount)} icon="stethoscope" color={COLORS.primaryLight} />
            <HealthMetric label={t('bloodType')} value={user?.bloodType || '--'} icon="tint" color={COLORS.danger} />
            <HealthMetric label={t('weightKg')} value={user?.weight && user.weight > 0 ? String(user.weight) : '--'} icon="weight" color={COLORS.secondary} />
            <HealthMetric label={t('age')} value={user?.age && user.age > 0 ? String(user.age) : '--'} icon="birthday-cake" color={COLORS.accentWarm} />
          </View>

          {completedHealthFields < healthFields.length && (
            <TouchableOpacity style={styles.completeProfileBtn} onPress={() => navigation.navigate('EditProfile')}>
              <Text style={styles.completeProfileText}>{t('editProfile')}</Text>
              <Ionicons name="chevron-back" size={18} color={COLORS.bgBase} />
            </TouchableOpacity>
          )}
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

const HealthMetric = ({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) => (
  <View style={styles.healthMetricBox}>
    <View style={[styles.healthMetricIcon, { backgroundColor: color + '22' }]}>
      <FontAwesome5 name={icon as any} size={16} color={color} />
    </View>
    <Text style={styles.healthMetricValue}>{value}</Text>
    <Text style={styles.healthMetricLabel}>{label}</Text>
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
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: COLORS.danger, borderWidth: 1, borderColor: COLORS.bgBase, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
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
  healthOverviewCard: { marginBottom: 120, padding: 16 },
  healthOverviewHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  healthOverviewIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.accentWarm + '22', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  healthOverviewTexts: { flex: 1 },
  healthOverviewTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  healthOverviewSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'right', lineHeight: 18 },
  healthGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  healthMetricBox: { width: '48%', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 14, padding: 12, alignItems: 'flex-end' },
  healthMetricIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  healthMetricValue: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  healthMetricLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'right' },
  completeProfileBtn: { marginTop: 14, backgroundColor: COLORS.accentWarm, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  completeProfileText: { color: COLORS.bgBase, fontSize: 13, fontWeight: 'bold' },
});
