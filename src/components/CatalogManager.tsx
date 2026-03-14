import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Plus, Edit2, Loader } from 'lucide-react';
import { z } from 'zod';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category?: string;
  inStock: boolean;
  createdAt: Date;
}

interface CatalogManagerProps {
  businessId: string | null;
}

const ProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  price: z.number().positive('Price must be greater than 0'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().optional(),
  inStock: z.boolean(),
});

type ProductFormData = Omit<z.infer<typeof ProductSchema>, 'id' | 'createdAt'>;

export const CatalogManager: React.FC<CatalogManagerProps> = ({ businessId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    price: 0,
    description: '',
    category: '',
    inStock: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load products from Firestore
  useEffect(() => {
    if (!businessId) return;

    const q = query(collection(db, `businesses/${businessId}/products`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList: Product[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        productList.push({
          id: doc.id,
          name: data.name,
          price: data.price,
          description: data.description,
          category: data.category,
          inStock: data.inStock !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      setProducts(productList);
    });

    return unsubscribe;
  }, [businessId]);

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      ProductSchema.parse(formData);

      if (!businessId) return;

      setLoading(true);

      if (editingId) {
        // Update existing product
        const productRef = doc(db, `businesses/${businessId}/products/${editingId}`);
        await updateDoc(productRef, {
          ...formData,
          updatedAt: new Date(),
        });
        setEditingId(null);
      } else {
        // Add new product
        await addDoc(collection(db, `businesses/${businessId}/products`), {
          ...formData,
          createdAt: new Date(),
        });
      }

      setFormData({
        name: '',
        price: 0,
        description: '',
        category: '',
        inStock: true,
      });
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

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      price: product.price,
      description: product.description,
      category: product.category || '',
      inStock: product.inStock,
    });
  };

  const handleDelete = async (id: string) => {
    if (!businessId || !window.confirm('Are you sure you want to delete this product?')) return;

    try {
      const productRef = doc(db, `businesses/${businessId}/products/${id}`);
      await deleteDoc(productRef);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      name: '',
      price: 0,
      description: '',
      category: '',
      inStock: true,
    });
    setErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {editingId ? 'Edit Product' : 'Add New Product'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., iPhone 15 Pro"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                placeholder="0.00"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none ${
                  errors.price ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your product..."
              rows={3}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category (Optional)
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Electronics"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
              <select
                value={formData.inStock ? 'in-stock' : 'out-of-stock'}
                onChange={(e) => setFormData({ ...formData, inStock: e.target.value === 'in-stock' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="in-stock">In Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
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
                  {editingId ? 'Update Product' : 'Add Product'}
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

      {/* Products Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Products ({filteredProducts.length})
          </h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-8">
              <p>No products found. Add your first product to get started!</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 flex-1">{product.name}</h4>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-1 hover:bg-blue-100 text-blue-600 rounded transition"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-gray-700 text-sm mb-3">{product.description}</p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-600">${product.price.toFixed(2)}</p>
                    {product.category && (
                      <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      product.inStock
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
