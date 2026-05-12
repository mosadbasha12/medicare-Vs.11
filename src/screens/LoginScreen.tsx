import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator, Platform, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { createPasswordResetRequest, findUserInDB, isValidEmailFormat } from '../utils/storage';
import { useUser } from '../context/UserContext';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(title, message);
  }
};

export default function LoginScreen({ navigation }: { navigation: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setUser } = useUser();

  useEffect(() => {
    if (user) {
      let targetScreen = 'MainTabs';
      if (user.role === 'doctor') targetScreen = 'DoctorDashboard';
      else if (user.role === 'admin') targetScreen = 'Admin';
      navigation.reset({
        index: 0,
        routes: [{ name: targetScreen as any }],
      });
    }
  }, [user]);

  const handleLogin = async () => {
    if (!email.trim()) {
      showAlert('تنبيه', 'الرجاء إدخال البريد الإلكتروني');
      return;
    }
    if (!password.trim()) {
      showAlert('تنبيه', 'الرجاء إدخال كلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const foundUser = await findUserInDB(email.trim(), password);
      
      if (foundUser) {
        if ((foundUser as any).status === 'inactive') {
          showAlert('حساب معطل', 'حسابك معطل حالياً.\nتواصل مع إدارة النظام لإعادة التفعيل.');
          setLoading(false);
          return;
        }
        if ((foundUser as any).status === 'pending') {
          showAlert('قيد المراجعة', 'حسابك قيد المراجعة من الإدارة.\nسيتم إعلامك بعد الموافقة.');
          setLoading(false);
          return;
        }
        if ((foundUser as any).status === 'email_unverified') {
          showAlert('تأكيد البريد مطلوب', 'تم إرسال رابط تأكيد جديد إلى بريدك الإلكتروني.\nافتح الإيميل واضغط رابط التأكيد ثم سجل الدخول مرة أخرى.');
          setLoading(false);
          return;
        }
        const u = foundUser as any;
        setUser(u);
        setTimeout(() => {
          let targetScreen = 'MainTabs';
          if (u.role === 'doctor') targetScreen = 'DoctorDashboard';
          else if (u.role === 'admin') targetScreen = 'Admin';
          navigation.reset({
            index: 0,
            routes: [{ name: targetScreen as any }],
          });
        }, 100);
        showAlert('نجاح', `تم تسجيل الدخول بنجاح\nمرحباً ${u.name}`);
      } else {
        showAlert('خطأ', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } catch (error) {
      console.error('Login error:', error);
      showAlert('خطأ', 'حدث مشكلة أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      showAlert('تنبيه', 'اكتب البريد الإلكتروني أولاً ثم اضغط نسيت كلمة المرور.');
      return;
    }
    if (!isValidEmailFormat(cleanEmail)) {
      showAlert('تنبيه', 'صيغة البريد الإلكتروني غير صحيحة.');
      return;
    }

    setLoading(true);
    try {
      const result = await createPasswordResetRequest(cleanEmail);
      if (result === 'not_found') {
        showAlert('لم يتم العثور على الحساب', 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.');
      } else if (result === 'already_pending') {
        showAlert('طلب موجود', 'يوجد طلب استعادة كلمة مرور قيد مراجعة الأدمن بالفعل.');
      } else {
        showAlert(
          'تم إرسال الطلب للأدمن',
          `تم إنشاء طلب مراجعة بياناتك.\nالأدمن سيراجع الحساب: ${result.name}\nوإذا كانت البيانات صحيحة سيرد بكلمة مرور جديدة داخل لوحة الإدارة.`
        );
      }
    } catch {
      showAlert('خطأ', 'تعذر إنشاء طلب استعادة كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.bgCircle} />
      
      <View style={styles.container}>
        <View style={styles.logoBox}>
          <Text style={styles.emoji}>🏥</Text>
        </View>
        <Text style={styles.title}>أهلاً بك مجدداً</Text>
        <Text style={styles.subtitle}>الرجاء تسجيل الدخول للمتابعة</Text>

        <GlassCard style={styles.formCard}>
          <View style={styles.inputContainer}>
            <FontAwesome5 name="envelope" size={16} color={COLORS.textSecondary} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="البريد الإلكتروني"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <FontAwesome5 name="lock" size={16} color={COLORS.textSecondary} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
              editable={!loading}
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity 
            style={styles.forgotBtn} 
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={styles.forgotText}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              loading && { opacity: 0.7 },
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
            )}
          </Pressable>
        </GlassCard>

        <View style={styles.signupRow}>
          <Text style={styles.noAccountText}>ليس لديك حساب؟ </Text>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.signupText}>سجل الآن</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  bgCircle: { position: 'absolute', top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.primarySofter, pointerEvents: 'none' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoBox: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24, borderWidth: 1, borderColor: COLORS.primaryLight },
  emoji: { fontSize: 40 },
  title: { color: COLORS.textPrimary, fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', marginBottom: 40 },
  formCard: { padding: 24 },
  inputContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderColor },
  icon: { marginLeft: 12 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
  forgotBtn: { alignSelf: 'flex-start', marginBottom: 24, padding: 8 },
  forgotText: { color: COLORS.primaryLight, fontSize: 14, fontWeight: '600' },
  loginBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', minHeight: 56, justifyContent: 'center', marginTop: 8 },
  loginBtnText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold' },
  signupRow: { flexDirection: 'row-reverse', justifyContent: 'center', marginTop: 32, padding: 8 },
  noAccountText: { color: COLORS.textSecondary, fontSize: 16 },
  signupText: { color: COLORS.primaryLight, fontSize: 16, fontWeight: 'bold' }
});
