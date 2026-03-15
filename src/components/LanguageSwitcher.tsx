import React from 'react';
import { useLocale, Locale } from '../contexts/LocaleContext';

const languageLabels: Record<Locale, string> = {
  en: 'English',
  he: 'עברית',
  ar: 'العربية',
  es: 'Español',
  ru: 'Русский',
};

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className={`flex items-center gap-2 text-sm text-gray-700 ${className || ''}`}>
      <span className="whitespace-nowrap">{t('language')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
      >
        {Object.entries(languageLabels).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
};
