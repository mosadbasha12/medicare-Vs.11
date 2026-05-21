import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdminPermission, Appointment, LabResult, Prescription, Doctor, DoctorReview, ChatMessage, Transaction } from '../types';
import { COLORS, type ThemeId } from '../theme';
import {
  addDoc,
  collectionGroup,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { AppUser, AuditLogEntry, Currency } from '../types';
import { isOwnerEmail } from './storage';

const FIREBASE_ENABLED = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY !== 'YOUR_API_KEY_HERE'
);

export interface DoctorSchedule {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface DoctorAppointment extends Appointment {
  patientId: string;
  patientName: string;
}

const appointmentStatusRank: Record<Appointment['status'], number> = {
  'قادم': 0,
  'مكتمل': 1,
  'ملغي': 2,
};

const getAppointmentTimeValue = (appointment: Pick<Appointment, 'date' | 'time' | 'id'>): number => {
  const candidates = [
    `${appointment.date} ${appointment.time}`,
    appointment.date,
  ];

  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const idNumber = Number(String(appointment.id || '').replace(/\D/g, ''));
  return Number.isFinite(idNumber) && idNumber > 0 ? idNumber : 0;
};

export const sortAppointmentsByWorkflow = <T extends Appointment>(appointments: T[]): T[] => {
  return [...appointments].sort((a, b) => {
    const statusDiff = (appointmentStatusRank[a.status] ?? 9) - (appointmentStatusRank[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;

    const aTime = getAppointmentTimeValue(a);
    const bTime = getAppointmentTimeValue(b);
    if (a.status === 'قادم') return aTime - bTime;
    return bTime - aTime;
  });
};

export interface ExtendedPrescription extends Prescription {
  patientName: string;
}

export interface ChatSummary {
  chatId?: string;
  doctorId: string;
  doctorName: string;
  doctorEmoji?: string;
  specialty?: string;
  patientId?: string;
  patientName?: string;
  lastMessage: string;
  lastMessageAt: string;
  messagesCount: number;
  unreadCount?: number;
}

export interface NotificationSummary {
  totalUnread: number;
  unreadNotifications: number;
  unreadChats: number;
}

export interface ChatMessageInput {
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

export interface PlatformSettings {
  commissionRate: number;
  instapayHandle: string;
  themeId: ThemeId;
}

export interface PaidAppointmentInput extends Omit<Appointment, 'id'> {
  price: number;
  currency: Currency;
}

export type TransactionInput = Omit<Transaction, 'id' | 'date' | 'createdAt'> & {
  date?: string;
  createdAt?: string;
};

export type PaidAppointmentResult =
  | { status: 'success'; updatedUser: AppUser; platformFee: number; doctorNet: number }
  | { status: 'insufficient_balance'; required: number; balance: number }
  | { status: 'doctor_not_found' }
  | { status: 'failed' };

const PLATFORM_SETTINGS_KEY = '@platform_settings';
const PLATFORM_BALANCE_KEY = '@platform_balance';
const AUDIT_LOG_KEY = '@audit_logs';
const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  commissionRate: 5,
  instapayHandle: 'medicare@instapay',
  themeId: 'ruby',
};

const createVideoMeetingFields = (appointmentId: string, type: Appointment['type']) => {
  if (type !== 'مكالمة فيديو') return {};
  const meetingRoom = `medicare-${appointmentId}`;
  return {
    meetingRoom,
    meetingUrl: `medicare-video-call://${meetingRoom}`,
  };
};

const normalizePlatformSettings = (settings?: Partial<PlatformSettings> | null): PlatformSettings => ({
  commissionRate: Math.max(0, Math.min(30, Number(settings?.commissionRate ?? DEFAULT_PLATFORM_SETTINGS.commissionRate) || 0)),
  instapayHandle: settings?.instapayHandle?.trim() || DEFAULT_PLATFORM_SETTINGS.instapayHandle,
  themeId: settings?.themeId || DEFAULT_PLATFORM_SETTINGS.themeId,
});

const findOwnerUser = async (): Promise<any | null> => {
  const users = await getAllUsers();
  return users.find((u: any) => u.role === 'owner' || isOwnerEmail(u.email || '')) || null;
};

const cleanAuditDetails = (details?: Record<string, any>): Record<string, any> | undefined => {
  if (!details) return undefined;
  const cleaned: Record<string, any> = {};
  Object.entries(details).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && value.length > 180) {
      cleaned[key] = `${value.slice(0, 180)}...`;
      return;
    }
    cleaned[key] = value;
  });
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};

const resolveAuditActor = async (actorId?: string): Promise<Partial<AuditLogEntry>> => {
  const fallbackId = actorId || auth.currentUser?.uid;
  if (!fallbackId) return {};
  try {
    const users = await getAllUsers();
    const actor = users.find((item) => item.uid === fallbackId);
    if (actor) {
      return {
        actorId: actor.uid,
        actorName: actor.name,
        actorRole: isOwnerEmail(actor.email || '') ? 'owner' : actor.role,
      };
    }
  } catch {
    // Audit logging should never block the action itself.
  }
  return { actorId: fallbackId };
};

export const recordAuditLog = async (input: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const createdAt = new Date().toISOString();
    const actor = await resolveAuditActor(input.actorId);
    const entry: AuditLogEntry = {
      ...input,
      ...actor,
      actorName: input.actorName || actor.actorName,
      actorRole: input.actorRole || actor.actorRole,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      details: cleanAuditDetails(input.details),
    };

    if (FIREBASE_ENABLED) {
      try {
        const { id, ...payload } = entry;
        const docRef = await addDoc(collection(db, 'auditLogs'), {
          ...payload,
          createdAt,
          createdAtServer: serverTimestamp(),
        });
        entry.id = docRef.id;
      } catch (error) {
        console.error('Firebase audit log error:', error);
      }
    }

    const stored = await AsyncStorage.getItem(AUDIT_LOG_KEY);
    const logs: AuditLogEntry[] = stored ? JSON.parse(stored) : [];
    logs.unshift(entry);
    await AsyncStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch (error) {
    console.error('recordAuditLog error:', error);
  }
};

export const getAuditLogs = async (max = 120): Promise<AuditLogEntry[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(max)));
      return snap.docs.map((item) => {
        const data = item.data() as any;
        return {
          id: item.id,
          actorId: data.actorId,
          actorName: data.actorName,
          actorRole: data.actorRole,
          action: data.action,
          area: data.area,
          targetId: data.targetId,
          targetName: data.targetName,
          description: data.description,
          details: data.details,
          createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || data.createdAtServer?.toDate?.().toISOString?.() || new Date().toISOString(),
        } as AuditLogEntry;
      });
    } catch (error) {
      console.error('Firebase getAuditLogs error:', error);
    }
  }

  const stored = await AsyncStorage.getItem(AUDIT_LOG_KEY);
  const logs: AuditLogEntry[] = stored ? JSON.parse(stored) : [];
  return logs
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, max);
};

const formatTransactionDate = (isoDate: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return new Date(isoDate).toLocaleString();
  }
};

export const recordWalletTransaction = async (input: TransactionInput): Promise<Transaction | null> => {
  try {
    const createdAt = input.createdAt || new Date().toISOString();
    const transaction: Transaction = {
      ...input,
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: input.date || formatTransactionDate(createdAt),
      createdAt,
      status: input.status || 'settled',
    };

    if (FIREBASE_ENABLED) {
      const { id, ...payload } = transaction;
      const docRef = await addDoc(collection(db, 'transactions'), payload);
      transaction.id = docRef.id;
    }

    const stored = await AsyncStorage.getItem(`@transactions_${input.userId}`);
    const transactions: Transaction[] = stored ? JSON.parse(stored) : [];
    transactions.unshift(transaction);
    await AsyncStorage.setItem(`@transactions_${input.userId}`, JSON.stringify(transactions));
    await recordAuditLog({
      actorId: input.userId,
      action: input.type === 'in' ? 'wallet_credit' : 'wallet_debit',
      area: 'المحفظة والمعاملات',
      targetId: transaction.id,
      targetName: transaction.title,
      description: `${transaction.title} بقيمة ${transaction.amount} ${transaction.currency || ''}`,
      details: {
        amount: transaction.amount,
        currency: transaction.currency,
        provider: transaction.provider,
        status: transaction.status,
        appointmentId: transaction.appointmentId,
      },
    });
    return transaction;
  } catch (error) {
    console.error('recordWalletTransaction error:', error);
    return null;
  }
};

const DEFAULT_DOCTORS: Doctor[] = [
  { id: '1', name: 'د. سارة ميتشيل', specialty: 'أخصائية قلب', rating: 0, reviewsCount: 0, emoji: '👩‍⚕️', available: true, price: 50 },
  { id: '2', name: 'د. أوين برادي', specialty: 'جراحة عامة', rating: 0, reviewsCount: 0, emoji: '👨‍⚕️', available: true, price: 70 },
  { id: '3', name: 'د. جيمس كوبر', specialty: 'طب أطفال', rating: 0, reviewsCount: 0, emoji: '👨‍⚕️', available: true, price: 40 },
];

export const getDoctorReviews = async (doctorId: string): Promise<DoctorReview[]> => {
  if (!doctorId) return [];

  if (FIREBASE_ENABLED) {
    try {
      const data = await getUserDocData(doctorId);
      if (Array.isArray(data?.doctorReviews)) {
        return data.doctorReviews.sort((a: DoctorReview, b: DoctorReview) => String(b.createdAt).localeCompare(String(a.createdAt)));
      }
    } catch (error) {
      console.error('Firebase getDoctorReviews error:', error);
    }
  }

  const stored = await AsyncStorage.getItem(`@doctor_reviews_${doctorId}`);
  return stored ? JSON.parse(stored) : [];
};

export const getDoctorReviewStats = async (doctorId: string): Promise<{ rating: number; reviewsCount: number }> => {
  const reviews = await getDoctorReviews(doctorId);
  if (reviews.length === 0) return { rating: 0, reviewsCount: 0 };
  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return {
    rating: Number((total / reviews.length).toFixed(1)),
    reviewsCount: reviews.length,
  };
};

export const canUserReviewDoctor = async (patientId: string, doctorId: string): Promise<boolean> => {
  if (!patientId || !doctorId) return false;
  const appointments = await getUserAppointments(patientId);
  return appointments.some((apt) => apt.doctorId === doctorId && apt.status !== 'ملغي');
};

export const createDoctorReview = async (
  reviewInput: Omit<DoctorReview, 'id' | 'createdAt'>
): Promise<DoctorReview | null> => {
  try {
    const canReview = await canUserReviewDoctor(reviewInput.patientId, reviewInput.doctorId);
    if (!canReview) return null;

    const review: DoctorReview = {
      ...reviewInput,
      rating: Math.max(1, Math.min(5, Number(reviewInput.rating) || 1)),
      comment: reviewInput.comment.trim(),
      id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    const existing = await getDoctorReviews(review.doctorId);
    const next = [review, ...existing.filter((item) => item.patientId !== review.patientId)];

    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', review.doctorId), { doctorReviews: next }, { merge: true });
    }

    await AsyncStorage.setItem(`@doctor_reviews_${review.doctorId}`, JSON.stringify(next));
    return review;
  } catch (error) {
    console.error('createDoctorReview error:', error);
    return null;
  }
};

export const getAllDoctors = async (): Promise<Doctor[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'doctor'), where('isApproved', '==', true)));
      const registeredDoctors = await Promise.all(snap.docs.map(async (d) => {
        const u = d.data() as any;
        const reviewStats = await getDoctorReviewStats(u.uid || d.id);
        return {
          id: u.uid || d.id,
          name: u.name,
          specialty: u.specialty || 'عام',
          rating: reviewStats.rating,
          reviewsCount: reviewStats.reviewsCount,
          emoji: '👨‍⚕️',
          available: u.isActive !== false,
          bio: u.bio || `طبيب متخصص في ${u.specialty || 'الطب العام'} ويستقبل الاستشارات والحجوزات عبر Medicare.`,
          phone: u.phone,
          clinicLocation: u.clinicLocation,
          medicalId: u.medicalId,
          patientsCount: u.patientsCount,
          price: u.doctorVideoPrice ?? 60,
          clinicPrice: u.doctorClinicPrice ?? u.doctorVideoPrice ?? 60,
          currency: u.currency || 'EGP',
        };
      }));
      return [...DEFAULT_DOCTORS, ...registeredDoctors.filter((rd) => !DEFAULT_DOCTORS.some((d) => d.id === rd.id))];
    } catch (error) {
      console.error('Firebase getAllDoctors error:', error);
    }
  }

  const stored = await AsyncStorage.getItem('@doctors');
  let defaultDoctors: Doctor[] = stored ? JSON.parse(stored) : DEFAULT_DOCTORS;

  if (!stored) {
    await AsyncStorage.setItem('@doctors', JSON.stringify(DEFAULT_DOCTORS));
    defaultDoctors = DEFAULT_DOCTORS;
  }

  const users = await getAllUsers();
  const registeredDoctorsWithRatings = await Promise.all(users
    .filter((u) => u.role === 'doctor' && u.isApproved !== false)
    .map(async (u) => {
      const reviewStats = await getDoctorReviewStats(u.uid);
      return {
        id: u.uid,
        name: u.name,
        specialty: u.specialty || 'عام',
        rating: reviewStats.rating,
        reviewsCount: reviewStats.reviewsCount,
        emoji: '👨‍⚕️',
        available: true,
        bio: u.bio || `طبيب متخصص في ${u.specialty || 'الطب العام'} ويستقبل الاستشارات والحجوزات عبر Medicare.`,
        phone: u.phone,
        clinicLocation: u.clinicLocation,
        medicalId: u.medicalId,
        patientsCount: u.patientsCount,
        price: u.doctorVideoPrice ?? 60,
        clinicPrice: u.doctorClinicPrice ?? u.doctorVideoPrice ?? 60,
        currency: u.currency || 'EGP',
      };
    }));
  const registeredDoctors = registeredDoctorsWithRatings.filter((rd) => !defaultDoctors.some((d) => d.id === rd.id));

  const merged = [...defaultDoctors, ...registeredDoctors];

  if (registeredDoctors.length > 0) {
    await AsyncStorage.setItem('@doctors', JSON.stringify(merged));
  }

  return merged;
};

