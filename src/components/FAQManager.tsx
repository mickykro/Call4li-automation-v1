import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Plus, Edit2, Check, X, Loader } from 'lucide-react';
import { z } from 'zod';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FAQManagerProps {
  businessId: string | null;
}

const FAQSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  answer: z.string().min(10, 'Answer must be at least 10 characters'),
  category: z.string().optional(),
});

type FAQFormData = z.infer<typeof FAQSchema>;

export const FAQManager: React.FC<FAQManagerProps> = ({ businessId }) => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FAQFormData>({ question: '', answer: '', category: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load FAQs from Firestore
  React.useEffect(() => {
    if (!businessId) return;

    const q = query(collection(db, `businesses/${businessId}/faqs`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const faqList: FAQ[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        faqList.push({
          id: doc.id,
          question: data.question,
          answer: data.answer,
          category: data.category,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });
      setFaqs(faqList);
    });

    return unsubscribe;
  }, [businessId]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faqs, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      FAQSchema.parse(formData);

      if (!businessId) return;

      setLoading(true);

      if (editingId) {
        // Update existing FAQ
        const faqRef = doc(db, `businesses/${businessId}/faqs/${editingId}`);
        await updateDoc(faqRef, {
          ...formData,
          updatedAt: new Date(),
        });
        setEditingId(null);
      } else {
        // Add new FAQ
        await addDoc(collection(db, `businesses/${businessId}/faqs`), {
          ...formData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      setFormData({ question: '', answer: '', category: '' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0]] = err.message;
          }
        });
        setErrors(newErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (faq: FAQ) => {
    setEditingId(faq.id);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!businessId || !window.confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const faqRef = doc(db, `businesses/${businessId}/faqs/${id}`);
      await deleteDoc(faqRef);
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ question: '', answer: '', category: '' });
    setErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {editingId ? 'Edit FAQ' : 'Add New FAQ'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="What is your question?"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
                errors.question ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.question && <p className="text-red-500 text-sm mt-1">{errors.question}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.answer}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              placeholder="Provide a detailed answer..."
              rows={4}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none ${
                errors.answer ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.answer && <p className="text-red-500 text-sm mt-1">{errors.answer}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category (Optional)
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Billing, Support, General"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {editingId ? 'Update FAQ' : 'Add FAQ'}
                </>
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 rounded-lg transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* FAQ List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">FAQ List ({filteredFaqs.length})</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="divide-y divide-gray-200">
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No FAQs found. Create your first FAQ to get started!</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => (
              <div key={faq.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2">{faq.question}</h4>
                    <p className="text-gray-700 mb-2">{faq.answer}</p>
                    {faq.category && (
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                        {faq.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(faq)}
                      className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
