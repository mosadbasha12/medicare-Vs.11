import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { requestDoctorProfileUpdate, updateUserProfile } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';
import type { Currency } from '../types';

interface EditProfileScreenProps {
  navigation: {
    goBack: () => void;
  };
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user, setUser } = useUser();
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [weight, setWeight] = useState(String(user?.weight ?? 0));
  const [bloodType, setBloodType] = useState(user?.bloodType || '');
  const [age, setAge] = useState(String(user?.age ?? 0));
  const [gender, setGender] = useState<'male' | 'female'>(user?.gender || 'male');
  const [currency, setCurrency] = useState<Currency>(user?.currency || 'EGP');
  const [specialty, setSpecialty] = useState(user?.specialty || '');
  const [medicalId, setMedicalId] = useState(user?.medicalId || '');
  const [nationalId, setNationalId] = useState(user?.nationalId || '');
  const [clinicLocation, setClinicLocation] = useState(user?.clinicLocation || '');
  const [doctorVideoPrice, setDoctorVideoPrice] = useState(String(user?.doctorVideoPrice ?? 60));
  const [doctorClinicPrice, setDoctorClinicPrice] = useState(String(user?.doctorClinicPrice ?? user?.doctorVideoPrice ?? 60));
  const [loading, setLoading] = useState(false);
  const showHealthFields = Boolean(user);
  const isDoctor = user?.role === 'doctor';

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('تنبيه', 'الرجاء إدخال الاسم');
      return;
    }

    const parsedWeight = Number(weight.replace(',', '.'));
    const parsedAge = Number(age.replace(',', '.'));
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      Alert.alert('تنبيه', 'الرجاء إدخال وزن صحيح');
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) {
      Alert.alert('تنبيه', 'الرجاء إدخال عمر صحيح');
      return;
    }

    const doctorVideo = Number(doctorVideoPrice.replace(',', '.'));
    const doctorClinic = Number(doctorClinicPrice.replace(',', '.'));
    if (isDoctor && (!Number.isFinite(doctorVideo) || doctorVideo < 0 || !Number.isFinite(doctorClinic) || doctorClinic < 0)) {
      Alert.alert('تنبيه', 'اكتب أسعار صحيحة للاستشارة والعيادة');
      return;
    }

    const updates = {
      name: name.trim(),
      phone: phone.trim(),
      currency,
      ...(showHealthFields ? { weight: parsedWeight, bloodType, age: parsedAge, gender } : {}),
      ...(isDoctor ? {
        specialty: specialty.trim(),
        medicalId: medicalId.trim(),
        nationalId: nationalId.trim(),
        clinicLocation: clinicLocation.trim(),
        doctorVideoPrice: doctorVideo,
        doctorClinicPrice: doctorClinic,
      } : {}),
    };

    setLoading(true);
    try {
      const success = isDoctor
        ? await requestDoctorProfileUpdate(user, updates)
        : await updateUserProfile(user.uid, updates);
      if (success) {
        if (isDoctor) {
          const pendingProfileUpdate = { updates, requestedAt: new Date().toISOString(), status: 'pending' as const };
          setUser({ ...user, pendingProfileUpdate });
          Alert.alert('تم إرسال الطلب', 'تم إرسال تعديل بيانات الطبيب للأدمن/الأونر للمراجعة. لن تتغير البيانات إلا بعد الموافقة.');
        } else {
          setUser({ ...user, ...updates });
          Alert.alert('نجاح', 'تم حفظ التغييرات بنجاح');
        }
        navigation.goBack();
      } else {
        Alert.alert('خطأ', 'فشل في حفظ التغييرات');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('editProfileTitle')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <GlassCard style={styles.card}>
          <Text style={styles.label}>{t('fullName')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('fullName')} placeholderTextColor={COLORS.textSecondary} editable={!loading} />
          
          <Text style={styles.label}>{t('email')}</Text>
          <TextInput style={styles.input} value={user?.email} editable={false} placeholderTextColor={COLORS.textSecondary} keyboardType="email-address" />
          
          <Text style={styles.label}>{t('phone')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="05XXXXXXXX" placeholderTextColor={COLORS.textSecondary} keyboardType="phone-pad" editable={!loading} />

          {isDoctor && user?.pendingProfileUpdate?.status === 'pending' && (
            <View style={styles.pendingBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.accentWarm} />
              <Text style={styles.pendingText}>عندك طلب تعديل قيد المراجعة. أي حفظ جديد سيستبدل الطلب السابق.</Text>
            </View>
          )}

          <Text style={styles.label}>عملة الحساب</Text>
          <View style={styles.currencyRow}>
            {(['EGP', 'USD'] as Currency[]).map((item) => {
              const selected = currency === item;
              return (
                <TouchableOpacity key={item} style={[styles.currencyOption, selected && styles.currencyOptionActive]} onPress={() => setCurrency(item)} disabled={loading}>
                  <Text style={[styles.currencyText, selected && styles.currencyTextActive]}>{item === 'EGP' ? 'جنيه مصري' : 'دولار'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {showHealthFields && (
            <>
              <Text style={styles.label}>{t('weightKg')}</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="0" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" editable={!loading} />

              <Text style={styles.label}>{t('bloodType')}</Text>
              <View style={styles.bloodGrid}>
                {BLOOD_TYPES.map((type) => {
                  const selected = bloodType === type;
                  return (
                    <TouchableOpacity key={type} style={[styles.bloodOption, selected && styles.bloodOptionActive]} onPress={() => setBloodType(type)} disabled={loading}>
                      <Text style={[styles.bloodOptionText, selected && styles.bloodOptionTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t('age')}</Text>
              <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="0" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" editable={!loading} />

              <Text style={styles.label}>{t('gender')}</Text>
              <View style={styles.genderRow}>
                {(['male', 'female'] as const).map((type) => {
                  const selected = gender === type;
                  return (
                    <TouchableOpacity key={type} style={[styles.genderOption, selected && styles.genderOptionActive]} onPress={() => setGender(type)} disabled={loading}>
                      <Text style={[styles.genderEmoji, selected && styles.genderTextActive]}>{type === 'male' ? '👨' : '👩'}</Text>
                      <Text style={[styles.genderText, selected && styles.genderTextActive]}>{type === 'male' ? t('male') : t('female')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {isDoctor && (
            <>
              <Text style={styles.label}>التخصص</Text>
              <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} placeholder="مثال: قلب" placeholderTextColor={COLORS.textSecondary} editable={!loading} />

              <Text style={styles.label}>رقم القيد الطبي</Text>
              <TextInput style={styles.input} value={medicalId} onChangeText={setMedicalId} placeholder="رقم القيد" placeholderTextColor={COLORS.textSecondary} editable={!loading} />

              <Text style={styles.label}>رقم الهوية الوطنية</Text>
              <TextInput style={styles.input} value={nationalId} onChangeText={setNationalId} placeholder="رقم الهوية" placeholderTextColor={COLORS.textSecondary} editable={!loading} />

              <Text style={styles.label}>موقع العيادة</Text>
              <TextInput style={styles.input} value={clinicLocation} onChangeText={setClinicLocation} placeholder="عنوان العيادة" placeholderTextColor={COLORS.textSecondary} editable={!loading} />

              <Text style={styles.label}>سعر الاستشارة</Text>
              <TextInput style={styles.input} value={doctorVideoPrice} onChangeText={setDoctorVideoPrice} placeholder="60" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" editable={!loading} />

              <Text style={styles.label}>سعر زيارة العيادة</Text>
              <TextInput style={styles.input} value={doctorClinicPrice} onChangeText={setDoctorClinicPrice} placeholder="60" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" editable={!loading} />

              <Text style={styles.approvalNote}>تعديلات الطبيب لا تطبق فوراً. سيتم إرسالها للأدمن/الأونر للموافقة أولاً.</Text>
            </>
          )}
        </GlassCard>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>{t('saveChanges')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 100 },
  card: { padding: 24, marginBottom: 32 },
  label: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: COLORS.textPrimary, padding: 16, borderRadius: 12, marginBottom: 20, textAlign: 'right', borderWidth: 1, borderColor: COLORS.borderColor },
  pendingBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: COLORS.accentWarm + '18', borderWidth: 1, borderColor: COLORS.accentWarm + '44', borderRadius: 12, padding: 12, marginBottom: 20 },
  pendingText: { flex: 1, color: COLORS.accentWarm, fontSize: 12, textAlign: 'right', lineHeight: 18 },
  approvalNote: { color: COLORS.accentWarm, fontSize: 12, textAlign: 'right', lineHeight: 18, marginBottom: 20 },
  currencyRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20 },
  currencyOption: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor },
  currencyOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  currencyText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: 'bold' },
  currencyTextActive: { color: '#FFF' },
  bloodGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  bloodOption: { minWidth: 64, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor },
  bloodOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bloodOptionText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
  bloodOptionTextActive: { color: '#FFF' },
  genderRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 20 },
  genderOption: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: COLORS.borderColor },
  genderOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderEmoji: { fontSize: 18 },
  genderText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
  genderTextActive: { color: '#FFF' },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});
