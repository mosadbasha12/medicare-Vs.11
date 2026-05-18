import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getAllDoctors, getUserChatSummaries, type ChatSummary } from '../utils/localDataService';
import type { Doctor } from '../types';
import { useLanguage } from '../context/LanguageContext';

export default function ChatListScreen({ navigation }: any) {
  const { user } = useUser();
  const { t } = useLanguage();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    const [chatData, doctorData] = await Promise.all([
      getUserChatSummaries(user.uid),
      getAllDoctors(),
    ]);
    setChats(chatData);
    setDoctors(doctorData);
  }, [user?.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', fetchData);
    return unsubscribe;
  }, [navigation, fetchData]);

  const openChat = (doctorId: string, doctorName: string) => {
    navigation.navigate('Chat', { doctorId, doctorName });
  };

  const newChatDoctors = doctors.filter((doctor) => !chats.some((chat) => chat.doctorId === doctor.id));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('chat')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={[
          { type: 'section', id: 'previous', title: t('previousChats') },
          ...(chats.length ? chats.map((item) => ({ type: 'chat', id: `chat_${item.doctorId}`, item })) : [{ type: 'emptyChats', id: 'emptyChats' }]),
          { type: 'section', id: 'new', title: t('startNewChat') },
          ...newChatDoctors.map((item) => ({ type: 'doctor', id: `doctor_${item.id}`, item })),
        ]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }: any) => {
          if (item.type === 'section') {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }

          if (item.type === 'emptyChats') {
            return (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>{t('noPreviousChats')}</Text>
              </GlassCard>
            );
          }

          if (item.type === 'chat') {
            const chat = item.item as ChatSummary;
            return (
              <TouchableOpacity onPress={() => openChat(chat.doctorId, chat.doctorName)}>
                <GlassCard style={styles.card}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarEmoji}>{chat.doctorEmoji || '👨‍⚕️'}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.name}>{chat.doctorName}</Text>
                    <Text style={styles.subText} numberOfLines={1}>{chat.lastMessage}</Text>
                  </View>
                  <View style={styles.metaBox}>
                    <Text style={styles.countText}>{chat.messagesCount}</Text>
                    <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          }

          const doctor = item.item as Doctor;
          return (
            <TouchableOpacity onPress={() => openChat(doctor.id, doctor.name)}>
              <GlassCard style={styles.card}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarEmoji}>{doctor.emoji || '👨‍⚕️'}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.name}>{doctor.name}</Text>
                  <Text style={styles.subText}>{doctor.specialty}</Text>
                </View>
                <View style={styles.chatIcon}>
                  <FontAwesome5 name="comments" size={15} color={COLORS.primaryLight} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  list: { paddingHorizontal: 24, paddingBottom: 110 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: 'bold', textAlign: 'right', marginTop: 16, marginBottom: 12 },
  card: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, padding: 14 },
  avatarBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', marginLeft: 12, borderWidth: 1, borderColor: COLORS.primaryLight },
  avatarEmoji: { fontSize: 26 },
  infoBox: { flex: 1 },
  name: { color: COLORS.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
  subText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'right' },
  metaBox: { alignItems: 'center', gap: 6 },
  countText: { color: COLORS.primaryLight, fontSize: 11, fontWeight: 'bold' },
  chatIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primarySofter },
  emptyCard: { alignItems: 'center', padding: 22, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' },
});
