import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdminPermission, Appointment, LabResult, Prescription, Doctor, ChatMessage, Transaction } from '../types';
import { COLORS, type ThemeId } from '../theme';
import {
  addDoc,
  collectionGroup,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { AppUser, Currency } from '../types';
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

export interface ExtendedPrescription extends Prescription {
  patientName: string;
}

export interface PrescriptionOrder {
  prescriptionId: string;
  status: 'قيد المراجعة' | 'جاري التوصيل' | 'تم التوصيل' | 'ملغي';
  orderedAt: string;
  med: string;
  dosage: string;
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
const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  commissionRate: 5,
  instapayHandle: 'medicare@instapay',
  themeId: 'ruby',
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
    return transaction;
  } catch (error) {
    console.error('recordWalletTransaction error:', error);
    return null;
  }
};

const DEFAULT_DOCTORS: Doctor[] = [
  { id: '1', name: 'د. سارة ميتشيل', specialty: 'أخصائية قلب', rating: 4.9, emoji: '👩‍⚕️', available: true, price: 50 },
  { id: '2', name: 'د. أوين برادي', specialty: 'جراحة عامة', rating: 4.7, emoji: '👨‍⚕️', available: true, price: 70 },
  { id: '3', name: 'د. جيمس كوبر', specialty: 'طب أطفال', rating: 4.8, emoji: '👨‍⚕️', available: true, price: 40 },
];

export const getAllDoctors = async (): Promise<Doctor[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'doctor'), where('isApproved', '==', true)));
      const registeredDoctors = snap.docs.map((d) => {
        const u = d.data() as any;
        return {
          id: u.uid || d.id,
          name: u.name,
          specialty: u.specialty || 'عام',
          rating: 5.0,
          emoji: '👨‍⚕️',
          available: u.isActive !== false,
          price: u.doctorVideoPrice ?? 60,
          clinicPrice: u.doctorClinicPrice ?? u.doctorVideoPrice ?? 60,
          currency: u.currency || 'EGP',
        };
      });
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
  const registeredDoctors = users
    .filter((u) => u.role === 'doctor' && u.isApproved !== false)
    .map((u) => ({
      id: u.uid,
      name: u.name,
      specialty: u.specialty || 'عام',
      rating: 5.0,
      emoji: '👨‍⚕️',
      available: true,
      price: u.doctorVideoPrice ?? 60,
      clinicPrice: u.doctorClinicPrice ?? u.doctorVideoPrice ?? 60,
      currency: u.currency || 'EGP',
    }))
    .filter((rd) => !defaultDoctors.some((d) => d.id === rd.id));

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
        rating: 5.0,
        emoji: '👨‍⚕️',
        available: doctorUser.isApproved !== false,
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
      rating: 5.0,
      emoji: '👨‍⚕️',
      available: doctorUser.isApproved !== false,
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

      await addDoc(collection(db, 'appointments'), {
        ...apt,
        patientId: apt.userId,
        patientName: patient?.name || 'مريض',
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

    const newApt = {
      ...apt,
      id: `apt_${Date.now()}`,
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
    const { password, ...updatedUser } = users[patientIdx];
    return { status: 'success', updatedUser, platformFee, doctorNet };
  } catch (error) {
    console.error('createPaidAppointment error:', error);
    return { status: 'failed' };
  }
};

export const getDoctorSchedule = async (doctorId: string): Promise<DoctorSchedule[]> => {
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
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
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
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DoctorAppointment));
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
      await addDoc(collection(db, 'appointments'), {
        ...apt,
        patientId: apt.userId,
        patientName: patient?.name || 'مريض',
        createdAt: new Date().toISOString(),
      });
      await incrementConsultationsCount(apt.userId);
      return true;
    } catch (error) {
      console.error('Firebase createAppointment error:', error);
      return false;
    }
  }

  const userId = apt.userId;
  const existing = await getUserAppointments(userId);
  const newApt = { ...apt, id: `apt_${Date.now()}` };
  existing.push(newApt);
  await AsyncStorage.setItem(`@appointments_${userId}`, JSON.stringify(existing));
  await incrementConsultationsCount(userId);
  return true;
};

