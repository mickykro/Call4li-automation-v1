import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';

type TabType = 'faqs' | 'catalog' | 'hours';

export const KnowledgeBase = () => {
    const { businessData } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('faqs');

    return (
        <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto h-full flex flex-col">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    Knowledge Base
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage the information Forli uses to answer customer questions.
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-zinc-800">
                <nav className="-mb-px flex space-x-8">
                    {(['faqs', 'catalog', 'hours'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                ${activeTab === tab
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-zinc-700'}
                            `}
                        >
                            {tab === 'faqs' ? 'FAQ Editor' : tab === 'catalog' ? 'Catalog Manager' : 'Opening Hours'}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                {activeTab === 'faqs' && <FAQEditor />}
                {activeTab === 'catalog' && <CatalogManager />}
                {activeTab === 'hours' && <OpeningHoursEditor />}
            </div>
        </div>
    );
};

const FAQEditor = () => {
    // Mock FAQs for UI shell
    const [faqs, setFaqs] = useState<{ id: string, q: string, a: string }[]>([
        { id: '1', q: 'Where are you located?', a: 'We are located at 123 Main St, Springfield.' },
        { id: '2', q: 'Do you offer delivery?', a: 'Yes, we offer free delivery within a 10-mile radius.' },
    ]);
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search FAQs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none dark:text-white"
                    />
                </div>
                <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" />
                    Add FAQ
                </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-zinc-800 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                    <thead className="bg-gray-50 dark:bg-zinc-950 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">Question</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Answer</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                        {faqs.map((faq) => (
                            <tr key={faq.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{faq.q}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{faq.a}</td>
                                <td className="px-6 py-4 text-right text-sm font-medium flex justify-end gap-3">
                                    <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CatalogManager = () => {
    // Mock products
    const [products] = useState([
        { id: '1', name: 'Premium Service Package', price: '$99.00', description: 'Includes a full consultation and priority support.' },
        { id: '2', name: 'Standard Training Plan', price: '$49.00', description: '4-week personalized workout regime.' },
        { id: '3', name: 'Starter Kit', price: '$29.00', description: 'Basic tools to get you started quickly.' },
    ]);

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm ml-auto">
                    <Plus className="w-4 h-4" />
                    New Product
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto">
                {products.map((product) => (
                    <div key={product.id} className="border border-gray-200 dark:border-zinc-800 rounded-lg p-5 flex flex-col hover:border-primary/50 transition-colors bg-gray-50/50 dark:bg-zinc-950/50">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{product.name}</h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                {product.price}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">{product.description}</p>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-3">
                            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Edit</button>
                            <button className="text-sm font-medium text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const OpeningHoursEditor = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
        <div className="p-6 h-full flex flex-col max-w-3xl mx-auto w-full">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Business Hours</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Set the hours Forli tells customers you're open.</p>
                </div>
                <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                    <Save className="w-4 h-4" />
                    Save Hours
                </button>
            </div>

            <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden shrink-0">
                <div className="divide-y divide-gray-200 dark:divide-zinc-800">
                    {days.map((day) => (
                        <div key={day} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <div className="flex items-center gap-4 w-40">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded text-primary focus:ring-primary w-4 h-4 border-gray-300 dark:border-zinc-600 dark:bg-zinc-800" defaultChecked={day !== 'Sunday'} />
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{day}</span>
                                </label>
                            </div>

                            {day !== 'Sunday' ? (
                                <div className="flex items-center gap-3 flex-1 justify-end">
                                    <select className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-primary focus:border-primary block p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white outline-none">
                                        <option>09:00</option>
                                        <option>10:00</option>
                                    </select>
                                    <span className="text-gray-500 dark:text-gray-400">-</span>
                                    <select className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-primary focus:border-primary block p-2 dark:bg-zinc-800 dark:border-zinc-700 dark:placeholder-gray-400 dark:text-white outline-none">
                                        <option>17:00</option>
                                        <option>18:00</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400 italic text-right flex-1">Closed</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
