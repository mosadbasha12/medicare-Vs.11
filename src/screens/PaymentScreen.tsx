import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform, TextInput } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { GlassCard } from '../components/GlassCard';
import { useUser } from '../context/UserContext';
import { updateUserBalance } from '../utils/storage';
import { useLanguage } from '../context/LanguageContext';
import { getPlatformSettings, recordWalletTransaction, updateUserProfile } from '../utils/localDataService';
import type { Currency } from '../types';

const showInfo = (title: string, message: string) => {
  if (Platform.OS === 'web') alert(`${title}\n${message}`);
  else Alert.alert(title, message);
};

export default function PaymentScreen({ navigation }: any) {
  const { user, setUser } = useUser();
  const { t } = useLanguage();
  const [selectedMethod, setSelectedMethod] = useState('visa');
  const [cards, setCards] = useState(['**** **** **** 4242', '**** **** **** 8899']);
  const [amount, setAmount] = useState('500');
  const currency = user?.currency || 'EGP';
  const currencySymbol = currency === 'EGP' ? 'ج.م' : '$';

  const updateCurrency = async (nextCurrency: Currency) => {
    if (!user || nextCurrency === currency) return;
    const success = await updateUserProfile(user.uid, { currency: nextCurrency });
    if (success) {
      setUser({ ...user, currency: nextCurrency });
      showInfo('تم تحديث العملة', `تم اختيار ${nextCurrency === 'EGP' ? 'الجنيه المصري' : 'الدولار'} كعملة الحساب.`);
    }
  };

  const handleTopUp = async () => {
    if (!user) return;
    const parsedAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showInfo('تنبيه', 'اكتب مبلغ شحن صحيح.');
      return;
    }
    const nextBalance = Number((user.balance + parsedAmount).toFixed(2));
    const updated = await updateUserBalance(user.uid, nextBalance);
    if (updated) {
      await recordWalletTransaction({
        userId: user.uid,
        title: selectedMethod === 'instapay' ? 'شحن رصيد عبر Instapay' : 'شحن رصيد المحفظة',
        amount: parsedAmount,
        type: 'in',
        currency,
        provider: selectedMethod === 'instapay' ? 'instapay' : 'card',
        description: 'تمت إضافة الرصيد كتجربة داخل التطبيق.',
      });
      setUser({ ...updated, currency });
      if (selectedMethod === 'instapay') {
        const settings = await getPlatformSettings();
        showInfo('طلب شحن Instapay', `حوّل ${parsedAmount} ${currencySymbol} إلى:\n${settings.instapayHandle}\nثم احتفظ بصورة التحويل للمراجعة. تمت إضافة الرصيد كتجربة داخل التطبيق.`);
      } else {
        showInfo('تم شحن الرصيد', `تمت إضافة ${parsedAmount} ${currencySymbol} إلى محفظتك داخل التطبيق.`);
      }
    }
  };

  const handleAddCard = () => {
    const next = `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`;
    setCards((current) => [...current, next]);
    setSelectedMethod(next);
    showInfo('تمت الإضافة', `تمت إضافة بطاقة تجريبية: ${next}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-forward" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('paymentMethods')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard style={styles.balanceCard}>
           <Text style={styles.balanceLabel}>{t('availableBalance')}</Text>
           <Text style={styles.balanceVal}>{user?.balance.toFixed(2)} {currencySymbol}</Text>
           <View style={styles.currencyRow}>
             {(['EGP', 'USD'] as Currency[]).map((item) => (
               <TouchableOpacity key={item} style={[styles.currencyBtn, currency === item && styles.currencyBtnActive]} onPress={() => updateCurrency(item)}>
                 <Text style={[styles.currencyText, currency === item && styles.currencyTextActive]}>{item === 'EGP' ? 'جنيه' : 'دولار'}</Text>
               </TouchableOpacity>
             ))}
           </View>
           <View style={styles.amountRow}>
             <TextInput
               style={styles.amountInput}
               value={amount}
               onChangeText={setAmount}
               keyboardType="numeric"
               placeholder="500"
               placeholderTextColor="rgba(255,255,255,0.55)"
             />
             <Text style={styles.amountCurrency}>{currencySymbol}</Text>
           </View>
           <TouchableOpacity style={styles.topUpBtn} onPress={handleTopUp}>
             <Text style={styles.topUpText}>{t('topUpBalance')}</Text>
           </TouchableOpacity>
           <Text style={styles.balanceHint}>الرصيد يستخدم لدفع الحجز أو الاستشارة. الدفع الحقيقي يحتاج ربط بوابة دفع وWebhook قبل التشغيل التجاري.</Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('savedCards')}</Text>
        
        {cards.map((card, index) => (
          <TouchableOpacity key={card} onPress={() => setSelectedMethod(card)}>
            <GlassCard style={styles.cardItem}>
              <FontAwesome5 name={index === 0 ? 'cc-visa' : 'cc-mastercard'} size={32} color="#FFF" />
              <View style={styles.cardInfo}>
                  <Text style={styles.cardType}>{index === 0 ? 'Visa Card' : 'Mastercard'}</Text>
                  <Text style={styles.cardNumber}>{card}</Text>
              </View>
              {selectedMethod === card && <Ionicons name="checkmark-circle" size={24} color={COLORS.secondary} />}
            </GlassCard>
          </TouchableOpacity>
        ))}

         <TouchableOpacity style={styles.addCardBtn} onPress={handleAddCard}>
           <Ionicons name="add" size={24} color={COLORS.primaryLight} />
           <Text style={styles.addCardText}>{t('addNewCard')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('otherOptions')}</Text>
        <GlassCard style={styles.otherOption}>
           <TouchableOpacity style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }} onPress={() => setSelectedMethod('instapay')}>
             <View style={styles.instapayMark}><Text style={styles.instapayText}>IP</Text></View>
             <Text style={styles.optionLabel}>Instapay</Text>
             <Ionicons name={selectedMethod === 'instapay' ? 'checkmark-circle' : 'chevron-back'} size={18} color={selectedMethod === 'instapay' ? COLORS.secondary : COLORS.textSecondary} />
           </TouchableOpacity>
        </GlassCard>
        <GlassCard style={styles.otherOption}>
           <TouchableOpacity style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }} onPress={() => setSelectedMethod('paypal')}>
             <FontAwesome5 name="paypal" size={20} color="#003087" />
             <Text style={styles.optionLabel}>PayPal</Text>
             <Ionicons name={selectedMethod === 'paypal' ? 'checkmark-circle' : 'chevron-back'} size={18} color={selectedMethod === 'paypal' ? COLORS.secondary : COLORS.textSecondary} />
           </TouchableOpacity>
        </GlassCard>
        <GlassCard style={styles.otherOption}>
           <TouchableOpacity style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }} onPress={() => setSelectedMethod('apple-pay')}>
             <FontAwesome5 name="apple-pay" size={24} color="#FFF" />
             <Text style={styles.optionLabel}>Apple Pay</Text>
             <Ionicons name={selectedMethod === 'apple-pay' ? 'checkmark-circle' : 'chevron-back'} size={18} color={selectedMethod === 'apple-pay' ? COLORS.secondary : COLORS.textSecondary} />
           </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, marginTop: 40 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 24 },
  balanceCard: { alignItems: 'center', paddingVertical: 32, marginBottom: 32, backgroundColor: COLORS.primary },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 },
  balanceVal: { color: '#FFF', fontSize: 36, fontWeight: 'bold', marginBottom: 20 },
  topUpBtn: { backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  topUpText: { color: COLORS.primary, fontWeight: 'bold' },
  currencyRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  currencyBtn: { minWidth: 76, borderRadius: 12, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  currencyBtnActive: { backgroundColor: '#FFF' },
  currencyText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  currencyTextActive: { color: COLORS.primary },
  amountRow: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14, minWidth: 180 },
  amountInput: { flex: 1, color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', paddingVertical: 10 },
  amountCurrency: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  balanceHint: { color: 'rgba(255,255,255,0.78)', fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 18, paddingHorizontal: 18 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 16 },
  cardItem: { flexDirection: 'row-reverse', alignItems: 'center', padding: 20, marginBottom: 16 },
  cardInfo: { flex: 1, marginRight: 16 },
  cardType: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  cardNumber: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'right', marginTop: 4 },
  addCardBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primaryLight, borderRadius: 16, marginBottom: 32 },
  addCardText: { color: COLORS.primaryLight, fontWeight: 'bold', marginRight: 8 },
  otherOption: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, marginBottom: 12 },
  optionLabel: { flex: 1, color: COLORS.textPrimary, fontSize: 16, marginRight: 16, textAlign: 'right' },
  instapayMark: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  instapayText: { color: '#FFF', fontWeight: '900', fontSize: 11 },
});
