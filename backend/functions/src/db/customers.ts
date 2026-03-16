import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';

const COLL = 'customers';

export interface CustomerDocument {
    phone: string;
    knownBusinesses: string[];   // list of businessIds this customer has interacted with
    isRegisteredBusiness: boolean;
    createdAt: FirebaseFirestore.Timestamp | FieldValue;
    updatedAt: FirebaseFirestore.Timestamp | FieldValue;
}

export async function getCustomer(phone: string): Promise<(CustomerDocument & { id: string }) | null> {
    const doc = await db.collection(COLL).doc(phone).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as CustomerDocument) };
}

export async function upsertCustomer(
    phone: string,
    businessId: string,
    isRegisteredBusiness = false,
): Promise<void> {
    const ref = db.collection(COLL).doc(phone);
    const existing = await ref.get();

    if (!existing.exists) {
        await ref.set({
            phone,
            knownBusinesses: [businessId],
            isRegisteredBusiness,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    } else {
        await ref.update({
            knownBusinesses: FieldValue.arrayUnion(businessId),
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
}

export async function getKnownBusinessesForPhone(phone: string): Promise<string[]> {
    const doc = await db.collection(COLL).doc(phone).get();
    if (!doc.exists) return [];
    const data = doc.data() as CustomerDocument;
    return data.knownBusinesses ?? [];
}
