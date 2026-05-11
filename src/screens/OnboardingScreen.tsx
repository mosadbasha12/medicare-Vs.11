import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../theme';

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const [step, setStep] = useState(0);

  const screens = [
    { title: 'مرحباً بك في ميديكير برو', desc: 'نظام رعاية صحية متكامل وأنيق، صُمم خصيصاً لك.', icon: '🏥', color: COLORS.primary },
    { title: 'استشارات فورية', desc: 'تواصل مع أفضل الأطباء في أي وقت ومن أي مكان.', icon: '💬', color: COLORS.secondary },
    { title: 'تقاريرك بأمان', desc: 'وفرنا لك أسهل طريقة لإدارة ومتابعة سجلاتك الطبية.', icon: '📂', color: COLORS.accentWarm },
  ];

  const handleNext = () => {
    if (step < screens.length - 1) {
      setStep(step + 1);
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.bgCircle, { backgroundColor: screens[step].color }]} />

      <Pressable 
        style={styles.skipBtn} 
        onPress={() => navigation.replace('Login')}
      >
         <Text style={styles.skipText}>تخطي</Text>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Text style={styles.emoji}>{screens[step].icon}</Text>
        </View>
        <Text style={styles.title}>{screens[step].title}</Text>
        <Text style={styles.desc}>{screens[step].desc}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {screens.map((_, i) => (
            <View key={i} style={[styles.dot, step === i && { backgroundColor: screens[step].color, width: 24 }]} />
          ))}
        </View>
        <Pressable 
          style={({ pressed }) => [
            styles.nextBtn, 
            { backgroundColor: screens[step].color },
            pressed && { transform: [{ scale: 0.95 }] }
          ]} 
          onPress={handleNext}
        >
          <FontAwesome5 name={step === screens.length - 1 ? "check" : "chevron-left"} size={20} color="#FFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bgBase, direction: 'rtl' },
  bgCircle: { position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125, opacity: 0.15, pointerEvents: 'none' },
  skipBtn: { position: 'absolute', top: 60, left: 24, zIndex: 10, padding: 12 },
  skipText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconBox: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 40, borderWidth: 1, borderColor: COLORS.borderColor },
  emoji: { fontSize: 72 },
  title: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 16 },
  desc: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 26 },
  footer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  dots: { flexDirection: 'row-reverse' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderColor, marginHorizontal: 4 },
  nextBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 }
});