export const updateAppointmentStatus = async (aptId: string, userId: string, status: Appointment['status']): Promise<boolean> => {
  if (FIREBASE_ENABLED) {
    try {
      await updateDoc(doc(db, 'appointments', aptId), { status });
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
    await AsyncStorage.setItem(`@results_${result.userId}`, JSON.stringify(existing));
    return newResult;
  } catch {
    return null;
  }
};

export const getUserPrescriptions = async (userId: string): Promise<Prescription[]> => {
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
    await AsyncStorage.setItem(`@prescriptions_${userId}`, JSON.stringify(existing));
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
    await AsyncStorage.setItem(`@prescriptions_${userId}`, JSON.stringify(prescriptions));
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

export const getPrescriptionOrders = async (userId: string): Promise<PrescriptionOrder[]> => {
  const stored = await AsyncStorage.getItem(`@prescription_orders_${userId}`);
  return stored ? JSON.parse(stored) : [];
};

export const orderPrescription = async (userId: string, prescription: Prescription): Promise<boolean> => {
  try {
    const orders = await getPrescriptionOrders(userId);
    const existingOrder = orders.find((o) => o.prescriptionId === prescription.id);
    if (existingOrder) {
      existingOrder.status = 'جاري التوصيل';
      existingOrder.orderedAt = new Date().toLocaleDateString('ar-EG');
      await AsyncStorage.setItem(`@prescription_orders_${userId}`, JSON.stringify(orders));
      return true;
    }
    const newOrder: PrescriptionOrder = {
      prescriptionId: prescription.id,
      status: 'جاري التوصيل',
      orderedAt: new Date().toLocaleDateString('ar-EG'),
      med: prescription.med,
      dosage: prescription.dosage,
    };
    orders.push(newOrder);
    await AsyncStorage.setItem(`@prescription_orders_${userId}`, JSON.stringify(orders));
    return true;
  } catch {
    return false;
  }
};

export const updatePrescriptionOrderStatus = async (userId: string, prescriptionId: string, status: PrescriptionOrder['status']): Promise<boolean> => {
  try {
    const orders = await getPrescriptionOrders(userId);
    const idx = orders.findIndex((o) => o.prescriptionId === prescriptionId);
    if (idx === -1) return false;
    orders[idx].status = status;
    if (status === 'تم التوصيل') {
      orders[idx].orderedAt += ' (تم التوصيل)';
    }
    await AsyncStorage.setItem(`@prescription_orders_${userId}`, JSON.stringify(orders));
    return true;
  } catch {
    return false;
  }
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

export const getUserNotifications = async (userId: string): Promise<any[]> => {
  if (FIREBASE_ENABLED) {
    try {
      const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
      const firebaseNotifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (firebaseNotifications.length > 0) return firebaseNotifications;
    } catch (error) {
      console.error('Firebase getUserNotifications error:', error);
    }
  }

  const stored = await AsyncStorage.getItem(`@notifications_${userId}`);
  if (stored) return JSON.parse(stored);
  const defaults = [
    { id: '1', userId, title: 'تذكير بالموعد', desc: 'موعدك مع د. سارة سيبدأ بعد 30 دقيقة.', time: 'منذ قليل', icon: 'clock', color: COLORS.primaryLight, read: false },
    { id: '2', userId, title: 'نتائج التحاليل', desc: 'تم رفع نتائج تحليل الدم الخاص بك في قسم النتائج.', time: 'منذ ساعتين', icon: 'file-medical', color: COLORS.secondary, read: false },
    { id: '3', userId, title: 'وصفة طبية جديدة', desc: 'قام د. أوين بإضافة وصفة طبية جديدة لملفك.', time: 'أمس', icon: 'pills', color: COLORS.accentWarm, read: true },
  ];
  await AsyncStorage.setItem(`@notifications_${userId}`, JSON.stringify(defaults));
  return defaults;
};

const getRecipientIdFromChat = (chatId: string, senderId: string, explicitRecipientId?: string): string | undefined => {
  if (explicitRecipientId && explicitRecipientId !== senderId) return explicitRecipientId;
  const participants = chatId.split('_').filter(Boolean);
  return participants.find((id) => id !== senderId);
};

const addLocalNotification = async (userId: string, notification: any): Promise<void> => {
  const stored = await AsyncStorage.getItem(`@notifications_${userId}`);
  const notifications = stored ? JSON.parse(stored) : [];
  notifications.unshift(notification);
  await AsyncStorage.setItem(`@notifications_${userId}`, JSON.stringify(notifications));
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
  }

  await addLocalNotification(recipientId, {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });
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
  const localMessage = {
    ...message,
    recipientId,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };

  try {
    if (FIREBASE_ENABLED) {
      const { id, ...payload } = localMessage;
      const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      localMessage.id = docRef.id;
    }

    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    const msgs = stored ? JSON.parse(stored) : [];
    if (!msgs.some((item: ChatMessage) => item.id === localMessage.id)) {
      msgs.push(localMessage);
      await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(msgs));
    }
    await createChatNotification(localMessage);
    return true;
  } catch (error) {
    console.error('sendMessage error:', error);
    try {
      const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
      const msgs = stored ? JSON.parse(stored) : [];
      msgs.push(localMessage);
      await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(msgs));
      await createChatNotification(localMessage);
      return !FIREBASE_ENABLED;
    } catch {
      return false;
    }
  }
};

