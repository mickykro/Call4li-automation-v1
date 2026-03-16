import { defineSecret } from 'firebase-functions/params';

// Firebase Functions v2 secrets (set via: firebase functions:secrets:set SECRET_NAME)
export const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
export const TWILIO_AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
export const TWILIO_WHATSAPP_NUMBER = defineSecret('TWILIO_WHATSAPP_NUMBER');
export const TWILIO_TEST_NUMBER = defineSecret('TWILIO_TEST_NUMBER');
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
export const ADMIN_SECRET = defineSecret('ADMIN_SECRET');
export const APP_BASE_URL = defineSecret('APP_BASE_URL');

// Generate a random BIZ-XXXXX ID (alphanumeric, uppercase)
export function generateBizId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `BIZ-${suffix}`;
}

// Normalise phone numbers: strip non-digits, ensure E.164 format
export function normalisePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    // Handle Israeli local numbers (05x)
    if (digits.startsWith('05') || digits.startsWith('07')) {
        digits = '972' + digits.slice(1);
    }
    if (!digits.startsWith('+')) {
        digits = '+' + digits;
    }
    return digits;
}

// Strip the whatsapp: prefix if present
export function stripWaPrefix(phone: string): string {
    return phone.replace(/^whatsapp:/i, '');
}
