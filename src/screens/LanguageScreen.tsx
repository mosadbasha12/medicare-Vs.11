import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { AppLanguage, useLanguage } from '../context/LanguageContext';

export default function LanguageScreen({ navigation }: any) {
  const { language, setLanguage, t } = useLanguage();

  const renderOption = (value: AppLanguage, title: string) => {
    const selected = language === value;
    return (
      <TouchableOpacity style={styles.option} onPress={() => setLanguage(value)} activeOpacity={0.85}>
        <GlassCard style={[styles.card, selected ? styles.activeCard : undefined]}>
          <View style={styles.langTextWrap}>
            <Text style={styles.langName}>{title}</Text>
            <Text style={styles.langSub}>{selected ? t('currentLanguage') : t('chooseAndReload')}</Text>
          </View>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selected ? COLORS.primaryLight : COLORS.textSecondary} />
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('chooseLanguage')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        {renderOption('ar', t('arabic'))}
        {renderOption('en', t('english'))}
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
