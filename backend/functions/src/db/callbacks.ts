import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';

const COLL = 'callbacks';

export interface CallbackDocument {
    businessId: string;
    callerPhone: string;
    businessPhone: string;
    scheduledTime: string;    // ISO string
    reminderSent: boolean;
    conversationId: string;
    createdAt: FirebaseFirestore.Timestamp | FieldValue;
}

export async function saveCallback(params: {
    businessId: string;
    callerPhone: string;
    businessPhone: string;
    scheduledIso: string;
    conversationId: string;
}): Promise<string> {
    const ref = db.collection(COLL).doc();
    await ref.set({
        businessId: params.businessId,
        callerPhone: params.callerPhone,
        businessPhone: params.businessPhone,
        scheduledTime: params.scheduledIso,
        conversationId: params.conversationId,
        reminderSent: false,
        createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
}

/** Returns callbacks whose reminder should fire within the next 35 minutes and haven't been sent yet. */
export async function getDueCallbacks(nowIso: string): Promise<(CallbackDocument & { id: string })[]> {
    const now = new Date(nowIso);
    const reminderWindow = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

    const snap = await db
        .collection(COLL)
        .where('reminderSent', '==', false)
        .where('scheduledTime', '<=', reminderWindow)
        .get();

    return snap.docs.map(d => ({ id: d.id, ...(d.data() as CallbackDocument) }));
}

export async function markReminderSent(callbackId: string): Promise<void> {
    await db.collection(COLL).doc(callbackId).update({ reminderSent: true });
}
