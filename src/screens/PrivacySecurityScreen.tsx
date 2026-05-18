import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';

export default function PrivacySecurityScreen({ navigation }: any) {
  const { user } = useUser();
  const { t } = useLanguage();

  const formatDate = (date?: string) => {
    if (!date) return '--';
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString();
  };

  const roleLabel =
    user?.role === 'admin'
      ? t('systemAdmin')
      : user?.role === 'doctor'
        ? t('doctorUser')
        : t('patient');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('privacyTitle')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <FontAwesome5 name="shield-alt" size={22} color={COLORS.primaryLight} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>{t('accountSecurity')}</Text>
            <Text style={styles.summarySub}>{t('localSessionNote')}</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <SecurityRow label={t('emailVerification')} value={user?.emailVerified ? t('verified') : t('notVerified')} ok={Boolean(user?.emailVerified)} />
          <SecurityRow label={t('phoneVerification')} value={user?.phoneVerified ? t('verified') : t('notVerified')} ok={Boolean(user?.phoneVerified)} />
          <SecurityRow label={t('accountStatus')} value={user?.isActive === false ? t('inactive') : t('active')} ok={user?.isActive !== false} />
          <SecurityRow label={t('accountRole')} value={roleLabel} ok />
          <SecurityRow label={t('createdAt')} value={formatDate(user?.createdAt)} ok />
          {user?.role === 'doctor' && (
            <SecurityRow label={t('approved')} value={user.isApproved === false ? t('pendingReview') : t('approved')} ok={user.isApproved !== false} />
          )}
        </GlassCard>

        <GlassCard style={styles.noteCard}>
          <FontAwesome5 name="lock" size={18} color={COLORS.accentWarm} />
          <Text style={styles.noteText}>{t('changePasswordHint')}</Text>
        </GlassCard>

        <GlassCard style={styles.noteCard}>
          <FontAwesome5 name="user-shield" size={18} color={COLORS.secondary} />
          <Text style={styles.noteText}>{t('dataPrivacyNote')}</Text>
        </GlassCard>

        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.actionText}>{t('manageProfileData')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const SecurityRow = ({ label, value, ok }: { label: string; value: string; ok: boolean }) => (
  <View style={styles.row}>
    <View style={[styles.statusDot, { backgroundColor: ok ? COLORS.secondary : COLORS.accentWarm }]} />
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 100 },
  summaryCard: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16, padding: 18 },
  summaryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySofter, marginLeft: 14 },
  summaryText: { flex: 1 },
  summaryTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  summarySub: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: 'right' },
  card: { padding: 8, marginBottom: 16 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 12 },
  rowText: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  rowValue: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'left' },
  noteCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, marginBottom: 12 },
  noteText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  actionBtn: { backgroundColor: COLORS.primary, borderRadius: 16, alignItems: 'center', paddingVertical: 16, marginTop: 12 },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
