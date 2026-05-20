import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getUserResults, updateUserResult } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';
import type { LabResult } from '../types';

type UploadCategory = NonNullable<LabResult['category']>;

export default function ResultsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [results, setResults] = useState<LabResult[]>([]);
  const [activeCategory, setActiveCategory] = useState<UploadCategory>('lab');

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

  const uploadRequestedFile = (request: LabResult) => {
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
      if (file.size > 700 * 1024) {
        showMessage(t('warning'), 'حجم الملف كبير. ارفع ملف أقل من 700KB حتى يتم حفظه ومشاركته مع الطبيب بدون فشل.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const saved = await updateUserResult(user.uid, request.id, {
          name: request.name || file.name,
          date: new Date().toLocaleDateString('ar-EG'),
          status: 'مرفوع',
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

  const filteredResults = results.filter((item) => (item.category || 'lab') === activeCategory);
  const uploadedCount = filteredResults.filter((item) => item.fileData).length;
  const pendingCount = filteredResults.filter((item) => !item.fileData).length;

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
        <FilterAction icon="vial" label="التحاليل" active={activeCategory === 'lab'} onPress={() => setActiveCategory('lab')} />
        <FilterAction icon="x-ray" label="الأشعة" active={activeCategory === 'xray'} onPress={() => setActiveCategory('xray')} />
        <FilterAction icon="file-prescription" label="الروشتات" active={activeCategory === 'prescription'} onPress={() => setActiveCategory('prescription')} />
      </View>
      <Text style={styles.filterSummary}>المرفوع: {uploadedCount} • المطلوب: {pendingCount}</Text>

      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('noResults')}</Text>
            <Text style={styles.emptyText}>{t('uploadMedicalFileHint')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={item.fileData ? 1 : 0.82}
            onPress={() => !item.fileData && uploadRequestedFile(item)}
          >
          <GlassCard style={[styles.card, !item.fileData && styles.requestCard]}>
            <View style={styles.infoRow}>
               <View style={styles.iconBox}>
                  <FontAwesome5 name={item.category === 'prescription' ? 'file-prescription' : item.category === 'xray' ? 'x-ray' : 'vial'} size={20} color={COLORS.primaryLight} />
               </View>
               <View style={styles.mainInfo}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultSub}>{item.lab} • {item.date}</Text>
                  {!!item.doctorName && <Text style={styles.requestDoctor}>طلب الطبيب: {item.doctorName}</Text>}
                  {!!item.notes && <Text style={styles.requestNotes}>{item.notes}</Text>}
               </View>
               <View style={[styles.statusBadge, { backgroundColor: item.fileData ? COLORS.secondary + '22' : COLORS.accentWarm + '22' }]}>
                  <Text style={[styles.statusText, { color: item.fileData ? COLORS.secondary : COLORS.accentWarm }]}>{item.fileData ? t('uploaded') : 'مطلوب'}</Text>
               </View>
            </View>
            {item.fileData ? (
              <TouchableOpacity style={styles.downloadBtn} onPress={() => downloadFile(item)}>
                 <Ionicons name="download-outline" size={18} color={COLORS.primaryLight} />
                 <Text style={styles.downloadText}>{t('downloadReport')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.requestHintBox}>
                  <Ionicons name="cloud-upload-outline" size={18} color={COLORS.accentWarm} />
                  <Text style={styles.requestHintText}>اضغط هنا لرفع الملف المطلوب بعد عمل التحليل أو الأشعة.</Text>
                </View>
                <TouchableOpacity style={styles.uploadRequestedBtn} onPress={() => uploadRequestedFile(item)}>
                  <Ionicons name="cloud-upload-outline" size={18} color={COLORS.bgBase} />
                  <Text style={styles.uploadRequestedText}>رفع الملف المطلوب</Text>
                </TouchableOpacity>
              </>
            )}
          </GlassCard>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const FilterAction = ({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.uploadBtn, active && styles.uploadBtnActive]} onPress={onPress}>
    <FontAwesome5 name={icon as any} size={16} color={COLORS.primaryLight} />
    <Text style={[styles.uploadText, active && styles.uploadTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  uploadActions: { flexDirection: 'row-reverse', gap: 10, paddingHorizontal: 24, marginBottom: 4 },
  uploadBtn: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.borderColor, justifyContent: 'center', alignItems: 'center', flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 8 },
  uploadBtnActive: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.primarySofter },
  uploadText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  uploadTextActive: { color: COLORS.primaryLight },
  filterSummary: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', paddingHorizontal: 24, marginTop: 8 },
  list: { padding: 24 },
  card: { marginBottom: 16, padding: 16 },
  requestCard: { borderColor: COLORS.accentWarm + '66' },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  mainInfo: { flex: 1 },
  resultName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  resultSub: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  requestDoctor: { color: COLORS.accentWarm, fontSize: 11, textAlign: 'right', marginTop: 4 },
  requestNotes: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4, lineHeight: 17 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  downloadBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 12 },
  downloadText: { color: COLORS.primaryLight, fontSize: 13, fontWeight: 'bold', marginRight: 8 },
  requestHintBox: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderColor, paddingTop: 12, gap: 6 },
  requestHintText: { color: COLORS.accentWarm, fontSize: 12, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  uploadRequestedBtn: { marginTop: 12, backgroundColor: COLORS.accentWarm, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 6 },
  uploadRequestedText: { color: COLORS.bgBase, fontSize: 13, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 70, paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.textPrimary, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
