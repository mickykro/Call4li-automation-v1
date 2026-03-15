import React, { createContext, useContext, useState } from 'react';

type AuthUser = {
  uid: string;
  phoneNumber: string;
};

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithOTP: (phoneNumber: string, code: string) => Promise<void>;
  sendOTP: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
  businessId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [pendingOtp, setPendingOtp] = useState<{ phone: string; code: string } | null>(null);

  const sendOTP = async (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      throw new Error('Please enter a valid phone number');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPendingOtp({ phone: cleanPhone, code });
    // Surface code in console for dev convenience
    console.info('OTP code (dev only):', code);
  };

  const signInWithOTP = async (phoneNumber: string, code: string) => {
    if (!pendingOtp) {
      throw new Error('No OTP requested');
    }
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone !== pendingOtp.phone) {
      throw new Error('Phone number does not match OTP request');
    }
    if (code !== pendingOtp.code) {
      throw new Error('Invalid OTP');
    }

    const uid = `mock-${cleanPhone}`;
    setUser({ uid, phoneNumber: cleanPhone });
    setBusinessId(`biz-${cleanPhone}`);
    setPendingOtp(null);
  };

  const logout = async () => {
    setUser(null);
    setBusinessId(null);
    setPendingOtp(null);
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
