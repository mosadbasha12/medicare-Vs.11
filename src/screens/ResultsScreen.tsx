import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getUserResults } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';

export default function ResultsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!user?.uid) return;
      const data = await getUserResults(user.uid);
      setResults(data);
    };
    fetchResults();
  }, [user?.uid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('labResults')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('noResults')}</Text>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.infoRow}>
               <View style={styles.iconBox}>
                  <FontAwesome5 name="vial" size={20} color={COLORS.primaryLight} />
               </View>
               <View style={styles.mainInfo}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultSub}>{item.lab} • {item.date}</Text>
               </View>
               <View style={[styles.statusBadge, { backgroundColor: item.status === 'طبيعي' ? COLORS.secondary + '22' : COLORS.danger + '22' }]}>
                  <Text style={[styles.statusText, { color: item.status === 'طبيعي' ? COLORS.secondary : COLORS.danger }]}>{item.status}</Text>
               </View>
            </View>
            <TouchableOpacity style={styles.downloadBtn}>
               <Ionicons name="download-outline" size={18} color={COLORS.primaryLight} />
               <Text style={styles.downloadText}>{t('downloadReport')}</Text>
            </TouchableOpacity>
          </GlassCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  list: { padding: 24 },
  card: { marginBottom: 16, padding: 16 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  mainInfo: { flex: 1 },
  resultName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  resultSub: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  downloadBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 12 },
  downloadText: { color: COLORS.primaryLight, fontSize: 13, fontWeight: 'bold', marginRight: 8 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
