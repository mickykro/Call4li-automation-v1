/** Generate a random BIZ-XXXXX identifier. */
export function generateBizId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return `BIZ-${s}`;
}

/** Normalise any phone string to E.164. Handles Israeli 05x / 07x local format. */
export function normalisePhone(raw: string): string {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('05') || d.startsWith('07')) d = '972' + d.slice(1);
    return d.startsWith('+') ? d : '+' + d;
}

/** Remove the "whatsapp:" prefix Twilio prepends to phone numbers. */
export function stripWaPrefix(s: string): string {
    return s.replace(/^whatsapp:/i, '');
}
