import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { AppUser, Doctor, Appointment, ChatMessage, Transaction, AppNotification, LabResult, Prescription } from '../types';

// ========== AUTH ==========

export const registerWithEmail = async (
  email: string,
  password: string,
  userData: Omit<AppUser, 'uid' | 'createdAt'>
): Promise<AppUser | null> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const userDoc: AppUser = {
      uid: cred.user.uid,
      name: userData.name,
      email: userData.email,
      level: userData.level,
      role: userData.role,
      balance: userData.balance,
      isActive: true,
      isApproved: true,
      specialty: userData.specialty,
      medicalId: userData.medicalId,
      patientsCount: userData.patientsCount,
      phone: userData.phone,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), userDoc);
    return userDoc;
  } catch (error) {
    console.error('Register error:', error);
    return null;
  }
};

export const loginWithEmail = async (
  email: string,
  password: string
): Promise<AppUser | null> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    if (userDoc.exists()) {
      return userDoc.data() as AppUser;
    }
    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

// ========== USERS ==========

export const getUserById = async (uid: string): Promise<AppUser | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    return userDoc.exists() ? (userDoc.data() as AppUser) : null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
};

export const updateUserProfile = async (
  uid: string,
  updates: Partial<AppUser>
): Promise<boolean> => {
  try {
    await updateDoc(doc(db, 'users', uid), updates);
    return true;
  } catch (error) {
    console.error('Update user error:', error);
    return false;
  }
};

export const listenToUser = (
  uid: string,
  callback: (user: AppUser | null) => void
): (() => void) => {
  return onSnapshot(doc(db, 'users', uid), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as AppUser);
    } else {
      callback(null);
    }
  });
};

// ========== DOCTORS ==========

export const getAllDoctors = async (): Promise<Doctor[]> => {
  try {
    const snap = await getDocs(collection(db, 'doctors'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Doctor));
  } catch (error) {
    console.error('Get doctors error:', error);
    return [];
  }
};

export const searchDoctors = async (searchTerm: string): Promise<Doctor[]> => {
  try {
    const allDoctors = await getAllDoctors();
    return allDoctors.filter(
      (d) =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.specialty.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } catch (error) {
    console.error('Search doctors error:', error);
    return [];
  }
};

// ========== APPOINTMENTS ==========

export const getUserAppointments = async (userId: string): Promise<Appointment[]> => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
  } catch (error) {
    console.error('Get appointments error:', error);
    return [];
  }
};

export const createAppointment = async (apt: Omit<Appointment, 'id'>): Promise<boolean> => {
  try {
    await addDoc(collection(db, 'appointments'), apt);
    return true;
  } catch (error) {
    console.error('Create appointment error:', error);
    return false;
  }
};

export const cancelAppointment = async (aptId: string): Promise<boolean> => {
  try {
    await updateDoc(doc(db, 'appointments', aptId), { status: 'ملغي' });
    return true;
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return false;
  }
};

// ========== CHAT ==========

export const sendMessage = async (message: Omit<ChatMessage, 'id'>): Promise<boolean> => {
  try {
    await addDoc(collection(db, 'chats', message.chatId, 'messages'), {
      ...message,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Send message error:', error);
    return false;
  }
};

export const listenToMessages = (
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const msgs: ChatMessage[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      msgs.push({
        id: docSnap.id,
        chatId,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
      });
    });
    callback(msgs);
  });
};

// ========== TRANSACTIONS ==========

export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
  } catch (error) {
    console.error('Get transactions error:', error);
    return [];
  }
};

// ========== NOTIFICATIONS ==========

export const getUserNotifications = async (userId: string): Promise<AppNotification[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('time', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
};

// ========== LAB RESULTS ==========

export const getUserResults = async (userId: string): Promise<LabResult[]> => {
  try {
    const q = query(
      collection(db, 'results'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LabResult));
  } catch (error) {
    console.error('Get results error:', error);
    return [];
  }
};

// ========== PRESCRIPTIONS ==========

export const getUserPrescriptions = async (userId: string): Promise<Prescription[]> => {
  try {
    const q = query(
      collection(db, 'prescriptions'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Prescription));
  } catch (error) {
    console.error('Get prescriptions error:', error);
    return [];
  }
};
