import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type UserLevel = 'برونزي' | 'فضي' | 'ذهبي';
export type UserRole = 'user' | 'admin' | 'doctor' | 'owner';
export type UserGender = 'male' | 'female';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  level: UserLevel;
  role: UserRole;
  balance: number;
  isActive: boolean;
  isApproved: boolean;
  specialty?: string;
  medicalId?: string;
  patientsCount?: number;
  phone?: string;
  nationalId?: string;
  clinicLocation?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  weight?: number;
  bloodType?: string;
  age?: number;
  gender?: UserGender;
  consultationsCount?: number;
  createdAt: string;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
  adminNote?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  emoji?: string;
  available: boolean;
  bio?: string;
  price: number;
}

export interface Appointment {
  id: string;
  userId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  type: 'مكالمة فيديو' | 'زيارة عيادة';
  status: 'قادم' | 'مكتمل' | 'ملغي';
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  title: string;
  date: string;
  amount: number;
  type: 'in' | 'out';
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  desc: string;
  time: string;
  icon: string;
  color: string;
  read: boolean;
}

export interface LabResult {
  id: string;
  userId: string;
  name: string;
  date: string;
  lab: string;
  status: 'طبيعي' | 'يحتاج مراجعة' | 'مرفوع';
  category?: 'lab' | 'xray' | 'prescription';
  fileName?: string;
  fileData?: string;
  mimeType?: string;
}

export interface Prescription {
  id: string;
  userId: string;
  med: string;
  dosage: string;
  doctor: string;
  date: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Chat: { doctorId?: string; doctorName: string };
  Payment: undefined;
  EditProfile: undefined;
  Language: undefined;
  Transactions: undefined;
  Notifications: undefined;
  PrivacySecurity: undefined;
  Results: undefined;
  Prescriptions: undefined;
  Emergency: undefined;
  Admin: undefined;
  DoctorDashboard: undefined;
};

export type TabParamList = {
  'الرئيسية': undefined;
  'الأطباء': undefined;
  'المواعيد': undefined;
  'حسابي': undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;
