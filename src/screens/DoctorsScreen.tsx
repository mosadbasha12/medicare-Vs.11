import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { getAllDoctors, searchDoctors } from '../utils/localDataService';
import type { Doctor } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface DoctorsScreenProps {
  navigation: {
    navigate: (screen: string, params?: { doctorId?: string; doctorName: string; doctorSpec?: string; doctorPrice?: number }) => void;
    addListener: (event: string, callback: () => void) => () => void;
  };
}

export default function DoctorsScreen({ navigation }: DoctorsScreenProps) {
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDoctors = async () => {
    const data = await getAllDoctors();
    setDoctors(data);
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDoctors();
    });
    return unsubscribe;
  }, [navigation]);

  const handleSearch = async (text: string) => {
    setSearchTerm(text);
    if (text.trim() === '') {
      const data = await getAllDoctors();
      setDoctors(data);
    } else {
      const results = await searchDoctors(text);
      setDoctors(results);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('availableDoctors')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <FontAwesome5 name="search" size={16} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchDoctor')}
          placeholderTextColor={COLORS.textSecondary}
          value={searchTerm}
          onChangeText={handleSearch}
        />
      </View>

      <FlatList
        data={doctors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('noDoctors')}</Text>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarEmoji}>{item.emoji || '👨‍⚕️'}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.doctorName}>{item.name}</Text>
                <Text style={styles.doctorSpec}>{item.specialty}</Text>
                <View style={styles.ratingRow}>
                  <FontAwesome5 name="star" size={12} color={COLORS.accentWarm} solid />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.chatIconBtn} 
                  onPress={() => navigation.navigate('Chat', { doctorName: item.name, doctorId: item.id })}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.primaryLight} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.bookButton}
                    onPress={() => navigation.navigate('Booking', { doctorId: item.id, doctorName: item.name, doctorSpec: item.specialty, doctorPrice: item.price })}
                >
                  <Text style={styles.bookButtonText}>{t('book')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { paddingHorizontal: 24, paddingVertical: 20, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', textAlign: 'right' },
  searchContainer: { flexDirection: 'row-reverse', marginHorizontal: 24, marginBottom: 20, backgroundColor: COLORS.bgCard, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderColor },
  searchIcon: { marginLeft: 12 },
  searchInput: { flex: 1, color: COLORS.textPrimary, textAlign: 'right' },
  listContainer: { paddingHorizontal: 24, paddingBottom: 100 },
  card: { marginBottom: 16, padding: 16 },
  cardRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatarBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginLeft: 16, borderWidth: 1, borderColor: COLORS.primaryLight },
  avatarEmoji: { fontSize: 32 },
  infoBox: { flex: 1 },
  doctorName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  doctorSpec: { color: COLORS.secondary, fontSize: 13, marginTop: 4, textAlign: 'right' },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8 },
  ratingText: { color: COLORS.textSecondary, fontSize: 12, marginRight: 6 },
  actions: { alignItems: 'center' },
  chatIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primarySofter, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  bookButton: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  bookButtonText: { color: COLORS.textPrimary, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
