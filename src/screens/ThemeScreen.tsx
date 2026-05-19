import React, { useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_THEMES, applyAppTheme, COLORS, getAppliedThemeId, type ThemeId } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { updateUserProfile } from '../utils/localDataService';

const showInfo = (title: string, message: string) => {
  if (Platform.OS === 'web') alert(`${title}\n${message}`);
  else Alert.alert(title, message);
};

export default function ThemeScreen({ navigation }: any) {
  const { user, setUser } = useUser();
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>((user?.themeId as ThemeId) || getAppliedThemeId());
  const [saving, setSaving] = useState(false);

  const saveTheme = async () => {
    if (!user?.uid) return;
    setSaving(true);
    const success = await updateUserProfile(user.uid, { themeId: selectedThemeId });
    setSaving(false);
    if (!success) {
      showInfo('خطأ', 'تعذر حفظ الثيم على حسابك.');
      return;
    }
    setUser({ ...user, themeId: selectedThemeId });
    applyAppTheme(selectedThemeId);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الثيمات</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>اختيارك هنا يطبق على حسابك أنت فقط، ولا يغير شكل التطبيق لباقي المستخدمين.</Text>
        <View style={styles.themeGrid}>
          {APP_THEMES.map((theme) => {
            const selected = selectedThemeId === theme.id;
            return (
              <TouchableOpacity
                key={theme.id}
                style={[styles.themeCard, selected && styles.themeCardActive]}
                onPress={() => setSelectedThemeId(theme.id)}
              >
                <View style={styles.themePreviewRow}>
                  {theme.preview.map((color) => (
                    <View key={color} style={[styles.themeSwatch, { backgroundColor: color }]} />
                  ))}
                </View>
                <View style={styles.themeTitleRow}>
                  <Text style={[styles.themeName, selected && styles.themeNameActive]}>{theme.name}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? COLORS.accentWarm : COLORS.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.65 }]} onPress={saveTheme} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'جاري الحفظ...' : 'تطبيق الثيم على حسابي'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24, paddingBottom: 80 },
  hint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 21, textAlign: 'right', marginBottom: 16 },
  themeGrid: { gap: 12, marginBottom: 18 },
  themeCard: { borderWidth: 1, borderColor: COLORS.borderColor, backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 14 },
  themeCardActive: { borderColor: COLORS.accentWarm, backgroundColor: COLORS.primarySofter },
  themePreviewRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  themeSwatch: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  themeTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  themeName: { color: COLORS.textSecondary, fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  themeNameActive: { color: COLORS.textPrimary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});
