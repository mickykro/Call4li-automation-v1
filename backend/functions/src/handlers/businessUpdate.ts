/**
 * PUT /business/update
 * Update business profile data, FAQ, products, or hours.
 * Called from the business dashboard panel.
 */

import type { Request, Response } from 'express';
import {
    findBusinessById,
    updateBusiness,
    setFaqs,
    setProducts,
    type FaqDoc,
    type ProductDoc,
} from '../db/businesses';

interface UpdateBody {
    bizId?: string;
    ownerName?: string;
    businessName?: string;
    description?: string;
    businessHours?: string;
    location?: string;
    openingMessage?: string;
    customButtons?: string[];
    status?: 'pending' | 'active' | 'suspended';
    plan?: 'basic' | 'premium';
    faqs?: FaqDoc[];
    products?: ProductDoc[];
}

export async function businessUpdateHandler(req: Request, res: Response): Promise<void> {
    const body = req.body as UpdateBody;
    const { bizId, faqs, products, ...rest } = body;

    if (!bizId) {
        res.status(400).json({ error: 'bizId is required' });
        return;
    }

    const business = await findBusinessById(bizId);
    if (!business) {
        res.status(404).json({ error: 'Business not found' });
        return;
    }

    // Update sub-collections if provided
    if (faqs !== undefined) {
        await setFaqs(bizId, faqs);
    }
    if (products !== undefined) {
        await setProducts(bizId, products);
    }

    // Update main document fields (filter out undefined values)
    const updates: Partial<typeof rest> = {};
    for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
            (updates as Record<string, unknown>)[key] = value;
        }
    }

    if (Object.keys(updates).length > 0) {
        await updateBusiness(bizId, updates);
    }

    res.json({ success: true, bizId });
}
