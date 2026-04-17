import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import LoadingScreen from '../components/LoadingScreen';
import { UserRole, UserPermissions, DEFAULT_PERMISSIONS, FULL_PERMISSIONS } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  isViewer: boolean;
  isTI: boolean;
  permissions: UserPermissions;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  isViewer: false,
  isTI: false,
  permissions: DEFAULT_PERMISSIONS,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]             = useState<User | null>(null);
  const [loading, setLoading]       = useState(true);
  const [role, setRole]             = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    let profUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      if (profUnsub) { profUnsub(); profUnsub = null; }

      setUser(currentUser);

      if (currentUser) {
        try {
          const roleRef  = doc(db, 'userRoles', currentUser.uid);
          const roleDoc  = await getDoc(roleRef);

          // Si el usuario no tiene documento, lo creamos como registro base
          if (!roleDoc.exists()) {
            await setDoc(roleRef, {
              email:     currentUser.email ?? '',
              role:      null,
              active:    true,
              createdAt: new Date().toISOString(),
            });
          }

          const roleData = roleDoc.exists() ? roleDoc.data() : null;

          if (roleData?.active === false) {
            await signOut(auth);
            setLoading(false);
            return;
          }

          const fetchedRole = roleData?.role as UserRole ?? null;
          setRole(fetchedRole);

          if (fetchedRole === 'ti' || fetchedRole === 'admin') {
            setPermissions(FULL_PERMISSIONS);
          } else if (fetchedRole === 'operador') {
            // Suscripción en tiempo real: si TI cambia permisos, el operador los recibe al instante
            profUnsub = onSnapshot(
              query(collection(db, 'professionals'), where('email', '==', currentUser.email)),
              (snap) => {
                if (!snap.empty) {
                  setPermissions(snap.docs[0].data().permissions ?? DEFAULT_PERMISSIONS);
                } else {
                  setPermissions(DEFAULT_PERMISSIONS);
                }
              }
            );
          } else {
            setPermissions(DEFAULT_PERMISSIONS);
          }
        } catch {
          setRole(null);
          setPermissions(DEFAULT_PERMISSIONS);
        }
      } else {
        setRole(null);
        setPermissions(DEFAULT_PERMISSIONS);
      }

      setLoading(false);
    });

    return () => { authUnsub(); if (profUnsub) profUnsub(); };
  }, []);

  if (loading) return <LoadingScreen />;

  const isViewer = role === 'viewer';
  const isTI     = role === 'ti';

  return (
    <AuthContext.Provider value={{ user, loading, role, isViewer, isTI, permissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
