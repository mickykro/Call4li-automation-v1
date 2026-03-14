import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import type { BusinessCardPayload } from './forli';

export type ConversationStatus = 'prospect' | 'active';

export type BusinessDocument = BusinessCardPayload & {
    createdAt?: unknown;
    phone: string;
};

export const findBusinessByPhone = async (phone: string) => {
    try {
        const q = query(collection(db, 'businesses'), where('phone', '==', phone), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as Record<string, unknown> & {
            id: string;
        };
    } catch (error) {
        console.error('Firebase error:', error);
        return null;
    }
};

export const ensureConversation = async (conversationId: string, status: ConversationStatus) => {
    try {
        const ref = doc(db, 'conversations', conversationId);
        await setDoc(
            ref,
            {
                phone: conversationId,
                status,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        );

        return ref;
    } catch (error) {
        console.error('Firebase error:', error);
        return null;
    }
};

export type ConversationMessageInput = {
    sender: 'user' | 'forli' | 'system';
    text: string;
    json?: Record<string, unknown> | null;
};

export const logConversationMessage = async (conversationId: string, message: ConversationMessageInput) => {
    try {
        const messagesRef = collection(doc(db, 'conversations', conversationId), 'messages');

        await addDoc(messagesRef, {
            ...message,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Firebase error:', error);
    }
};

export const createBusinessCard = async (phone: string, payload: BusinessCardPayload) => {
    try {
        const suffix = Math.floor(Math.random() * 90000) + 10000;
        const bizId = `BIZ-${suffix}`;
        const ref = doc(db, 'businesses', bizId);

        await setDoc(ref, {
            ...payload,
            phone,
            createdAt: serverTimestamp(),
        });

        return bizId;
    } catch (error) {
        console.error('Firebase error:', error);
        return null;
    }
};

export const updateConversationStatus = async (conversationId: string, status: ConversationStatus) => {
    try {
        const ref = doc(db, 'conversations', conversationId);
        await setDoc(
            ref,
            {
                status,
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        );
    } catch (error) {
        console.error('Firebase error:', error);
    }
};