export const searchDoctors = async (searchTerm: string): Promise<Doctor[]> => {
  const doctors = await getAllDoctors();
  return doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );
};

export const addDoctorToCatalog = async (doctorUser: any): Promise<boolean> => {
  try {
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'doctors', doctorUser.uid), {
        id: doctorUser.uid,
        name: doctorUser.name,
        specialty: doctorUser.specialty || 'عام',
        rating: 0,
        reviewsCount: 0,
        emoji: '👨‍⚕️',
        available: doctorUser.isApproved !== false,
        bio: doctorUser.bio || `طبيب متخصص في ${doctorUser.specialty || 'الطب العام'} ويستقبل الاستشارات والحجوزات عبر Medicare.`,
        phone: doctorUser.phone,
        clinicLocation: doctorUser.clinicLocation,
        medicalId: doctorUser.medicalId,
        patientsCount: doctorUser.patientsCount,
        price: doctorUser.doctorVideoPrice ?? 60,
        clinicPrice: doctorUser.doctorClinicPrice ?? doctorUser.doctorVideoPrice ?? 60,
        currency: doctorUser.currency || 'EGP',
      }, { merge: true });
      return true;
    }

    const doctors = await getAllDoctors();
    const existingIndex = doctors.findIndex((d) => d.id === doctorUser.uid);
    if (existingIndex > -1) {
      doctors[existingIndex] = {
        ...doctors[existingIndex],
        name: doctorUser.name,
        specialty: doctorUser.specialty || doctors[existingIndex].specialty || 'عام',
        available: doctorUser.isApproved !== false,
        bio: doctorUser.bio || doctors[existingIndex].bio,
        phone: doctorUser.phone,
        clinicLocation: doctorUser.clinicLocation,
        medicalId: doctorUser.medicalId,
        patientsCount: doctorUser.patientsCount,
        price: doctorUser.doctorVideoPrice ?? doctors[existingIndex].price ?? 60,
        clinicPrice: doctorUser.doctorClinicPrice ?? doctorUser.doctorVideoPrice ?? doctors[existingIndex].clinicPrice ?? doctors[existingIndex].price ?? 60,
        currency: doctorUser.currency || doctors[existingIndex].currency || 'EGP',
      };
      await AsyncStorage.setItem('@doctors', JSON.stringify(doctors));
      return true;
    }

    const newDoctor: Doctor = {
      id: doctorUser.uid,
      name: doctorUser.name,
      specialty: doctorUser.specialty || 'عام',
      rating: 0,
      reviewsCount: 0,
      emoji: '👨‍⚕️',
      available: doctorUser.isApproved !== false,
      bio: doctorUser.bio || `طبيب متخصص في ${doctorUser.specialty || 'الطب العام'} ويستقبل الاستشارات والحجوزات عبر Medicare.`,
      phone: doctorUser.phone,
      clinicLocation: doctorUser.clinicLocation,
      medicalId: doctorUser.medicalId,
      patientsCount: doctorUser.patientsCount,
      price: doctorUser.doctorVideoPrice ?? 60,
      clinicPrice: doctorUser.doctorClinicPrice ?? doctorUser.doctorVideoPrice ?? 60,
      currency: doctorUser.currency || 'EGP',
    };
    if (doctorUser.isApproved !== false) {
      doctors.push(newDoctor);
    }
    await AsyncStorage.setItem('@doctors', JSON.stringify(doctors));
    const defaultSchedule: DoctorSchedule[] = [
      { day: 'الأحد', enabled: true, startTime: '09:00', endTime: '17:00' },
      { day: 'الإثنين', enabled: true, startTime: '09:00', endTime: '17:00' },
      { day: 'الثلاثاء', enabled: true, startTime: '09:00', endTime: '17:00' },
      { day: 'الأربعاء', enabled: true, startTime: '09:00', endTime: '17:00' },
      { day: 'الخميس', enabled: true, startTime: '09:00', endTime: '14:00' },
      { day: 'الجمعة', enabled: false, startTime: '', endTime: '' },
      { day: 'السبت', enabled: false, startTime: '', endTime: '' },
    ];
    await AsyncStorage.setItem(`@doctor_schedule_${doctorUser.uid}`, JSON.stringify(defaultSchedule));
    return true;
  } catch {
    return false;
  }
};

export const getPlatformSettings = async (): Promise<PlatformSettings> => {
  if (FIREBASE_ENABLED) {
    try {
      const owner = await findOwnerUser();
      if (owner?.platformSettings) return normalizePlatformSettings(owner.platformSettings);
    } catch (error) {
      console.error('Owner platformSettings fallback error:', error);
    }

    try {
      const snap = await getDoc(doc(db, 'settings', 'platform'));
      if (snap.exists()) return normalizePlatformSettings(snap.data() as Partial<PlatformSettings>);
    } catch (error) {
      console.error('Firebase getPlatformSettings error:', error);
    }
  }

  const stored = await AsyncStorage.getItem(PLATFORM_SETTINGS_KEY);
  return stored ? normalizePlatformSettings(JSON.parse(stored)) : DEFAULT_PLATFORM_SETTINGS;
};

export const updatePlatformSettings = async (
  settings: PlatformSettings,
  actorRole?: string,
  actorUid?: string
): Promise<'success' | 'forbidden' | 'failed'> => {
  if (actorRole !== 'owner') return 'forbidden';
  const cleanSettings = normalizePlatformSettings(settings);

  try {
    let savedToFirebase = false;
    if (FIREBASE_ENABLED) {
      try {
        await setDoc(doc(db, 'settings', 'platform'), cleanSettings, { merge: true });
        savedToFirebase = true;
      } catch (error) {
        console.error('settings/platform write denied, using owner fallback:', error);
        const owner = await findOwnerUser();
        const candidateUserIds = [
          auth.currentUser?.uid,
          actorUid,
          owner?.uid,
        ].filter(Boolean) as string[];
        let lastError = error;

        for (const uid of Array.from(new Set(candidateUserIds))) {
          try {
            await setDoc(doc(db, 'users', uid), {
              platformSettings: cleanSettings,
              platformSettingsUpdatedAt: new Date().toISOString(),
            }, { merge: true });
            savedToFirebase = true;
            break;
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }

        if (!savedToFirebase) throw lastError;
      }
    }
    await AsyncStorage.setItem(PLATFORM_SETTINGS_KEY, JSON.stringify(cleanSettings));
    await recordAuditLog({
      actorId: actorUid,
      action: 'platform_settings_updated',
      area: 'إعدادات النظام',
      targetId: 'settings/platform',
      targetName: 'إعدادات الدفع والثيم',
      description: 'تم تعديل إعدادات المنصة',
      details: cleanSettings,
    });
    return FIREBASE_ENABLED && !savedToFirebase ? 'failed' : 'success';
  } catch (error) {
    console.error('updatePlatformSettings error:', error);
    return 'failed';
  }
};

export const subscribePlatformSettings = (
  callback: (settings: PlatformSettings) => void
): (() => void) => {
  let disposed = false;

  if (FIREBASE_ENABLED) {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'platform'),
      async (snap) => {
        if (disposed) return;
        if (snap.exists()) {
          callback(await getPlatformSettings());
        } else {
          callback(await getPlatformSettings());
        }
      },
      async () => {
        if (!disposed) callback(await getPlatformSettings());
      }
    );
    const interval = setInterval(async () => {
      if (!disposed) callback(await getPlatformSettings());
    }, 5000);
    return () => {
      disposed = true;
      clearInterval(interval);
      unsubscribe();
    };
  }

  getPlatformSettings().then((settings) => {
    if (!disposed) callback(settings);
  });
  const interval = setInterval(async () => {
    if (!disposed) callback(await getPlatformSettings());
  }, 5000);

  return () => {
    disposed = true;
    clearInterval(interval);
  };
};

const addPlatformBalance = async (amount: number): Promise<void> => {
  const currentStr = await AsyncStorage.getItem(PLATFORM_BALANCE_KEY);
  const current = currentStr ? Number(currentStr) : 0;
  await AsyncStorage.setItem(PLATFORM_BALANCE_KEY, String(Number((current + amount).toFixed(2))));
};

const saveUsersWithSession = async (users: any[], sessionUser?: any): Promise<void> => {
  await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
  if (sessionUser) {
    const { password, ...safeUser } = sessionUser;
    await AsyncStorage.setItem('@medicare_session', JSON.stringify(safeUser));
  }
};

