import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isViewer: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isViewer, setIsViewer] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const roleDoc = await getDoc(doc(db, 'userRoles', currentUser.uid));
          setIsViewer(roleDoc.exists() && roleDoc.data()?.role === 'viewer');
        } catch {
          setIsViewer(false);
        }
      } else {
        setIsViewer(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isViewer }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
