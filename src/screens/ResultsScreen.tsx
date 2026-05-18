import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { createUserResult, getUserResults } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';
import type { LabResult } from '../types';

type UploadCategory = NonNullable<LabResult['category']>;

export default function ResultsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [results, setResults] = useState<LabResult[]>([]);

  const fetchResults = async () => {
    if (!user?.uid) return;
    const data = await getUserResults(user.uid);
    setResults(data);
  };

  useEffect(() => {
    fetchResults();
  }, [user?.uid]);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const getCategoryLabel = (category?: UploadCategory) => {
    if (category === 'xray') return t('xrayFile');
    if (category === 'prescription') return t('prescriptionFile');
    return t('labFile');
  };

  const uploadFile = (category: UploadCategory) => {
    if (!user?.uid) return;

    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      showMessage(t('warning'), t('uploadWebOnly'));
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const saved = await createUserResult({
          userId: user.uid,
          name: file.name,
          date: new Date().toLocaleDateString('ar-EG'),
          lab: getCategoryLabel(category),
          status: 'مرفوع',
          category,
          fileName: file.name,
          fileData: String(reader.result),
          mimeType: file.type,
        });

        if (saved) {
          await fetchResults();
          showMessage(t('done'), t('fileUploaded'));
        } else {
          showMessage(t('error'), t('fileUploadFailed'));
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const downloadFile = (item: LabResult) => {
    if (!item.fileData || Platform.OS !== 'web' || typeof document === 'undefined') {
      showMessage(t('warning'), t('noFileToDownload'));
      return;
    }

    const link = document.createElement('a');
    link.href = item.fileData;
    link.download = item.fileName || `${item.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('labResults')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.uploadActions}>
        <UploadAction icon="vial" label={t('uploadLab')} onPress={() => uploadFile('lab')} />
        <UploadAction icon="x-ray" label={t('uploadXray')} onPress={() => uploadFile('xray')} />
        <UploadAction icon="file-prescription" label={t('uploadPrescription')} onPress={() => uploadFile('prescription')} />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('noResults')}</Text>
            <Text style={styles.emptyText}>{t('uploadMedicalFileHint')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.infoRow}>
               <View style={styles.iconBox}>
                  <FontAwesome5 name={item.category === 'prescription' ? 'file-prescription' : item.category === 'xray' ? 'x-ray' : 'vial'} size={20} color={COLORS.primaryLight} />
               </View>
               <View style={styles.mainInfo}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultSub}>{item.lab} • {item.date}</Text>
               </View>
               <View style={[styles.statusBadge, { backgroundColor: COLORS.secondary + '22' }]}>
                  <Text style={[styles.statusText, { color: COLORS.secondary }]}>{t('uploaded')}</Text>
               </View>
            </View>
            <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadFile(item)}>
               <Ionicons name="download-outline" size={18} color={COLORS.primaryLight} />
               <Text style={styles.downloadText}>{t('downloadReport')}</Text>
            </TouchableOpacity>
          </GlassCard>
        )}
      />
    </SafeAreaView>
  );
}

const UploadAction = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.uploadBtn} onPress={onPress}>
    <FontAwesome5 name={icon as any} size={16} color={COLORS.primaryLight} />
    <Text style={styles.uploadText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  uploadActions: { flexDirection: 'row-reverse', gap: 10, paddingHorizontal: 24, marginBottom: 4 },
  uploadBtn: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, justifyContent: 'center', alignItems: 'center', flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 8 },
  uploadText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
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
  emptyState: { alignItems: 'center', marginTop: 70, paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.textPrimary, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