export const createPaidAppointment = async (apt: PaidAppointmentInput): Promise<PaidAppointmentResult> => {
  try {
    const settings = await getPlatformSettings();
    const platformFee = Number((apt.price * settings.commissionRate / 100).toFixed(2));
    const doctorNet = Number((apt.price - platformFee).toFixed(2));

    if (FIREBASE_ENABLED) {
      const users = await getAllUsers();
      const patient = users.find((u) => u.uid === apt.userId);
      const doctorUser = users.find((u) => u.uid === apt.doctorId);
      const demoDoctor = DEFAULT_DOCTORS.find((d) => d.id === apt.doctorId);
      if (!doctorUser && !demoDoctor) {
        return { status: 'doctor_not_found' };
      }
      if (!patient || (patient.balance ?? 0) < apt.price) {
        return { status: 'insufficient_balance', required: apt.price, balance: patient?.balance ?? 0 };
      }

      const appointmentRef = doc(collection(db, 'appointments'));
      const videoFields = createVideoMeetingFields(appointmentRef.id, apt.type);
      await setDoc(appointmentRef, {
        ...apt,
        id: appointmentRef.id,
        patientId: apt.userId,
        patientName: patient?.name || 'مريض',
        ...videoFields,
        platformFee,
        doctorNet,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', apt.userId), {
        balance: Number(((patient.balance ?? 0) - apt.price).toFixed(2)),
        consultationsCount: increment(1),
      });
      if (doctorUser) {
        await updateDoc(doc(db, 'users', apt.doctorId), {
          balance: Number(((doctorUser.balance ?? 0) + doctorNet).toFixed(2)),
        });
      }
      const updatedUser = { ...patient, balance: Number(((patient.balance ?? 0) - apt.price).toFixed(2)), consultationsCount: (patient.consultationsCount ?? 0) + 1 };
      await updateCachedUser(apt.userId, { balance: updatedUser.balance, consultationsCount: updatedUser.consultationsCount });
      await addPlatformBalance(platformFee);
      await recordWalletTransaction({
        userId: apt.userId,
        title: `دفع حجز ${apt.doctorName}`,
        amount: -apt.price,
        type: 'out',
        currency: apt.currency,
        provider: 'wallet',
        description: `رسوم التطبيق ${platformFee} ${apt.currency} وصافي الطبيب ${doctorNet} ${apt.currency}`,
      });
      if (doctorUser) {
        await recordWalletTransaction({
          userId: apt.doctorId,
          title: `إيراد حجز من ${patient.name || 'مريض'}`,
          amount: doctorNet,
          type: 'in',
          currency: apt.currency,
          provider: 'wallet',
          description: `تم خصم عمولة التطبيق ${platformFee} ${apt.currency}`,
        });
      }
      await createAppointmentNotification({
        doctorId: apt.doctorId,
        patientId: apt.userId,
        patientName: patient?.name || 'مريض',
        doctorName: apt.doctorName,
        date: apt.date,
        time: apt.time,
        appointmentId: appointmentRef.id,
      });
      await recordAuditLog({
        actorId: apt.userId,
        action: 'appointment_created',
        area: 'الحجوزات',
        targetId: appointmentRef.id,
        targetName: apt.doctorName,
        description: `${patient?.name || 'مريض'} حجز موعد مع ${apt.doctorName} يوم ${apt.date} الساعة ${apt.time}`,
        details: {
          doctorId: apt.doctorId,
          patientId: apt.userId,
          type: apt.type,
          price: apt.price,
          platformFee,
          doctorNet,
        },
      });
      return { status: 'success', updatedUser, platformFee, doctorNet };
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return { status: 'failed' };
    const users = JSON.parse(stored);
    const patientIdx = users.findIndex((u: any) => u.uid === apt.userId);
    const doctorIdx = users.findIndex((u: any) => u.uid === apt.doctorId);
    const demoDoctor = DEFAULT_DOCTORS.find((d) => d.id === apt.doctorId);
    if (doctorIdx === -1 && !demoDoctor) {
      return { status: 'doctor_not_found' };
    }
    if (patientIdx === -1 || (users[patientIdx].balance ?? 0) < apt.price) {
      return { status: 'insufficient_balance', required: apt.price, balance: users[patientIdx]?.balance ?? 0 };
    }

    users[patientIdx].balance = Number(((users[patientIdx].balance ?? 0) - apt.price).toFixed(2));
    users[patientIdx].consultationsCount = (users[patientIdx].consultationsCount ?? 0) + 1;
    if (doctorIdx > -1) {
      users[doctorIdx].balance = Number(((users[doctorIdx].balance ?? 0) + doctorNet).toFixed(2));
    }

    const localAppointmentId = `apt_${Date.now()}`;
    const newApt = {
      ...apt,
      id: localAppointmentId,
      ...createVideoMeetingFields(localAppointmentId, apt.type),
      platformFee,
      doctorNet,
      paidAt: new Date().toISOString(),
    };
    const existing = await getUserAppointments(apt.userId);
    existing.push(newApt);
    await AsyncStorage.setItem(`@appointments_${apt.userId}`, JSON.stringify(existing));
    await saveUsersWithSession(users, users[patientIdx]);
    await addPlatformBalance(platformFee);
    await recordWalletTransaction({
      userId: apt.userId,
      title: `دفع حجز ${apt.doctorName}`,
      amount: -apt.price,
      type: 'out',
      currency: apt.currency,
      provider: 'wallet',
      appointmentId: newApt.id,
      description: `رسوم التطبيق ${platformFee} ${apt.currency} وصافي الطبيب ${doctorNet} ${apt.currency}`,
    });
    if (doctorIdx > -1) {
      await recordWalletTransaction({
        userId: apt.doctorId,
        title: `إيراد حجز من ${users[patientIdx].name || 'مريض'}`,
        amount: doctorNet,
        type: 'in',
        currency: apt.currency,
        provider: 'wallet',
        appointmentId: newApt.id,
        description: `تم خصم عمولة التطبيق ${platformFee} ${apt.currency}`,
      });
    }
    await createAppointmentNotification({
      doctorId: apt.doctorId,
      patientId: apt.userId,
      patientName: users[patientIdx].name || 'مريض',
      doctorName: apt.doctorName,
      date: apt.date,
      time: apt.time,
      appointmentId: newApt.id,
    });
    await recordAuditLog({
      actorId: apt.userId,
      action: 'appointment_created',
      area: 'الحجوزات',
      targetId: newApt.id,
      targetName: apt.doctorName,
      description: `${users[patientIdx].name || 'مريض'} حجز موعد مع ${apt.doctorName} يوم ${apt.date} الساعة ${apt.time}`,
      details: {
        doctorId: apt.doctorId,
        patientId: apt.userId,
        type: apt.type,
        price: apt.price,
        platformFee,
        doctorNet,
      },
    });
    const { password, ...updatedUser } = users[patientIdx];
    return { status: 'success', updatedUser, platformFee, doctorNet };
  } catch (error) {
    console.error('createPaidAppointment error:', error);
    return { status: 'failed' };
  }
};

export const getDoctorSchedule = async (doctorId: string): Promise<DoctorSchedule[]> => {
  if (FIREBASE_ENABLED) {
    const data = await getUserDocData(doctorId);
    if (Array.isArray(data?.doctorSchedule)) return data.doctorSchedule;
  }

  const stored = await AsyncStorage.getItem(`@doctor_schedule_${doctorId}`);
  if (stored) return JSON.parse(stored);
  const defaultSchedule: DoctorSchedule[] = [
    { day: 'الأحد', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 'الإثنين', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 'الثلاثاء', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 'الأربعاء', enabled: true, startTime: '09:00', endTime: '17:00' },
    { day: 'الخميس', enabled: true, startTime: '09:00', endTime: '14:00' },
    { day: 'الجمعة', enabled: false, startTime: '', endTime: '' },
    { day: 'السبت', enabled: false, startTime: '', endTime: '' },
  ];
  await AsyncStorage.setItem(`@doctor_schedule_${doctorId}`, JSON.stringify(defaultSchedule));
  return defaultSchedule;
};

export const saveDoctorSchedule = async (doctorId: string, schedule: DoctorSchedule[]): Promise<boolean> => {
  try {
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', doctorId), { doctorSchedule: schedule }, { merge: true });
    }
    await AsyncStorage.setItem(`@doctor_schedule_${doctorId}`, JSON.stringify(schedule));
    return true;
  } catch {
    return false;
  }
};

export const getAllUsers = async (): Promise<any[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((d) => {
        const data = d.data() as any;
        const { password, emailLower, ...safeUser } = data;
        return { uid: data.uid || d.id, ...safeUser };
      });
    } catch (error) {
      console.error('Firebase getAllUsers error:', error);
    }
  }

  const stored = await AsyncStorage.getItem('@medicare_users');
  return stored ? JSON.parse(stored) : [];
};

export const getUserAppointments = async (userId: string): Promise<Appointment[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'appointments'), where('userId', '==', userId)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Appointment))
        .filter((apt: any) => apt.type !== 'chatThread');
    } catch (error) {
      console.error('Firebase getUserAppointments error:', error);
    }
  }

  const stored = await AsyncStorage.getItem(`@appointments_${userId}`);
  return stored ? JSON.parse(stored) : [];
};

export const getDoctorAppointments = async (doctorId: string): Promise<DoctorAppointment[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'appointments'), where('doctorId', '==', doctorId)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DoctorAppointment))
        .filter((apt: any) => apt.type !== 'chatThread');
    } catch (error) {
      console.error('Firebase getDoctorAppointments error:', error);
    }
  }

  const users = await getAllUsers();
  const allAppointments: (Appointment & { patientId: string; patientName: string })[] = [];
  for (const user of users) {
    const stored = await AsyncStorage.getItem(`@appointments_${user.uid}`);
    if (stored) {
      const appointments: Appointment[] = JSON.parse(stored);
      for (const apt of appointments) {
        if (apt.doctorId === doctorId) {
          allAppointments.push({
            ...apt,
            patientId: user.uid,
            patientName: user.name,
          });
        }
      }
    }
  }
  return allAppointments;
};

export const subscribeUserAppointments = (
  userId: string | undefined,
  callback: (appointments: Appointment[]) => void
): (() => void) => {
  if (!userId) {
    callback([]);
    return () => undefined;
  }

  if (FIREBASE_ENABLED) {
    try {
      const q = query(collection(db, 'appointments'), where('userId', '==', userId));
      const unsubscribe = onSnapshot(q, (snap) => {
        const appointments = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Appointment))
          .filter((apt: any) => apt.type !== 'chatThread');
        callback(appointments);
      }, async () => {
        callback(await getUserAppointments(userId));
      });
      return unsubscribe;
    } catch (error) {
      console.error('Firebase subscribeUserAppointments error:', error);
    }
  }

  let disposed = false;
  const fetch = async () => {
    if (!disposed) callback(await getUserAppointments(userId));
  };
  fetch();
  const interval = setInterval(fetch, 3000);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
};

export const subscribeDoctorAppointments = (
  doctorId: string | undefined,
  callback: (appointments: DoctorAppointment[]) => void
): (() => void) => {
  if (!doctorId) {
    callback([]);
    return () => undefined;
  }

  if (FIREBASE_ENABLED) {
    try {
      const q = query(collection(db, 'appointments'), where('doctorId', '==', doctorId));
      const unsubscribe = onSnapshot(q, (snap) => {
        const appointments = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as DoctorAppointment))
          .filter((apt: any) => apt.type !== 'chatThread');
        callback(appointments);
      }, async () => {
        callback(await getDoctorAppointments(doctorId));
      });
      return unsubscribe;
    } catch (error) {
      console.error('Firebase subscribeDoctorAppointments error:', error);
    }
  }

  let disposed = false;
  const fetch = async () => {
    if (!disposed) callback(await getDoctorAppointments(doctorId));
  };
  fetch();
  const interval = setInterval(fetch, 3000);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
};

const updateCachedUser = async (uid: string, updates: Record<string, any>): Promise<void> => {
  const stored = await AsyncStorage.getItem('@medicare_users');
  if (stored) {
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...updates };
      await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
    }
  }

  const session = await AsyncStorage.getItem('@medicare_session');
  if (session) {
    const current = JSON.parse(session);
    if (current.uid === uid) {
      await AsyncStorage.setItem('@medicare_session', JSON.stringify({ ...current, ...updates }));
    }
  }
};

const incrementConsultationsCount = async (userId: string): Promise<void> => {
  try {
    if (FIREBASE_ENABLED) {
      await updateDoc(doc(db, 'users', userId), { consultationsCount: increment(1) });
    }

    const session = await AsyncStorage.getItem('@medicare_session');
    const current = session ? JSON.parse(session) : null;
    const nextCount = (current?.uid === userId ? current.consultationsCount ?? 0 : 0) + 1;
    await updateCachedUser(userId, { consultationsCount: nextCount });
  } catch (error) {
    console.error('Increment consultations count error:', error);
  }
};

export const createAppointment = async (apt: Omit<Appointment, 'id'>): Promise<boolean> => {
  if (FIREBASE_ENABLED) {
    try {
      const users = await getAllUsers();
      const patient = users.find((u) => u.uid === apt.userId);
      const appointmentRef = doc(collection(db, 'appointments'));
      await setDoc(appointmentRef, {
        ...apt,
        id: appointmentRef.id,
        patientId: apt.userId,
        patientName: patient?.name || 'مريض',
        ...createVideoMeetingFields(appointmentRef.id, apt.type),
        createdAt: new Date().toISOString(),
      });
      await incrementConsultationsCount(apt.userId);
      await createAppointmentNotification({
        doctorId: apt.doctorId,
        patientId: apt.userId,
        patientName: patient?.name || 'مريض',
        doctorName: apt.doctorName,
        date: apt.date,
        time: apt.time,
        appointmentId: appointmentRef.id,
      });
      await recordAuditLog({
        actorId: apt.userId,
        action: 'appointment_created',
        area: 'الحجوزات',
        targetId: appointmentRef.id,
        targetName: apt.doctorName,
        description: `${patient?.name || 'مريض'} أنشأ حجز مع ${apt.doctorName}`,
        details: { doctorId: apt.doctorId, date: apt.date, time: apt.time, type: apt.type },
      });
      return true;
    } catch (error) {
      console.error('Firebase createAppointment error:', error);
      return false;
    }
  }

  const userId = apt.userId;
  const existing = await getUserAppointments(userId);
  const localAppointmentId = `apt_${Date.now()}`;
  const newApt = { ...apt, id: localAppointmentId, ...createVideoMeetingFields(localAppointmentId, apt.type) };
  existing.push(newApt);
  await AsyncStorage.setItem(`@appointments_${userId}`, JSON.stringify(existing));
  await incrementConsultationsCount(userId);
  const users = await getAllUsers();
  const patient = users.find((u) => u.uid === userId);
  await createAppointmentNotification({
    doctorId: apt.doctorId,
    patientId: userId,
    patientName: patient?.name || 'مريض',
    doctorName: apt.doctorName,
    date: apt.date,
    time: apt.time,
    appointmentId: localAppointmentId,
  });
  await recordAuditLog({
    actorId: userId,
    action: 'appointment_created',
    area: 'الحجوزات',
    targetId: localAppointmentId,
    targetName: apt.doctorName,
    description: `${patient?.name || 'مريض'} أنشأ حجز مع ${apt.doctorName}`,
    details: { doctorId: apt.doctorId, date: apt.date, time: apt.time, type: apt.type },
  });
  return true;
};

export const updateAppointmentStatus = async (aptId: string, userId: string, status: Appointment['status']): Promise<boolean> => {
  if (FIREBASE_ENABLED) {
    try {
      await updateDoc(doc(db, 'appointments', aptId), { status });
      await recordAuditLog({
        actorId: userId,
        action: 'appointment_status_updated',
        area: 'الحجوزات',
        targetId: aptId,
        description: `تم تغيير حالة الموعد إلى ${status}`,
        details: { status },
      });
      return true;
    } catch (error) {
      console.error('Firebase updateAppointmentStatus error:', error);
      return false;
    }
  }

  const stored = await AsyncStorage.getItem(`@appointments_${userId}`);
  if (!stored) return false;
  const appointments = JSON.parse(stored);
  const idx = appointments.findIndex((a: Appointment) => a.id === aptId);
  if (idx === -1) return false;
  appointments[idx].status = status;
  await AsyncStorage.setItem(`@appointments_${userId}`, JSON.stringify(appointments));
  await recordAuditLog({
    actorId: userId,
    action: 'appointment_status_updated',
    area: 'الحجوزات',
    targetId: aptId,
    targetName: appointments[idx]?.doctorName,
    description: `تم تغيير حالة الموعد إلى ${status}`,
    details: { status },
  });
  return true;
};

