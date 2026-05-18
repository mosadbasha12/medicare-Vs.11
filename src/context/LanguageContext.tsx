import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type AppLanguage = 'ar' | 'en';

const LANGUAGE_KEY = '@medicare_language';

const translations = {
  ar: {
    home: 'الرئيسية',
    doctors: 'الأطباء',
    appointments: 'المواعيد',
    account: 'حسابي',
    profile: 'الملف الشخصي',
    systemAdmin: 'مسؤول النظام',
    doctorUser: 'طبيب ممارس',
    member: 'عضو',
    doctorDashboard: 'لوحة تحكم الطبيب',
    doctorDashboardSub: 'إدارة المرضى، المواعيد، وجدول العمل',
    adminDashboard: 'لوحة تحكم المسؤول',
    adminDashboardSub: 'إدارة المستخدمين، الأطباء، والتقارير المالية',
    pointsToNext: 'بقي لك 250 نقطة للوصول للمستوى التالي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
    patient: 'مريض',
    consultation: 'استشارة',
    rating: 'تقييم',
    bloodType: 'فصيلة الدم',
    expert: 'خبير',
    weightKg: 'الوزن (كج)',
    accountFinance: 'الحساب والمالية',
    wallet: 'المحفظة وطرق الدفع',
    transactions: 'سجل المعاملات',
    generalSettings: 'الإعدادات العامة',
    editProfile: 'تعديل البيانات',
    languageArabic: 'اللغة (العربية)',
    languageEnglish: 'اللغة (English)',
    notifications: 'التنبيهات',
    privacy: 'الخصوصية والأمان',
    logout: 'تسجيل الخروج',
    chooseLanguage: 'اختر اللغة',
    arabic: 'العربية',
    english: 'English',
    currentLanguage: 'اللغة الحالية',
    chooseAndReload: 'اضغط للتبديل وإعادة تحميل الموقع',
  },
  en: {
    home: 'Home',
    doctors: 'Doctors',
    appointments: 'Appointments',
    account: 'Account',
    profile: 'Profile',
    systemAdmin: 'System admin',
    doctorUser: 'Doctor',
    member: 'Member',
    doctorDashboard: 'Doctor dashboard',
    doctorDashboardSub: 'Manage patients, appointments, and schedule',
    adminDashboard: 'Admin dashboard',
    adminDashboardSub: 'Manage users, doctors, and financial reports',
    pointsToNext: '250 points left to reach the next level',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    patient: 'Patient',
    consultation: 'Consultation',
    rating: 'Rating',
    bloodType: 'Blood type',
    expert: 'Expert',
    weightKg: 'Weight (kg)',
    accountFinance: 'Account and finance',
    wallet: 'Wallet and payment methods',
    transactions: 'Transactions',
    generalSettings: 'General settings',
    editProfile: 'Edit profile',
    languageArabic: 'Language (Arabic)',
    languageEnglish: 'Language (English)',
    notifications: 'Notifications',
    privacy: 'Privacy and security',
    logout: 'Log out',
    chooseLanguage: 'Choose language',
    arabic: 'Arabic',
    english: 'English',
    currentLanguage: 'Current language',
    chooseAndReload: 'Tap to switch and reload the site',
  },
} as const;

type TranslationKey = keyof typeof translations.ar;

interface LanguageContextType {
  language: AppLanguage;
  isRTL: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<AppLanguage>('ar');

  useEffect(() => {
    const loadLanguage = async () => {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (stored === 'ar' || stored === 'en') {
        setLanguageState(stored);
      }
    };
    loadLanguage();
  }, []);

  const value = useMemo<LanguageContextType>(() => {
    const setLanguage = async (nextLanguage: AppLanguage) => {
      await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
      setLanguageState(nextLanguage);
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    };

    return {
      language,
      isRTL: language === 'ar',
      setLanguage,
      t: (key) => translations[language][key] || translations.ar[key],
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
