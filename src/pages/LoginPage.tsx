import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Loader } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export const LoginPage: React.FC = () => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const { sendOTP, signInWithOTP } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && step === 'otp') {
      setStep('phone');
    }
    return () => clearInterval(interval);
  }, [timeLeft, step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Format phone number (remove non-digits)
      const formattedPhone = phoneNumber.replace(/\D/g, '');
      if (formattedPhone.length < 10) {
        throw new Error(t('login.error.invalidPhone'));
      }

      await sendOTP(formattedPhone);
      setStep('otp');
      setTimeLeft(300); // 5 minutes

      // Countdown timer - managed in a separate useEffect or using a functional update
      // For now, let's just use the setTimeLeft and handle the side effect in a useEffect
      setTimeLeft(300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (otp.length !== 6) {
        throw new Error(t('login.error.otpLength'));
      }

      await signInWithOTP(phoneNumber.replace(/\D/g, ''), otp);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <MessageCircle className="w-12 h-12 text-green-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">{t('login.heading')}</h1>
            </div>
            <LanguageSwitcher />
          </div>

          <p className="text-center text-gray-600 mb-8">
            {step === 'phone' ? t('login.subtitlePhone') : t('login.subtitleOtp')}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOTP}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.phoneLabel')}
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t('login.phonePlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition text-black placeholder:text-gray-500"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    {t('login.sending')}
                  </>
                ) : (
                  t('login.sendOtp')
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.otpLabel')}
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('login.otpPlaceholder')}
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition text-center text-2xl tracking-widest font-mono"
                  disabled={loading}
                />
              </div>

              <div className="text-center text-sm text-gray-600 mb-6">
                {t('login.codeExpires', {
                  time: `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`,
                })}
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    {t('login.verifying')}
                  </>
                ) : (
                  t('login.verify')
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setPhoneNumber('');
                }}
                className="w-full mt-4 text-green-600 hover:text-green-700 font-semibold py-2"
              >
                {t('login.changePhone')}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-500 mt-8">
            {t('login.helper')}
          </p>
        </div>
      </div>
    </div>
  );
};
