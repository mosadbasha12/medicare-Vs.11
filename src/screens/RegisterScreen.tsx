import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import {
  isStrongPassword,
  isThreePartName,
  isValidEmailFormat,
  isValidPhone,
  saveUserToDB,
} from '../utils/storage';
import { addDoctorToCatalog } from '../utils/localDataService';
import { useUser } from '../context/UserContext';
import type { UserRole } from '../types';

const EMAIL_DELIVERY_HINT = '\n\nإذا لم تجد الرسالة في البريد الوارد، راجع الرسائل غير المرغوب فيها (Junk/Spam).';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message);
  }
};

export default function RegisterScreen({ navigation }: { navigation: any }) {
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      const targetScreen = user.role === 'doctor' ? 'DoctorDashboard' : 'MainTabs';
      navigation.reset({
        index: 0,
        routes: [{ name: targetScreen as any }],
      });
    }
  }, [user]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [medicalId, setMedicalId] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [clinicLocation, setClinicLocation] = useState('');

  const handleRegister = async () => {
    if (!isThreePartName(name)) {
      showAlert('تنبيه', 'الاسم يجب أن يكون ثلاثياً على الأقل، مثال: محمد أحمد علي');
      return;
    }
    if (!isValidEmailFormat(email)) {
      showAlert('تنبيه', 'اكتب بريد إلكتروني صحيح بصيغة name@example.com');
      return;
    }
    if (!isValidPhone(phone)) {
      showAlert('تنبيه', 'اكتب رقم هاتف صحيح، ويمكنك إضافة كود الدولة مثل +20');
      return;
    }
    if (!isStrongPassword(password)) {
      showAlert('تنبيه', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حروف وأرقام.');
      return;
    }
    if (role === 'doctor') {
      if (!specialty.trim() || !nationalId.trim() || !medicalId.trim() || !clinicLocation.trim()) {
        showAlert('تنبيه', 'أكمل بيانات الطبيب: التخصص، الهوية الوطنية، رقم الكارت الطبي، وموقع العيادة.');
        return;
      }
    }
    setLoading(true);
    try {
      const newUser = {
        name: name.trim(),
        email: email.trim(),
        password,
        level: 'برونزي' as const,
        role: role,
        balance: 100,
        isActive: true,
        isApproved: role !== 'doctor',
        specialty: role === 'doctor' ? specialty.trim() : undefined,
        medicalId: role === 'doctor' ? medicalId.trim() : undefined,
        patientsCount: role === 'doctor' ? 0 : undefined,
        phone: phone.trim(),
        nationalId: role === 'doctor' ? nationalId.trim() : undefined,
        clinicLocation: role === 'doctor' ? clinicLocation.trim() : undefined,
        emailVerified: false,
        phoneVerified: true,
      };

      const savedUser = await saveUserToDB(newUser);

      if (savedUser) {
        if (role === 'doctor') {
          await addDoctorToCatalog(savedUser);
          showAlert('تم إنشاء الحساب', `مرحباً ${savedUser.name}\nتم إرسال رابط تأكيد إلى بريدك الإلكتروني.\nبعد تأكيد البريد سيظل حساب الطبيب قيد مراجعة الإدارة.${EMAIL_DELIVERY_HINT}`);
          navigation.navigate('Login');
        } else {
          showAlert('تم إنشاء الحساب', `مرحباً ${savedUser.name}\nتم إرسال رابط تأكيد إلى بريدك الإلكتروني.\nافتح الإيميل واضغط رابط التأكيد ثم سجل الدخول.${EMAIL_DELIVERY_HINT}`);
          navigation.navigate('Login');
        }
      } else {
        showAlert('خطأ', 'فشل في إنشاء الحساب. قد يكون البريد مسجلاً مسبقاً');
      }
    } catch (error) {
      console.error('Register error:', error);
      const code = (error as any)?.code;
      if (code === 'auth/operation-not-allowed') {
        showAlert('إعداد مطلوب', 'فعّل Email/Password من Firebase Authentication ثم جرّب مرة أخرى.');
      } else if (code === 'auth/email-already-in-use') {
        showAlert('خطأ', 'هذا البريد مسجل بالفعل.');
      } else {
        showAlert('خطأ', 'حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>إنشاء حساب جديد</Text>
            <Text style={styles.subtitle}>انضم إلى عائلة ميديكير برو اليوم</Text>
          </View>

          <View style={styles.roleSwitcher}>
            <Pressable 
              style={[styles.roleBtn, role === 'user' && styles.roleBtnActive]} 
              onPress={() => setRole('user')}
              disabled={loading}
            >
              <FontAwesome5 name="user" size={16} color={role === 'user' ? '#FFF' : COLORS.textSecondary} style={{ marginLeft: 8 }} />
              <Text style={[styles.roleBtnText, role === 'user' && styles.roleBtnTextActive]}>مريض</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]} 
              onPress={() => setRole('doctor')}
              disabled={loading}
            >
              <FontAwesome5 name="user-md" size={16} color={role === 'doctor' ? '#FFF' : COLORS.textSecondary} style={{ marginLeft: 8 }} />
              <Text style={[styles.roleBtnText, role === 'doctor' && styles.roleBtnTextActive]}>طبيب</Text>
            </Pressable>
          </View>

          <GlassCard style={styles.formCard}>
            <InputItem icon="user" placeholder="الاسم بالكامل" value={name} onChangeText={setName} editable={!loading} />
            <InputItem icon="envelope" placeholder="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
            <InputItem icon="phone" placeholder="رقم الهاتف مع كود الدولة" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!loading} />
            <InputItem icon="lock" placeholder="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
            {role === 'doctor' && (
              <View style={styles.doctorFields}>
                <View style={styles.separator} />
                <Text style={styles.doctorSectionTitle}>بيانات المهنة</Text>
                <InputItem icon="briefcase-medical" placeholder="التخصص الطبي" value={specialty} onChangeText={setSpecialty} editable={!loading} />
                <InputItem icon="id-card" placeholder="رقم الهوية الوطنية" value={nationalId} onChangeText={setNationalId} editable={!loading} />
                <InputItem icon="address-card" placeholder="رقم الكارت الطبي" value={medicalId} onChangeText={setMedicalId} editable={!loading} />
                <InputItem icon="map-marker-alt" placeholder="موقع العيادة" value={clinicLocation} onChangeText={setClinicLocation} editable={!loading} />
              </View>
            )}

            <Pressable 
              style={({ pressed }) => [
                styles.registerBtn,
                loading && { opacity: 0.7 },
                pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
              ]} 
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.registerBtnText}>إنشاء الحساب وإرسال تأكيد البريد</Text>}
            </Pressable>
          </GlassCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginText}>سجل دخول</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const InputItem = ({ icon, ...props }: any) => (
  <View style={styles.inputContainer}>
    <FontAwesome5 name={icon} size={16} color={COLORS.textSecondary} style={styles.icon} />
    <TextInput 
      style={styles.input} 
      placeholderTextColor={COLORS.textMuted} 
      textAlign="right"
      {...props} 
    />
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  content: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  header: { marginBottom: 32, alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8 },
  roleSwitcher: { flexDirection: 'row-reverse', backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 6, marginBottom: 24, borderWidth: 1, borderColor: COLORS.borderColor },
  roleBtn: { flex: 1, flexDirection: 'row-reverse', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  roleBtnActive: { backgroundColor: COLORS.primary },
  roleBtnText: { color: COLORS.textSecondary, fontWeight: 'bold' },
  roleBtnTextActive: { color: '#FFF' },
  formCard: { padding: 20 },
  inputContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderColor },
  icon: { marginLeft: 12, width: 20 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  doctorFields: { marginTop: 8 },
  separator: { height: 1, backgroundColor: COLORS.borderColor, marginBottom: 20 },
  doctorSectionTitle: { color: COLORS.primaryLight, fontSize: 14, fontWeight: 'bold', marginBottom: 16, textAlign: 'right' },
  registerBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12, minHeight: 56, justifyContent: 'center' },
  registerBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row-reverse', justifyContent: 'center', marginTop: 32 },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  loginText: { color: COLORS.primaryLight, fontWeight: 'bold', fontSize: 14 }
});
