import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminProductRatesView } from './AdminProductRatesView';
import { AdminCategoriesMasterView } from './AdminCategoriesMasterView';
import { ProductImage } from '../common/ProductImage';
import { normalizeProductImage } from '../../utils/imageNormalizer';
import { 
  Package, Plus, Search, Filter, Tag, CheckCircle2, XCircle, 
  Eye, Edit3, Power, AlertTriangle, Layers, ArrowLeft, Save, 
  Sparkles, RefreshCw, Layers3, DollarSign, Barcode, ShieldAlert, Check, Upload, Image as ImageIcon 
} from 'lucide-react';
import { toast } from 'sonner';

const SELLING_UNITS = ['Tray', 'Box', 'Case', 'Pack', 'Crate', 'Bottle'];
const BASE_UNITS = ['Piece', 'Bottle', 'Packet', 'Can', 'Pouches'];

export const AdminProductsMasterView = () => {
  const { products = [], categories = [], addProduct, updateProduct, toggleProductStatus, addCategory } = useApp();
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'add', 'rates', 'categories'

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE

  // Selected product for Details / Edit Modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Inline Quick Add Category Modal State
  const [isQuickAddCategoryOpen, setIsQuickAddCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Active Categories list for dropdown selection
  const activeCategories = useMemo(() => {
    return categories.filter(c => c.is_active !== 0);
  }, [categories]);

  // Add Product Form State
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    sku: '',
    barcode: '',
    category_id: 1,
    category: 'Dairy',
    base_unit: 'Piece',
    selling_unit: 'Tray',
    pieces_per_unit: 20,
    purchase_price: 700,
    unit_selling_price: 880,
    piece_selling_price: 44,
    warehouse_stock_units: 50,
    min_stock_level: 10,
    is_active: 1,
    image: '',
    icon: '🥛'
  });

  const [formErrors, setFormErrors] = useState({});

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p) return false;
      
      let catMatch = true;
      if (selectedCategory !== 'all') {
        catMatch = String(p.category_id) === String(selectedCategory) || 
          (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());
      }
      
      const isAct = p.is_active !== undefined ? Boolean(p.is_active) : true;
      const statusMatch = statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && isAct) || 
        (statusFilter === 'INACTIVE' && !isAct);

      const q = searchQuery.toLowerCase().trim();
      const nameMatch = !q || (p.name && p.name.toLowerCase().includes(q)) || 
        (p.display_name && p.display_name.toLowerCase().includes(q)) || 
        (p.sku && p.sku.toLowerCase().includes(q)) || 
        (p.barcode && p.barcode.toLowerCase().includes(q));

      return catMatch && statusMatch && nameMatch;
    });
  }, [products, selectedCategory, statusFilter, searchQuery]);

  // Overall Statistics
  const metrics = useMemo(() => {
    const total = products.length;
    const activeCount = products.filter(p => p.is_active !== undefined ? Boolean(p.is_active) : true).length;
    const lowStockCount = products.filter(p => (p.warehouse_stock_units || 0) <= (p.min_stock_level || 10)).length;
    const categoryCount = categories.length;

    return { total, activeCount, lowStockCount, categoryCount };
  }, [products, categories]);

  // Add Product Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.category) errors.category = 'Category is required';
    if (Number(formData.unit_selling_price) < 0) errors.unit_selling_price = 'Selling price cannot be negative';
    if (Number(formData.purchase_price) < 0) errors.purchase_price = 'Purchase price cannot be negative';
    if (Number(formData.pieces_per_unit) <= 0) errors.pieces_per_unit = 'Pieces per unit must be at least 1';

    // Duplicate SKU check
    if (formData.sku.trim()) {
      const skuNorm = formData.sku.trim().toUpperCase();
      const dup = products.find(p => p.sku && p.sku.toUpperCase() === skuNorm);
      if (dup) errors.sku = `Product code / SKU '${skuNorm}' is already taken.`;
    }

    // Duplicate Barcode check
    if (formData.barcode.trim()) {
      const barNorm = formData.barcode.trim();
      const dup = products.find(p => p.barcode === barNorm);
      if (dup) errors.barcode = `Barcode '${barNorm}' is already registered.`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // When category changes, update both category_id and category name
      if (field === 'category') {
        const foundCat = categories.find(c => c.name === value || String(c.id) === String(value));
        if (foundCat) {
          updated.category_id = foundCat.id;
          updated.category = foundCat.name;
        }
      }

      // Auto-generate display name if empty
      if (field === 'name' && (!prev.display_name || prev.display_name === prev.name)) {
        updated.display_name = value;
      }

      // Auto-recalculate piece price when unit price or pieces/unit changes
      if (field === 'unit_selling_price' || field === 'pieces_per_unit') {
        const uPrice = field === 'unit_selling_price' ? Number(value) : Number(prev.unit_selling_price);
        const pcs = field === 'pieces_per_unit' ? Math.max(1, Number(value)) : Math.max(1, Number(prev.pieces_per_unit));
        updated.piece_selling_price = parseFloat((uPrice / pcs).toFixed(2));
      }

      return updated;
    });

    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Inline Quick Add Category Handler
  const handleInlineQuickAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error("Category name is required");
      return;
    }

    const res = await addCategory({ name: newCatName.trim(), description: newCatDesc.trim() });
    if (res.success) {
      toast.success(`🎉 Category '${res.category.name}' created and selected!`);
      setFormData(prev => ({
        ...prev,
        category_id: res.category.id,
        category: res.category.name
      }));
      setNewCatName('');
      setNewCatDesc('');
      setIsQuickAddCategoryOpen(false);
    } else {
      toast.error(res.message);
    }
  };

  // 512x512 Canvas Image Upload Handler
  const handleImageFileUpload = async (e, isEditModal = false) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const normalizedDataUrl = await normalizeProductImage(file, 512);
      if (isEditModal && selectedProduct) {
        setSelectedProduct(prev => ({ ...prev, image: normalizedDataUrl }));
      } else {
        setFormData(prev => ({ ...prev, image: normalizedDataUrl }));
      }
      toast.success("✨ Product image normalized to master 512×512 1:1 canvas!");
    } catch (err) {
      toast.error(`Image Error: ${err.message}`);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please correct the form errors before saving.");
      return;
    }

    if (addProduct) {
      const res = await addProduct(formData);
      if (res.success) {
        toast.success(`🎉 Product '${res.product.display_name}' created successfully under '${res.product.category}'!`);
        setActiveTab('list');
        // Reset form
        setFormData({
          name: '',
          display_name: '',
          sku: '',
          barcode: '',
          category_id: activeCategories[0]?.id || 1,
          category: activeCategories[0]?.name || 'Dairy',
          base_unit: 'Piece',
          selling_unit: 'Tray',
          pieces_per_unit: 20,
          purchase_price: 700,
          unit_selling_price: 880,
          piece_selling_price: 44,
          warehouse_stock_units: 50,
          min_stock_level: 10,
          is_active: 1,
          image: '',
          icon: '🥛'
        });
      } else {
        toast.error(`Failed to create product: ${res.message}`);
      }
    }
  };

  const handleToggleStatus = async (product) => {
    const currentActive = product.is_active !== undefined ? Boolean(product.is_active) : true;
    const newStatus = currentActive ? 0 : 1;

    if (toggleProductStatus) {
      const res = await toggleProductStatus(product.id, newStatus);
      if (res.success) {
        toast.success(`Product '${product.display_name}' ${newStatus ? 'Activated 🟢' : 'Deactivated 🔴'}`);
      } else {
        toast.error(`Status update failed: ${res.message}`);
      }
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (updateProduct) {
      const res = await updateProduct(selectedProduct.id, selectedProduct);
      if (res.success) {
        toast.success(`Product '${res.product.display_name}' updated successfully!`);
        setSelectedProduct(null);
        setIsEditing(false);
      } else {
        toast.error(`Update failed: ${res.message}`);
      }
    }
  };

  return (
    <div className="space-y-5 pb-6">
      
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                PRODUCTS & RATES MASTER
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  {metrics.total} Product Variants
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Manage Products, Category Master, SKU/Barcodes, 512×512 Images, Rates, and Status</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-2">
          {activeTab !== 'add' ? (
            <button
              onClick={() => setActiveTab('add')}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md border border-emerald-400/30 transition"
            >
              <Plus className="w-4 h-4" /> + ADD NEW PRODUCT
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('list')}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-2 border border-white/20 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Products List
            </button>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-blue-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Total Products</span>
          <div className="font-mono font-black text-2xl text-slate-900 mt-1.5">
            {metrics.total} <span className="text-xs text-slate-500 font-bold">Items</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Active Products</span>
          <div className="font-mono font-black text-2xl text-emerald-600 mt-1.5">
            {metrics.activeCount} <span className="text-xs text-emerald-700 font-bold">Live</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Low Stock Alert</span>
          <div className="font-mono font-black text-2xl text-amber-600 mt-1.5">
            {metrics.lowStockCount} <span className="text-xs text-amber-700 font-bold">Below Min</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-purple-500 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-tight block">Category Master</span>
          <div className="font-mono font-black text-2xl text-purple-600 mt-1.5">
            {metrics.categoryCount} <span className="text-xs text-purple-700 font-bold">Master Categories</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === 'list'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4 text-blue-400" /> All Products List ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === 'add'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Plus className="w-4 h-4 text-emerald-300" /> + Add New Product
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === 'categories'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers3 className="w-4 h-4 text-indigo-300" /> Category Master 🏷️ ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === 'rates'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Tag className="w-4 h-4 text-purple-300" /> Product Rates Master
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: ALL PRODUCTS LIST */}
      {/* ==================================================================== */}
      {activeTab === 'list' && (
        <div className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          
          {/* Search & Dynamic Category Filters Toolbar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Name, SKU (e.g. MILK-200), Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Dynamic Category Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto max-w-full">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-lg font-extrabold transition whitespace-nowrap ${
                    selectedCategory === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1 rounded-lg font-extrabold transition whitespace-nowrap ${
                      selectedCategory === cat.name ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-extrabold ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-2.5 py-1 rounded-lg font-extrabold ${statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'}`}
                >
                  🟢 Active
                </button>
                <button
                  onClick={() => setStatusFilter('INACTIVE')}
                  className={`px-2.5 py-1 rounded-lg font-extrabold ${statusFilter === 'INACTIVE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'}`}
                >
                  🔴 Inactive
                </button>
              </div>
            </div>
          </div>

          {/* Products Table Grid */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-200 font-extrabold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Product & Image (48x48)</th>
                  <th className="p-3.5">SKU / Code</th>
                  <th className="p-3.5">Barcode</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Packaging & Ratio</th>
                  <th className="p-3.5 text-right">Purchase Rate</th>
                  <th className="p-3.5 text-right">Selling Rate</th>
                  <th className="p-3.5 text-center">Current Stock</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 font-medium text-slate-700 bg-white">
                {filteredProducts.map(product => {
                  const isActive = product.is_active !== undefined ? Boolean(product.is_active) : true;
                  const isLowStock = (product.warehouse_stock_units || 0) <= (product.min_stock_level || 10);

                  return (
                    <tr key={product.id} className={`hover:bg-slate-50 transition ${!isActive ? 'opacity-60 bg-slate-50/50' : ''}`}>
                      
                      {/* Product Name & Standardized 48x48 ProductImage */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <ProductImage
                            src={product.image}
                            alt={product.display_name}
                            size={48}
                            icon={product.icon}
                          />
                          <div>
                            <span className="font-black text-slate-900 block leading-tight">{product.display_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID #{product.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-3.5 font-mono font-black text-slate-900">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                          {product.sku || `PROD-${product.id}`}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-600">
                        {product.barcode || '—'}
                      </td>

                      {/* Category Badge */}
                      <td className="p-3.5 font-extrabold text-slate-800">
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-800 rounded-full border border-indigo-200 font-bold">
                          {product.category || 'General'}
                        </span>
                      </td>

                      {/* Packaging & Ratio */}
                      <td className="p-3.5 font-mono text-[11px]">
                        <span className="font-bold text-slate-900">1 {product.selling_unit || 'Tray'}</span>
                        <span className="text-slate-400 block text-[10px]">= {product.pieces_per_unit || 20} {product.base_unit || 'Pcs'}</span>
                      </td>

                      {/* Purchase Rate */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-600">
                        ₹{Number(product.purchase_price || 0).toLocaleString()}
                      </td>

                      {/* Selling Rate */}
                      <td className="p-3.5 text-right font-mono">
                        <span className="font-black text-emerald-700 block">₹{Number(product.unit_selling_price || 0).toLocaleString()} / {product.selling_unit}</span>
                        <span className="text-[10px] text-slate-500 font-bold block">₹{Number(product.piece_selling_price || 0).toLocaleString()} / Pc</span>
                      </td>

                      {/* Warehouse Stock */}
                      <td className="p-3.5 text-center font-mono">
                        <span className={`font-black text-sm px-2.5 py-0.5 rounded-xl border ${
                          isLowStock 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}>
                          {product.warehouse_stock_units || 0} {product.selling_unit}
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
                            onClick={() => { setSelectedProduct(product); setIsEditing(false); }}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                          </button>
                          
                          <button
                            onClick={() => { setSelectedProduct(product); setIsEditing(true); }}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(product)}
                            className={`p-1.5 rounded-xl transition ${isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                            title={isActive ? 'Deactivate Product' : 'Activate Product'}
                          >
                            <Power className="w-3.5 h-3.5" />
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
      )}

      {/* ==================================================================== */}
      {/* TAB 2: + ADD PRODUCT FORM WITH DYNAMIC CATEGORY MASTER + INLINE ADD */}
      {/* ==================================================================== */}
      {activeTab === 'add' && (
        <form onSubmit={handleCreateProduct} className="glass-panel p-6 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-sm">
          
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                Add New Product Master (புதிய பொருள் சேர்த்தல்)
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Register new product specifications, Category Master, SKU/Barcode, pricing, and stock ratio</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="text-xs text-slate-500 font-extrabold hover:text-slate-900"
            >
              Cancel & Return
            </button>
          </div>

          {/* SECTION A: BASIC INFORMATION & 512x512 IMAGE UPLOAD */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              SECTION A — BASIC INFORMATION & 512×512 MASTER IMAGE
            </h4>

            {/* Master Image Normalization Canvas Upload Control */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
              <ProductImage
                src={formData.image}
                alt={formData.display_name || 'Upload Preview'}
                size={96}
                icon={formData.icon}
              />

              <div className="space-y-1.5 flex-1">
                <span className="font-extrabold text-xs text-slate-900 block flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  Product Master Photo (Auto-Normalizes to 512×512 WebP)
                </span>
                <p className="text-[11px] text-slate-500">
                  Upload JPG, PNG, or WebP (max 2 MB). The system automatically resizes and centers the product on a <strong>512×512 1:1 canvas</strong> with zero distortion!
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <label className={`px-3 py-1.5 rounded-xl text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition ${isProcessingImage ? 'bg-slate-400 pointer-events-none' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    <Upload className="w-3.5 h-3.5" />
                    {isProcessingImage ? 'Processing 512×512 Image...' : 'Choose Image File'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageFileUpload(e, false)}
                      className="hidden"
                    />
                  </label>
                  {formData.image && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Clear Image
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Product Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Badam Milk 200ml"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className={`w-full p-2.5 font-bold bg-white border rounded-xl focus:outline-none ${formErrors.name ? 'border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
                />
                {formErrors.name && <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formErrors.name}</span>}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Display Name (Receipt Name)</label>
                <input
                  type="text"
                  placeholder="e.g. Badam Milk - 200ml"
                  value={formData.display_name}
                  onChange={(e) => handleFormChange('display_name', e.target.value)}
                  className="w-full p-2.5 font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Product Code / SKU (Unique)</label>
                <input
                  type="text"
                  placeholder="e.g. BADAM-200"
                  value={formData.sku}
                  onChange={(e) => handleFormChange('sku', e.target.value)}
                  className={`w-full p-2.5 font-mono font-black uppercase bg-white border rounded-xl focus:outline-none ${formErrors.sku ? 'border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
                />
                {formErrors.sku && <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formErrors.sku}</span>}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Barcode (EAN / UPC - Unique)</label>
                <input
                  type="text"
                  placeholder="e.g. 8901234500999"
                  value={formData.barcode}
                  onChange={(e) => handleFormChange('barcode', e.target.value)}
                  className={`w-full p-2.5 font-mono font-bold bg-white border rounded-xl focus:outline-none ${formErrors.barcode ? 'border-rose-500' : 'border-slate-300 focus:border-blue-500'}`}
                />
                {formErrors.barcode && <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formErrors.barcode}</span>}
              </div>

              {/* DYNAMIC CATEGORY MASTER DROPDOWN + INLINE ADD ACTION */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-extrabold text-slate-700 block">
                    Category Master <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddCategoryOpen(true)}
                    className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Category
                  </button>
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  className={`w-full p-2.5 font-bold bg-white border rounded-xl focus:outline-none ${formErrors.category ? 'border-rose-500' : 'border-slate-300 focus:border-indigo-500'}`}
                >
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </select>
                {formErrors.category && <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formErrors.category}</span>}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Product Status</label>
                <select
                  value={formData.is_active}
                  onChange={(e) => handleFormChange('is_active', Number(e.target.value))}
                  className="w-full p-2.5 font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>🟢 Active (Available for Sales & POS)</option>
                  <option value={0}>🔴 Inactive (Hidden from New Sales)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION B: UNIT & PACKAGING */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <Layers3 className="w-4 h-4 text-indigo-600" />
              SECTION B — UNIT & PACKAGING RATIO
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Selling Unit (Bulk Box / Tray)</label>
                <select
                  value={formData.selling_unit}
                  onChange={(e) => handleFormChange('selling_unit', e.target.value)}
                  className="w-full p-2.5 font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  {SELLING_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Base Unit (Single Pc)</label>
                <select
                  value={formData.base_unit}
                  onChange={(e) => handleFormChange('base_unit', e.target.value)}
                  className="w-full p-2.5 font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  {BASE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Pieces per {formData.selling_unit} (Ratio)</label>
                <input
                  type="number"
                  value={formData.pieces_per_unit}
                  onChange={(e) => handleFormChange('pieces_per_unit', e.target.value)}
                  className={`w-full p-2.5 font-mono font-black bg-white border rounded-xl focus:outline-none ${formErrors.pieces_per_unit ? 'border-rose-500' : 'border-slate-300 focus:border-indigo-500'}`}
                />
                {formErrors.pieces_per_unit && <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">{formErrors.pieces_per_unit}</span>}
              </div>
            </div>
          </div>

          {/* SECTION C: PRICING MASTER */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              SECTION C — PRICING MASTER
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Tray Selling Price (₹ / {formData.selling_unit})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    value={formData.unit_selling_price}
                    onChange={(e) => handleFormChange('unit_selling_price', e.target.value)}
                    className="w-full pl-7 pr-3 p-2.5 font-mono font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Single Piece Rate (₹ / {formData.base_unit})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    value={formData.piece_selling_price}
                    onChange={(e) => handleFormChange('piece_selling_price', e.target.value)}
                    className="w-full pl-7 pr-3 p-2.5 font-mono font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Purchase Cost (COGS ₹ / {formData.selling_unit})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    value={formData.purchase_price}
                    onChange={(e) => handleFormChange('purchase_price', e.target.value)}
                    className="w-full pl-7 pr-3 p-2.5 font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs font-mono flex justify-between items-center">
              <span className="font-sans font-extrabold text-slate-800">Calculated Profit Margin:</span>
              <span className="font-black text-emerald-700 text-sm">
                +₹{formData.unit_selling_price - formData.purchase_price} / {formData.selling_unit}
              </span>
            </div>
          </div>

          {/* SECTION D: INVENTORY STOCK */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-600" />
              SECTION D — INVENTORY STOCK SETTINGS
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Opening Warehouse Stock ({formData.selling_unit})</label>
                <input
                  type="number"
                  value={formData.warehouse_stock_units}
                  onChange={(e) => handleFormChange('warehouse_stock_units', e.target.value)}
                  className="w-full p-2.5 font-mono font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Minimum Reorder Stock Level ({formData.selling_unit})</label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => handleFormChange('min_stock_level', e.target.value)}
                  className="w-full p-2.5 font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-300"
          >
            <Save className="w-4 h-4" /> SAVE & REGISTER PRODUCT
          </button>
        </form>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: CATEGORY MASTER VIEW */}
      {/* ==================================================================== */}
      {activeTab === 'categories' && (
        <AdminCategoriesMasterView />
      )}

      {/* ==================================================================== */}
      {/* TAB 4: PRODUCT RATES MASTER */}
      {/* ==================================================================== */}
      {activeTab === 'rates' && (
        <AdminProductRatesView />
      )}

      {/* INLINE QUICK ADD CATEGORY MODAL */}
      {isQuickAddCategoryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Quick Add Category Master
              </h4>
              <button onClick={() => setIsQuickAddCategoryOpen(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInlineQuickAddCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ice Cream, Flavoured Milk"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dairy desserts"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full p-2.5 font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs"
                >
                  Save & Select
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickAddCategoryOpen(false)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT DETAILS / EDIT MODAL WITH DYNAMIC CATEGORY MASTER */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <ProductImage
                  src={selectedProduct.image}
                  alt={selectedProduct.display_name}
                  size={96}
                  icon={selectedProduct.icon}
                />
                <div>
                  <h3 className="font-black text-base text-slate-900">{selectedProduct.display_name}</h3>
                  <span className="text-[10px] text-slate-500 font-mono">SKU: {selectedProduct.sku || `PROD-${selectedProduct.id}`}</span>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {!isEditing ? (
              // READ-ONLY PRODUCT DETAILS VIEW
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 font-mono">
                  <div>
                    <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Category Master</span>
                    <span className="font-black text-indigo-700">{selectedProduct.category || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Barcode</span>
                    <span className="font-black text-slate-900">{selectedProduct.barcode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Selling Unit Ratio</span>
                    <span className="font-black text-slate-900">1 {selectedProduct.selling_unit} = {selectedProduct.pieces_per_unit} Pcs</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Warehouse Stock</span>
                    <span className="font-black text-emerald-600">{selectedProduct.warehouse_stock_units} {selectedProduct.selling_unit}</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans font-bold">Tray Selling Rate:</span>
                    <span className="font-black text-emerald-800 text-sm">₹{selectedProduct.unit_selling_price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans font-bold">Single Piece Rate:</span>
                    <span className="font-black text-emerald-800">₹{selectedProduct.piece_selling_price}</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200/60 pt-1">
                    <span className="text-slate-600 font-sans font-bold">Purchase Cost (COGS):</span>
                    <span className="font-black text-slate-800">₹{selectedProduct.purchase_price}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Specifications
                  </button>

                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              // EDIT PRODUCT SPECS FORM WITH DYNAMIC CATEGORY MASTER
              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={selectedProduct.display_name}
                    onChange={(e) => setSelectedProduct({ ...selectedProduct, display_name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Category Master</label>
                  <select
                    value={selectedProduct.category}
                    onChange={(e) => {
                      const selCat = categories.find(c => c.name === e.target.value);
                      setSelectedProduct({
                        ...selectedProduct,
                        category: e.target.value,
                        category_id: selCat ? selCat.id : selectedProduct.category_id
                      });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* 512x512 MASTER IMAGE NORMALIZATION UPLOAD CONTROL */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Update Master Product Photo (512×512 WebP)
                  </span>

                  <div className="flex items-center gap-3">
                    <ProductImage
                      src={selectedProduct.image}
                      alt={selectedProduct.display_name}
                      size={64}
                      icon={selectedProduct.icon}
                    />

                    <div className="flex-1 space-y-1">
                      <label className={`px-3 py-1.5 rounded-xl text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition w-max ${isProcessingImage ? 'bg-slate-400 pointer-events-none' : 'bg-blue-600 hover:bg-blue-500'}`}>
                        <Upload className="w-3.5 h-3.5" />
                        {isProcessingImage ? 'Processing 512×512 Image...' : 'Choose New Image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleImageFileUpload(e, true)}
                          className="hidden"
                        />
                      </label>

                      {selectedProduct.image && (
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(prev => ({ ...prev, image: '' }))}
                          className="text-[11px] font-bold text-rose-600 hover:underline block"
                        >
                          Reset / Clear Image
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">SKU Code</label>
                    <input
                      type="text"
                      value={selectedProduct.sku}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, sku: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Barcode</label>
                    <input
                      type="text"
                      value={selectedProduct.barcode || ''}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, barcode: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Tray Selling Price (₹)</label>
                    <input
                      type="number"
                      value={selectedProduct.unit_selling_price}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, unit_selling_price: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-extrabold text-slate-700 block mb-1">Purchase Cost (COGS ₹)</label>
                    <input
                      type="number"
                      value={selectedProduct.purchase_price}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, purchase_price: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
