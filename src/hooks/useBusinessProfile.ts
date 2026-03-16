import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface BusinessProfile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  description?: string;
  plan?: string;
  status?: string;
  followMeActive?: boolean;
  followMeVerified?: boolean;
}

export const useBusinessProfile = (phoneNumber: string | null | undefined) => {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!phoneNumber);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phoneNumber) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'businesses'), where('phone', '==', phoneNumber), limit(1));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setProfile(null);
        } else {
          const doc = snapshot.docs[0];
          const data = doc.data();
          setProfile({
            id: doc.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            description: data.description,
            plan: data.plan,
            status: data.status,
            followMeActive: data.followMeActive,
            followMeVerified: data.followMeVerified,
          });
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading business profile', err);
        setError('Failed to load business profile');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [phoneNumber]);

  return { profile, loading, error } as const;
};
