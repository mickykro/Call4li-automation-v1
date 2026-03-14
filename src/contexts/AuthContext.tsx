import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut, type ConfirmationResult, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { findBusinessByPhone } from '../firestoreHelpers';

interface AuthContextType {
    user: User | null;
    businessData: Record<string, unknown> | null;
    loading: boolean;
    setupRecaptcha: (containerId: string) => void;
    sendOTP: (phoneNumber: string) => Promise<ConfirmationResult>;
    verifyOTP: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [businessData, setBusinessData] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser && currentUser.phoneNumber) {
                try {
                    const data = await findBusinessByPhone(currentUser.phoneNumber);
                    if (data) {
                        setUser(currentUser);
                        setBusinessData(data);
                    } else {
                        // User exists in auth but not in businesses collection
                        await signOut(auth);
                        setUser(null);
                        setBusinessData(null);
                    }
                } catch (error) {
                    console.error("Error fetching business data:", error);
                    setUser(null);
                    setBusinessData(null);
                }
            } else {
                setUser(null);
                setBusinessData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const setupRecaptcha = (containerId: string) => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
                size: 'invisible',
            });
        }
    };

    const sendOTP = async (phoneNumber: string) => {
        if (!window.recaptchaVerifier) throw new Error('Recaptcha not initialized');
        return signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
    };

    const verifyOTP = async (confirmationResult: ConfirmationResult, otp: string) => {
        await confirmationResult.confirm(otp);
        // Auth state changes on successful confirm, onAuthStateChanged will handle the rest
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, businessData, loading, setupRecaptcha, sendOTP, verifyOTP, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
