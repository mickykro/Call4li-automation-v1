import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Clock, Save, Loader } from 'lucide-react';

interface DayHours {
  open: boolean;
  startTime: string;
  endTime: string;
}

interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

interface OpeningHoursSelectorProps {
  businessId: string | null;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DEFAULT_HOURS: OpeningHours = {
  monday: { open: true, startTime: '09:00', endTime: '17:00' },
  tuesday: { open: true, startTime: '09:00', endTime: '17:00' },
  wednesday: { open: true, startTime: '09:00', endTime: '17:00' },
  thursday: { open: true, startTime: '09:00', endTime: '17:00' },
  friday: { open: true, startTime: '09:00', endTime: '17:00' },
  saturday: { open: false, startTime: '10:00', endTime: '14:00' },
  sunday: { open: false, startTime: '10:00', endTime: '14:00' },
};

export const OpeningHoursSelector: React.FC<OpeningHoursSelectorProps> = ({ businessId }) => {
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load opening hours from Firestore
  useEffect(() => {
    if (!businessId) return;

    const loadHours = async () => {
      try {
        const businessRef = doc(db, 'businesses', businessId);
        const businessDoc = await getDoc(businessRef);

        if (businessDoc.exists() && businessDoc.data().openingHours) {
          setHours(businessDoc.data().openingHours);
        } else {
          setHours(DEFAULT_HOURS);
        }
      } catch (err) {
        console.error('Error loading opening hours:', err);
        setError('Failed to load opening hours');
      } finally {
        setLoading(false);
      }
    };

    loadHours();
  }, [businessId]);

  const handleToggleDay = (day: keyof OpeningHours) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        open: !prev[day].open,
      },
    }));
  };

  const handleTimeChange = (day: keyof OpeningHours, field: 'startTime' | 'endTime', value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!businessId) return;

    try {
      setSaving(true);
      setError(null);

      const businessRef = doc(db, 'businesses', businessId);
      await setDoc(
        businessRef,
        {
          openingHours: hours,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Show success message
      setTimeout(() => setSaving(false), 1000);
    } catch (err) {
      console.error('Error saving opening hours:', err);
      setError('Failed to save opening hours');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <Clock className="w-6 h-6 text-green-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">Opening Hours</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <p className="text-gray-600 mb-6">
        Set your business hours. Forli will use this to tell customers if you're currently open or closed.
      </p>

      <div className="space-y-4">
        {DAYS.map((day) => (
          <div key={day} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <div className="flex items-center flex-1">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hours[day].open}
                  onChange={() => handleToggleDay(day)}
                  className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <span className="ml-3 font-semibold text-gray-900 w-24">{DAY_LABELS[day]}</span>
              </label>
            </div>

            {hours[day].open ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={hours[day].startTime}
                    onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  <span className="text-gray-600">to</span>
                  <input
                    type="time"
                    value={hours[day].endTime}
                    onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="text-gray-500 font-medium">Closed</div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {saving ? (
          <>
            <Loader className="w-5 h-5 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            Save Opening Hours
          </>
        )}
      </button>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> Your opening hours will be used by Forli to automatically respond to customers
          asking if you're open, and to schedule callbacks during business hours.
        </p>
      </div>
    </div>
  );
};
