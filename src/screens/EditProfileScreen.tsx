import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { updateUserProfile } from '../utils/localDataService';

interface EditProfileScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user, setUser } = useUser();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('تنبيه', 'الرجاء إدخال الاسم');
      return;
    }
    setLoading(true);
    try {
      const success = await updateUserProfile(user!.uid, { name, phone });
      if (success) {
        setUser({ ...user!, name, phone });
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
        <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <GlassCard style={styles.card}>
          <Text style={styles.label}>الاسم بالكامل</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="الاسم" placeholderTextColor={COLORS.textSecondary} editable={!loading} />
          
          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput style={styles.input} value={user?.email} editable={false} placeholderTextColor={COLORS.textSecondary} keyboardType="email-address" />
          
          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="05XXXXXXXX" placeholderTextColor={COLORS.textSecondary} keyboardType="phone-pad" editable={!loading} />
        </GlassCard>

        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>حفظ التغييرات</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24 },
  card: { padding: 24, marginBottom: 32 },
  label: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', color: COLORS.textPrimary, padding: 16, borderRadius: 12, marginBottom: 20, textAlign: 'right', borderWidth: 1, borderColor: COLORS.borderColor },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});
