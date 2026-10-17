import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { UserProfile, UserRole } from '@/src/types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerInitialSuperadmin: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPERADMIN_BOOTSTRAP_EMAIL = 'juhartininasa@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);
          
          if (snap.exists()) {
            const profile = snap.data() as UserProfile;
            setUserProfile(profile);
          } else {
            // Check if this user is the primary superadmin
            const isSuper = user.email?.toLowerCase() === SUPERADMIN_BOOTSTRAP_EMAIL.toLowerCase();
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || (isSuper ? 'Superadmin Utama' : 'Staff Admin'),
              role: isSuper ? 'superadmin' : 'admin',
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);

            // Also maintain in admins collection
            if (isSuper) {
              await setDoc(doc(db, 'admins', user.uid), {
                email: user.email,
                role: 'superadmin',
                createdAt: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          // If bootstrap superadmin
          if (user.email?.toLowerCase() === SUPERADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
            setUserProfile({
              uid: user.uid,
              email: user.email,
              displayName: 'Superadmin Utama',
              role: 'superadmin',
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = 'Gagal masuk. Periksa email dan password Anda.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email atau password salah. Pastikan akun sudah terdaftar di Firebase.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan masuk yang gagal. Silakan coba beberapa saat lagi.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Metode Email/Password belum diaktifkan di Firebase Console Authentication.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google login error:', err);
      setAuthError('Gagal masuk dengan Google: ' + (err.message || 'Operasi dibatalkan.'));
      throw err;
    }
  };

  const registerInitialSuperadmin = async (email: string, pass: string, name: string) => {
    setAuthError(null);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const isSuper = email.toLowerCase() === SUPERADMIN_BOOTSTRAP_EMAIL.toLowerCase();
      const profile: UserProfile = {
        uid: res.user.uid,
        email: email,
        displayName: name || 'Admin ZDN',
        role: isSuper ? 'superadmin' : 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', res.user.uid), profile);
      if (isSuper) {
        await setDoc(doc(db, 'admins', res.user.uid), {
          email,
          role: 'superadmin',
          createdAt: new Date().toISOString(),
        });
      }
      setUserProfile(profile);
    } catch (err: any) {
      console.error('Registration error:', err);
      setAuthError(err.message || 'Gagal mendaftarkan akun.');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setUserProfile(null);
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const role = userProfile?.status === 'active' ? userProfile.role : null;
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = isSuperAdmin || role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        role,
        isAdmin,
        isSuperAdmin,
        loading,
        loginWithEmail,
        loginWithGoogle,
        registerInitialSuperadmin,
        logout,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
