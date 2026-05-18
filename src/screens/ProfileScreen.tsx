import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { clearSession as logoutFromStorage } from '../utils/storage';

interface ProfileScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    reset: (state: { index: number; routes: { name: string }[] }) => void;
  };
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, setUser } = useUser();
  
  const progress = 0.75; 
  const pointsToNext = 250;
  const consultationsCount = user?.consultationsCount ?? 0;
  const bloodType = user?.bloodType || '--';
  const weight = user?.weight ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSection}>
           <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>
                  {user?.role === 'admin' ? '👨‍💼' : user?.role === 'doctor' ? '👨‍⚕️' : '👨'}
                </Text>
              </View>
              <View style={[styles.progressRing, { borderRightColor: COLORS.accentWarm, borderTopColor: COLORS.accentWarm, borderBottomColor: COLORS.accentWarm }]} />
           </View>
           
           <View style={styles.levelInfo}>
              <Text style={styles.name}>{user?.name}</Text>
              <View style={[styles.levelBadge, user?.role === 'admin' && { backgroundColor: COLORS.primary }, user?.role === 'doctor' && { backgroundColor: COLORS.secondary }]}>
                <FontAwesome5 
                  name={user?.role === 'admin' ? "user-shield" : user?.role === 'doctor' ? "stethoscope" : "crown"} 
                  size={10} 
                  color="#FFF" 
                  style={{ marginLeft: 4 }} 
                />
                <Text style={styles.levelText}>
                  {user?.role === 'admin' ? 'مسؤول النظام' : user?.role === 'doctor' ? 'طبيب ممارس' : `عضو ${user?.level}`}
                </Text>
              </View>
           </View>
        </View>

        {user?.role === 'doctor' && (
           <TouchableOpacity style={[styles.adminPanelBtn, { backgroundColor: COLORS.secondary }]} onPress={() => navigation.navigate('DoctorDashboard')}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#FFF" />
              <View style={styles.adminPanelTexts}>
                 <Text style={styles.adminTitle}>لوحة تحكم الطبيب</Text>
                 <Text style={styles.adminSub}>إدارة المرضى، المواعيد، وجدول العمل</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
           </TouchableOpacity>
        )}

        {user?.role === 'admin' && (
           <TouchableOpacity style={styles.adminPanelBtn} onPress={() => navigation.navigate('Admin')}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#FFF" />
              <View style={styles.adminPanelTexts}>
                 <Text style={styles.adminTitle}>لوحة تحكم المسؤول</Text>
                 <Text style={styles.adminSub}>إدارة المستخدمين، الأطباء، والتقارير المالية</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
           </TouchableOpacity>
        )}

        {user?.role === 'user' && (
          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
                <Text style={styles.pointsText}>بقي لك {pointsToNext} نقطة للوصول للمستوى التالي</Text>
                <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.levelLabels}>
                <Text style={styles.levelLabel}>فضي</Text>
                <Text style={styles.levelLabelActive}>ذهبي</Text>
                <Text style={styles.levelLabel}>بلاتيني</Text>
            </View>
          </GlassCard>
        )}

        <View style={styles.statsRow}>
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '120' : consultationsCount}</Text>
             <Text style={styles.statLbl}>{user?.role === 'doctor' ? 'مريض' : 'استشارة'}</Text>
           </View>
           <View style={styles.statBoxLine} />
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '4.9' : bloodType}</Text>
             <Text style={styles.statLbl}>{user?.role === 'doctor' ? 'تقييم' : 'فصيلة الدم'}</Text>
           </View>
           <View style={styles.statBoxLine} />
           <View style={styles.statBox}>
             <Text style={styles.statVal}>{user?.role === 'doctor' ? '8' : weight}</Text>
             <Text style={styles.statLbl}>{user?.role === 'doctor' ? 'خبير' : 'الوزن (كج)'}</Text>
           </View>
        </View>

        <Text style={styles.sectionTitle}>الحساب والمالية</Text>
        <GlassCard style={styles.card}>
           <SettingItem 
             icon="wallet" 
             label="المحفظة وطرق الدفع" 
             color={COLORS.secondary} 
             onPress={() => navigation.navigate('Payment')} 
           />
           <SettingItem 
             icon="history" 
             label="سجل المعاملات" 
             color={COLORS.primaryLight} 
             onPress={() => navigation.navigate('Transactions')}
           />
        </GlassCard>

        <Text style={styles.sectionTitle}>الإعدادات العامة</Text>
        <GlassCard style={styles.card}>
           <SettingItem 
             icon="user-edit" 
             label="تعديل البيانات" 
             color={COLORS.primaryLight} 
             onPress={() => navigation.navigate('EditProfile')}
           />
           <SettingItem 
             icon="language" 
             label="اللغة (العربية)" 
             color={COLORS.accentWarm} 
             onPress={() => navigation.navigate('Language')}
           />
           <SettingItem icon="bell" label="التنبيهات" color={COLORS.danger} onPress={() => navigation.navigate('Notifications')} />
           <SettingItem icon="shield-alt" label="الخصوصية والأمان" color={COLORS.textSecondary} />
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
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const SettingItem = ({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress?: () => void }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress}>
    <View style={styles.settingItemLeft}>
      <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
        <FontAwesome5 name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
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
  progressRing: { position: 'absolute', width: 106, height: 106, borderRadius: 53, borderWidth: 4, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'transparent' },
  levelInfo: { marginRight: 20, alignItems: 'flex-start' },
  name: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold' },
  levelBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.accentWarm, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 8 },
  levelText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
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
  logoutBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: 'rgba(227, 26, 26, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(227, 26, 26, 0.3)' },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: 'bold' }
});
