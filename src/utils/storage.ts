import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppUser, PasswordResetRequest } from '../types';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const USERS_KEY = '@medicare_users';
const SESSION_KEY = '@medicare_session';
const ADMIN_INIT_KEY = '@admin_initialized';
const PASSWORD_RESET_KEY = '@password_reset_requests';
const FIREBASE_ENABLED = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY !== 'YOUR_API_KEY_HERE'
);

export const ADMIN_EMAIL = 'admin@medicare.com';
export const ADMIN_PASSWORD_LABEL = 'تم تعيين كلمة مرور مخصصة';
const ADMIN_PASSWORD_HASH = 'hashed_l4y4l7_11';

const removeUndefinedValues = <T extends Record<string, any>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
};

export const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hashed_${Math.abs(hash).toString(36)}_${password.length}`;
};

export const isThreePartName = (name: string): boolean =>
  name.trim().split(/\s+/).filter(Boolean).length >= 3;

export const isValidEmailFormat = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());

export const isValidPhone = (phone: string): boolean =>
  /^\+?[0-9\s-]{8,16}$/.test(phone.trim());

export const isStrongPassword = (password: string): boolean =>
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&._-]{8,}$/.test(password);

export const createVerificationToken = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const initializeAdminAccount = async (): Promise<boolean> => {
  try {
    if (FIREBASE_ENABLED) {
      const adminDoc = {
        uid: 'admin_001',
        name: 'المسؤول الرئيسي',
        email: ADMIN_EMAIL,
        emailLower: ADMIN_EMAIL.toLowerCase(),
        password: ADMIN_PASSWORD_HASH,
        level: 'ذهبي',
        role: 'admin',
        isActive: true,
        isApproved: true,
        balance: 0,
        phone: '',
        emailVerified: true,
        phoneVerified: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', 'admin_001'), adminDoc, { merge: true });
    }

    const alreadyInit = await AsyncStorage.getItem(ADMIN_INIT_KEY);
    if (alreadyInit) return true;

    const existingStr = await AsyncStorage.getItem(USERS_KEY);
    const existing = existingStr ? JSON.parse(existingStr) : [];
    const adminIndex = existing.findIndex((u: any) => u.email === ADMIN_EMAIL);
    if (adminIndex > -1) {
      existing[adminIndex] = {
        ...existing[adminIndex],
        password: ADMIN_PASSWORD_HASH,
        isActive: true,
        isApproved: true,
        role: 'admin',
      };
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(existing));
      await AsyncStorage.setItem(ADMIN_INIT_KEY, 'true');
      return true;
    }

    const adminUser = {
      uid: 'admin_001',
      name: 'المسؤول الرئيسي',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD_HASH,
      level: 'ذهبي',
      role: 'admin',
      isActive: true,
      isApproved: true,
      balance: 0,
      phone: '',
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date().toISOString(),
    };
    existing.push(adminUser);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(existing));
    await AsyncStorage.setItem(ADMIN_INIT_KEY, 'true');
    return true;
  } catch (e) {
    console.error('Error initializing admin:', e);
    return false;
  }
};

const saveUserToStorage = async (user: any) => {
  try {
    const existingStr = await AsyncStorage.getItem(USERS_KEY);
    const existing = existingStr ? JSON.parse(existingStr) : [];
    const index = existing.findIndex((u: any) => u.email === user.email);
    if (index > -1) {
      existing[index] = user;
    } else {
      existing.push(user);
    }
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(existing));
    return true;
  } catch (e) {
    console.error('Error saving user:', e);
    return false;
  }
};

export const getAllStoredUsers = async (): Promise<any[]> => {
  const existingStr = await AsyncStorage.getItem(USERS_KEY);
  return existingStr ? JSON.parse(existingStr) : [];
};

export const saveAllStoredUsers = async (users: any[]): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  } catch (e) {
    console.error('Error saving users:', e);
    return false;
  }
};

export const getUserByEmail = async (email: string): Promise<any | null> => {
  const users = await getAllStoredUsers();
  return users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
};

export const saveUserToDB = async (user: Omit<AppUser, 'uid' | 'createdAt'> & { password: string }): Promise<AppUser | null> => {
  let uid = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const hashedPassword = hashPassword(user.password);
  let emailVerified = user.emailVerified;

  if (FIREBASE_ENABLED) {
    const existing = await getDocs(query(collection(db, 'users'), where('emailLower', '==', user.email.trim().toLowerCase())));
    if (!existing.empty) return null;

    const cred = await createUserWithEmailAndPassword(auth, user.email.trim(), user.password);
    uid = cred.user.uid;
    emailVerified = cred.user.emailVerified;
    await sendEmailVerification(cred.user);
    await signOut(auth);
  }

  const newUser: AppUser = {
    uid,
    name: user.name,
    email: user.email,
    level: user.level,
    role: user.role,
    balance: user.balance,
    isActive: user.isActive,
    isApproved: user.isApproved,
    specialty: user.specialty,
    medicalId: user.medicalId,
    patientsCount: user.patientsCount,
    phone: user.phone,
    nationalId: user.nationalId,
    clinicLocation: user.clinicLocation,
    emailVerified,
    phoneVerified: user.phoneVerified,
    createdAt: new Date().toISOString(),
  };
  const userWithPass = { ...newUser, password: hashedPassword };
  if (FIREBASE_ENABLED) {
    await setDoc(doc(db, 'users', uid), removeUndefinedValues({
      ...userWithPass,
      emailLower: user.email.trim().toLowerCase(),
    }));
  }
  const success = await saveUserToStorage(userWithPass);
  if (success) {
    if (newUser.isActive && newUser.isApproved) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    }
    return newUser;
  }
  return null;
};

export const findUserInDB = async (email: string, pass: string): Promise<AppUser | null | { status: 'inactive' } | { status: 'pending' } | { status: 'email_unverified' }> => {
  try {
    const hashedPass = hashPassword(pass);
    if (FIREBASE_ENABLED) {
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail !== ADMIN_EMAIL) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        await reload(cred.user);

        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          await signOut(auth);
          return { status: 'email_unverified' };
        }
      }

      const q = query(collection(db, 'users'), where('emailLower', '==', trimmedEmail), where('password', '==', hashedPass));
      let snap = await getDocs(q);

      if (snap.empty) {
        const legacyQ = query(collection(db, 'users'), where('email', '==', email.trim()), where('password', '==', hashedPass));
        snap = await getDocs(legacyQ);
      }

      if (!snap.empty) {
        const found = snap.docs[0].data() as any;
        if (found.isActive === false) return { status: 'inactive' };
        if (found.role === 'doctor' && found.isApproved === false) return { status: 'pending' };
        if (trimmedEmail !== ADMIN_EMAIL && found.emailVerified === false) {
          await setDoc(doc(db, 'users', found.uid || snap.docs[0].id), { emailVerified: true }, { merge: true });
          found.emailVerified = true;
        }
        const { password, emailLower, ...userWithoutPass } = found;
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPass));
        return userWithoutPass;
      }
    }

    const existingStr = await AsyncStorage.getItem(USERS_KEY);
    const existing = existingStr ? JSON.parse(existingStr) : [];
    const found = existing.find((u: any) => u.email === email && u.password === hashedPass);
    if (found) {
      if (found.isActive === false) {
        return { status: 'inactive' };
      }
      if (found.role === 'doctor' && found.isApproved === false) {
        return { status: 'pending' };
      }
      const { password, ...userWithoutPass } = found;
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPass));
      return userWithoutPass;
    }
    return null;
  } catch (e) {
    console.error('Login error:', e);
    return null;
  }
};

export const signInWithGoogleInDB = async (
  idToken?: string,
  accessToken?: string
): Promise<AppUser | null | { status: 'inactive' } | { status: 'pending' }> => {
  if (!FIREBASE_ENABLED || (!idToken && !accessToken)) return null;

  try {
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const authResult = await signInWithCredential(auth, credential);
    const firebaseUser = authResult.user;
    const email = firebaseUser.email?.trim();
    if (!email) return null;

    const emailLower = email.toLowerCase();
    const userRef = doc(db, 'users', firebaseUser.uid);
    const directDoc = await getDoc(userRef);

    let userData: any | null = directDoc.exists() ? directDoc.data() : null;
    let userDocId = firebaseUser.uid;

    if (!userData) {
      const existing = await getDocs(query(collection(db, 'users'), where('emailLower', '==', emailLower)));
      if (!existing.empty) {
        userDocId = existing.docs[0].id;
        userData = existing.docs[0].data();
      }
    }

    if (!userData) {
      userData = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || email.split('@')[0],
        email,
        emailLower,
        level: 'برونزي',
        role: 'user',
        balance: 0,
        isActive: true,
        isApproved: true,
        phone: firebaseUser.phoneNumber || '',
        emailVerified: firebaseUser.emailVerified,
        phoneVerified: Boolean(firebaseUser.phoneNumber),
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, removeUndefinedValues(userData));
    } else {
      await setDoc(doc(db, 'users', userDocId), removeUndefinedValues({
        uid: userData.uid || firebaseUser.uid,
        email,
        emailLower,
        name: userData.name || firebaseUser.displayName || email.split('@')[0],
        emailVerified: true,
      }), { merge: true });
      userData = {
        ...userData,
        uid: userData.uid || firebaseUser.uid,
        email,
        emailLower,
        name: userData.name || firebaseUser.displayName || email.split('@')[0],
        emailVerified: true,
      };
    }

    if (userData.isActive === false) return { status: 'inactive' };
    if (userData.role === 'doctor' && userData.isApproved === false) return { status: 'pending' };

    const { password, emailLower: _emailLower, ...userWithoutPass } = userData;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPass));
    await saveUserToStorage({ ...userWithoutPass, password: password || '' });
    return userWithoutPass as AppUser;
  } catch (e) {
    console.error('Google login error:', e);
    return null;
  }
};

export const createPasswordResetRequest = async (email: string): Promise<'not_found' | 'already_pending' | PasswordResetRequest> => {
  const user = await getUserByEmail(email);
  if (!user) return 'not_found';

  const existingStr = await AsyncStorage.getItem(PASSWORD_RESET_KEY);
  const requests: PasswordResetRequest[] = existingStr ? JSON.parse(existingStr) : [];
  const pending = requests.find((req) => req.email.toLowerCase() === email.trim().toLowerCase() && req.status === 'pending');
  if (pending) return 'already_pending';

  const request: PasswordResetRequest = {
    id: `reset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: user.uid,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  requests.unshift(request);
  await AsyncStorage.setItem(PASSWORD_RESET_KEY, JSON.stringify(requests));
  return request;
};

