import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Layers, Plus, Search, Edit3, Power, Trash2, XCircle, 
  Save, CheckCircle2, ShieldAlert, AlertTriangle, Layers3, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';

export const AdminCategoriesMasterView = () => {
  const { categories = [], products = [], addCategory, updateCategory, toggleCategoryStatus, deleteCategory } = useApp();

  // Search & Modal State
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    operational_unit: 'Piece',
    is_active: 1
  });

  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    category: null,
    productCount: 0
  });

  // Filtered Categories List
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      if (!cat) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (cat.name && cat.name.toLowerCase().includes(q)) ||
        (cat.code && cat.code.toLowerCase().includes(q)) ||
        (cat.operational_unit && cat.operational_unit.toLowerCase().includes(q)) ||
        (cat.description && cat.description.toLowerCase().includes(q))
      );
    });
  }, [categories, searchQuery]);

  // Key Metrics
  const metrics = useMemo(() => {
    const total = categories.length;
    const activeCount = categories.filter(c => c.is_active !== 0).length;
    const totalProductsMapped = products.length;

    return { total, activeCount, totalProductsMapped };
  }, [categories, products]);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      operational_unit: 'Piece',
      is_active: 1
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      code: cat.code || '',
      description: cat.description || '',
      operational_unit: cat.operational_unit || 'Piece',
      is_active: cat.is_active !== undefined ? Number(cat.is_active) : 1
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Category name is required';
    } else {
      const norm = formData.name.trim().toLowerCase();
      const duplicate = categories.find(c => 
        (!editingCategory || Number(c.id) !== Number(editingCategory.id)) && 
        c.name.toLowerCase() === norm
      );
      if (duplicate) {
        errors.name = `Category '${formData.name.trim()}' already exists.`;
      }
    }

    if (formData.code && formData.code.trim()) {
      const codeNorm = formData.code.trim().toUpperCase();
      const dupCode = categories.find(c =>
        (!editingCategory || Number(c.id) !== Number(editingCategory.id)) &&
        c.code && c.code.toUpperCase() === codeNorm
      );
      if (dupCode) {
        errors.code = `Category code '${codeNorm}' is already taken.`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please resolve the errors before saving.");
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      code: (formData.code.trim() || formData.name.trim().replace(/[^a-zA-Z0-9]/g, '')).toUpperCase(),
      description: formData.description ? formData.description.trim() : '',
      operational_unit: formData.operational_unit || 'Piece'
    };

    if (editingCategory) {
      // UPDATE CATEGORY
      const res = await updateCategory(editingCategory.id, payload);
      if (res.success) {
        toast.success(`Category '${res.category.name}' updated successfully!`);
        setIsModalOpen(false);
      } else {
        toast.error(`Update failed: ${res.message}`);
      }
    } else {
      // ADD CATEGORY
      const res = await addCategory(payload);
      if (res.success) {
        toast.success(`🎉 Category '${res.category.name}' created successfully!`);
        setIsModalOpen(false);
      } else {
        toast.error(`Creation failed: ${res.message}`);
      }
    }
  };

  const handleToggleStatus = async (cat) => {
    const currentStatus = cat.is_active !== 0;
    const newStatus = currentStatus ? 0 : 1;

    const res = await toggleCategoryStatus(cat.id, newStatus);
    if (res.success) {
      toast.success(`Category '${cat.name}' ${newStatus ? 'Activated 🟢' : 'Deactivated 🔴'}`);
    } else {
      toast.error(`Status toggle failed: ${res.message}`);
    }
  };

  const handleRequestDelete = (cat) => {
    const linkedFromProducts = products.filter(p => Number(p.category_id) === Number(cat.id)).length;
    const linkedCount = Math.max(linkedFromProducts, Number(cat.product_count || 0));

    if (linkedCount > 0) {
      toast.error(`Cannot delete category '${cat.name}' because ${linkedCount} product(s) are linked to it.`);
      return;
    }

    setDeleteConfirmModal({
      isOpen: true,
      category: cat,
      productCount: linkedCount
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal.category) return;
    const cat = deleteConfirmModal.category;

    const res = await deleteCategory(cat.id);
    if (res.success) {
      toast.success(res.message || `Category '${cat.name}' deleted successfully.`);
      setDeleteConfirmModal({ isOpen: false, category: null, productCount: 0 });
    } else {
      toast.error(res.message || "Failed to delete category.");
    }
  };

  return (
    <div className="space-y-5 pb-16">
      
      {/* Top Banner Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Layers3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                CATEGORY MASTER
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                  {metrics.total} Master Categories
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Manage Product Categories, Operational Units (Piece, Box, Case), Uniqueness Validation, Status, and Relationships</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="relative z-10 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md border border-indigo-400/30 transition"
        >
          <Plus className="w-4 h-4" /> + ADD NEW CATEGORY
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-indigo-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Categories</span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1.5">
            {metrics.total} <span className="text-xs text-slate-500 font-bold">Categories</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Active Categories</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            {metrics.activeCount} <span className="text-xs text-emerald-700 font-bold">Live</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Mapped Product Variants</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5">
            {metrics.totalProductsMapped} <span className="text-xs text-purple-700 font-bold">Products</span>
          </div>
        </div>
      </div>

      {/* Category List Main Table Panel */}
      <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        
        {/* Search Bar Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category name, code, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
            />
          </div>

          <span className="text-xs text-slate-500 font-bold">
            Showing {filteredCategories.length} of {categories.length} Categories
          </span>
        </div>

        {/* Categories Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-200 font-extrabold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Category Code</th>
                <th className="p-3.5">Category Name</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 text-center">Operational Unit</th>
                <th className="p-3.5 text-center">Linked Products</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 font-medium text-slate-700 bg-white">
              {filteredCategories.map(cat => {
                const isActive = cat.is_active !== 0;

                return (
                  <tr key={cat.id} className={`hover:bg-slate-50 transition ${!isActive ? 'opacity-60 bg-slate-50/50' : ''}`}>
                    
                    {/* Code */}
                    <td className="p-3.5 font-mono font-black text-slate-900">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 text-indigo-700">
                        {cat.code || `CAT-${cat.id}`}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="p-3.5">
                      <span className="font-black text-slate-900 text-sm block leading-tight">{cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID #{cat.id}</span>
                    </td>

                    {/* Description */}
                    <td className="p-3.5 text-slate-600 font-medium max-w-xs truncate">
                      {cat.description || 'No description provided.'}
                    </td>

                    {/* Operational Sales Unit */}
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 font-black text-xs rounded-xl border border-indigo-200">
                        {cat.operational_unit || 'Piece'}
                      </span>
                    </td>

                    {/* Linked Products Count */}
                    <td className="p-3.5 text-center font-mono">
                      <span className="px-2.5 py-0.5 bg-purple-50 text-purple-900 font-black text-xs rounded-full border border-purple-200">
                        {cat.product_count || 0} Products
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      {isActive ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full border border-emerald-300 flex items-center justify-center gap-1 w-max mx-auto">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 font-black text-[10px] rounded-full border border-rose-300 flex items-center justify-center gap-1 w-max mx-auto">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(cat)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Edit Category"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(cat)}
                          className={`p-1.5 rounded-xl transition ${isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                          title={isActive ? 'Deactivate Category' : 'Activate Category'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleRequestDelete(cat)}
                          className={`p-1.5 rounded-xl transition ${(cat.product_count > 0 || products.some(p => Number(p.category_id) === Number(cat.id))) ? 'bg-slate-100 text-slate-400 cursor-not-allowed hover:bg-slate-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                          title={(cat.product_count > 0 || products.some(p => Number(p.category_id) === Number(cat.id))) ? `Cannot delete category: ${cat.product_count || 0} product(s) linked` : `Delete category '${cat.name}'`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* ADD / EDIT CATEGORY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base border border-indigo-200">
                  <Layers3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    {editingCategory ? 'Edit Category Specifications' : 'Add New Category Master'}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">Category Master Entity for AVS Distributors</span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Category Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ice Cream, Flavoured Milk"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full p-2.5 font-bold bg-slate-50 border rounded-xl focus:outline-none ${formErrors.name ? 'border-rose-500' : 'border-slate-300 focus:border-indigo-500'}`}
                />
                {formErrors.name && <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formErrors.name}</span>}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Category Code (Optional / Auto-Generated)</label>
                <input
                  type="text"
                  placeholder="e.g. CAT-ICE"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full p-2.5 font-mono font-bold uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Operational / Sales Unit</label>
                <select
                  value={formData.operational_unit || 'Piece'}
                  onChange={(e) => setFormData(prev => ({ ...prev, operational_unit: e.target.value }))}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  <option value="Piece">Piece (Milk, Curd, Single Packets, Bottles)</option>
                  <option value="Box">Box (Bulk Boxes, Cones, Tubs)</option>
                  <option value="Case">Case (Cartons, Multi-pack Cases)</option>
                  <option value="Tray">Tray (Crates, Trays)</option>
                  <option value="Packet">Packet (Packets)</option>
                  <option value="Bottle">Bottle (Bottles, Cans)</option>
                  <option value="Bag">Bag (Sacks, Bags)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">For Milk and Curd, the operational sales unit is always Piece (Trays are packaging conversion only).</p>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Premium frozen dairy desserts and tubs..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2.5 font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Status</label>
                <select
                  value={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: Number(e.target.value) }))}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>🟢 Active (Available for New Products)</option>
                  <option value={0}>🔴 Inactive (Restricted for New Products)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" /> {editingCategory ? 'SAVE CHANGES' : 'CREATE CATEGORY'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmModal.isOpen && deleteConfirmModal.category && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-base text-slate-900 leading-tight">
                  Delete category '{deleteConfirmModal.category.name}'?
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  {deleteConfirmModal.productCount} products are linked to this category.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600">
              <p>
                Are you sure you want to permanently delete category <strong className="font-bold text-slate-900">'{deleteConfirmModal.category.name}'</strong>? This category will be permanently removed from master records.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, category: null, productCount: 0 })}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 transition"
              >
                <Trash2 className="w-4 h-4" /> Delete Category
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
