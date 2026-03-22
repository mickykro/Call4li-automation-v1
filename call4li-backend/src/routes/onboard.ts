/**
 * POST /onboard
 * Registers a new business from the web onboarding form.
 */

import type { Request, Response } from 'express';
import { findBusinessByPhone, createBusiness } from '../db/businesses';
import { normalisePhone } from '../helpers';

interface OnboardBody {
    ownerName?: string;
    businessName?: string;
    description?: string;
    phone?: string;
}

export async function onboardHandler(req: Request, res: Response): Promise<void> {
    const { ownerName, businessName, description, phone: rawPhone } = req.body as OnboardBody;

    if (!ownerName || !businessName || !description || !rawPhone) {
        res.status(400).json({ error: 'Missing required fields: ownerName, businessName, description, phone' });
        return;
    }

    const phone = normalisePhone(rawPhone);

    const existing = await findBusinessByPhone(phone);
    if (existing) {
        res.status(409).json({
            error: 'A business with this phone number already exists.',
            bizId: existing.id,
            onboardUrl: `${process.env.APP_BASE_URL}/onboard/${existing.id}`,
        });
        return;
    }

    const bizId = await createBusiness(phone, {
        ownerName,
        businessName,
        description,
        plan: 'basic',
        status: 'pending',
    });

    res.status(201).json({
        bizId,
        onboardUrl: `${process.env.APP_BASE_URL}/onboard/${bizId}`,
    });
}
