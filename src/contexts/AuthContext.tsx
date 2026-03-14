import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '../firebase';
import { getAuth } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithOTP: (phoneNumber: string, code: string) => Promise<void>;
  sendOTP: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  businessId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const sendOTP = async (phoneNumber: string) => {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send OTP');
    }
  };

  const signInWithOTP = async (phoneNumber: string, code: string) => {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify OTP');
    }

    const data = await response.json();
    setBusinessId(data.businessId);

    // Sign in with custom token
    await signInWithCustomToken(auth, data.token);
  };

  const logout = async () => {
    await signOut(auth);
    setBusinessId(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithOTP, sendOTP, logout, businessId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