export const cancelAppointment = async (aptId: string, userId: string): Promise<boolean> => {
  return updateAppointmentStatus(aptId, userId, 'ملغي');
};

export const getDoctorStats = async (doctorId: string): Promise<{ totalPatients: number; upcoming: number; completed: number; cancelled: number }> => {
  const appointments = await getDoctorAppointments(doctorId);
  const uniquePatients = new Set(appointments.map((a) => a.patientId)).size;
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  for (const apt of appointments) {
    if (apt.status === 'قادم') upcoming++;
    else if (apt.status === 'مكتمل') completed++;
    else if (apt.status === 'ملغي') cancelled++;
  }
  return { totalPatients: uniquePatients, upcoming, completed, cancelled };
};

export const getUserResults = async (userId: string): Promise<LabResult[]> => {
  if (FIREBASE_ENABLED) {
    const data = await getUserDocData(userId);
    if (Array.isArray(data?.labResults)) {
      return data.labResults.sort((a: LabResult, b: LabResult) => String(b.id).localeCompare(String(a.id)));
    }
  }

  const stored = await AsyncStorage.getItem(`@results_${userId}`);
  if (!stored) return [];

  const results: LabResult[] = JSON.parse(stored);
  const seededNames = ['تحليل دم كامل (CBC)', 'فحص وظائف الكبد', 'تحليل فيتامين د'];
  const onlySeededResults = results.length > 0 && results.every((item) => seededNames.includes(item.name) && !item.fileData);
  if (onlySeededResults) {
    await AsyncStorage.setItem(`@results_${userId}`, JSON.stringify([]));
    return [];
  }

  return results;
};

export const createUserResult = async (result: Omit<LabResult, 'id'>): Promise<LabResult | null> => {
  try {
    const newResult: LabResult = { ...result, id: `result_${Date.now()}` };
    const existing = await getUserResults(result.userId);
    existing.unshift(newResult);
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', result.userId), { labResults: existing }, { merge: true });
    }
    await AsyncStorage.setItem(`@results_${result.userId}`, JSON.stringify(existing));
    if (result.doctorId) {
      await createMedicalRecordNotification({
        userId: result.userId,
        title: `طلب طبي جديد من ${result.doctorName || 'الطبيب'}`,
        desc: `${result.name} تمت إضافته إلى نتائجك وملفاتك الطبية.`,
        icon: result.category === 'xray' ? 'x-ray' : 'vial',
        color: COLORS.accentWarm,
      });
    }
    await recordAuditLog({
      actorId: result.doctorId || result.userId,
      action: result.doctorId ? 'medical_request_created' : 'medical_file_uploaded',
      area: 'الملفات الطبية',
      targetId: newResult.id,
      targetName: newResult.name,
      description: result.doctorId
        ? `${result.doctorName || 'طبيب'} طلب ${result.name} للمريض`
        : `تم رفع ملف طبي: ${result.name}`,
      details: {
        patientId: result.userId,
        doctorId: result.doctorId,
        category: result.category,
        status: result.status,
        fileName: result.fileName,
      },
    });
    return newResult;
  } catch {
    return null;
  }
};

export const updateUserResult = async (
  userId: string,
  resultId: string,
  updates: Partial<LabResult>
): Promise<LabResult | null> => {
  try {
    const results = await getUserResults(userId);
    const idx = results.findIndex((item) => item.id === resultId);
    if (idx === -1) return null;

    const previous = results[idx];
    const nextResult: LabResult = {
      ...previous,
      ...updates,
      id: previous.id,
      userId: previous.userId,
    };
    results[idx] = nextResult;

    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', userId), { labResults: results }, { merge: true });
    }
    await AsyncStorage.setItem(`@results_${userId}`, JSON.stringify(results));

    if (!previous.fileData && nextResult.fileData && previous.doctorId) {
      const users = await getAllUsers();
      const patient = users.find((item) => item.uid === userId);
      await createMedicalRecordNotification({
        userId: previous.doctorId,
        title: `نتيجة جديدة من ${patient?.name || 'المريض'}`,
        desc: `${nextResult.name} تم رفع الملف المطلوب ويمكنك فتحه من ملف المريض.`,
        icon: nextResult.category === 'xray' ? 'x-ray' : 'file-medical',
        color: COLORS.secondary,
        targetScreen: 'DoctorDashboard',
      });
    }
    await recordAuditLog({
      actorId: userId,
      action: nextResult.fileData && !previous.fileData ? 'requested_result_uploaded' : 'medical_file_updated',
      area: 'الملفات الطبية',
      targetId: nextResult.id,
      targetName: nextResult.name,
      description: nextResult.fileData && !previous.fileData
        ? `المريض رفع نتيجة مطلوبة: ${nextResult.name}`
        : `تم تعديل ملف طبي: ${nextResult.name}`,
      details: {
        patientId: userId,
        doctorId: previous.doctorId,
        category: nextResult.category,
        status: nextResult.status,
        fileName: nextResult.fileName,
      },
    });

    return nextResult;
  } catch (error) {
    console.error('updateUserResult error:', error);
    return null;
  }
};

export const getUserPrescriptions = async (userId: string): Promise<Prescription[]> => {
  if (FIREBASE_ENABLED) {
    const data = await getUserDocData(userId);
    if (Array.isArray(data?.prescriptions)) {
      return data.prescriptions.sort((a: Prescription, b: Prescription) => String(b.id).localeCompare(String(a.id)));
    }
  }

  const stored = await AsyncStorage.getItem(`@prescriptions_${userId}`);
  if (!stored) return [];

  const prescriptions: Prescription[] = JSON.parse(stored);
  const seededMeds = ['باندول إكسترا', 'أوجمنتين'];
  const onlySeededPrescriptions = prescriptions.length > 0 && prescriptions.every((item) => seededMeds.includes(item.med));
  if (onlySeededPrescriptions) {
    await AsyncStorage.setItem(`@prescriptions_${userId}`, JSON.stringify([]));
    return [];
  }

  return prescriptions;
};

export const createPrescription = async (prescription: Omit<Prescription, 'id'>): Promise<Prescription | null> => {
  try {
    const newPrescription: Prescription = { ...prescription, id: `presc_${Date.now()}` };
    const userId = prescription.userId;
    const existing = await getUserPrescriptions(userId);
    existing.push(newPrescription);
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', userId), { prescriptions: existing }, { merge: true });
    }
    await AsyncStorage.setItem(`@prescriptions_${userId}`, JSON.stringify(existing));
    await createMedicalRecordNotification({
      userId,
      title: `وصفة جديدة من ${prescription.doctor || 'الطبيب'}`,
      desc: `${prescription.med} تمت إضافته إلى وصفاتك.`,
      icon: 'prescription-bottle-alt',
      color: COLORS.secondary,
    });
    await recordAuditLog({
      action: 'prescription_created',
      area: 'الوصفات الطبية',
      targetId: newPrescription.id,
      targetName: newPrescription.med,
      description: `${prescription.doctor || 'طبيب'} أضاف وصفة ${prescription.med} للمريض`,
      details: {
        patientId: userId,
        dosage: prescription.dosage,
        timesPerDay: prescription.timesPerDay,
        durationDays: prescription.durationDays,
      },
    });
    return newPrescription;
  } catch {
    return null;
  }
};

export const markPrescriptionDoseTaken = async (userId: string, prescriptionId: string): Promise<Prescription | null> => {
  try {
    const prescriptions = await getUserPrescriptions(userId);
    const idx = prescriptions.findIndex((item) => item.id === prescriptionId);
    if (idx === -1) return null;

    const totalDoses = prescriptions[idx].totalDoses ?? 0;
    const takenDoses = prescriptions[idx].takenDoses ?? 0;
    prescriptions[idx] = {
      ...prescriptions[idx],
      takenDoses: totalDoses > 0 ? Math.min(totalDoses, takenDoses + 1) : takenDoses + 1,
      lastTakenAt: new Date().toISOString(),
    };
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', userId), { prescriptions }, { merge: true });
    }
    await AsyncStorage.setItem(`@prescriptions_${userId}`, JSON.stringify(prescriptions));
    await recordAuditLog({
      actorId: userId,
      action: 'prescription_dose_taken',
      area: 'الوصفات الطبية',
      targetId: prescriptionId,
      targetName: prescriptions[idx].med,
      description: `المريض سجل جرعة مأخوذة من ${prescriptions[idx].med}`,
      details: { takenDoses: prescriptions[idx].takenDoses, totalDoses: prescriptions[idx].totalDoses },
    });
    return prescriptions[idx];
  } catch {
    return null;
  }
};

export const addPrescriptionSupply = async (userId: string, prescriptionId: string): Promise<Prescription | null> => {
  try {
    const prescriptions = await getUserPrescriptions(userId);
    const idx = prescriptions.findIndex((item) => item.id === prescriptionId);
    if (idx === -1) return null;

    const prescription = prescriptions[idx];
    const currentTotal = prescription.totalDoses || ((prescription.timesPerDay || 0) * (prescription.durationDays || 0));
    const refillDoses = Math.max(1, (prescription.timesPerDay || 0) * (prescription.durationDays || 0) || currentTotal || 1);
    prescriptions[idx] = {
      ...prescription,
      totalDoses: currentTotal + refillDoses,
      lastRefillAt: new Date().toISOString(),
      refillCount: ((prescription as any).refillCount || 0) + 1,
    } as Prescription;

    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', userId), { prescriptions }, { merge: true });
    }
    await AsyncStorage.setItem(`@prescriptions_${userId}`, JSON.stringify(prescriptions));
    await recordAuditLog({
      actorId: userId,
      action: 'prescription_supply_added',
      area: 'الوصفات الطبية',
      targetId: prescriptionId,
      targetName: prescriptions[idx].med,
      description: `المريض أضاف كمية جديدة من ${prescriptions[idx].med}`,
      details: {
        refillCount: prescriptions[idx].refillCount,
        totalDoses: prescriptions[idx].totalDoses,
      },
    });
    return prescriptions[idx];
  } catch {
    return null;
  }
};

export const getDoctorPrescriptions = async (doctorId: string, doctorName: string): Promise<ExtendedPrescription[]> => {
  const users = await getAllUsers();
  const allPrescriptions: (Prescription & { patientName: string })[] = [];
  for (const user of users) {
    const prescriptions = await getUserPrescriptions(user.uid);
    for (const p of prescriptions) {
      if (p.doctor === doctorName) {
        allPrescriptions.push({ ...p, patientName: user.name });
      }
    }
  }
  return allPrescriptions;
};

export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', userId)));
      const firebaseTransactions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
      if (firebaseTransactions.length > 0) {
        return firebaseTransactions.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      }
    } catch (error) {
      console.error('Firebase getUserTransactions error:', error);
    }
  }

  const stored = await AsyncStorage.getItem(`@transactions_${userId}`);
  const transactions: Transaction[] = stored ? JSON.parse(stored) : [];
  return transactions.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
};

const getReadNotificationIds = async (userId: string): Promise<Set<string>> => {
  const ids = new Set<string>();
  const stored = await AsyncStorage.getItem(`@read_notifications_${userId}`);
  if (stored) {
    try {
      (JSON.parse(stored) as string[]).forEach((id) => ids.add(id));
    } catch {
      // Ignore old malformed local state.
    }
  }
  if (FIREBASE_ENABLED) {
    const data = await getUserDocData(userId);
    if (Array.isArray(data?.readNotificationIds)) {
      data.readNotificationIds.forEach((id: string) => ids.add(id));
    }
  }
  return ids;
};

const getDismissedNotificationIds = async (userId: string): Promise<Set<string>> => {
  const ids = new Set<string>();
  const stored = await AsyncStorage.getItem(`@dismissed_notifications_${userId}`);
  if (stored) {
    try {
      (JSON.parse(stored) as string[]).forEach((id) => ids.add(id));
    } catch {
      // Ignore old malformed local state.
    }
  }
  if (FIREBASE_ENABLED) {
    const data = await getUserDocData(userId);
    if (Array.isArray(data?.dismissedNotificationIds)) {
      data.dismissedNotificationIds.forEach((id: string) => ids.add(id));
    }
  }
  return ids;
};

const persistDismissedNotificationIds = async (userId: string, ids: Set<string>): Promise<void> => {
  const next = Array.from(ids).slice(-500);
  await AsyncStorage.setItem(`@dismissed_notifications_${userId}`, JSON.stringify(next));
  if (FIREBASE_ENABLED) {
    await setDoc(doc(db, 'users', userId), { dismissedNotificationIds: next }, { merge: true });
  }
};

const persistReadNotificationIds = async (userId: string, ids: Set<string>): Promise<void> => {
  const next = Array.from(ids).slice(-300);
  await AsyncStorage.setItem(`@read_notifications_${userId}`, JSON.stringify(next));
  if (FIREBASE_ENABLED) {
    await setDoc(doc(db, 'users', userId), { readNotificationIds: next }, { merge: true });
  }
};

