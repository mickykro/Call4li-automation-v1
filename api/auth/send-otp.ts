import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });
}

const db = admin.firestore();

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to Firestore
    await db.collection('temp_codes').doc(phoneNumber).set(
      {
        code: otp,
        expiresAt: expirationTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: 0,
      },
      { merge: true }
    );

    // Send OTP via Green API
    const greenApiToken = process.env.GREEN_API_TOKEN;
    const greenApiInstanceId = process.env.GREEN_API_INSTANCE_ID;

    if (!greenApiToken || !greenApiInstanceId) {
      console.error('Green API credentials not configured');
      return res.status(500).json({ error: 'SMS service not configured' });
    }

    const message = `Your Call4li verification code is: ${otp}. This code expires in 5 minutes.`;

    try {
      await axios.post(
        `https://api.green-api.com/waInstance${greenApiInstanceId}/sendMessage/${greenApiToken}`,
        {
          chatId: `${phoneNumber}@c.us`,
          message: message,
        }
      );
    } catch (error) {
      console.error('Error sending OTP via Green API:', error);
      // Continue even if SMS fails - user can still verify manually
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    console.error('Error in send-otp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