export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
  const existingStr = await AsyncStorage.getItem(PASSWORD_RESET_KEY);
  return existingStr ? JSON.parse(existingStr) : [];
};

export const resolvePasswordResetRequest = async (
  requestId: string,
  status: 'approved' | 'rejected',
  newPassword?: string
): Promise<boolean> => {
  const requests = await getPasswordResetRequests();
  const idx = requests.findIndex((req) => req.id === requestId);
  if (idx === -1) return false;

  const request = requests[idx];
  const users = await getAllStoredUsers();
  const userIdx = users.findIndex((u: any) => u.uid === request.userId);
  if (userIdx === -1) return false;

  if (status === 'approved' && newPassword) {
    users[userIdx].password = hashPassword(newPassword);
    await saveAllStoredUsers(users);
  }

  requests[idx] = {
    ...request,
    status,
    resolvedAt: new Date().toISOString(),
    adminNote: status === 'approved' && newPassword ? `كلمة المرور الجديدة: ${newPassword}` : 'تم رفض الطلب بعد مراجعة البيانات',
  };
  await AsyncStorage.setItem(PASSWORD_RESET_KEY, JSON.stringify(requests));
  return true;
};

export const updateUserBalance = async (uid: string, balance: number): Promise<AppUser | null> => {
  const users = await getAllStoredUsers();
  const idx = users.findIndex((u: any) => u.uid === uid);
  if (idx === -1) return null;
  users[idx].balance = balance;
  await saveAllStoredUsers(users);
  const { password, ...userWithoutPass } = users[idx];
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPass));
  return userWithoutPass;
};

export const clearSession = async (): Promise<void> => {
  await AsyncStorage.removeItem(SESSION_KEY);
};

export const getStoredUser = async (): Promise<AppUser | null> => {
  try {
    const session = await AsyncStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
};