const inferNotificationTarget = (item: any): string | undefined => {
  if (item.targetScreen) return item.targetScreen;
  const text = `${item.title || ''} ${item.desc || ''}`;
  if (text.includes('مكالمة') || text.includes('فيديو')) return 'VideoCall';
  if (item.chatId || text.includes('رسالة')) return 'ChatList';
  if (text.includes('وصفة') || text.includes('دواء')) return 'Prescriptions';
  if (text.includes('تحليل') || text.includes('نتائج') || text.includes('أشعة')) return 'Results';
  if (text.includes('حجز') || text.includes('موعد')) return item.doctorId ? 'DoctorDashboard' : 'المواعيد';
  return undefined;
};

const normalizeNotification = (item: any, readIds: Set<string>): any => {
  const createdAt = item.createdAt?.toDate?.().toISOString?.() || item.createdAt || new Date().toISOString();
  const id = item.id || `${item.userId || 'user'}_${createdAt}_${item.title || 'notification'}`;
  return {
    ...item,
    id,
    createdAt,
    time: item.time || new Date(createdAt).toLocaleString('ar-EG'),
    read: Boolean(item.read || readIds.has(id)),
    targetScreen: inferNotificationTarget(item),
  };
};

const parseAppointmentTimestamp = (appointment: Pick<Appointment, 'date' | 'time'>): number => {
  const candidates = [
    `${appointment.date} ${appointment.time}`,
    appointment.date,
  ];
  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

const getAppointmentReminderNotifications = async (userId: string, readIds: Set<string>): Promise<any[]> => {
  const users = await getAllUsers();
  const currentUser = users.find((item) => item.uid === userId);
  const appointments = currentUser?.role === 'doctor'
    ? await getDoctorAppointments(userId)
    : await getUserAppointments(userId);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  return appointments
    .filter((appointment: any) => appointment.status === 'قادم')
    .map((appointment: any) => {
      const timestamp = parseAppointmentTimestamp(appointment);
      if (!timestamp || timestamp < now || timestamp - now > oneDay) return null;
      const id = `appointment_reminder_${userId}_${appointment.id}`;
      return {
        id,
        userId,
        title: 'موعدك اقترب',
        desc: currentUser?.role === 'doctor'
          ? `موعدك مع ${appointment.patientName || 'مريض'} يوم ${appointment.date} الساعة ${appointment.time}`
          : `موعدك مع ${appointment.doctorName || 'الطبيب'} يوم ${appointment.date} الساعة ${appointment.time}`,
        time: new Date(timestamp).toLocaleString('ar-EG'),
        icon: 'clock',
        color: COLORS.primaryLight,
        read: readIds.has(id),
        createdAt: new Date(timestamp - oneDay).toISOString(),
        appointmentId: appointment.id,
        targetScreen: currentUser?.role === 'doctor' ? 'DoctorDashboard' : 'المواعيد',
      };
    })
    .filter(Boolean);
};

export const getUserNotifications = async (userId: string): Promise<any[]> => {
  const readIds = await getReadNotificationIds(userId);
  const dismissedIds = await getDismissedNotificationIds(userId);
  const mergedNotifications: any[] = [];

  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
      const firebaseNotifications = snap.docs.map((d) => ({ firestoreDocId: d.id, ...d.data() }));
      mergedNotifications.push(...firebaseNotifications);
    } catch (error) {
      console.error('Firebase getUserNotifications error:', error);
    }

    try {
      const userData = await getUserDocData(userId);
      if (Array.isArray(userData?.notifications)) mergedNotifications.push(...userData.notifications);
    } catch (error) {
      console.error('Firebase get mirrored notifications error:', error);
    }

  }

  const stored = await AsyncStorage.getItem(`@notifications_${userId}`);
  if (stored) mergedNotifications.push(...JSON.parse(stored));

  const reminders = await getAppointmentReminderNotifications(userId, readIds);
  mergedNotifications.push(...reminders);

  const unique = new Map<string, any>();
  mergedNotifications
    .map((item) => normalizeNotification(item, readIds))
    .filter((item) => !dismissedIds.has(item.id))
    .forEach((item) => unique.set(item.id, item));

  return Array.from(unique.values()).sort((a, b) => new Date(b.createdAt || b.time).getTime() - new Date(a.createdAt || a.time).getTime());
};

export const dismissUserNotifications = async (userId: string, notificationIds: string[]): Promise<void> => {
  const idsToDismiss = new Set(notificationIds.filter(Boolean));
  if (idsToDismiss.size === 0) return;

  const dismissedIds = await getDismissedNotificationIds(userId);
  idsToDismiss.forEach((id) => dismissedIds.add(id));
  await persistDismissedNotificationIds(userId, dismissedIds);

  const readIds = await getReadNotificationIds(userId);
  idsToDismiss.forEach((id) => readIds.add(id));
  await persistReadNotificationIds(userId, readIds);

  const stored = await AsyncStorage.getItem(`@notifications_${userId}`);
  if (stored) {
    const localNotifications = JSON.parse(stored).filter((item: any) => {
      const id = item.id || `${item.userId || userId}_${item.createdAt || item.time}_${item.title || 'notification'}`;
      return !idsToDismiss.has(id);
    });
    await AsyncStorage.setItem(`@notifications_${userId}`, JSON.stringify(localNotifications));
  }

  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)));
      await Promise.all(snap.docs.map(async (notificationDoc) => {
        const data = notificationDoc.data() as any;
        const id = data.id || notificationDoc.id;
        if (!idsToDismiss.has(id)) return;
        await deleteDoc(notificationDoc.ref);
      }));
    } catch (error) {
      console.error('Firebase dismiss notifications error:', error);
    }

    try {
      const data = await getUserDocData(userId);
      const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
      await setDoc(doc(db, 'users', userId), {
        notifications: notifications.filter((item: any) => !idsToDismiss.has(item.id)),
      }, { merge: true });
    } catch (error) {
      console.error('Firebase mirror dismiss notifications error:', error);
    }
  }
};

export const markUserNotificationsRead = async (userId: string, notificationIds?: string[]): Promise<void> => {
  const notifications = await getUserNotifications(userId);
  const idsToRead = notificationIds?.length ? new Set(notificationIds) : new Set(notifications.map((item) => item.id));
  if (idsToRead.size === 0) return;

  const readIds = await getReadNotificationIds(userId);
  idsToRead.forEach((id) => readIds.add(id));
  await persistReadNotificationIds(userId, readIds);

  const stored = await AsyncStorage.getItem(`@notifications_${userId}`);
  if (stored) {
    const localNotifications = JSON.parse(stored).map((item: any) => {
      const id = item.id || `${item.userId || userId}_${item.createdAt || item.time}_${item.title || 'notification'}`;
      return idsToRead.has(id) ? { ...item, id, read: true } : item;
    });
    await AsyncStorage.setItem(`@notifications_${userId}`, JSON.stringify(localNotifications));
  }

  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)));
      await Promise.all(snap.docs.map(async (notificationDoc) => {
        const data = notificationDoc.data() as any;
        const id = data.id || notificationDoc.id;
        if (!idsToRead.has(id)) return;
        await updateDoc(notificationDoc.ref, { read: true });
      }));
    } catch (error) {
      console.error('Firebase mark notifications read error:', error);
    }

    try {
      const data = await getUserDocData(userId);
      const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
      await setDoc(doc(db, 'users', userId), {
        notifications: notifications.map((item: any) => idsToRead.has(item.id) ? { ...item, read: true } : item),
      }, { merge: true });
    } catch (error) {
      console.error('Firebase mirror mark notifications read error:', error);
    }
  }
};

const getRecipientIdFromChat = (chatId: string, senderId: string, explicitRecipientId?: string): string | undefined => {
  if (explicitRecipientId && explicitRecipientId !== senderId) return explicitRecipientId;
  const participants = chatId.split('_').filter(Boolean);
  return participants.find((id) => id !== senderId);
};

const getSharedChatDocId = (chatId: string): string => `chat_${encodeURIComponent(chatId)}`;

const getSharedChatRef = (chatId: string) => doc(db, 'appointments', getSharedChatDocId(chatId));

const getUserDocData = async (userId: string): Promise<any | null> => {
  if (!FIREBASE_ENABLED || !userId) return null;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('Firebase getUserDocData error:', error);
    return null;
  }
};

const getUserDocChatMessages = async (userId: string | undefined, chatId: string): Promise<ChatMessage[]> => {
  if (!userId) return [];
  const data = await getUserDocData(userId);
  const messages = data?.chatThreads?.[chatId]?.messages;
  return Array.isArray(messages) ? messages.map((item: any) => normalizeChatMessage(item.id, chatId, item)) : [];
};

const uniqueSortedMessages = (messages: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<string, ChatMessage>();
  messages.forEach((message) => {
    const id = message.id || `${message.senderId}_${message.createdAt}_${message.text}`;
    byId.set(id, { ...message, id });
  });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const countUnreadMessages = (messages: ChatMessage[], userId: string, lastReadAt?: string): number => {
  const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter((message) => {
    if (message.senderId === userId) return false;
    if (message.recipientId && message.recipientId !== userId) return false;
    return new Date(message.createdAt).getTime() > lastReadTime;
  }).length;
};

const getSharedChatThreadMessages = async (chatId: string): Promise<ChatMessage[]> => {
  if (!FIREBASE_ENABLED) return [];
  try {
    const snap = await getDoc(getSharedChatRef(chatId));
    const data = snap.exists() ? snap.data() : null;
    const messages = data?.messages;
    return Array.isArray(messages) ? messages.map((item: any) => normalizeChatMessage(item.id, chatId, item)) : [];
  } catch (error) {
    console.error('Firebase getSharedChatThreadMessages error:', error);
    return [];
  }
};

const getChatParticipantIds = async (chatId: string, fallbackUserId?: string): Promise<string[]> => {
  const ids = new Set<string>();
  if (fallbackUserId) ids.add(fallbackUserId);

  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDoc(getSharedChatRef(chatId));
      const data = snap.exists() ? snap.data() : null;
      if (Array.isArray(data?.participantIds)) {
        data.participantIds.forEach((id: string) => id && ids.add(id));
      }
      if (Array.isArray(data?.messages)) {
        data.messages.forEach((message: any) => {
          if (message.senderId) ids.add(message.senderId);
          if (message.recipientId) ids.add(message.recipientId);
        });
      }
    } catch {
      // Participant fallback below is enough for local cleanup.
    }
  }

  const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
  const localMessages: ChatMessage[] = stored ? JSON.parse(stored) : [];
  localMessages.forEach((message) => {
    if (message.senderId) ids.add(message.senderId);
    if (message.recipientId) ids.add(message.recipientId);
  });

  chatId.split('_').forEach((id) => {
    if (id) ids.add(id);
  });

  return Array.from(ids);
};

const saveSharedChatThread = async (
  participantIds: string[],
  chatId: string,
  messages: ChatMessage[]
): Promise<boolean> => {
  if (!FIREBASE_ENABLED || participantIds.length < 2) return false;
  try {
    const sortedMessages = uniqueSortedMessages(messages);
    const last = sortedMessages[sortedMessages.length - 1];
    await setDoc(getSharedChatRef(chatId), {
      type: 'chatThread',
      chatId,
      participantIds: Array.from(new Set(participantIds.filter(Boolean))),
      messages: sortedMessages,
      lastMessage: last?.text || (last?.attachmentName ? `مرفق: ${last.attachmentName}` : 'رسالة جديدة'),
      lastMessageAt: last?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Firebase saveSharedChatThread error:', error);
    return false;
  }
};

const getSharedChatThreadsForUser = async (userId: string): Promise<any[]> => {
  if (!FIREBASE_ENABLED || !userId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'appointments'), where('participantIds', 'array-contains', userId)));
    return snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item: any) => item.type === 'chatThread' && Array.isArray(item.messages));
  } catch (error) {
    console.error('Firebase getSharedChatThreadsForUser error:', error);
    return [];
  }
};

export const markChatThreadRead = async (userId: string, chatId: string): Promise<void> => {
  if (!userId || !chatId) return;
  const readAt = new Date().toISOString();

  if (FIREBASE_ENABLED) {
    try {
      await setDoc(getSharedChatRef(chatId), {
        readBy: { [userId]: readAt },
      }, { merge: true });
    } catch (error) {
      console.error('Firebase markChatThreadRead error:', error);
    }
  }

  try {
    await AsyncStorage.setItem(`@chat_read_${userId}_${chatId}`, readAt);
  } catch {
    // Local read markers are best-effort only.
  }
};

export const subscribeUnreadChatCount = (
  userId: string | undefined,
  callback: (count: number) => void
): (() => void) => {
  if (!userId) {
    callback(0);
    return () => undefined;
  }

  let disposed = false;
  const computeLocalUnread = async () => {
    if (FIREBASE_ENABLED) {
      const threads = await getSharedChatThreadsForUser(userId);
      const count = threads.reduce((total, thread: any) => {
        const messages = Array.isArray(thread.messages)
          ? thread.messages.map((item: any) => normalizeChatMessage(item.id, thread.chatId, item))
          : [];
        return total + countUnreadMessages(messages, userId, thread.readBy?.[userId]);
      }, 0);
      if (!disposed) callback(count);
      return;
    }
    if (!disposed) callback(0);
  };

  if (FIREBASE_ENABLED) {
    try {
      const q = query(collection(db, 'appointments'), where('participantIds', 'array-contains', userId));
      const unsubscribe = onSnapshot(q, (snap) => {
        const count = snap.docs.reduce((total, threadDoc) => {
          const thread = threadDoc.data() as any;
          if (thread.type !== 'chatThread' || !Array.isArray(thread.messages)) return total;
          const messages = thread.messages.map((item: any) => normalizeChatMessage(item.id, thread.chatId, item));
          return total + countUnreadMessages(messages, userId, thread.readBy?.[userId]);
        }, 0);
        if (!disposed) callback(count);
      }, () => {
        computeLocalUnread();
      });
      return () => {
        disposed = true;
        unsubscribe();
      };
    } catch (error) {
      console.error('Firebase subscribeUnreadChatCount error:', error);
    }
  }

  computeLocalUnread();
  const interval = setInterval(computeLocalUnread, 5000);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
};

