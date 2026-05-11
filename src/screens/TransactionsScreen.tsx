import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { getUserTransactions } from '../utils/localDataService';

export default function TransactionsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.uid) return;
      const data = await getUserTransactions(user.uid);
      setTransactions(data);
    };
    fetchTransactions();
  }, [user?.uid]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل المعاملات</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا توجد معاملات حالياً</Text>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.card}>
            <View style={styles.left}>
               <Text style={[styles.amount, { color: item.type === 'in' ? COLORS.secondary : COLORS.danger }]}>
                 {item.amount > 0 ? `+${item.amount}$` : `${item.amount}$`}
               </Text>
            </View>
            <View style={styles.right}>
               <Text style={styles.title}>{item.title}</Text>
               <Text style={styles.date}>{item.date}</Text>
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
  card: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: 16 },
  left: { alignItems: 'flex-start' },
  right: { flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  date: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'right', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
