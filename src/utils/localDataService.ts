import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Appointment, LabResult, Prescription, Doctor } from '../types';
import { COLORS } from '../theme';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';

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
          price: 60,
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
      price: 60,
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
        price: 60,
      }, { merge: true });
      return true;
    }

    const doctors = await getAllDoctors();
    const alreadyExists = doctors.find((d) => d.id === doctorUser.uid);
    if (alreadyExists) return true;
    const newDoctor: Doctor = {
      id: doctorUser.uid,
      name: doctorUser.name,
      specialty: doctorUser.specialty || 'عام',
      rating: 5.0,
      emoji: '👨‍⚕️',
      available: doctorUser.isApproved !== false,
      price: 60,
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

export const getUserTransactions = async (userId: string): Promise<any[]> => {
  const stored = await AsyncStorage.getItem(`@transactions_${userId}`);
  if (stored) return JSON.parse(stored);
  const defaults = [
    { id: '1', userId, title: 'دفع استشارة د. سارة', date: '20 أبريل 2026', amount: 50, type: 'out' },
    { id: '2', userId, title: 'شحن رصيد المحفظة', date: '18 أبريل 2026', amount: 200, type: 'in' },
    { id: '3', userId, title: 'اختبار معامل الـ بي سي أر', date: '15 أبريل 2026', amount: 30, type: 'out' },
  ];
  await AsyncStorage.setItem(`@transactions_${userId}`, JSON.stringify(defaults));
  return defaults;
};

export const getUserNotifications = async (userId: string): Promise<any[]> => {
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

export const sendMessage = async (message: any): Promise<boolean> => {
  const chatId = message.chatId;
  const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
  const msgs = stored ? JSON.parse(stored) : [];
  msgs.push({ ...message, id: `msg_${Date.now()}` });
  await AsyncStorage.setItem(`@chat_${chatId}`, JSON.stringify(msgs));
  return true;
};

export const listenToMessages = (
  chatId: string,
  callback: (messages: any[]) => void
): (() => void) => {
  const fetchMessages = async () => {
    const stored = await AsyncStorage.getItem(`@chat_${chatId}`);
    const msgs = stored ? JSON.parse(stored) : [];
    callback(msgs);
  };
  fetchMessages();
  const interval = setInterval(fetchMessages, 2000);
  return () => clearInterval(interval);
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
      if (!target || target.role === 'owner' || target.role === 'doctor') return false;
      await updateDoc(doc(db, 'users', uid), {
        role: makeAdmin ? 'admin' : 'user',
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
    if (users[idx].role === 'owner' || users[idx].role === 'doctor') return false;

    users[idx].role = makeAdmin ? 'admin' : 'user';
    users[idx].isApproved = true;
    users[idx].isActive = true;
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
