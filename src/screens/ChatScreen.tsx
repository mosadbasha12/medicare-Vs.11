import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { sendMessage, listenToMessages } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';

export default function ChatScreen(props: any) {
  const { route, navigation } = props;
  const { user } = useUser();
  const { t } = useLanguage();
  const doctorName = route.params?.doctorName || t('chooseDoctor');
  const doctorId = route.params?.doctorId;
  const hasDoctor = Boolean(doctorId);
  const chatId = user?.uid && doctorId ? `${user.uid}_${doctorId}` : 'temp';
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const unsubscribe = listenToMessages(chatId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [chatId]);

  const sendNewMessage = async () => {
    if (!input.trim() || !user) return;
    const msg = {
      chatId,
      senderId: user.uid,
      senderName: user.name,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };
    await sendMessage(msg);
    setInput('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.doctorName}>{doctorName}</Text>
          <Text style={styles.status}>متصل الآن</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>👨‍⚕️</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          !hasDoctor ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('chooseDoctor')}</Text>
              <Text style={styles.emptyText}>{t('chooseDoctorForChat')}</Text>
              <TouchableOpacity style={styles.chooseDoctorBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'الأطباء' })}>
                <Text style={styles.chooseDoctorText}>{t('availableDoctors')}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.senderId === user?.uid ? styles.userRow : styles.doctorRow]}>
            <View style={[styles.bubble, item.senderId === user?.uid ? styles.userBubble : styles.doctorBubble]}>
              <Text style={[styles.messageText, item.senderId === user?.uid ? styles.userText : styles.doctorText]}>
                {item.text}
              </Text>
            </View>
          </View>
        )}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GlassCard style={styles.inputArea}>
          <TouchableOpacity style={styles.sendBtn} onPress={sendNewMessage} disabled={!hasDoctor}>
            <Ionicons name="send" size={24} color={COLORS.primaryLight} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={hasDoctor ? t('writeMessage') : t('chooseDoctorFirst')}
            placeholderTextColor={COLORS.textSecondary}
            value={input}
            onChangeText={setInput}
            editable={hasDoctor}
          />
          <TouchableOpacity style={styles.attachBtn}>
            <Ionicons name="attach" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </GlassCard>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor, marginTop: 40 },
  headerInfo: { flex: 1, marginRight: 12 },
  doctorName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  status: { color: COLORS.secondary, fontSize: 12, textAlign: 'right' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primaryLight },
  avatarEmoji: { fontSize: 24 },
  messageList: { padding: 20 },
  messageRow: { marginBottom: 16, flexDirection: 'row-reverse' },
  userRow: { justifyContent: 'flex-start' },
  doctorRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20 },
  userBubble: { backgroundColor: COLORS.primary, borderTopRightRadius: 4 },
  doctorBubble: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 4, borderWidth: 1, borderColor: COLORS.borderColor },
  messageText: { fontSize: 15, textAlign: 'right' },
  userText: { color: '#FFF' },
  doctorText: { color: COLORS.textPrimary },
  emptyState: { flex: 1, minHeight: 420, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 18, textAlign: 'center' },
  chooseDoctorBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  chooseDoctorText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold' },
  inputArea: { margin: 16, flexDirection: 'row-reverse', alignItems: 'center', padding: 8, borderRadius: 30 },
  input: { flex: 1, color: COLORS.textPrimary, textAlign: 'right', paddingHorizontal: 12, fontSize: 16 },
  sendBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  attachBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});
