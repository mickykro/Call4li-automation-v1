import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';
import type { CustomerConversationState } from '../forli/types';
import type { ForliState } from '../forli/types';

const COLL = 'conversations';

export type CallerRole = 'customer' | 'business';
export type ConversationStatus = 'active' | 'summarized' | 'closed';

export interface ConversationDocument {
    businessId: string;
    callerPhone: string;
    callerRole: CallerRole;
    status: ConversationStatus;
    summary?: string;
    callbackTime?: string;
    // Serialised engine state stored as JSON string to avoid Firestore type issues
    customerState?: string;
    onboardingState?: string;
    createdAt: FirebaseFirestore.Timestamp | FieldValue;
    updatedAt: FirebaseFirestore.Timestamp | FieldValue;
}

export interface MessageDocument {
    sender: 'customer' | 'forli' | 'system';
    content: string;
    type: 'text' | 'media' | 'system';
    mediaUrl?: string;
    timestamp: FirebaseFirestore.Timestamp | FieldValue;
}

// Conversation ID: "{businessId}_{callerPhone}" — deterministic per pair
export function buildConversationId(businessId: string, callerPhone: string): string {
    return `${businessId}_${callerPhone.replace(/\+/g, '')}`;
}

export async function getConversation(conversationId: string): Promise<(ConversationDocument & { id: string }) | null> {
    const doc = await db.collection(COLL).doc(conversationId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as ConversationDocument) };
}

export async function getOrCreateConversation(
    businessId: string,
    callerPhone: string,
    callerRole: CallerRole,
): Promise<ConversationDocument & { id: string }> {
    const id = buildConversationId(businessId, callerPhone);
    const existing = await getConversation(id);
    if (existing) return existing;

    const data: ConversationDocument = {
        businessId,
        callerPhone,
        callerRole,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection(COLL).doc(id).set(data);
    return { id, ...data };
}

export async function addMessage(
    conversationId: string,
    message: Omit<MessageDocument, 'timestamp'>,
): Promise<void> {
    await db
        .collection(COLL)
        .doc(conversationId)
        .collection('messages')
        .add({ ...message, timestamp: FieldValue.serverTimestamp() });

    // Also touch updatedAt on parent
    await db
        .collection(COLL)
        .doc(conversationId)
        .update({ updatedAt: FieldValue.serverTimestamp() });
}

export async function getMessages(conversationId: string): Promise<MessageDocument[]> {
    const snap = await db
        .collection(COLL)
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();
    return snap.docs.map(d => d.data() as MessageDocument);
}

export async function saveCustomerState(
    conversationId: string,
    state: CustomerConversationState,
): Promise<void> {
    await db
        .collection(COLL)
        .doc(conversationId)
        .update({
            customerState: JSON.stringify(state),
            updatedAt: FieldValue.serverTimestamp(),
        });
}

export async function loadCustomerState(
    conversationId: string,
): Promise<CustomerConversationState | null> {
    const doc = await db.collection(COLL).doc(conversationId).get();
    if (!doc.exists) return null;
    const data = doc.data() as ConversationDocument;
    if (!data.customerState) return null;
    return JSON.parse(data.customerState) as CustomerConversationState;
}

export async function saveOnboardingState(
    conversationId: string,
    state: ForliState,
): Promise<void> {
    await db
        .collection(COLL)
        .doc(conversationId)
        .set(
            {
                onboardingState: JSON.stringify(state),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
}

export async function loadOnboardingState(conversationId: string): Promise<ForliState | null> {
    const doc = await db.collection(COLL).doc(conversationId).get();
    if (!doc.exists) return null;
    const data = doc.data() as ConversationDocument;
    if (!data.onboardingState) return null;
    return JSON.parse(data.onboardingState) as ForliState;
}

export async function closeConversationWithSummary(
    conversationId: string,
    summary: string,
    callbackTime?: string,
): Promise<void> {
    await db
        .collection(COLL)
        .doc(conversationId)
        .update({
            status: 'summarized',
            summary,
            ...(callbackTime ? { callbackTime } : {}),
            updatedAt: FieldValue.serverTimestamp(),
        });
}

export async function getActiveConversationsForBusiness(businessId: string): Promise<(ConversationDocument & { id: string })[]> {
    const snap = await db
        .collection(COLL)
        .where('businessId', '==', businessId)
        .where('status', '==', 'active')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as ConversationDocument) }));
}

export async function getAllConversationsForBusiness(businessId: string): Promise<(ConversationDocument & { id: string })[]> {
    const snap = await db
        .collection(COLL)
        .where('businessId', '==', businessId)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as ConversationDocument) }));
}
