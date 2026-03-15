import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'en' | 'he' | 'ar' | 'es' | 'ru';

type Translations = Record<string, string>;

const rtlLocales = new Set<Locale>(['he', 'ar']);

const translations: Record<Locale, Translations> = {
  en: {
    'app.name': 'Call4li',
    'loading': 'Loading...',
    'nav.liveFeed': 'Live Feed',
    'nav.faq': 'FAQ Manager',
    'nav.catalog': 'Catalog',
    'nav.hours': 'Opening Hours',
    'nav.analytics': 'Analytics',
    'nav.admin': 'Admin Panel',
    'logout': 'Logout',
    'loggedInAs': 'Logged in as',
    'login.heading': 'Call4li',
    'login.subtitlePhone': 'Enter your phone number',
    'login.subtitleOtp': 'Enter the code sent to your WhatsApp',
    'login.phoneLabel': 'Phone Number',
    'login.phonePlaceholder': '+1 (555) 123-4567',
    'login.otpLabel': 'Verification Code',
    'login.otpPlaceholder': '000000',
    'login.sendOtp': 'Send OTP',
    'login.sending': 'Sending...',
    'login.verify': 'Verify Code',
    'login.verifying': 'Verifying...',
    'login.changePhone': 'Change Phone Number',
    'login.codeExpires': 'Code expires in {time}',
    'login.helper': "We'll send you a code via WhatsApp to verify your identity",
    'login.error.invalidPhone': 'Please enter a valid phone number',
    'login.error.otpLength': 'OTP must be 6 digits',
    'language': 'Language',
    'dashboard.desc.conversations': 'Real-time conversation monitoring',
    'dashboard.desc.faq': 'Manage your FAQ knowledge base',
    'dashboard.desc.catalog': 'Manage your product catalog',
    'dashboard.desc.hours': 'Set your business opening hours',
    'dashboard.desc.analytics': 'View system performance and analytics',
    'dashboard.desc.admin': 'Manage all businesses',
  },
  he: {
    'app.name': 'Call4li',
    'loading': 'טוען...',
    'nav.liveFeed': 'פיד חי',
    'nav.faq': 'ניהול שאלות נפוצות',
    'nav.catalog': 'קטלוג',
    'nav.hours': 'שעות פתיחה',
    'nav.analytics': 'אנליטיקות',
    'nav.admin': 'פאנל ניהול',
    'logout': 'התנתקות',
    'loggedInAs': 'מחובר כ',
    'login.heading': 'Call4li',
    'login.subtitlePhone': 'הזן מספר טלפון',
    'login.subtitleOtp': 'הזן את הקוד שנשלח ב-WhatsApp',
    'login.phoneLabel': 'מספר טלפון',
    'login.phonePlaceholder': '+972 50-123-4567',
    'login.otpLabel': 'קוד אימות',
    'login.otpPlaceholder': '000000',
    'login.sendOtp': 'שלח קוד',
    'login.sending': 'שולח...',
    'login.verify': 'אמת קוד',
    'login.verifying': 'מאמת...',
    'login.changePhone': 'שנה מספר טלפון',
    'login.codeExpires': 'הקוד פג בעוד {time}',
    'login.helper': 'נשלח אליך קוד ב-WhatsApp לאימות',
    'login.error.invalidPhone': 'נא להזין מספר טלפון תקין',
    'login.error.otpLength': 'הקוד חייב לכלול 6 ספרות',
    'language': 'שפה',
    'dashboard.desc.conversations': 'מעקב שיחות בזמן אמת',
    'dashboard.desc.faq': 'ניהול מאגר השאלות והתשובות',
    'dashboard.desc.catalog': 'ניהול קטלוג המוצרים',
    'dashboard.desc.hours': 'הגדרת שעות פתיחה',
    'dashboard.desc.analytics': 'צפייה בביצועים ובאנליטיקות',
    'dashboard.desc.admin': 'ניהול כל העסקים',
  },
  ar: {
    'app.name': 'Call4li',
    'loading': 'جاري التحميل...',
    'nav.liveFeed': 'البث المباشر',
    'nav.faq': 'إدارة الأسئلة الشائعة',
    'nav.catalog': 'الكتالوج',
    'nav.hours': 'ساعات العمل',
    'nav.analytics': 'التحليلات',
    'nav.admin': 'لوحة الإدارة',
    'logout': 'تسجيل خروج',
    'loggedInAs': 'مسجل دخول باسم',
    'login.heading': 'Call4li',
    'login.subtitlePhone': 'أدخل رقم هاتفك',
    'login.subtitleOtp': 'أدخل الرمز المرسل عبر واتساب',
    'login.phoneLabel': 'رقم الهاتف',
    'login.phonePlaceholder': '+966 50-123-4567',
    'login.otpLabel': 'رمز التحقق',
    'login.otpPlaceholder': '000000',
    'login.sendOtp': 'إرسال الرمز',
    'login.sending': 'جارٍ الإرسال...',
    'login.verify': 'تأكيد الرمز',
    'login.verifying': 'جارٍ التأكيد...',
    'login.changePhone': 'تغيير رقم الهاتف',
    'login.codeExpires': 'ينتهي الرمز خلال {time}',
    'login.helper': 'سنرسل لك رمزاً عبر واتساب للتحقق من هويتك',
    'login.error.invalidPhone': 'يرجى إدخال رقم هاتف صالح',
    'login.error.otpLength': 'يجب أن يتكون الرمز من 6 أرقام',
    'language': 'اللغة',
    'dashboard.desc.conversations': 'مراقبة المحادثات لحظيًا',
    'dashboard.desc.faq': 'إدارة قاعدة الأسئلة والأجوبة',
    'dashboard.desc.catalog': 'إدارة كتالوج المنتجات',
    'dashboard.desc.hours': 'تعيين ساعات العمل',
    'dashboard.desc.analytics': 'عرض الأداء والتحليلات',
    'dashboard.desc.admin': 'إدارة جميع الأعمال',
  },
  es: {
    'app.name': 'Call4li',
    'loading': 'Cargando...',
    'nav.liveFeed': 'Flujo en vivo',
    'nav.faq': 'Gestor de FAQs',
    'nav.catalog': 'Catálogo',
    'nav.hours': 'Horario',
    'nav.analytics': 'Analíticas',
    'nav.admin': 'Panel de admin',
    'logout': 'Cerrar sesión',
    'loggedInAs': 'Conectado como',
    'login.heading': 'Call4li',
    'login.subtitlePhone': 'Ingresa tu número de teléfono',
    'login.subtitleOtp': 'Ingresa el código enviado por WhatsApp',
    'login.phoneLabel': 'Número de teléfono',
    'login.phonePlaceholder': '+34 600 123 456',
    'login.otpLabel': 'Código de verificación',
    'login.otpPlaceholder': '000000',
    'login.sendOtp': 'Enviar código',
    'login.sending': 'Enviando...',
    'login.verify': 'Verificar código',
    'login.verifying': 'Verificando...',
    'login.changePhone': 'Cambiar número',
    'login.codeExpires': 'El código expira en {time}',
    'login.helper': 'Te enviaremos un código por WhatsApp para verificar tu identidad',
    'login.error.invalidPhone': 'Ingresa un número válido',
    'login.error.otpLength': 'El código debe tener 6 dígitos',
    'language': 'Idioma',
    'dashboard.desc.conversations': 'Monitoreo de conversaciones en tiempo real',
    'dashboard.desc.faq': 'Administra tu base de FAQs',
    'dashboard.desc.catalog': 'Administra tu catálogo de productos',
    'dashboard.desc.hours': 'Configura tu horario de atención',
    'dashboard.desc.analytics': 'Ver rendimiento y analíticas',
    'dashboard.desc.admin': 'Administra todos los negocios',
  },
  ru: {
    'app.name': 'Call4li',
    'loading': 'Загрузка...',
    'nav.liveFeed': 'Лента',
    'nav.faq': 'FAQ менеджер',
    'nav.catalog': 'Каталог',
    'nav.hours': 'Часы работы',
    'nav.analytics': 'Аналитика',
    'nav.admin': 'Админ панель',
    'logout': 'Выйти',
    'loggedInAs': 'Вошли как',
    'login.heading': 'Call4li',
    'login.subtitlePhone': 'Введите номер телефона',
    'login.subtitleOtp': 'Введите код из WhatsApp',
    'login.phoneLabel': 'Номер телефона',
    'login.phonePlaceholder': '+7 999 123-45-67',
    'login.otpLabel': 'Код подтверждения',
    'login.otpPlaceholder': '000000',
    'login.sendOtp': 'Отправить код',
    'login.sending': 'Отправка...',
    'login.verify': 'Подтвердить код',
    'login.verifying': 'Проверка...',
    'login.changePhone': 'Изменить номер',
    'login.codeExpires': 'Код истечет через {time}',
    'login.helper': 'Мы отправим код в WhatsApp для подтверждения личности',
    'login.error.invalidPhone': 'Введите корректный номер',
    'login.error.otpLength': 'Код должен содержать 6 цифр',
    'language': 'Язык',
    'dashboard.desc.conversations': 'Мониторинг чатов в реальном времени',
    'dashboard.desc.faq': 'Управление базой FAQ',
    'dashboard.desc.catalog': 'Управление каталогом товаров',
    'dashboard.desc.hours': 'Настройка часов работы',
    'dashboard.desc.analytics': 'Просмотр показателей и аналитики',
    'dashboard.desc.admin': 'Управление всеми бизнесами',
  },
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = rtlLocales.has(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const value = translations[locale]?.[key] || translations.en[key] || key;
      if (!vars) return value;
      return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), value);
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
};
