import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { clearSession as logoutFromStorage, getAccountTypeLabel, getPermissionLabel } from '../utils/storage';
import { useLanguage } from '../context/LanguageContext';
import { subscribeNotificationSummary } from '../utils/localDataService';

interface ProfileScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    reset: (state: { index: number; routes: { name: string }[] }) => void;
  };
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, setUser } = useUser();
  const { language, t } = useLanguage();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const profileFields = [
    user?.name,
    user?.email,
    user?.phone,
    user?.gender,
    user?.age && user.age > 0 ? user.age : undefined,
    user?.weight && user.weight > 0 ? user.weight : undefined,
    user?.bloodType,
  ];
  const completedFields = profileFields.filter(Boolean).length;
  const profileCompletion = Math.round((completedFields / profileFields.length) * 100);
  const missingFields = profileFields.length - completedFields;
  const consultationsCount = user?.consultationsCount ?? 0;
  const bloodType = user?.bloodType || '--';
  const weight = user?.weight ?? 0;
  const age = user?.age ?? 0;
  const gender = user?.gender || 'male';
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'owner' || (user?.adminPermissions?.length || 0) > 0;

  const avatarEmoji =
    user?.role === 'doctor'
        ? gender === 'female' ? '👩‍⚕️' : '👨‍⚕️'
        : gender === 'female' ? '👩' : '👨';

  const roleBadgeText = user?.role === 'doctor'
    ? `${getAccountTypeLabel(user?.role)} • ${getPermissionLabel(user?.role, user?.adminPermissions)}`
    : `${getAccountTypeLabel(user?.role)} • ${getPermissionLabel(user?.role, user?.adminPermissions)}`;

  useEffect(() => subscribeNotificationSummary(user?.uid, (summary) => {
    setUnreadNotifications(summary.totalUnread);
  }), [user?.uid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSection}>
           <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
              </View>
           </View>
           
           <View style={styles.levelInfo}>
              <Text style={styles.name}>{user?.name}</Text>
              <View style={[
                styles.levelBadge,
                user?.role === 'admin' && { backgroundColor: COLORS.primary },
                user?.role === 'doctor' && { backgroundColor: COLORS.secondary },
              ]}>
                <FontAwesome5 
                  name={user?.role === 'admin' || user?.role === 'owner' ? "user-shield" : user?.role === 'doctor' ? "stethoscope" : "user"} 
                  size={10} 
                  color="#FFF" 
                  style={{ marginLeft: 4 }} 
                />
                <Text style={styles.levelText}>
                  {roleBadgeText}
                </Text>
              </View>
           </View>
        </View>

        {user?.role === 'doctor' && (
           <TouchableOpacity style={[styles.adminPanelBtn, { backgroundColor: COLORS.secondary }]} onPress={() => navigation.navigate('DoctorDashboard')}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#FFF" />
              <View style={styles.adminPanelTexts}>
                 <Text style={styles.adminTitle}>{t('doctorDashboard')}</Text>
                 <Text style={styles.adminSub}>{t('doctorDashboardSub')}</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
           </TouchableOpacity>
        )}

        {hasAdminAccess && (
           <TouchableOpacity style={styles.adminPanelBtn} onPress={() => navigation.navigate('Admin')}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#FFF" />
              <View style={styles.adminPanelTexts}>
                 <Text style={styles.adminTitle}>{t('adminDashboard')}</Text>
                 <Text style={styles.adminSub}>{t('adminDashboardSub')}</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
           </TouchableOpacity>
        )}

        {user?.role !== 'doctor' && (
          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
                <Text style={styles.pointsText}>
                  {missingFields > 0 ? `${t('completeProfileHint')} ${missingFields}` : t('profileComplete')}
                </Text>
                <Text style={styles.progressPercent}>{profileCompletion}%</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${profileCompletion}%` }]} />
            </View>
            <View style={styles.levelLabels}>
                <Text style={styles.levelLabel}>{t('profileCompletion')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                  <Text style={styles.levelLabelActive}>{t('editProfile')}</Text>
                </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        <View style={styles.statsRow}>
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '120' : consultationsCount}</Text>
             <Text style={styles.statLbl}>{user?.role === 'doctor' ? t('patient') : t('consultation')}</Text>
           </View>
           <View style={styles.statBoxLine} />
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '4.9' : bloodType}</Text>
             <Text style={styles.statLbl}>{user?.role === 'doctor' ? t('rating') : t('bloodType')}</Text>
           </View>
           <View style={styles.statBoxLine} />
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '8' : weight}</Text>
             <Text style={styles.statLbl}>{user?.role === 'doctor' ? t('expert') : t('weightKg')}</Text>
           </View>
           <View style={styles.statBoxLine} />
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '--' : age}</Text>
             <Text style={styles.statLbl}>{t('age')}</Text>
           </View>
        </View>

        <Text style={styles.sectionTitle}>{t('accountFinance')}</Text>
        <GlassCard style={styles.card}>
           <SettingItem 
             icon="wallet" 
             label={t('wallet')} 
             color={COLORS.secondary} 
             onPress={() => navigation.navigate('Payment')} 
           />
           <SettingItem 
             icon="history" 
             label={t('transactions')} 
             color={COLORS.primaryLight} 
             onPress={() => navigation.navigate('Transactions')}
           />
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('generalSettings')}</Text>
        <GlassCard style={styles.card}>
           <SettingItem 
             icon="user-edit" 
             label={t('editProfile')} 
             color={COLORS.primaryLight} 
             onPress={() => navigation.navigate('EditProfile')}
           />
           <SettingItem 
             icon="language" 
             label={language === 'ar' ? t('languageArabic') : t('languageEnglish')} 
             color={COLORS.accentWarm} 
             onPress={() => navigation.navigate('Language')}
           />
           <SettingItem icon="palette" label="الثيمات" color={COLORS.primaryLight} onPress={() => navigation.navigate('Theme')} />
           <SettingItem icon="bell" label={t('notifications')} color={COLORS.danger} badgeCount={unreadNotifications} onPress={() => navigation.navigate('Notifications')} />
           <SettingItem icon="shield-alt" label={t('privacy')} color={COLORS.textSecondary} onPress={() => navigation.navigate('PrivacySecurity')} />
        </GlassCard>

        <TouchableOpacity 
          style={styles.logoutBtn}
          onPress={async () => {
            await logoutFromStorage();
            setUser(null);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        >
          <FontAwesome5 name="sign-out-alt" size={16} color={COLORS.danger} style={{ marginLeft: 8 }} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const SettingItem = ({ icon, label, color, badgeCount = 0, onPress }: { icon: string; label: string; color: string; badgeCount?: number; onPress?: () => void }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress}>
    <View style={styles.settingItemLeft}>
      <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
        <FontAwesome5 name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
      {badgeCount > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </View>
    <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { paddingHorizontal: 24, paddingVertical: 20, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', textAlign: 'right' },
  scroll: { paddingHorizontal: 24, paddingBottom: 100 },
  avatarSection: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 24 },
  avatarContainer: { position: 'relative', width: 110, height: 110, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  avatarEmoji: { fontSize: 40 },
  levelInfo: { marginRight: 20, alignItems: 'flex-start' },
  name: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold' },
  levelBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  levelText: { color: COLORS.bgBase, fontSize: 12, fontWeight: 'bold' },
  adminPanelBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primary, padding: 20, borderRadius: 24, marginBottom: 24 },
  adminPanelTexts: { flex: 1, marginRight: 16 },
  adminTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  adminSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'right', marginTop: 4 },
  progressCard: { padding: 20, marginBottom: 24 },
  progressHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pointsText: { color: COLORS.textSecondary, fontSize: 12 },
  progressPercent: { color: COLORS.accentWarm, fontWeight: 'bold', fontSize: 16 },
  progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.accentWarm, borderRadius: 4 },
  levelLabels: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  levelLabel: { color: COLORS.textMuted, fontSize: 10 },
  levelLabelActive: { color: COLORS.accentWarm, fontSize: 11, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderRadius: 20, paddingVertical: 16, marginBottom: 32, borderWidth: 1, borderColor: COLORS.borderColor },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  statLbl: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  statBoxLine: { width: 1, backgroundColor: COLORS.borderColor },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 16 },
  card: { padding: 8, marginBottom: 24 },
  settingItem: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  settingItemLeft: { flexDirection: 'row-reverse', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  settingLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '500' },
  notificationBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  notificationBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  logoutBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: 'rgba(227, 26, 26, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(227, 26, 26, 0.3)' },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: 'bold' }
});
