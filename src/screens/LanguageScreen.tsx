import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';

export default function LanguageScreen({ navigation }: any) {
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
        <TouchableOpacity style={styles.option} onPress={() => navigation.goBack()}>
          <GlassCard style={styles.card}>
            <Text style={styles.langName}>العربية</Text>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.secondary} />
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={() => navigation.goBack()}>
          <GlassCard style={[styles.card, { opacity: 0.6 }]}>
            <Text style={styles.langName}>English</Text>
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
  langName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});
