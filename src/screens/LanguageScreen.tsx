import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';

export default function LanguageScreen({ navigation }: any) {
  const showUnavailable = () => {
    const message = 'اللغة الإنجليزية غير متاحة حالياً';
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('تنبيه', message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>اختر اللغة</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.option} activeOpacity={0.85}>
          <GlassCard style={[styles.card, styles.activeCard]}>
            <View style={styles.langTextWrap}>
              <Text style={styles.langName}>العربية</Text>
              <Text style={styles.langSub}>اللغة الحالية</Text>
            </View>
            <Ionicons name="checkmark-circle" size={26} color={COLORS.primaryLight} />
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={showUnavailable} activeOpacity={0.85}>
          <GlassCard style={[styles.card, { opacity: 0.6 }]}>
            <View style={styles.langTextWrap}>
              <Text style={styles.langName}>English</Text>
              <Text style={styles.langSub}>قريباً</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={22} color={COLORS.textSecondary} />
          </GlassCard>
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
  option: { marginBottom: 16 },
  card: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  activeCard: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  langTextWrap: { alignItems: 'flex-end' },
  langName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  langSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 }
});
