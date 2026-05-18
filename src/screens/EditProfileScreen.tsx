import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { updateUserProfile } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';

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
  const [loading, setLoading] = useState(false);
  const showHealthFields = user?.role !== 'doctor';

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('تنبيه', 'الرجاء إدخال الاسم');
      return;
    }

    const parsedWeight = Number(weight.replace(',', '.'));
    const parsedAge = Number(age.replace(',', '.'));
    if (showHealthFields && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      Alert.alert('تنبيه', 'الرجاء إدخال وزن صحيح');
      return;
    }
    if (showHealthFields && (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130)) {
      Alert.alert('تنبيه', 'الرجاء إدخال عمر صحيح');
      return;
    }

    const updates = {
      name: name.trim(),
      phone: phone.trim(),
      ...(showHealthFields ? { weight: parsedWeight, bloodType, age: parsedAge, gender } : {}),
    };

    setLoading(true);
    try {
      const success = await updateUserProfile(user.uid, updates);
      if (success) {
        setUser({ ...user, ...updates });
        Alert.alert('نجاح', 'تم حفظ التغييرات بنجاح');
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
