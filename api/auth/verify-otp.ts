import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });
}

const db = admin.firestore();
const auth = admin.auth();

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    // Retrieve OTP from Firestore
    const tempCodeDoc = await db.collection('temp_codes').doc(phoneNumber).get();

    if (!tempCodeDoc.exists) {
      return res.status(400).json({ error: 'No OTP found for this phone number' });
    }

    const tempCodeData = tempCodeDoc.data();

    // Check expiration
    if (tempCodeData.expiresAt.toDate() < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Check attempts
    if (tempCodeData.attempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
    }

    // Verify code
    if (tempCodeData.code !== code) {
      // Increment attempts
      await db.collection('temp_codes').doc(phoneNumber).update({
        attempts: admin.firestore.FieldValue.increment(1),
      });
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Get or create user in Firebase Auth
    let uid: string;
    try {
      const user = await auth.getUserByPhoneNumber(phoneNumber);
      uid = user.uid;
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        const newUser = await auth.createUser({
          phoneNumber: phoneNumber,
        });
        uid = newUser.uid;
      } else {
        throw error;
      }
    }

    // Create custom token
    const customToken = await auth.createCustomToken(uid);

    // Delete the temp code
    await db.collection('temp_codes').doc(phoneNumber).delete();

    // Get user's business data
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};

    return res.status(200).json({
      success: true,
      token: customToken,
      uid: uid,
      phoneNumber: phoneNumber,
      businessId: userData.businessId,
      businessName: userData.businessName,
    });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
