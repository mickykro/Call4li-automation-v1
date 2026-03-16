import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';
import { generateBizId } from '../config';

export interface BusinessDocument {
    businessId: string;
    ownerName: string;
    businessName: string;
    description: string;
    phone: string;
    plan: 'basic' | 'premium';
    status: 'pending' | 'active' | 'suspended';
    followMeVerified: boolean;
    createdAt: FirebaseFirestore.Timestamp | FieldValue;
    // Premium fields
    openingMessage?: string;
    customButtons?: string[];
    businessHours?: string;
    location?: string;
    // Sub-collections: faq, products (not stored on this doc)
}

const COLL = 'businesses';

export async function findBusinessByPhone(phone: string): Promise<(BusinessDocument & { id: string }) | null> {
    const snap = await db.collection(COLL).where('phone', '==', phone).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() as BusinessDocument) };
}

export async function findBusinessById(bizId: string): Promise<(BusinessDocument & { id: string }) | null> {
    const doc = await db.collection(COLL).doc(bizId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as BusinessDocument) };
}

export async function createBusiness(
    phone: string,
    payload: Omit<BusinessDocument, 'businessId' | 'phone' | 'createdAt' | 'followMeVerified'>,
): Promise<string> {
    const bizId = generateBizId();
    await db.collection(COLL).doc(bizId).set({
        ...payload,
        businessId: bizId,
        phone,
        followMeVerified: false,
        createdAt: FieldValue.serverTimestamp(),
    });
    return bizId;
}

export async function updateBusiness(
    bizId: string,
    data: Partial<Omit<BusinessDocument, 'businessId' | 'createdAt'>>,
): Promise<void> {
    await db.collection(COLL).doc(bizId).set(data, { merge: true });
}

export async function setFollowMeVerified(bizId: string, verified: boolean): Promise<void> {
    await db.collection(COLL).doc(bizId).update({ followMeVerified: verified });
}

export async function getAllBusinesses(filters?: {
    plan?: 'basic' | 'premium';
    status?: 'pending' | 'active' | 'suspended';
}): Promise<(BusinessDocument & { id: string })[]> {
    let query: FirebaseFirestore.Query = db.collection(COLL);
    if (filters?.plan) query = query.where('plan', '==', filters.plan);
    if (filters?.status) query = query.where('status', '==', filters.status);
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as BusinessDocument) }));
}

// ── FAQ sub-collection ────────────────────────────────────────────

export interface FaqDoc {
    q: string;
    a: string;
    order?: number;
}

export async function getFaqs(bizId: string): Promise<FaqDoc[]> {
    const snap = await db.collection(COLL).doc(bizId).collection('faq').orderBy('order').get();
    return snap.docs.map(d => d.data() as FaqDoc);
}

export async function setFaqs(bizId: string, faqs: FaqDoc[]): Promise<void> {
    const batch = db.batch();
    const ref = db.collection(COLL).doc(bizId).collection('faq');
    // Clear existing
    const existing = await ref.get();
    existing.docs.forEach(d => batch.delete(d.ref));
    // Write new
    faqs.forEach((faq, i) => {
        const docRef = ref.doc();
        batch.set(docRef, { ...faq, order: i });
    });
    await batch.commit();
}

// ── Products sub-collection ───────────────────────────────────────

export interface ProductDoc {
    name: string;
    description: string;
    price: string;
    order?: number;
}

export async function getProducts(bizId: string): Promise<ProductDoc[]> {
    const snap = await db.collection(COLL).doc(bizId).collection('products').orderBy('order').get();
    return snap.docs.map(d => d.data() as ProductDoc);
}

export async function setProducts(bizId: string, products: ProductDoc[]): Promise<void> {
    const batch = db.batch();
    const ref = db.collection(COLL).doc(bizId).collection('products');
    const existing = await ref.get();
    existing.docs.forEach(d => batch.delete(d.ref));
    products.forEach((p, i) => {
        const docRef = ref.doc();
        batch.set(docRef, { ...p, order: i });
    });
    await batch.commit();
}
