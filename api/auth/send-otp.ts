import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Early validate required credentials to avoid opaque 500s
const requiredEnv = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const missing = Object.entries(requiredEnv)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`send-otp missing Firebase credentials: ${missing.join(', ')}`);
}

if (!admin.apps.length && missing.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: requiredEnv.projectId,
      privateKey: requiredEnv.privateKey,
      clientEmail: requiredEnv.clientEmail,
    }),
  });
}

const db = admin.apps.length ? admin.firestore() : null as unknown as FirebaseFirestore.Firestore;

const allowCors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async (req: VercelRequest, res: VercelResponse) => {
  allowCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!admin.apps.length || !db) {
      return res.status(500).json({ error: 'Server not configured: missing Firebase credentials' });
    }

    const rawPhone: string | undefined = req.body?.phoneNumber;
    if (!rawPhone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const phoneNumber = rawPhone.replace(/\D/g, '');
    if (phoneNumber.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const otp = generateOTP();
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000);

    await db.collection('temp_codes').doc(phoneNumber).set(
      {
        code: otp,
        expiresAt: expirationTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: 0,
      },
      { merge: true }
    );

    const greenApiToken = process.env.GREEN_API_TOKEN;
    const greenApiInstanceId = process.env.GREEN_API_INSTANCE_ID;

    if (!greenApiToken || !greenApiInstanceId) {
      console.error('Green API credentials not configured');
      return res.status(500).json({ error: 'Messaging service not configured (missing GREEN_API_TOKEN or GREEN_API_INSTANCE_ID)' });
    }

    const message = `Your Call4li verification code is: ${otp}. This code expires in 5 minutes.`;

    try {
      await axios.post(
        `https://api.green-api.com/waInstance${greenApiInstanceId}/sendMessage/${greenApiToken}`,
        {
          chatId: `${phoneNumber}@c.us`,
          message,
        }
      );
    } catch (err) {
      console.error('Error sending OTP via Green API:', err);
      // Continue even if message fails; verification can still proceed with stored code.
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 300,
    });
  } catch (error) {
    console.error('Error in send-otp:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
};
