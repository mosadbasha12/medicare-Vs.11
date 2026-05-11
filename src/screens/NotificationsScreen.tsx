import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getUserNotifications } from '../utils/localDataService';

export default function NotificationsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.uid) return;
      const data = await getUserNotifications(user.uid);
      setNotifications(data);
    };
    fetchNotifications();
  }, [user?.uid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>التنبيهات</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا توجد تنبيهات</Text>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
               <FontAwesome5 name={item.icon as any} size={18} color={item.color} />
            </View>
            <View style={styles.textContainer}>
               <View style={styles.row}>
                 <Text style={styles.title}>{item.title}</Text>
                 <Text style={styles.time}>{item.time}</Text>
               </View>
               <Text style={styles.desc}>{item.desc}</Text>
            </View>
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
  card: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 16, padding: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  textContainer: { flex: 1 },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  time: { color: COLORS.textMuted, fontSize: 11 },
  desc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
