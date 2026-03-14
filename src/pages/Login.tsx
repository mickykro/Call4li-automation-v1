import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Loader2 } from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';

export const Login = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    const { setupRecaptcha, sendOTP, verifyOTP, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/', { replace: true });
        }
        setupRecaptcha('recaptcha-container');
    }, [user, navigate, setupRecaptcha]);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
            const result = await sendOTP(formattedPhone);
            setConfirmationResult(result);
            setStep('OTP');
        } catch (err: any) {
            console.error('Error sending OTP:', err);
            setError(err.message || 'Failed to send verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmationResult) return;

        setError('');
        setLoading(true);

        try {
            await verifyOTP(confirmationResult, otp);
            // On success, AuthContext will navigate to / due to user state change
        } catch (err: any) {
            console.error('Error verifying OTP:', err);
            setError('Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 dark:bg-zinc-950">
            <div id="recaptcha-container"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Bot size={28} />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    Sign in to your Dashboard
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    Use the phone number associated with your Call4li business account.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">

                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {step === 'PHONE' ? (
                        <form className="space-y-6" onSubmit={handleSendCode}>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Phone Number
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        placeholder="+1234567890"
                                        required
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Send Code'}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleVerifyCode}>
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Verification Code
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="otp"
                                        name="otp"
                                        type="text"
                                        placeholder="123456"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white text-center tracking-widest text-lg"
                                        maxLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length < 6}
                                className="flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Verify Code'}
                            </button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep('PHONE');
                                        setOtp('');
                                        setError('');
                                    }}
                                    className="text-sm text-primary hover:text-primary/80"
                                >
                                    Use a different phone number
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