export const subscribeNotificationSummary = (
  userId: string | undefined,
  callback: (summary: NotificationSummary) => void
): (() => void) => {
  if (!userId) {
    callback({ totalUnread: 0, unreadNotifications: 0, unreadChats: 0 });
    return () => undefined;
  }

  let disposed = false;
  let unreadNotifications = 0;
  let unreadChats = 0;

  const emit = () => {
    if (!disposed) {
      callback({
        unreadNotifications,
        unreadChats,
        totalUnread: unreadNotifications + unreadChats,
      });
    }
  };

  const refreshNotifications = async () => {
    const notifications = await getUserNotifications(userId);
    unreadNotifications = notifications.filter((item) => !item.read).length;
    emit();
  };

  const unsubscribeChats = subscribeUnreadChatCount(userId, (count) => {
    unreadChats = count;
    emit();
  });

  refreshNotifications();
  const interval = setInterval(refreshNotifications, 4000);

  return () => {
    disposed = true;
    clearInterval(interval);
    unsubscribeChats();
  };
};

const mirrorChatToUserDocs = async (
  participantIds: string[],
  chatId: string,
  messages: ChatMessage[]
): Promise<boolean> => {
  if (!FIREBASE_ENABLED || participantIds.length === 0) return false;

  const sortedMessages = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const last = sortedMessages[sortedMessages.length - 1];
  let saved = false;

  for (const participantId of Array.from(new Set(participantIds.filter(Boolean)))) {
    try {
      const data = await getUserDocData(participantId);
      await setDoc(doc(db, 'users', participantId), {
        chatThreads: {
          ...(data?.chatThreads || {}),
          [chatId]: {
            chatId,
            participantIds: Array.from(new Set(participantIds.filter(Boolean))),
            messages: sortedMessages,
            lastMessage: last?.text || (last?.attachmentName ? `مرفق: ${last.attachmentName}` : 'رسالة جديدة'),
            lastMessageAt: last?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      }, { merge: true });
      saved = true;
    } catch (error) {
      console.error('Firebase mirrorChatToUserDocs error:', error);
    }
  }

  return saved;
};

const addLocalNotification = async (userId: string, notification: any): Promise<void> => {
  const stored = await AsyncStorage.getItem(`@notifications_${userId}`);
  const notifications = stored ? JSON.parse(stored) : [];
  notifications.unshift(notification);
  await AsyncStorage.setItem(`@notifications_${userId}`, JSON.stringify(notifications));
};

const persistNotification = async (notification: any, mirrorLimit = 80): Promise<void> => {
  if (FIREBASE_ENABLED) {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Firebase notification error:', error);
    }

    try {
      const data = await getUserDocData(notification.userId);
      const existing = Array.isArray(data?.notifications) ? data.notifications : [];
      await setDoc(doc(db, 'users', notification.userId), {
        notifications: [notification, ...existing].slice(0, mirrorLimit),
      }, { merge: true });
    } catch (error) {
      console.error('Firebase notification mirror error:', error);
    }
  }

  await addLocalNotification(notification.userId, notification);
};

export const createVideoCallInviteNotification = async (input: {
  callerId: string;
  callerName: string;
  recipientId: string;
  appointmentId: string;
  meetingUrl?: string;
  meetingRoom?: string;
  participantName?: string;
}): Promise<void> => {
  const notification = {
    id: `video_call_${input.appointmentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.recipientId,
    title: 'دعوة مكالمة فيديو',
    desc: `${input.callerName || 'مستخدم'} بدأ مكالمة فيديو مرتبطة بالحجز. يمكنك قبول الدعوة أو رفضها.`,
    time: new Date().toLocaleString('ar-EG'),
    icon: 'video',
    color: COLORS.primaryLight,
    read: false,
    createdAt: new Date().toISOString(),
    action: 'video_call_invite',
    callerId: input.callerId,
    callerName: input.callerName,
    appointmentId: input.appointmentId,
    meetingUrl: input.meetingUrl,
    meetingRoom: input.meetingRoom || `medicare-${input.appointmentId}`,
    participantName: input.participantName || input.callerName,
    targetScreen: 'VideoCall',
  };

  await persistNotification(notification, 80);
  await recordAuditLog({
    actorId: input.callerId,
    action: 'video_call_invite_sent',
    area: 'مكالمات الفيديو',
    targetId: input.appointmentId,
    targetName: input.participantName || input.recipientId,
    description: `${input.callerName || 'مستخدم'} أرسل دعوة مكالمة فيديو`,
    details: { recipientId: input.recipientId, meetingRoom: notification.meetingRoom },
  });
};

export const createVideoCallResponseNotification = async (input: {
  callerId: string;
  responderId: string;
  responderName: string;
  appointmentId: string;
  accepted: boolean;
}): Promise<void> => {
  if (!input.callerId || !input.responderId || input.callerId === input.responderId) return;
  const notification = {
    id: `video_call_response_${input.appointmentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.callerId,
    title: input.accepted ? 'تم قبول مكالمة الفيديو' : 'تم رفض مكالمة الفيديو',
    desc: input.accepted
      ? `${input.responderName || 'المستخدم'} قبل دعوة مكالمة الفيديو.`
      : `${input.responderName || 'المستخدم'} رفض دعوة مكالمة الفيديو.`,
    time: new Date().toLocaleString('ar-EG'),
    icon: input.accepted ? 'video' : 'phone-slash',
    color: input.accepted ? COLORS.secondary : COLORS.danger,
    read: false,
    createdAt: new Date().toISOString(),
    action: input.accepted ? 'video_call_accepted' : 'video_call_rejected',
    callerId: input.callerId,
    initiatorId: input.callerId,
    appointmentId: input.appointmentId,
    meetingRoom: `medicare-${input.appointmentId}`,
    targetScreen: input.accepted ? 'VideoCall' : undefined,
  };

  await persistNotification(notification, 80);
};

const createAppointmentNotification = async (input: {
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  appointmentId: string;
}): Promise<void> => {
  const doctorNotification = {
    id: `apt_notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.doctorId,
    title: `حجز جديد من ${input.patientName || 'مريض'}`,
    desc: `موعد مع ${input.patientName || 'مريض'} يوم ${input.date} الساعة ${input.time}`,
    time: new Date().toLocaleString('ar-EG'),
    icon: 'calendar-check',
    color: COLORS.accentWarm,
    read: false,
    createdAt: new Date().toISOString(),
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    targetScreen: 'DoctorDashboard',
  };
  const patientNotification = {
    id: `apt_patient_notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.patientId,
    title: 'تم تأكيد الحجز',
    desc: `تم حجز موعدك مع ${input.doctorName || 'الطبيب'} يوم ${input.date} الساعة ${input.time}`,
    time: new Date().toLocaleString('ar-EG'),
    icon: 'calendar-check',
    color: COLORS.secondary,
    read: false,
    createdAt: new Date().toISOString(),
    appointmentId: input.appointmentId,
    doctorId: input.doctorId,
    targetScreen: 'المواعيد',
  };
  const notifications = [doctorNotification, patientNotification];

  if (FIREBASE_ENABLED) {
    await Promise.all(notifications.map(async (notification) => {
      try {
        await addDoc(collection(db, 'notifications'), {
          ...notification,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Firebase appointment notification error:', error);
      }
    }));

    await Promise.all(notifications.map(async (notification) => {
      try {
        const data = await getUserDocData(notification.userId);
        const existing = Array.isArray(data?.notifications) ? data.notifications : [];
        await setDoc(doc(db, 'users', notification.userId), {
          notifications: [notification, ...existing].slice(0, 80),
        }, { merge: true });
      } catch (error) {
        console.error('Firebase appointment notification mirror error:', error);
      }
    }));
  }

  await Promise.all(notifications.map((notification) => addLocalNotification(notification.userId, notification)));
};

const createChatNotification = async (message: ChatMessageInput): Promise<void> => {
  const recipientId = getRecipientIdFromChat(message.chatId, message.senderId, message.recipientId);
  if (!recipientId) return;

  const notification = {
    userId: recipientId,
    title: `رسالة جديدة من ${message.senderName || 'مستخدم'}`,
    desc: message.text || (message.attachmentName ? `تم إرسال مرفق: ${message.attachmentName}` : 'تم إرسال رسالة جديدة'),
    time: new Date().toLocaleString('ar-EG'),
    icon: message.attachmentName ? 'paperclip' : 'comments',
    color: COLORS.primaryLight,
    read: false,
    createdAt: message.createdAt,
    chatId: message.chatId,
    senderId: message.senderId,
    targetScreen: 'ChatList',
  };

  if (FIREBASE_ENABLED) {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Firebase chat notification error:', error);
    }

    try {
      const data = await getUserDocData(recipientId);
      const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
      await setDoc(doc(db, 'users', recipientId), {
        notifications: [
          { ...notification, id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
          ...notifications,
        ].slice(0, 60),
      }, { merge: true });
    } catch (error) {
      console.error('Firebase user notification mirror error:', error);
    }
  }

  await addLocalNotification(recipientId, {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });
};

const createMedicalRecordNotification = async (input: {
  userId: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  targetScreen?: string;
}): Promise<void> => {
  const notification = {
    id: `medical_notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    title: input.title,
    desc: input.desc,
    time: new Date().toLocaleString('ar-EG'),
    icon: input.icon,
    color: input.color,
    read: false,
    createdAt: new Date().toISOString(),
    targetScreen: input.targetScreen || (input.icon === 'prescription-bottle-alt' ? 'Prescriptions' : 'Results'),
  };

  if (FIREBASE_ENABLED) {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Firebase medical notification error:', error);
    }

    try {
      const data = await getUserDocData(input.userId);
      const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
      await setDoc(doc(db, 'users', input.userId), {
        notifications: [notification, ...notifications].slice(0, 80),
      }, { merge: true });
    } catch (error) {
      console.error('Firebase medical notification mirror error:', error);
    }
  }

  await addLocalNotification(input.userId, notification);
};

const normalizeChatMessage = (id: string, chatId: string, data: any): ChatMessage => ({
  id,
  chatId,
  senderId: data.senderId,
  senderName: data.senderName,
  text: data.text || '',
  createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || new Date().toISOString(),
  recipientId: data.recipientId,
  attachmentName: data.attachmentName,
  attachmentData: data.attachmentData,
  attachmentType: data.attachmentType,
});

export const sendMessage = async (message: ChatMessageInput): Promise<boolean> => {
  const chatId = message.chatId;
  const recipientId = getRecipientIdFromChat(chatId, message.senderId, message.recipientId);
  if (!recipientId) return false;
  const localMessage = {
    ...message,
    recipientId,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const participantIds = [message.senderId, recipientId];
  let savedToSharedStore = false;

  try {
    if (FIREBASE_ENABLED) {
      const { id, ...payload } = localMessage;
      await setDoc(doc(db, 'chats', chatId), {
        chatId,
        participantIds,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      localMessage.id = docRef.id;
      savedToSharedStore = true;
    }
  } catch (error) {
    console.error('sendMessage primary chat error:', error);
  }

  try {
    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    const localMsgs = stored ? JSON.parse(stored) : [];
    const sharedMsgs = await getSharedChatThreadMessages(chatId);
    const msgs = uniqueSortedMessages([...sharedMsgs, ...localMsgs, localMessage]);
    if (!msgs.some((item: ChatMessage) => item.id === localMessage.id)) {
      msgs.push(localMessage);
    }
    await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(uniqueSortedMessages(msgs)));
    const sharedThreadSaved = await saveSharedChatThread(participantIds, chatId, msgs);
    const mirrored = await mirrorChatToUserDocs(participantIds, chatId, msgs);
    savedToSharedStore = savedToSharedStore || sharedThreadSaved || mirrored || !FIREBASE_ENABLED;
    await createChatNotification(localMessage);
    await recordAuditLog({
      actorId: message.senderId,
      action: message.attachmentName ? 'chat_attachment_sent' : 'chat_message_sent',
      area: 'المحادثات',
      targetId: chatId,
      targetName: message.senderName,
      description: `${message.senderName || 'مستخدم'} أرسل ${message.attachmentName ? 'مرفق' : 'رسالة'} في المحادثة`,
      details: {
        chatId,
        recipientId,
        attachmentName: message.attachmentName,
        textPreview: message.text,
      },
    });
    return savedToSharedStore;
  } catch (error) {
    console.error('sendMessage error:', error);
    try {
      const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
      const msgs = stored ? JSON.parse(stored) : [];
      msgs.push(localMessage);
      const sortedMsgs = uniqueSortedMessages(msgs);
      await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(sortedMsgs));
      const sharedThreadSaved = await saveSharedChatThread(participantIds, chatId, sortedMsgs);
      const mirrored = await mirrorChatToUserDocs(participantIds, chatId, sortedMsgs);
      await createChatNotification(localMessage);
      await recordAuditLog({
        actorId: message.senderId,
        action: message.attachmentName ? 'chat_attachment_sent' : 'chat_message_sent',
        area: 'المحادثات',
        targetId: chatId,
        targetName: message.senderName,
        description: `${message.senderName || 'مستخدم'} أرسل ${message.attachmentName ? 'مرفق' : 'رسالة'} في المحادثة`,
        details: {
          chatId,
          recipientId,
          attachmentName: message.attachmentName,
          textPreview: message.text,
        },
      });
      return sharedThreadSaved || mirrored || !FIREBASE_ENABLED;
    } catch {
      return false;
    }
  }
};

export const deleteChatMessage = async (
  chatId: string,
  messageId: string,
  requesterId: string
): Promise<boolean> => {
  if (!chatId || !messageId || !requesterId) return false;

  try {
    const participantIds = await getChatParticipantIds(chatId, requesterId);
    const [sharedMessages, stored] = await Promise.all([
      getSharedChatThreadMessages(chatId),
      AsyncStorage.getItem(`@chat_${chatId}`),
    ]);
    const localMessages: ChatMessage[] = stored ? JSON.parse(stored) : [];
    const allMessages = uniqueSortedMessages([...sharedMessages, ...localMessages]);
    const target = allMessages.find((message) => message.id === messageId);

    if (!target || target.senderId !== requesterId) return false;

    const nextMessages = allMessages.filter((message) => message.id !== messageId);
    await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(nextMessages));

    if (FIREBASE_ENABLED) {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId)).catch(() => undefined);
    }

    if (nextMessages.length > 0) {
      await saveSharedChatThread(participantIds, chatId, nextMessages);
      await mirrorChatToUserDocs(participantIds, chatId, nextMessages);
    } else {
      await deleteChatThread(chatId, requesterId);
    }

    await recordAuditLog({
      actorId: requesterId,
      action: 'chat_message_deleted',
      area: 'المحادثات',
      targetId: messageId,
      targetName: chatId,
      description: 'تم حذف رسالة من المحادثة',
      details: { chatId, messageId },
    });
    return true;
  } catch (error) {
    console.error('deleteChatMessage error:', error);
    return false;
  }
};

export const deleteChatThread = async (chatId: string, requesterId: string): Promise<boolean> => {
  if (!chatId || !requesterId) return false;

  try {
    const participantIds = await getChatParticipantIds(chatId, requesterId);
    await AsyncStorage.removeItem(`@chat_${chatId}`);

    if (FIREBASE_ENABLED) {
      try {
        const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
        await Promise.all(messagesSnap.docs.map((messageDoc) => deleteDoc(messageDoc.ref).catch(() => undefined)));
      } catch (error) {
        console.error('Firebase delete chat messages error:', error);
      }

      await deleteDoc(doc(db, 'chats', chatId)).catch(() => undefined);
      await deleteDoc(getSharedChatRef(chatId)).catch(() => undefined);

      await Promise.all(participantIds.map(async (participantId) => {
        try {
          await updateDoc(doc(db, 'users', participantId), {
            [`chatThreads.${chatId}`]: deleteField(),
          });
        } catch {
          await mirrorChatToUserDocs([participantId], chatId, []);
        }
      }));
    }

    await recordAuditLog({
      actorId: requesterId,
      action: 'chat_thread_deleted',
      area: 'المحادثات',
      targetId: chatId,
      description: 'تم حذف محادثة كاملة',
      details: { chatId, participantIds },
    });
    return true;
  } catch (error) {
    console.error('deleteChatThread error:', error);
    return false;
  }
};

export const getUserChatSummaries = async (userId: string): Promise<ChatSummary[]> => {
  const doctors = await getAllDoctors();
  const summaries: ChatSummary[] = [];
  const mirroredThreads = (await getUserDocData(userId))?.chatThreads || {};
  const sharedThreads = await getSharedChatThreadsForUser(userId);
  const sharedThreadByChatId = new Map<string, any>();
  sharedThreads.forEach((thread: any) => {
    if (thread.chatId) sharedThreadByChatId.set(thread.chatId, thread);
  });

  for (const doctor of doctors) {
    const chatId = `${userId}_${doctor.id}`;
    let messages: ChatMessage[] = [];
    if (FIREBASE_ENABLED) {
      try {
        const snap = await getDocs(query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')));
        messages = snap.docs.map((d) => normalizeChatMessage(d.id, chatId, d.data()));
      } catch (error) {
        console.error('Firebase getUserChatSummaries error:', error);
      }
    }
    if (messages.length === 0) {
      const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
      messages = stored ? JSON.parse(stored) : [];
    }
    if (messages.length === 0 && Array.isArray(mirroredThreads?.[chatId]?.messages)) {
      messages = mirroredThreads[chatId].messages.map((item: any) => normalizeChatMessage(item.id, chatId, item));
    }
    if (messages.length === 0 && Array.isArray(sharedThreadByChatId.get(chatId)?.messages)) {
      messages = sharedThreadByChatId.get(chatId).messages.map((item: any) => normalizeChatMessage(item.id, chatId, item));
    }
    if (messages.length === 0) continue;

    const last = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const thread = sharedThreadByChatId.get(chatId) || mirroredThreads?.[chatId];
    summaries.push({
      chatId,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorEmoji: doctor.emoji,
      specialty: doctor.specialty,
      lastMessage: last.text || (last.attachmentName ? `مرفق: ${last.attachmentName}` : 'رسالة جديدة'),
      lastMessageAt: last.createdAt,
      messagesCount: messages.length,
      unreadCount: countUnreadMessages(messages, userId, thread?.readBy?.[userId]),
    });
  }

  sharedThreads.forEach((thread: any) => {
    if (!thread.chatId || summaries.some((summary) => summary.chatId === thread.chatId)) return;
    const doctorId = thread.participantIds?.find?.((id: string) => id && id !== userId);
    if (!doctorId) return;
    const doctor = doctors.find((item) => item.id === doctorId);
    const messages = Array.isArray(thread.messages) ? thread.messages.map((item: any) => normalizeChatMessage(item.id, thread.chatId, item)) : [];
    if (messages.length === 0) return;
    const last = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    summaries.push({
      chatId: thread.chatId,
      doctorId,
      doctorName: doctor?.name || 'طبيب',
      doctorEmoji: doctor?.emoji,
      specialty: doctor?.specialty,
      lastMessage: last.text || (last.attachmentName ? `مرفق: ${last.attachmentName}` : 'رسالة جديدة'),
      lastMessageAt: last.createdAt,
      messagesCount: messages.length,
      unreadCount: countUnreadMessages(messages, userId, thread.readBy?.[userId]),
    });
  });

  return summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
};

const getChatMessages = async (chatId: string, viewerId?: string): Promise<ChatMessage[]> => {
  let messages: ChatMessage[] = [];
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc')));
      messages = snap.docs.map((d) => normalizeChatMessage(d.id, chatId, d.data()));
    } catch (error) {
      console.error('Firebase getChatMessages error:', error);
    }
  }
  if (messages.length === 0) {
    messages = await getSharedChatThreadMessages(chatId);
  }
  if (messages.length === 0) {
    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    messages = stored ? JSON.parse(stored) : [];
  }
  if (messages.length === 0) {
    messages = await getUserDocChatMessages(viewerId, chatId);
  }
  return messages;
};

export const getDoctorChatSummaries = async (doctorId: string): Promise<ChatSummary[]> => {
  const chatIds = new Set<string>();
  const patientNames = new Map<string, string>();
  const participantIdsByChatId = new Map<string, string[]>();
  const doctorDocData = await getUserDocData(doctorId);

  if (doctorDocData?.chatThreads) {
    Object.entries(doctorDocData.chatThreads).forEach(([chatId, thread]: [string, any]) => {
      chatIds.add(chatId);
      if (Array.isArray(thread?.participantIds)) participantIdsByChatId.set(chatId, thread.participantIds);
      const messages = Array.isArray(thread?.messages) ? thread.messages : [];
      const patientMessage = messages.find((item: any) => item.senderId && item.senderId !== doctorId && item.senderName);
      const patientId = thread?.participantIds?.find?.((id: string) => id && id !== doctorId) || patientMessage?.senderId;
      if (patientId && patientMessage?.senderName) patientNames.set(patientId, patientMessage.senderName);
    });
  }

  const sharedThreads = await getSharedChatThreadsForUser(doctorId);
  sharedThreads.forEach((thread: any) => {
    if (!thread.chatId) return;
    chatIds.add(thread.chatId);
    if (Array.isArray(thread.participantIds)) participantIdsByChatId.set(thread.chatId, thread.participantIds);
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const patientMessage = messages.find((item: any) => item.senderId && item.senderId !== doctorId && item.senderName);
    const patientId = thread.participantIds?.find?.((id: string) => id && id !== doctorId) || patientMessage?.senderId;
    if (patientId && patientMessage?.senderName) patientNames.set(patientId, patientMessage.senderName);
  });

  try {
    const [appointments, users] = await Promise.all([getDoctorAppointments(doctorId), getAllUsers()]);
    for (const apt of appointments) {
      if (!apt.patientId) continue;
      const chatId = `${apt.patientId}_${doctorId}`;
      chatIds.add(chatId);
      const patient = users.find((item) => item.uid === apt.patientId);
      patientNames.set(apt.patientId, apt.patientName || patient?.name || 'مريض');
    }
  } catch (error) {
    console.error('Doctor chat appointment fallback error:', error);
  }

  if (FIREBASE_ENABLED) {
    try {
      const inbound = await getDocs(query(collectionGroup(db, 'messages'), where('recipientId', '==', doctorId)));
      inbound.docs.forEach((messageDoc) => {
        const data = messageDoc.data() as any;
        if (!data.chatId) return;
        chatIds.add(data.chatId);
        if (data.senderId && data.senderName) patientNames.set(data.senderId, data.senderName);
      });
    } catch (error) {
      console.error('Firebase getDoctorChatSummaries inbound error:', error);
    }
  }

  const summaries: ChatSummary[] = [];
  for (const chatId of chatIds) {
    const messages = await getChatMessages(chatId, doctorId);
    if (messages.length === 0) continue;
    const sharedThread = sharedThreads.find((thread: any) => thread.chatId === chatId) || doctorDocData?.chatThreads?.[chatId];
    const last = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const patientId = participantIdsByChatId.get(chatId)?.find((id) => id && id !== doctorId) || (last.senderId !== doctorId ? last.senderId : last.recipientId) || chatId.split('_').find((id) => id && id !== doctorId) || last.senderId;
    const patientName = patientNames.get(patientId) || (last.senderId === patientId ? last.senderName : 'مريض');
    summaries.push({
      chatId,
      doctorId,
      doctorName: patientName,
      patientId,
      patientName,
      lastMessage: last.text || (last.attachmentName ? `مرفق: ${last.attachmentName}` : 'رسالة جديدة'),
      lastMessageAt: last.createdAt,
      messagesCount: messages.length,
      unreadCount: countUnreadMessages(messages, doctorId, sharedThread?.readBy?.[doctorId]),
    });
  }

  return summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
};

export const listenToMessages = (
  chatId: string,
  callback: (messages: any[]) => void,
  viewerId?: string
): (() => void) => {
  let disposed = false;

  const fetchMessages = async () => {
    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    let msgs = stored ? JSON.parse(stored) : [];
    const mirrored = await getUserDocChatMessages(viewerId, chatId);
    if (mirrored.length > msgs.length) {
      msgs = mirrored;
      await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(msgs));
    }
    if (!disposed) callback(msgs);
  };

  if (FIREBASE_ENABLED) {
    try {
      const unsubscribe = onSnapshot(
        getSharedChatRef(chatId),
        async (snap) => {
          const data = snap.exists() ? snap.data() : null;
          const rawMessages = data?.messages;
          if (Array.isArray(rawMessages)) {
            const msgs = uniqueSortedMessages(rawMessages.map((item: any) => normalizeChatMessage(item.id, chatId, item)));
            await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(msgs));
            if (!disposed) callback(msgs);
            return;
          }
          fetchMessages();
        },
        () => {
          fetchMessages();
        }
      );
      return () => {
        disposed = true;
        unsubscribe();
      };
    } catch (error) {
      console.error('Firebase listenToMessages error:', error);
    }
  }

  fetchMessages();
  const interval = setInterval(fetchMessages, 2000);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
};

export const toggleUserActive = async (uid: string, isActive: boolean): Promise<boolean> => {
  try {
    const usersBefore = await getAllUsers();
    const target = usersBefore.find((item) => item.uid === uid);
    if (FIREBASE_ENABLED) {
      await updateDoc(doc(db, 'users', uid), { isActive });
      await recordAuditLog({
        action: isActive ? 'user_activated' : 'user_deactivated',
        area: 'إدارة المستخدمين',
        targetId: uid,
        targetName: target?.name,
        description: `تم ${isActive ? 'تفعيل' : 'تعطيل'} حساب ${target?.name || uid}`,
        details: { isActive },
      });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx === -1) return false;
    users[idx].isActive = isActive;
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
    await recordAuditLog({
      action: isActive ? 'user_activated' : 'user_deactivated',
      area: 'إدارة المستخدمين',
      targetId: uid,
      targetName: users[idx].name,
      description: `تم ${isActive ? 'تفعيل' : 'تعطيل'} حساب ${users[idx].name}`,
      details: { isActive },
    });
    return true;
  } catch {
    return false;
  }
};

export const setUserAdminPermission = async (
  uid: string,
  makeAdmin: boolean,
  actorRole?: string
): Promise<boolean> => {
  if (actorRole !== 'owner') return false;

  try {
    if (FIREBASE_ENABLED) {
      const users = await getAllUsers();
      const target = users.find((u) => u.uid === uid);
      if (!target || target.role === 'owner') return false;
      await updateDoc(doc(db, 'users', uid), {
        role: target.role === 'doctor' ? 'doctor' : makeAdmin ? 'admin' : 'user',
        adminPermissions: makeAdmin ? ['approveDoctors'] : [],
        isApproved: true,
        isActive: true,
      });
      await recordAuditLog({
        action: makeAdmin ? 'admin_role_granted' : 'admin_role_revoked',
        area: 'إدارة المستخدمين',
        targetId: uid,
        targetName: target.name,
        description: makeAdmin ? `تم منح ${target.name} صلاحية أدمن` : `تم إلغاء صلاحية الأدمن من ${target.name}`,
        details: { targetRole: target.role },
      });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx === -1) return false;
    if (users[idx].role === 'owner') return false;

    users[idx].role = users[idx].role === 'doctor' ? 'doctor' : makeAdmin ? 'admin' : 'user';
    users[idx].adminPermissions = makeAdmin ? ['approveDoctors'] : [];
    users[idx].isApproved = true;
    users[idx].isActive = true;
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
    await recordAuditLog({
      action: makeAdmin ? 'admin_role_granted' : 'admin_role_revoked',
      area: 'إدارة المستخدمين',
      targetId: uid,
      targetName: users[idx].name,
      description: makeAdmin ? `تم منح ${users[idx].name} صلاحية أدمن` : `تم إلغاء صلاحية الأدمن من ${users[idx].name}`,
      details: { targetRole: users[idx].role },
    });
    return true;
  } catch {
    return false;
  }
};

export const setAdminPermissions = async (
  uid: string,
  permissions: AdminPermission[],
  actorRole?: string
): Promise<boolean> => {
  if (actorRole !== 'owner') return false;

  try {
    if (FIREBASE_ENABLED) {
      const users = await getAllUsers();
      const target = users.find((u) => u.uid === uid);
      if (!target || (target.role !== 'admin' && target.role !== 'doctor')) return false;
      await updateDoc(doc(db, 'users', uid), { adminPermissions: permissions });
      await recordAuditLog({
        action: 'admin_permissions_updated',
        area: 'إدارة المستخدمين',
        targetId: uid,
        targetName: target.name,
        description: `تم تعديل صلاحيات ${target.name}`,
        details: { permissions },
      });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx === -1 || (users[idx].role !== 'admin' && users[idx].role !== 'doctor')) return false;

    users[idx].adminPermissions = permissions;
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
    await recordAuditLog({
      action: 'admin_permissions_updated',
      area: 'إدارة المستخدمين',
      targetId: uid,
      targetName: users[idx].name,
      description: `تم تعديل صلاحيات ${users[idx].name}`,
      details: { permissions },
    });
    return true;
  } catch {
    return false;
  }
};

export const deleteUser = async (uid: string): Promise<boolean> => {
  try {
    const usersBefore = await getAllUsers();
    const target = usersBefore.find((item) => item.uid === uid);
    if (FIREBASE_ENABLED) {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'doctors', uid)).catch(() => undefined);
      await recordAuditLog({
        action: 'user_deleted',
        area: 'إدارة المستخدمين',
        targetId: uid,
        targetName: target?.name,
        description: `تم حذف حساب ${target?.name || uid}`,
        details: { role: target?.role, email: target?.email },
      });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const filtered = users.filter((u: any) => u.uid !== uid);
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(filtered));
    const doctorsStr = await AsyncStorage.getItem('@doctors');
    if (doctorsStr) {
      const doctors = JSON.parse(doctorsStr);
      const filteredDoctors = doctors.filter((d: any) => d.id !== uid);
      await AsyncStorage.setItem('@doctors', JSON.stringify(filteredDoctors));
    }
    await AsyncStorage.removeItem(`@appointments_${uid}`);
    await AsyncStorage.removeItem(`@results_${uid}`);
    await AsyncStorage.removeItem(`@prescriptions_${uid}`);
    await AsyncStorage.removeItem(`@prescription_orders_${uid}`);
    await AsyncStorage.removeItem(`@transactions_${uid}`);
    await AsyncStorage.removeItem(`@notifications_${uid}`);
    await AsyncStorage.removeItem(`@doctor_schedule_${uid}`);
    await recordAuditLog({
      action: 'user_deleted',
      area: 'إدارة المستخدمين',
      targetId: uid,
      targetName: users.find((u: any) => u.uid === uid)?.name,
      description: `تم حذف حساب ${users.find((u: any) => u.uid === uid)?.name || uid}`,
      details: { role: users.find((u: any) => u.uid === uid)?.role, email: users.find((u: any) => u.uid === uid)?.email },
    });
    return true;
  } catch {
    return false;
  }
};

export const getPendingDoctors = async (): Promise<any[]> => {
  const users = await getAllUsers();
  return users.filter((u) => u.role === 'doctor' && u.isApproved === false);
};

export const approveDoctor = async (uid: string): Promise<boolean> => {
  try {
    const usersBefore = await getAllUsers();
    const target = usersBefore.find((item) => item.uid === uid);
    if (FIREBASE_ENABLED) {
      await updateDoc(doc(db, 'users', uid), { isApproved: true, isActive: true });
      await recordAuditLog({
        action: 'doctor_approved',
        area: 'إدارة الأطباء',
        targetId: uid,
        targetName: target?.name,
        description: `تم اعتماد الطبيب ${target?.name || uid}`,
        details: { email: target?.email, medicalId: target?.medicalId },
      });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx === -1) return false;
    users[idx].isApproved = true;
    users[idx].isActive = true;
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
    await recordAuditLog({
      action: 'doctor_approved',
      area: 'إدارة الأطباء',
      targetId: uid,
      targetName: users[idx].name,
      description: `تم اعتماد الطبيب ${users[idx].name}`,
      details: { email: users[idx].email, medicalId: users[idx].medicalId },
    });
    return true;
  } catch {
    return false;
  }
};

export const rejectDoctor = async (uid: string): Promise<boolean> => {
  try {
    const usersBefore = await getAllUsers();
    const target = usersBefore.find((item) => item.uid === uid);
    if (FIREBASE_ENABLED) {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'doctors', uid)).catch(() => undefined);
      await recordAuditLog({
        action: 'doctor_rejected',
        area: 'إدارة الأطباء',
        targetId: uid,
        targetName: target?.name,
        description: `تم رفض طبيب وحذف طلبه: ${target?.name || uid}`,
        details: { email: target?.email, medicalId: target?.medicalId },
      });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const filtered = users.filter((u: any) => u.uid !== uid);
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(filtered));
    const doctorsStr = await AsyncStorage.getItem('@doctors');
    if (doctorsStr) {
      const doctors = JSON.parse(doctorsStr);
      const filteredDoctors = doctors.filter((d: any) => d.id !== uid);
      await AsyncStorage.setItem('@doctors', JSON.stringify(filteredDoctors));
    }
    await AsyncStorage.removeItem(`@doctor_schedule_${uid}`);
    await recordAuditLog({
      action: 'doctor_rejected',
      area: 'إدارة الأطباء',
      targetId: uid,
      targetName: users.find((u: any) => u.uid === uid)?.name,
      description: `تم رفض طبيب وحذف طلبه: ${users.find((u: any) => u.uid === uid)?.name || uid}`,
      details: { email: users.find((u: any) => u.uid === uid)?.email, medicalId: users.find((u: any) => u.uid === uid)?.medicalId },
    });
    return true;
  } catch {
    return false;
  }
};

export const updateUserProfile = async (
  uid: string,
  updates: any
): Promise<boolean> => {
  try {
    if (FIREBASE_ENABLED) {
      await updateDoc(doc(db, 'users', uid), updates);
      await updateCachedUser(uid, updates);
      await recordAuditLog({
        actorId: uid,
        action: 'profile_updated',
        area: 'الحساب',
        targetId: uid,
        description: 'تم تعديل بيانات الحساب',
        details: { fields: Object.keys(updates || {}) },
      });
      return true;
    }

    await updateCachedUser(uid, updates);
    await recordAuditLog({
      actorId: uid,
      action: 'profile_updated',
      area: 'الحساب',
      targetId: uid,
      description: 'تم تعديل بيانات الحساب',
      details: { fields: Object.keys(updates || {}) },
    });
    return true;
  } catch {
    return false;
  }
};

export const requestDoctorProfileUpdate = async (
  currentUser: AppUser,
  updates: Partial<AppUser>
): Promise<boolean> => {
  try {
    const approvalFields = new Set([
      'phone',
      'email',
      'specialty',
      'medicalId',
      'nationalId',
      'clinicLocation',
      'doctorVideoPrice',
      'doctorClinicPrice',
    ]);
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => approvalFields.has(key) && value !== undefined)
    );
    if (Object.keys(cleanUpdates).length === 0) return true;
    const request = {
      updates: cleanUpdates,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', currentUser.uid), {
        pendingProfileUpdate: request,
      }, { merge: true });
    }

    await updateCachedUser(currentUser.uid, { pendingProfileUpdate: request });
    await recordAuditLog({
      actorId: currentUser.uid,
      action: 'doctor_profile_update_requested',
      area: 'الحساب',
      targetId: currentUser.uid,
      targetName: currentUser.name,
      description: `${currentUser.name} طلب تعديل بيانات الطبيب`,
      details: { fields: Object.keys(cleanUpdates || {}) },
    });
    return true;
  } catch (error) {
    console.error('requestDoctorProfileUpdate error:', error);
    return false;
  }
};

export const approveDoctorProfileUpdate = async (
  uid: string,
  actorRole?: string
): Promise<boolean> => {
  if (actorRole !== 'owner' && actorRole !== 'admin') return false;
  try {
    const users = await getAllUsers();
    const target = users.find((item) => item.uid === uid);
    const updates = target?.pendingProfileUpdate?.updates;
    if (!updates) return false;

    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', uid), {
        ...updates,
        pendingProfileUpdate: null,
      }, { merge: true });
    }

    await updateCachedUser(uid, { ...updates, pendingProfileUpdate: undefined });
    const refreshed = { ...target, ...updates, pendingProfileUpdate: undefined };
    if (refreshed.role === 'doctor') await addDoctorToCatalog(refreshed);
    await recordAuditLog({
      action: 'doctor_profile_update_approved',
      area: 'إدارة الأطباء',
      targetId: uid,
      targetName: target?.name,
      description: `تم اعتماد تعديل بيانات الطبيب ${target?.name || uid}`,
      details: { fields: Object.keys(updates || {}) },
    });
    return true;
  } catch (error) {
    console.error('approveDoctorProfileUpdate error:', error);
    return false;
  }
};

export const rejectDoctorProfileUpdate = async (
  uid: string,
  actorRole?: string
): Promise<boolean> => {
  if (actorRole !== 'owner' && actorRole !== 'admin') return false;
  try {
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', uid), { pendingProfileUpdate: null }, { merge: true });
    }
    await updateCachedUser(uid, { pendingProfileUpdate: undefined });
    await recordAuditLog({
      action: 'doctor_profile_update_rejected',
      area: 'إدارة الأطباء',
      targetId: uid,
      description: 'تم رفض تعديل بيانات الطبيب',
    });
    return true;
  } catch (error) {
    console.error('rejectDoctorProfileUpdate error:', error);
    return false;
  }
};

export const updateUserWalletBalance = async (
  currentUser: AppUser,
  balance: number
): Promise<AppUser | null> => {
  try {
    const nextBalance = Number(balance.toFixed(2));
    if (FIREBASE_ENABLED) {
      await setDoc(doc(db, 'users', currentUser.uid), { balance: nextBalance }, { merge: true });
    }

    await updateCachedUser(currentUser.uid, { balance: nextBalance });
    await recordAuditLog({
      actorId: currentUser.uid,
      action: 'wallet_balance_updated',
      area: 'المحفظة والمعاملات',
      targetId: currentUser.uid,
      targetName: currentUser.name,
      description: `تم تحديث رصيد المحفظة إلى ${nextBalance}`,
      details: { balance: nextBalance, previousBalance: currentUser.balance },
    });
    return { ...currentUser, balance: nextBalance };
  } catch (error) {
    console.error('updateUserWalletBalance error:', error);
    return null;
  }
};
