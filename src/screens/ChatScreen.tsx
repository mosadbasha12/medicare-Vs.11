import React, { useState, useEffect } from 'react';
import { Alert, View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Linking, Platform } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { deleteChatMessage, sendMessage, listenToMessages, markChatThreadRead } from '../utils/localDataService';
import { useLanguage } from '../context/LanguageContext';

export default function ChatScreen(props: any) {
  const { route, navigation } = props;
  const { user } = useUser();
  const { t } = useLanguage();
  const doctorName = route.params?.doctorName || t('chooseDoctor');
  const doctorId = route.params?.doctorId;
  const chatId = route.params?.chatId || (user?.uid && doctorId ? `${user.uid}_${doctorId}` : 'temp');
  const recipientId = route.params?.recipientId || chatId.split('_').find((id: string) => id && id !== user?.uid);
  const hasChatTarget = Boolean(user?.uid && chatId !== 'temp' && recipientId);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const unsubscribe = listenToMessages(chatId, (msgs) => {
      setMessages(msgs);
    }, user?.uid);
    return () => unsubscribe();
  }, [chatId, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !hasChatTarget || messages.length === 0) return;
    markChatThreadRead(user.uid, chatId);
  }, [chatId, hasChatTarget, messages.length, user?.uid]);

  const sendNewMessage = async () => {
    if (!input.trim() || !user || !hasChatTarget) return;
    const msg = {
      chatId,
      senderId: user.uid,
      senderName: user.name,
      recipientId,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };
    const success = await sendMessage(msg);
    if (success) setInput('');
    else Alert.alert('خطأ', 'تعذر إرسال الرسالة على السيرفر. راجع صلاحيات Firebase للشات.');
  };

  const sendAttachment = async (file: File) => {
    if (!user || !hasChatTarget) return;
    if (file.size > 700 * 1024) {
      Alert.alert('تنبيه', 'حجم المرفق كبير. اختر ملف أقل من 700KB مؤقتاً.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = String(reader.result || '');
      if (!fileData) {
        Alert.alert('خطأ', 'تعذر قراءة الملف.');
        return;
      }

      const success = await sendMessage({
        chatId,
        senderId: user.uid,
        senderName: user.name,
        recipientId,
        text: input.trim() || `مرفق: ${file.name}`,
        createdAt: new Date().toISOString(),
        attachmentName: file.name,
        attachmentData: fileData,
        attachmentType: file.type,
      });
      if (success) setInput('');
      else Alert.alert('خطأ', 'تعذر إرسال المرفق.');
    };
    reader.onerror = () => Alert.alert('خطأ', 'تعذر قراءة الملف.');
    reader.readAsDataURL(file);
  };

  const pickAttachment = () => {
    if (!hasChatTarget) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('تنبيه', 'إرسال المرفقات متاح حالياً من نسخة الويب.');
      return;
    }

    const inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.accept = 'image/*,application/pdf,.doc,.docx,.txt';
    inputEl.onchange = () => {
      const file = inputEl.files?.[0];
      if (file) sendAttachment(file);
    };
    inputEl.click();
  };

  const openAttachment = (item: any) => {
    if (!item.attachmentData) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = item.attachmentData;
      link.download = item.attachmentName || 'attachment';
      link.target = '_blank';
      link.click();
      return;
    }
    Linking.openURL(item.attachmentData);
  };

  const deleteMessage = (item: any) => {
    if (!user?.uid || item.senderId !== user.uid) return;
    const runDelete = async () => {
      const success = await deleteChatMessage(chatId, item.id, user.uid);
      if (!success) Alert.alert('خطأ', 'تعذر حذف الرسالة.');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('حذف الرسالة\nهل تريد حذف هذه الرسالة من المحادثة؟')) runDelete();
      return;
    }

    Alert.alert('حذف الرسالة', 'هل تريد حذف هذه الرسالة من المحادثة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: runDelete },
    ]);
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
          !hasChatTarget ? (
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
              {item.senderId === user?.uid && (
                <TouchableOpacity style={styles.deleteMessageBtn} onPress={() => deleteMessage(item)}>
                  <Ionicons name="trash-outline" size={14} color="#FFF" />
                </TouchableOpacity>
              )}
              {!!item.text && (
                <Text style={[styles.messageText, item.senderId === user?.uid ? styles.userText : styles.doctorText]}>
                  {item.text}
                </Text>
              )}
              {!!item.attachmentData && (
                <TouchableOpacity style={styles.attachmentChip} onPress={() => openAttachment(item)}>
                  <Ionicons name="document-attach-outline" size={16} color={item.senderId === user?.uid ? '#FFF' : COLORS.primaryLight} />
                  <Text style={[styles.attachmentText, item.senderId === user?.uid ? styles.userText : styles.doctorText]} numberOfLines={1}>
                    {item.attachmentName || 'مرفق'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GlassCard style={styles.inputArea}>
          <TouchableOpacity style={[styles.sendBtn, !hasChatTarget && styles.disabledBtn]} onPress={sendNewMessage} disabled={!hasChatTarget}>
            <Ionicons name="send" size={24} color={hasChatTarget ? COLORS.primaryLight : COLORS.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={hasChatTarget ? t('writeMessage') : t('chooseDoctorFirst')}
            placeholderTextColor={COLORS.textSecondary}
            value={input}
            onChangeText={setInput}
            editable={hasChatTarget}
          />
          <TouchableOpacity style={[styles.attachBtn, !hasChatTarget && styles.disabledBtn]} onPress={pickAttachment} disabled={!hasChatTarget}>
            <Ionicons name="attach" size={24} color={hasChatTarget ? COLORS.textSecondary : COLORS.textMuted} />
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
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20, position: 'relative' },
  userBubble: { backgroundColor: COLORS.primary, borderTopRightRadius: 4 },
  doctorBubble: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 4, borderWidth: 1, borderColor: COLORS.borderColor },
  deleteMessageBtn: { alignSelf: 'flex-start', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 6 },
  messageText: { fontSize: 15, textAlign: 'right' },
  userText: { color: '#FFF' },
  doctorText: { color: COLORS.textPrimary },
  attachmentChip: { marginTop: 8, minHeight: 34, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  attachmentText: { flex: 1, fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  emptyState: { flex: 1, minHeight: 420, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 18, textAlign: 'center' },
  chooseDoctorBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  chooseDoctorText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: 'bold' },
  inputArea: { margin: 16, flexDirection: 'row-reverse', alignItems: 'center', padding: 8, borderRadius: 30 },
  input: { flex: 1, color: COLORS.textPrimary, textAlign: 'right', paddingHorizontal: 12, fontSize: 16 },
  sendBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  attachBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { opacity: 0.45 },
});