export const getUserChatSummaries = async (userId: string): Promise<ChatSummary[]> => {
  const doctors = await getAllDoctors();
  const summaries: ChatSummary[] = [];

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
    if (messages.length === 0) continue;

    const last = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    summaries.push({
      chatId,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorEmoji: doctor.emoji,
      specialty: doctor.specialty,
      lastMessage: last.text || (last.attachmentName ? `مرفق: ${last.attachmentName}` : 'رسالة جديدة'),
      lastMessageAt: last.createdAt,
      messagesCount: messages.length,
    });
  }

  return summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
};

const getChatMessages = async (chatId: string): Promise<ChatMessage[]> => {
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
    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    messages = stored ? JSON.parse(stored) : [];
  }
  return messages;
};

export const getDoctorChatSummaries = async (doctorId: string): Promise<ChatSummary[]> => {
  const chatIds = new Set<string>();
  const patientNames = new Map<string, string>();

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
    const messages = await getChatMessages(chatId);
    if (messages.length === 0) continue;
    const last = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const patientId = chatId.split('_').find((id) => id && id !== doctorId) || last.senderId;
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
    });
  }

  return summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
};

export const listenToMessages = (
  chatId: string,
  callback: (messages: any[]) => void
): (() => void) => {
  let disposed = false;

  const fetchMessages = async () => {
    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    const msgs = stored ? JSON.parse(stored) : [];
    if (!disposed) callback(msgs);
  };

  if (FIREBASE_ENABLED) {
    try {
      const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        async (snap) => {
          const msgs = snap.docs.map((d) => normalizeChatMessage(d.id, chatId, d.data()));
          await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(msgs));
          if (!disposed) callback(msgs);
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
    if (FIREBASE_ENABLED) {
      await updateDoc(doc(db, 'users', uid), { isActive });
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx === -1) return false;
    users[idx].isActive = isActive;
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
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
      return true;
    }

    const stored = await AsyncStorage.getItem('@medicare_users');
    if (!stored) return false;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx === -1 || (users[idx].role !== 'admin' && users[idx].role !== 'doctor')) return false;

    users[idx].adminPermissions = permissions;
    await AsyncStorage.setItem('@medicare_users', JSON.stringify(users));
    return true;
  } catch {
    return false;
  }
};

export const deleteUser = async (uid: string): Promise<boolean> => {
  try {
    if (FIREBASE_ENABLED) {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'doctors', uid)).catch(() => undefined);
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
    if (FIREBASE_ENABLED) {
      await updateDoc(doc(db, 'users', uid), { isApproved: true, isActive: true });
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
    return true;
  } catch {
    return false;
  }
};

export const rejectDoctor = async (uid: string): Promise<boolean> => {
  try {
    if (FIREBASE_ENABLED) {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'doctors', uid)).catch(() => undefined);
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
      return true;
    }

    await updateCachedUser(uid, updates);
    return true;
  } catch {
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
    return { ...currentUser, balance: nextBalance };
  } catch (error) {
    console.error('updateUserWalletBalance error:', error);
    return null;
  }
};
