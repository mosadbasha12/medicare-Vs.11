import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch, Platform, TextInput } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { getAllUsers, getUserAppointments, getAllDoctors, getPendingDoctors, toggleUserActive, deleteUser, approveDoctor, rejectDoctor, setUserAdminPermission, setAdminPermissions, getPlatformSettings, updatePlatformSettings } from '../utils/localDataService';
import { clearSession, getAccountTypeLabel, getPermissionLabel } from '../utils/storage';
import { useUser } from '../context/UserContext';
import type { AdminPermission } from '../types';

function showConfirmation(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: onConfirm },
    ]);
  }
}

function showInfo(title: string, message: string) {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message);
  }
}

export default function AdminDashboard({ navigation }: any) {
  const { user, setUser } = useUser();
  const [stats, setStats] = useState({ totalUsers: 0, totalDoctors: 0, totalAppointments: 0, totalPatients: 0, pendingDoctors: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pending' | 'doctors' | 'settings'>('overview');
  const [commissionRate, setCommissionRate] = useState('5');
  const [instapayHandle, setInstapayHandle] = useState('medicare@instapay');
  const [loading, setLoading] = useState(true);
  const isOwner = user?.role === 'owner';
  const adminPermissions = user?.adminPermissions || (user?.role === 'admin' ? ['approveDoctors'] : []);
  const canApproveDoctors = isOwner || adminPermissions.includes('approveDoctors');
  const canManageUsers = isOwner || adminPermissions.includes('manageUsers');
  const canManageDoctors = isOwner || adminPermissions.includes('manageDoctors');
  const tabs = [
    { key: 'overview' as const, label: 'نظرة', visible: true },
    { key: 'users' as const, label: 'الحسابات', visible: canManageUsers },
    { key: 'pending' as const, label: 'طلبات الأطباء', visible: canApproveDoctors },
    { key: 'doctors' as const, label: 'الأطباء', visible: canManageDoctors },
    { key: 'settings' as const, label: 'الدفع', visible: isOwner },
  ].filter((tab) => tab.visible);
  const permissionOptions: { key: AdminPermission; label: string }[] = [
    { key: 'approveDoctors', label: 'قبول ورفض الأطباء' },
    { key: 'manageUsers', label: 'إدارة الحسابات' },
    { key: 'manageDoctors', label: 'عرض الأطباء المعتمدين' },
  ];
  const hasAdminPermission = (target: any) =>
    target.role === 'admin' || (target.adminPermissions?.length || 0) > 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      const allDoctors = await getAllDoctors();
      const pending = await getPendingDoctors();
      let totalAppointments = 0;
      for (const u of allUsers) {
        const apts = await getUserAppointments(u.uid);
        totalAppointments += apts.length;
      }
      const doctorsCount = allUsers.filter((u: any) => u.role === 'doctor' && u.isApproved !== false).length;
      const patientsCount = allUsers.filter((u: any) => u.role !== 'doctor').length;

      setStats({
        totalUsers: allUsers.length,
        totalDoctors: doctorsCount,
        totalAppointments,
        totalPatients: patientsCount,
        pendingDoctors: pending.length,
      });
      setUsers(allUsers);
      setPendingDoctors(pending);
      const settings = await getPlatformSettings();
      setCommissionRate(String(settings.commissionRate));
      setInstapayHandle(settings.instapayHandle);
    } catch (e) {
      console.error('Error fetching admin data:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = () => {
    showConfirmation('تسجيل خروج', 'هل تريد تسجيل الخروج؟', () => {
      clearSession();
      setUser(null);
    });
  };

  const handleToggleUser = async (uid: string, currentActive: boolean) => {
    const success = await toggleUserActive(uid, !currentActive);
    if (success) {
      const action = !currentActive ? 'تفعيل' : 'تعطيل';
      showInfo('تم', `تم ${action} المستخدم بنجاح`);
      fetchData();
    }
  };

  const handleDeleteUser = (uid: string, userName: string) => {
    showConfirmation('حذف مستخدم', `هل تريد حذف "${userName}" نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.`, async () => {
      const success = await deleteUser(uid);
      if (success) {
        showInfo('تم', 'تم حذف المستخدم وجميع بياناته');
        fetchData();
      } else {
        showInfo('خطأ', 'فشل في حذف المستخدم');
      }
    });
  };

  const handleSetAdmin = (target: any, makeAdmin: boolean) => {
    showConfirmation(
      makeAdmin ? 'منح صلاحية أدمن' : 'إلغاء صلاحية أدمن',
      makeAdmin
        ? `هل تريد جعل "${target.name}" أدمن؟`
        : `هل تريد إلغاء صلاحية الأدمن من "${target.name}"؟`,
      async () => {
        const success = await setUserAdminPermission(target.uid, makeAdmin, user?.role);
        showInfo(success ? 'تم' : 'خطأ', success ? 'تم تحديث الصلاحية بنجاح.' : 'فشل تحديث الصلاحية. هذه العملية متاحة للأونر فقط.');
        fetchData();
      }
    );
  };

  const handleToggleAdminPermission = (target: any, permission: AdminPermission) => {
    const current = target.adminPermissions || ['approveDoctors'];
    const next = current.includes(permission)
      ? current.filter((item: AdminPermission) => item !== permission)
      : [...current, permission];

    showConfirmation('تعديل صلاحيات الأدمن', `هل تريد تحديث صلاحيات "${target.name}"؟`, async () => {
      const success = await setAdminPermissions(target.uid, next, user?.role);
      showInfo(success ? 'تم' : 'خطأ', success ? 'تم تحديث صلاحيات الأدمن.' : 'فشل تحديث الصلاحيات. هذه العملية متاحة للأونر فقط.');
      fetchData();
    });
  };

  const handleApproveDoctor = async (uid: string, name: string) => {
    const success = await approveDoctor(uid);
    if (success) {
      showInfo('تم', `تم اعتماد الدكتور "${name}"\nأصبح متاحاً الآن للمرضى`);
      fetchData();
    }
  };

  const handleSavePaymentSettings = async () => {
    const parsedRate = Number(commissionRate.replace(',', '.'));
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 30) {
      showInfo('تنبيه', 'النسبة لازم تكون بين 0 و 30%.');
      return;
    }
    const success = await updatePlatformSettings({ commissionRate: parsedRate, instapayHandle }, user?.role);
    showInfo(success ? 'تم' : 'خطأ', success ? 'تم حفظ إعدادات الدفع والعمولة.' : 'فشل حفظ الإعدادات. متاح للأونر فقط.');
  };

  const handleRejectDoctor = (uid: string, name: string) => {
    showConfirmation('رفض طبيب', `هل تريد رفض طلب "${name}"؟\nسيتم حذف حسابه وبياناته.`, async () => {
      const success = await rejectDoctor(uid);
      if (success) {
        showInfo('تم', `تم رفض طلب الدكتور "${name}"`);
        fetchData();
      } else {
        showInfo('خطأ', 'فشل في رفض الطلب');
      }
    });
  };

  const getRoleLabel = (role: string) => {
    return getAccountTypeLabel(role);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'doctor': return COLORS.secondary;
      case 'owner':
      case 'admin':
      case 'user': return COLORS.primaryLight;
      default: return COLORS.textSecondary;
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return 'غير متوفر';
    return new Date(value).toLocaleString('ar-EG');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة تحكم المسؤول</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.adminInfoRow}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.danger} />
          <Text style={styles.adminName}>{user?.name}</Text>
          <Text style={styles.adminEmail}>{user?.email}</Text>
          <Text style={styles.adminEmail}>الصلاحية: {getPermissionLabel(user?.role, user?.adminPermissions)}</Text>
        </View>

        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && <Text style={styles.loadingText}>جاري التحميل...</Text>}

        {!loading && activeTab === 'overview' && (
          <>
            <View style={styles.statsRow}>
              <AdminStat icon="users" label="إجمالي المستخدمين" val={stats.totalUsers.toString()} color={COLORS.primaryLight} />
              <AdminStat icon="user-md" label="الأطباء" val={stats.totalDoctors.toString()} color={COLORS.secondary} />
            </View>
            <View style={styles.statsRow}>
              <AdminStat icon="calendar-check" label="المواعيد" val={stats.totalAppointments.toString()} color={COLORS.accentWarm} />
              <AdminStat icon="user" label="المرضى" val={stats.totalPatients.toString()} color={COLORS.danger} />
            </View>

            {stats.pendingDoctors > 0 && (
              <TouchableOpacity style={styles.pendingAlert} onPress={() => setActiveTab('pending')}>
                <View style={styles.pendingAlertRow}>
                  <Ionicons name="hourglass" size={22} color={COLORS.accentWarm} />
                  <Text style={styles.pendingAlertText}>
                    يوجد {stats.pendingDoctors} طبيب{stats.pendingDoctors > 1 ? '' : ''} قيد المراجعة
                  </Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={COLORS.accentWarm} />
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>إدارة النظام</Text>
            <GlassCard style={styles.managementCard}>
              {canManageUsers && <TouchableOpacity style={styles.actionItem} onPress={() => setActiveTab('users')}>
                <View style={styles.actionRight}>
                  <View style={[styles.actionIconBox, { backgroundColor: COLORS.primaryLight + '22' }]}>
                    <MaterialCommunityIcons name="account-cog" size={20} color={COLORS.primaryLight} />
                  </View>
                  <Text style={styles.actionLabel}>إدارة المستخدمين</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>}
              {canApproveDoctors && <TouchableOpacity style={styles.actionItem} onPress={() => setActiveTab('pending')}>
                <View style={styles.actionRight}>
                  <View style={[styles.actionIconBox, { backgroundColor: COLORS.accentWarm + '22' }]}>
                    <MaterialCommunityIcons name="clock-check-outline" size={20} color={COLORS.accentWarm} />
                  </View>
                  <Text style={styles.actionLabel}>طلبات الأطباء</Text>
                </View>
                <View style={styles.actionLeft}>
                  <View style={[styles.badge, { backgroundColor: COLORS.accentWarm }]}>
                    <Text style={styles.badgeText}>{stats.pendingDoctors}</Text>
                  </View>
                  <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>}
              {canManageDoctors && <TouchableOpacity style={[styles.actionItem, { borderBottomWidth: 0 }]} onPress={() => setActiveTab('doctors')}>
                <View style={styles.actionRight}>
                  <View style={[styles.actionIconBox, { backgroundColor: COLORS.secondary + '22' }]}>
                    <MaterialCommunityIcons name="doctor" size={20} color={COLORS.secondary} />
                  </View>
                  <Text style={styles.actionLabel}>التحقق من الأطباء</Text>
                </View>
                <View style={styles.actionLeft}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{stats.totalDoctors}</Text>
                  </View>
                  <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                </View>
              </TouchableOpacity>}
              {isOwner && <TouchableOpacity style={[styles.actionItem, { borderBottomWidth: 0 }]} onPress={() => setActiveTab('settings')}>
                <View style={styles.actionRight}>
                  <View style={[styles.actionIconBox, { backgroundColor: COLORS.danger + '22' }]}>
                    <MaterialCommunityIcons name="cash-multiple" size={20} color={COLORS.danger} />
                  </View>
                  <Text style={styles.actionLabel}>إعدادات الدفع والعمولة</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>}
            </GlassCard>
          </>
        )}

        {!loading && activeTab === 'settings' && isOwner && (
          <GlassCard style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>إعدادات عمولة التطبيق</Text>
            <Text style={styles.settingsHint}>هذه النسبة تظهر للمرضى والأطباء ويتم خصمها من قيمة كل استشارة أو حجز.</Text>
            <Text style={styles.settingsLabel}>نسبة التطبيق (%)</Text>
            <TextInput
              style={styles.settingsInput}
              value={commissionRate}
              onChangeText={setCommissionRate}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.settingsLabel}>حساب Instapay لاستقبال التحويلات</Text>
            <TextInput
              style={styles.settingsInput}
              value={instapayHandle}
              onChangeText={setInstapayHandle}
              placeholder="medicare@instapay"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.saveSettingsBtn} onPress={handleSavePaymentSettings}>
              <Text style={styles.saveSettingsText}>حفظ إعدادات الدفع</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {!loading && activeTab === 'users' && canManageUsers && (
          <>
            {users.filter((u) => isOwner ? u.role !== 'owner' : u.role !== 'admin' && u.role !== 'owner').length === 0 ? (
              <Text style={styles.emptyText}>لا يوجد مستخدمين حالياً</Text>
            ) : (
              users.filter((u) => isOwner ? u.role !== 'owner' : u.role !== 'admin' && u.role !== 'owner').map((u) => (
                <GlassCard key={u.uid} style={styles.userCard}>
                  <View style={styles.userRow}>
                    <View style={styles.userAvatar}>
                      <FontAwesome5 name={u.role === 'doctor' ? 'user-md' : 'user'} size={18} color={getRoleColor(u.role)} />
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.name}</Text>
                      <Text style={styles.userEmail}>{u.email}</Text>
                      <Text style={styles.userMeta}>الهاتف: {u.phone || 'غير مسجل'}</Text>
                      <Text style={styles.userMeta}>تاريخ الإنشاء: {formatDate(u.createdAt)}</Text>
                      {u.role === 'doctor' && (
                        <>
                          <Text style={styles.userMeta}>التخصص: {u.specialty || 'غير محدد'}</Text>
                          <Text style={styles.userMeta}>الهوية: {u.nationalId || 'غير محدد'} | الكارت الطبي: {u.medicalId || 'غير محدد'}</Text>
                          <Text style={styles.userMeta}>العيادة: {u.clinicLocation || 'غير محدد'}</Text>
                          <Text style={styles.userMeta}>حالة الاعتماد: {u.isApproved === false ? 'قيد المراجعة' : 'معتمد'}</Text>
                        </>
                      )}
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(u.role) + '22' }]}>
                      <Text style={[styles.roleBadgeText, { color: getRoleColor(u.role) }]}>{getRoleLabel(u.role)}</Text>
                    </View>
                  </View>
                  <View style={styles.permissionLine}>
                    <Text style={styles.userMeta}>الصلاحية: {getPermissionLabel(u.role, u.adminPermissions)}</Text>
                    {isOwner && (
                      <TouchableOpacity
                        style={[styles.adminPermissionBtn, hasAdminPermission(u) && styles.adminPermissionBtnDanger]}
                        onPress={() => handleSetAdmin(u, !hasAdminPermission(u))}
                      >
                        <Ionicons name={hasAdminPermission(u) ? 'remove-circle-outline' : 'shield-checkmark-outline'} size={16} color="#FFF" />
                        <Text style={styles.adminPermissionText}>{hasAdminPermission(u) ? 'إلغاء أدمن' : 'جعله أدمن'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {isOwner && hasAdminPermission(u) && (
                    <View style={styles.permissionsBox}>
                      <Text style={styles.permissionsTitle}>صلاحيات هذا الأدمن</Text>
                      {permissionOptions.map((option) => {
                        const selected = (u.adminPermissions || ['approveDoctors']).includes(option.key);
                        return (
                          <TouchableOpacity
                            key={option.key}
                            style={styles.permissionOption}
                            onPress={() => handleToggleAdminPermission(u, option.key)}
                          >
                            <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color={selected ? COLORS.accentWarm : COLORS.textSecondary} />
                            <Text style={styles.permissionOptionText}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  <View style={styles.userActions}>
                    <View style={styles.userActionRight}>
                      <Text style={styles.userActionLabel}>{u.isActive ? 'مفعّل' : 'معطّل'}</Text>
                      <Switch
                        value={u.isActive}
                        onValueChange={() => handleToggleUser(u.uid, u.isActive)}
                        trackColor={{ false: COLORS.danger + '44', true: COLORS.accentWarm + '66' }}
                        thumbColor={u.isActive ? COLORS.accentWarm : COLORS.danger}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteUser(u.uid, u.name)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      <Text style={styles.deleteBtnText}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        )}

        {!loading && activeTab === 'pending' && canApproveDoctors && (
          <>
            {pendingDoctors.length === 0 ? (
              <GlassCard style={styles.noPendingCard}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.accentWarm} />
                <Text style={styles.noPendingTitle}>لا يوجد طلبات قيد الانتظار</Text>
                <Text style={styles.noPendingText}>جميع الأطباء معتمدون حالياً</Text>
              </GlassCard>
            ) : (
              pendingDoctors.map((d) => (
                <GlassCard key={d.uid} style={styles.pendingCard}>
                  <View style={styles.pendingHeader}>
                    <View style={styles.pendingAvatar}>
                      <Text style={styles.pendingEmoji}>👨‍⚕️</Text>
                    </View>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingName}>{d.name}</Text>
                      <Text style={styles.pendingSpec}>{d.specialty || 'غير محدد'}</Text>
                      <Text style={styles.pendingMedId}>رقم القيد: {d.medicalId || 'غير محدد'}</Text>
                      <Text style={styles.pendingMedId}>الهاتف: {d.phone || 'غير مسجل'}</Text>
                      <Text style={styles.pendingMedId}>الهوية: {d.nationalId || 'غير محدد'}</Text>
                      <Text style={styles.pendingMedId}>العيادة: {d.clinicLocation || 'غير محدد'}</Text>
                      <Text style={styles.pendingMedId}>تاريخ الطلب: {formatDate(d.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: COLORS.accentWarm + '22' }]}>
                      <Text style={[styles.statusBadgeText, { color: COLORS.accentWarm }]}>قيد المراجعة</Text>
                    </View>
                  </View>
                  <View style={styles.pendingDetails}>
                    <Ionicons name="mail-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.pendingEmail}>{d.email}</Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={[styles.pendingBtn, styles.approveBtn]}
                      onPress={() => handleApproveDoctor(d.uid, d.name)}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={styles.pendingBtnText}>اعتماد</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pendingBtn, styles.rejectBtn]}
                      onPress={() => handleRejectDoctor(d.uid, d.name)}
                    >
                      <Ionicons name="close-circle" size={18} color="#FFF" />
                      <Text style={styles.pendingBtnText}>رفض</Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        )}

        {!loading && activeTab === 'doctors' && canManageDoctors && (
          <>
            {users.filter((u) => u.role === 'doctor' && u.isApproved !== false).length === 0 ? (
              <Text style={styles.emptyText}>لا يوجد أطباء معتمدين حالياً</Text>
            ) : (
              users.filter((u) => u.role === 'doctor' && u.isApproved !== false).map((d) => (
                <GlassCard key={d.uid} style={styles.doctorCard}>
                  <View style={styles.doctorRow}>
                    <View style={styles.doctorAvatar}>
                      <Text style={styles.doctorEmoji}>👨‍⚕️</Text>
                    </View>
                    <View style={styles.doctorInfo}>
                      <Text style={styles.doctorName}>{d.name}</Text>
                      <Text style={styles.doctorSpec}>{d.specialty || 'غير محدد'}</Text>
                      <Text style={styles.doctorMedId}>رقم القيد: {d.medicalId || 'غير محدد'}</Text>
                      <Text style={styles.doctorMedId}>الهاتف: {d.phone || 'غير مسجل'}</Text>
                      <Text style={styles.doctorMedId}>العيادة: {d.clinicLocation || 'غير محدد'}</Text>
                      <Text style={styles.doctorMedId}>تاريخ الإنشاء: {formatDate(d.createdAt)}</Text>
                    </View>
                  </View>
                  <View style={styles.doctorFooter}>
                    <Text style={styles.doctorEmail}>{d.email}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: COLORS.secondary + '22' }]}>
                      <Text style={[styles.roleBadgeText, { color: COLORS.secondary }]}>طبيب</Text>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const AdminStat = ({ icon, label, val, color }: any) => (
  <GlassCard style={styles.statBox}>
    <View style={[styles.statIconBox, { backgroundColor: color + '22' }]}>
      <FontAwesome5 name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statVal}>{val}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </GlassCard>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 60 },
  adminInfoRow: { alignItems: 'center', marginBottom: 24, gap: 4 },
  adminName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  adminEmail: { color: COLORS.textSecondary, fontSize: 13 },
  tabRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  tabText: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 11 },
  tabTextActive: { color: '#FFF' },
  loadingText: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 16 },
  statBox: { width: '48%', padding: 16, alignItems: 'center' },
  statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statVal: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginVertical: 16 },
  pendingAlert: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.accentWarm + '18', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.accentWarm + '44' },
  pendingAlertRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  pendingAlertText: { color: COLORS.accentWarm, fontSize: 14, fontWeight: 'bold' },
  managementCard: { padding: 10, marginBottom: 24 },
  actionItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  actionRight: { flexDirection: 'row-reverse', alignItems: 'center' },
  actionIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  actionLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500' },
  actionLeft: { flexDirection: 'row-reverse', alignItems: 'center' },
  badge: { backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  userCard: { padding: 14, marginBottom: 12 },
  userRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  userInfo: { flex: 1 },
  userName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  userEmail: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 2 },
  userMeta: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right', marginTop: 2 },
  resetNote: { color: COLORS.accentWarm, fontSize: 12, textAlign: 'right', marginTop: 6, fontWeight: 'bold' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 11, fontWeight: 'bold' },
  permissionLine: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 },
  adminPermissionBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 6 },
  adminPermissionBtnDanger: { backgroundColor: COLORS.danger },
  adminPermissionText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  permissionsBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderColor },
  permissionsTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  permissionOption: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, gap: 8 },
  permissionOptionText: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right' },
  userActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.borderColor },
  userActionRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  userActionLabel: { color: COLORS.textSecondary, fontSize: 13 },
  deleteBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.danger + '22', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 6 },
  deleteBtnText: { color: COLORS.danger, fontSize: 13, fontWeight: 'bold' },
  noPendingCard: { padding: 32, alignItems: 'center' },
  noPendingTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  noPendingText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6 },
  pendingCard: { padding: 16, marginBottom: 14 },
  pendingHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  pendingAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', marginLeft: 12, borderWidth: 1, borderColor: COLORS.accentWarm },
  pendingEmoji: { fontSize: 24 },
  pendingInfo: { flex: 1 },
  pendingName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  pendingSpec: { color: COLORS.accentWarm, fontSize: 13, marginTop: 2, textAlign: 'right' },
  pendingMedId: { color: COLORS.textMuted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
  pendingDetails: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: 8, padding: 10, marginBottom: 14, gap: 8 },
  pendingEmail: { color: COLORS.textSecondary, fontSize: 13 },
  pendingActions: { flexDirection: 'row-reverse', gap: 10 },
  pendingBtn: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  approveBtn: { backgroundColor: COLORS.accentWarm },
  rejectBtn: { backgroundColor: COLORS.danger },
  pendingBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  doctorCard: { padding: 14, marginBottom: 12 },
  doctorRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  doctorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', marginLeft: 12, borderWidth: 1, borderColor: COLORS.secondary },
  doctorEmoji: { fontSize: 24 },
  doctorInfo: { flex: 1 },
  doctorName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  doctorSpec: { color: COLORS.secondary, fontSize: 13, marginTop: 2, textAlign: 'right' },
  doctorMedId: { color: COLORS.textMuted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  doctorFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 10 },
  doctorEmail: { color: COLORS.textSecondary, fontSize: 12 },
  settingsCard: { padding: 18, marginBottom: 18 },
  settingsTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 8 },
  settingsHint: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', lineHeight: 18, marginBottom: 16 },
  settingsLabel: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'right', marginBottom: 8 },
  settingsInput: { color: COLORS.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor, borderRadius: 12, padding: 12, marginBottom: 14, textAlign: 'right' },
  saveSettingsBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveSettingsText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});
