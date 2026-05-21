import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type UserLevel = 'برونزي' | 'فضي' | 'ذهبي';
export type UserRole = 'user' | 'admin' | 'doctor' | 'owner';
export type AdminPermission = 'approveDoctors' | 'manageUsers' | 'manageDoctors';
export type UserGender = 'male' | 'female';
export type Currency = 'USD' | 'EGP';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  level: UserLevel;
  role: UserRole;
  balance: number;
  currency?: Currency;
  themeId?: string;
  isActive: boolean;
  isApproved: boolean;
  adminPermissions?: AdminPermission[];
  specialty?: string;
  medicalId?: string;
  patientsCount?: number;
  doctorVideoPrice?: number;
  doctorClinicPrice?: number;
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
  pendingProfileUpdate?: {
    updates: Partial<AppUser>;
    requestedAt: string;
    status: 'pending';
  };
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
  reviewsCount?: number;
  emoji?: string;
  available: boolean;
  bio?: string;
  phone?: string;
  clinicLocation?: string;
  medicalId?: string;
  patientsCount?: number;
  price: number;
  clinicPrice?: number;
  currency?: Currency;
}

export interface DoctorReview {
  id: string;
  doctorId: string;
  patientId: string;
  rating: number;
  comment: string;
  createdAt: string;
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
  price?: number;
  currency?: Currency;
  platformFee?: number;
  doctorNet?: number;
  meetingUrl?: string;
  meetingRoom?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  recipientId?: string;
  attachmentName?: string;
  attachmentData?: string;
  attachmentType?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  title: string;
  date: string;
  amount: number;
  type: 'in' | 'out';
  currency?: Currency;
  status?: 'pending' | 'approved' | 'rejected' | 'settled';
  provider?: 'card' | 'instapay' | 'wallet' | 'system';
  appointmentId?: string;
  description?: string;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  action: string;
  area: string;
  targetId?: string;
  targetName?: string;
  description: string;
  details?: Record<string, any>;
  createdAt: string;
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
  doctorId?: string;
  doctorName?: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  userId: string;
  med: string;
  dosage: string;
  doctor: string;
  date: string;
  frequency?: string;
  durationDays?: number;
  timesPerDay?: number;
  instructions?: string;
  startDate?: string;
  totalDoses?: number;
  takenDoses?: number;
  lastTakenAt?: string;
  refillCount?: number;
  lastRefillAt?: string;
}

export interface MedicineCatalogItem {
  med: string;
  dosage: string;
  timesPerDay: number;
  durationDays: number;
  instructions: string;
  source?: 'local' | 'rxnav' | 'openfda';
  updatedAt?: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  ChatList: undefined;
  Chat: { doctorId?: string; doctorName: string; chatId?: string; recipientId?: string };
  DoctorProfile: { doctorId: string };
  PatientMedicalFile: { patientId: string; patientName?: string; doctorId?: string };
  Payment: undefined;
  EditProfile: undefined;
  Language: undefined;
  Theme: undefined;
  Transactions: undefined;
  Notifications: undefined;
  PrivacySecurity: undefined;
  Results: undefined;
  Prescriptions: undefined;
  Emergency: undefined;
  Admin: undefined;
  DoctorDashboard: undefined;
  VideoCall: { appointmentId: string; meetingUrl?: string; meetingRoom?: string; doctorName?: string; participantName?: string };
};

export type TabParamList = {
  'الرئيسية': undefined;
  'الأطباء': undefined;
  'المواعيد': undefined;
  'حسابي': undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;
