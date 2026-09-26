import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Snowflake, Plus, Store, X, Save, Search, Filter, 
  Trash2, Edit3, CheckCircle2, AlertTriangle, Layers, 
  Sparkles, RefreshCw, Boxes, ArrowRight, ArrowLeft, Tag, ShieldAlert, Undo2, MapPin, ChevronDown, Check, PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';

const POPULAR_BRANDS = ['Blue Star', 'Voltas', 'Western', 'Godrej', 'Haier', 'Rockwell', 'Panasonic'];
const POPULAR_CAPACITIES = ['100L', '150L', '200L', '250L', '300L', '320L', '350L', '400L', '500L'];
const FREEZER_TYPES = ['Deep Freezer', 'Visicooler', 'Chest Freezer', 'Double Door Cooler', 'Display Cooler'];

const DEFAULT_FREEZER_MODELS = [
  { id: 'df-1', brand: 'Blue Star', capacity: '100L', model_name: 'Blue Star 100L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-2', brand: 'Blue Star', capacity: '200L', model_name: 'Blue Star 200L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-3', brand: 'Blue Star', capacity: '300L', model_name: 'Blue Star 300L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-4', brand: 'Blue Star', capacity: '400L', model_name: 'Blue Star 400L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-5', brand: 'Blue Star', capacity: '500L', model_name: 'Blue Star 500L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-6', brand: 'Voltas', capacity: '100L', model_name: 'Voltas 100L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-7', brand: 'Voltas', capacity: '200L', model_name: 'Voltas 200L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-8', brand: 'Voltas', capacity: '300L', model_name: 'Voltas 300L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-9', brand: 'Voltas', capacity: '400L', model_name: 'Voltas 400L Double Door Cooler', freezer_type: 'Double Door Cooler' },
  { id: 'df-10', brand: 'Voltas', capacity: '500L', model_name: 'Voltas 500L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-11', brand: 'Western', capacity: '200L', model_name: 'Western 200L Visicooler', freezer_type: 'Visicooler' },
  { id: 'df-12', brand: 'Western', capacity: '300L', model_name: 'Western 300L Visicooler', freezer_type: 'Visicooler' },
  { id: 'df-13', brand: 'Western', capacity: '400L', model_name: 'Western 400L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-14', brand: 'Godrej', capacity: '100L', model_name: 'Godrej 100L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-15', brand: 'Godrej', capacity: '200L', model_name: 'Godrej 200L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-16', brand: 'Godrej', capacity: '300L', model_name: 'Godrej 300L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-17', brand: 'Godrej', capacity: '400L', model_name: 'Godrej 400L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-18', brand: 'Haier', capacity: '200L', model_name: 'Haier 200L Visicooler', freezer_type: 'Visicooler' },
  { id: 'df-19', brand: 'Haier', capacity: '300L', model_name: 'Haier 300L Chest Freezer', freezer_type: 'Chest Freezer' },
  { id: 'df-20', brand: 'Haier', capacity: '320L', model_name: 'Haier 320L Visicooler', freezer_type: 'Visicooler' },
  { id: 'df-21', brand: 'Haier', capacity: '400L', model_name: 'Haier 400L Visicooler', freezer_type: 'Visicooler' },
  { id: 'df-22', brand: 'Rockwell', capacity: '250L', model_name: 'Rockwell 250L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-23', brand: 'Rockwell', capacity: '350L', model_name: 'Rockwell 350L Deep Freezer', freezer_type: 'Deep Freezer' },
  { id: 'df-24', brand: 'Panasonic', capacity: '300L', model_name: 'Panasonic 300L Visicooler', freezer_type: 'Visicooler' }
];

export const FreezerManagement = () => {
  const { 
    shops = [], 
    villages = [],
    freezers = [],
    assignFreezer, 
    updateFreezer,
    unassignFreezer, 
    freezerModels = [], 
    addFreezerModel, 
    deleteFreezerModel 
  } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [selectedVillage, setSelectedVillage] = useState(null);

  // Modals State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingFreezer, setEditingFreezer] = useState(null); // null when creating new, or freezer object when editing
  const [showCreateModelModal, setShowCreateModelModal] = useState(false);
  const [showManageModelsModal, setShowManageModelsModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, freezer: null, shop: null });

  // Assign / Edit Form State
  const [selectedShopId, setSelectedShopId] = useState('');
  const [modalVillageFilter, setModalVillageFilter] = useState('ALL');
  const [villageSearchText, setVillageSearchText] = useState('');
  const [isVillageDropdownOpen, setIsVillageDropdownOpen] = useState(false);

  const [shopSearchText, setShopSearchText] = useState('');
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState('Blue Star');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('Blue Star 300L Deep Freezer');
  const [serial, setSerial] = useState('');
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().split('T')[0]);
  const [freezerStatus, setFreezerStatus] = useState('Active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Create Model Form State
  const [newModelBrand, setNewModelBrand] = useState('Blue Star');
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [newModelCapacity, setNewModelCapacity] = useState('300L');
  const [customCapacityInput, setCustomCapacityInput] = useState('');
  const [newModelType, setNewModelType] = useState('Deep Freezer');
  const [newModelDisplayName, setNewModelDisplayName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [creatingModel, setCreatingModel] = useState(false);

  // Combined master models list (defaults + user created)
  const allAvailableModels = useMemo(() => {
    const map = new Map();
    DEFAULT_FREEZER_MODELS.forEach(m => map.set(m.model_name.toLowerCase().trim(), m));
    if (Array.isArray(freezerModels)) {
      freezerModels.forEach(m => {
        if (m && m.model_name) {
          map.set(m.model_name.toLowerCase().trim(), m);
        }
      });
    }
    return Array.from(map.values());
  }, [freezerModels]);

  // Grouped and sorted available brands
  const availableBrands = useMemo(() => {
    const brandsSet = new Set(POPULAR_BRANDS);
    allAvailableModels.forEach(m => {
      if (m.brand) brandsSet.add(m.brand);
    });
    return Array.from(brandsSet);
  }, [allAvailableModels]);

  // Models filtered by selected brand in the assign modal
  const filteredBrandModels = useMemo(() => {
    if (!selectedBrand || selectedBrand === 'ALL') {
      return allAvailableModels;
    }
    const list = allAvailableModels.filter(m => 
      (m.brand || '').toLowerCase().trim() === selectedBrand.toLowerCase().trim()
    );
    if (list.length === 0) {
      return POPULAR_CAPACITIES.map((cap, idx) => ({
        id: `auto-${selectedBrand}-${idx}`,
        brand: selectedBrand,
        capacity: cap,
        model_name: `${selectedBrand} ${cap} Deep Freezer`,
        freezer_type: 'Deep Freezer'
      }));
    }
    return list;
  }, [allAvailableModels, selectedBrand]);

  // Keep auto-generated display name updated when creating new model
  useEffect(() => {
    const b = newModelBrand === 'Other' ? (customBrandInput.trim() || 'Brand') : newModelBrand;
    const c = newModelCapacity === 'Other' ? (customCapacityInput.trim() || '') : newModelCapacity;
    const generated = `${b} ${c} ${newModelType}`.replace(/\s+/g, ' ').trim();
    setNewModelDisplayName(generated);
  }, [newModelBrand, customBrandInput, newModelCapacity, customCapacityInput, newModelType]);

  // Build Comprehensive List of All Freezers (merging shop_freezers table and fallback from shops table)
  const allFreezersList = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    if (Array.isArray(freezers)) {
      freezers.forEach(f => {
        if (f && f.id) {
          seenIds.add(String(f.id));
          list.push(f);
        }
      });
    }

    // Fallback: If any shop has has_freezer and not in shop_freezers, add it
    shops.forEach(s => {
      if (s.has_freezer && s.freezer_model) {
        const alreadyExists = list.some(f => String(f.shop_id) === String(s.id));
        if (!alreadyExists) {
          list.push({
            id: `legacy-${s.id}`,
            shop_id: s.id,
            shop_name: s.name,
            shop_code: s.code,
            owner_name: s.owner_name,
            phone: s.phone,
            village_id: s.village_id,
            village_name: s.village_name,
            model_name: s.freezer_model,
            serial_no: s.freezer_serial || `FRZ-${s.code || s.id}`,
            allocation_date: s.freezer_date || 'N/A',
            status: s.freezer_status || 'Active',
            notes: ''
          });
        }
      }
    });

    return list;
  }, [freezers, shops]);

  // Map of shopId -> array of Freezers
  const shopFreezersMap = useMemo(() => {
    const map = new Map();
    allFreezersList.forEach(f => {
      const key = String(f.shop_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    });
    return map;
  }, [allFreezersList]);

  // Auto-generate serial when shop or model changes
  const generateSerial = (shopIdVal, modelNameVal) => {
    const s = shops.find(item => String(item.id) === String(shopIdVal));
    const cleanShopCode = s?.code ? s.code.replace(/[^A-Za-z0-9]/g, '') : 'SHOP';
    const cleanModel = (modelNameVal || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'FRZ';
    const rand = Math.floor(100 + Math.random() * 900);
    return `FRZ-${cleanShopCode}-${cleanModel}-${rand}`;
  };

  // Active villages for village selector
  const activeVillages = useMemo(() => {
    return (villages || []).filter(v => v.status === 'ACTIVE' || v.is_active !== false);
  }, [villages]);

  const villageMap = useMemo(() => {
    const map = new Map();
    (villages || []).forEach(v => {
      map.set(String(v.id), v.name);
      if (v.name) map.set(v.name.toLowerCase().trim(), v.name);
    });
    return map;
  }, [villages]);

  const getShopVillageName = (shop) => {
    if (!shop) return 'Salem Area';
    if (shop.village_name) return shop.village_name;
    if (shop.village_id && villageMap.has(String(shop.village_id))) {
      return villageMap.get(String(shop.village_id));
    }
    return 'Salem Area';
  };

  // Group all shops and freezers by Village
  const villageFreezerGroups = useMemo(() => {
    const groupMap = new Map();

    // 1. Seed with known active villages
    (villages || []).forEach(v => {
      const key = String(v.id || v.name).toLowerCase().trim();
      groupMap.set(key, {
        id: v.id,
        name: v.name,
        code: v.code || '',
        shops: [],
        freezerShops: [],
        noFreezerShops: [],
        allFreezers: [],
        brands: new Set()
      });
    });

    // 2. Put shops & their freezers into respective villages
    (shops || []).forEach(s => {
      let matchedKey = null;
      if (s.village_id && groupMap.has(String(s.village_id).toLowerCase().trim())) {
        matchedKey = String(s.village_id).toLowerCase().trim();
      } else if (s.village_name) {
        const byNameKey = s.village_name.toLowerCase().trim();
        for (const [k, g] of groupMap.entries()) {
          if (g.name.toLowerCase().trim() === byNameKey) {
            matchedKey = k;
            break;
          }
        }
      }

      if (!matchedKey) {
        const fallbackName = s.village_name || 'Salem Area';
        matchedKey = fallbackName.toLowerCase().trim();
        if (!groupMap.has(matchedKey)) {
          groupMap.set(matchedKey, {
            id: s.village_id || matchedKey,
            name: fallbackName,
            code: 'AREA',
            shops: [],
            freezerShops: [],
            noFreezerShops: [],
            allFreezers: [],
            brands: new Set()
          });
        }
      }

      const group = groupMap.get(matchedKey);
      group.shops.push(s);

      const sFreezers = shopFreezersMap.get(String(s.id)) || [];
      if (sFreezers.length > 0 || s.has_freezer) {
        group.freezerShops.push(s);
        sFreezers.forEach(f => {
          group.allFreezers.push(f);
          if (f.model_name) {
            const matchedBrand = availableBrands.find(b => f.model_name.toLowerCase().includes(b.toLowerCase()));
            if (matchedBrand) group.brands.add(matchedBrand);
          }
        });
        if (sFreezers.length === 0 && s.freezer_model) {
          const matchedBrand = availableBrands.find(b => s.freezer_model.toLowerCase().includes(b.toLowerCase()));
          if (matchedBrand) group.brands.add(matchedBrand);
        }
      } else {
        group.noFreezerShops.push(s);
      }
    });

    return Array.from(groupMap.values()).filter(g => g.shops.length > 0 || g.freezerShops.length > 0);
  }, [villages, shops, shopFreezersMap, availableBrands]);

  // Filtered village groups for Level 1 (Default View)
  const filteredVillageGroups = useMemo(() => {
    return villageFreezerGroups.filter(vg => {
      // Brand filter
      if (brandFilter !== 'ALL') {
        const hasBrand = Array.from(vg.brands).some(b => b.toLowerCase() === brandFilter.toLowerCase()) ||
          vg.allFreezers.some(f => (f.model_name || '').toLowerCase().includes(brandFilter.toLowerCase()));
        if (!hasBrand) return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesVillage = (vg.name && vg.name.toLowerCase().includes(q)) ||
          (vg.code && vg.code.toLowerCase().includes(q));
        const matchesShopInside = vg.shops.some(s => 
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q))
        );
        const matchesFreezerInside = vg.allFreezers.some(f => 
          (f.model_name && f.model_name.toLowerCase().includes(q)) ||
          (f.serial_no && f.serial_no.toLowerCase().includes(q))
        );
        return matchesVillage || matchesShopInside || matchesFreezerInside;
      }
      return true;
    });
  }, [villageFreezerGroups, brandFilter, searchQuery]);

  // Active village group when Level 2 is opened
  const activeVillageGroup = useMemo(() => {
    if (!selectedVillage) return null;
    return villageFreezerGroups.find(vg => 
      String(vg.id) === String(selectedVillage.id || selectedVillage) ||
      vg.name.toLowerCase().trim() === String(selectedVillage.name || selectedVillage).toLowerCase().trim()
    ) || selectedVillage;
  }, [selectedVillage, villageFreezerGroups]);

  // Level 2: Shops inside selected village with freezers
  const activeVillageFreezerShops = useMemo(() => {
    if (!activeVillageGroup) return [];
    return (activeVillageGroup.freezerShops || []).filter(s => {
      const sFreezers = shopFreezersMap.get(String(s.id)) || [];
      if (brandFilter !== 'ALL') {
        const hasBrandInFreezers = sFreezers.some(f => (f.model_name || '').toLowerCase().includes(brandFilter.toLowerCase()));
        const hasBrandInShop = (s.freezer_model || '').toLowerCase().includes(brandFilter.toLowerCase());
        if (!hasBrandInFreezers && !hasBrandInShop) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesShop = (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q));
        const matchesFreezers = sFreezers.some(f => 
          (f.model_name && f.model_name.toLowerCase().includes(q)) ||
          (f.serial_no && f.serial_no.toLowerCase().includes(q))
        );
        return matchesShop || matchesFreezers;
      }
      return true;
    });
  }, [activeVillageGroup, shopFreezersMap, brandFilter, searchQuery]);

  const activeVillageNoFreezerShops = useMemo(() => {
    if (!activeVillageGroup) return [];
    return (activeVillageGroup.noFreezerShops || []).filter(s => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [activeVillageGroup, searchQuery]);

  // Filtered villages based on what user types in village input
  const filteredVillageOptions = useMemo(() => {
    const q = villageSearchText.toLowerCase().trim();
    if (!q) return activeVillages;
    return activeVillages.filter(v => 
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.code && v.code.toLowerCase().includes(q))
    );
  }, [activeVillages, villageSearchText]);

  // Shops filtered for Assign Modal by selected village and shop search query
  const modalFilteredShops = useMemo(() => {
    return shops.filter(s => {
      // 1. Filter by selected village if not 'ALL'
      if (modalVillageFilter !== 'ALL') {
        const vMatch = String(s.village_id) === String(modalVillageFilter) ||
          (s.village_name && s.village_name.toLowerCase().trim() === modalVillageFilter.toLowerCase().trim());
        if (!vMatch) return false;
      }
      // 2. Filter by typed text in shop search
      if (shopSearchText.trim()) {
        const q = shopSearchText.toLowerCase().trim();
        const matches = (s.name && s.name.toLowerCase().includes(q)) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.owner_name && s.owner_name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [shops, modalVillageFilter, shopSearchText]);

  const handleSelectVillage = (villageId, villageName = '') => {
    setModalVillageFilter(villageId);
    setVillageSearchText(villageId === 'ALL' ? '' : villageName);
    setIsVillageDropdownOpen(false);

    // Auto update selected shop under the chosen village
    const eligibleShops = shops.filter(s => {
      if (villageId === 'ALL') return true;
      return String(s.village_id) === String(villageId) ||
        (s.village_name && s.village_name.toLowerCase().trim() === villageName.toLowerCase().trim());
    });

    if (eligibleShops.length > 0) {
      const isCurrentInList = eligibleShops.some(s => String(s.id) === String(selectedShopId));
      if (!isCurrentInList) {
        handleShopChangeInModal(eligibleShops[0].id);
      }
    }
  };

  const handleSelectShop = (shop) => {
    handleShopChangeInModal(shop.id);
    setShopSearchText(`${shop.name} (${shop.code})`);
    setIsShopDropdownOpen(false);
  };

  // Open Assign Modal (To assign a new freezer or an additional freezer to any shop)
  const handleOpenAssignModal = (shopId = '') => {
    setEditingFreezer(null); // Adding fresh freezer asset
    const targetShopId = shopId || (shops[0]?.id || '');
    setSelectedShopId(targetShopId);

    const targetShop = shops.find(s => String(s.id) === String(targetShopId));

    if (targetShop) {
      setShopSearchText(`${targetShop.name} (${targetShop.code})`);
      if (targetShop.village_id) {
        const vName = getShopVillageName(targetShop);
        setModalVillageFilter(String(targetShop.village_id));
        setVillageSearchText(vName !== 'Salem Area' ? vName : '');
      } else {
        setModalVillageFilter('ALL');
        setVillageSearchText('');
      }
    } else {
      setShopSearchText('');
      setModalVillageFilter('ALL');
      setVillageSearchText('');
    }

    setIsVillageDropdownOpen(false);
    setIsShopDropdownOpen(false);

    const initialBrand = availableBrands[0] || 'Blue Star';
    setSelectedBrand(initialBrand);
    const brandList = allAvailableModels.filter(m => (m.brand || '').toLowerCase() === initialBrand.toLowerCase());
    const initialModel = brandList[0] || allAvailableModels[0];
    const modelName = initialModel?.model_name || `${initialBrand} 300L Deep Freezer`;
    setSelectedModelId(initialModel?.id || '');
    setCustomModelName(modelName);
    setSerial(generateSerial(targetShopId, modelName));
    setAllocationDate(new Date().toISOString().split('T')[0]);
    setFreezerStatus('Active');
    setNotes('');

    setShowAssignModal(true);
  };

  // Open Edit Modal for a SPECIFIC freezer asset
  const handleOpenEditModal = (freezer, shop) => {
    setEditingFreezer(freezer);
    const targetShopId = freezer.shop_id || shop?.id;
    setSelectedShopId(targetShopId);

    const targetShop = shop || shops.find(s => String(s.id) === String(targetShopId));
    if (targetShop) {
      setShopSearchText(`${targetShop.name} (${targetShop.code})`);
      if (targetShop.village_id) {
        const vName = getShopVillageName(targetShop);
        setModalVillageFilter(String(targetShop.village_id));
        setVillageSearchText(vName !== 'Salem Area' ? vName : '');
      }
    }

    const modelName = freezer.model_name || freezer.freezer_model || 'Deep Freezer';
    setCustomModelName(modelName);
    setSerial(freezer.serial_no || freezer.freezer_serial || '');
    setAllocationDate(freezer.allocation_date || freezer.freezer_date || new Date().toISOString().split('T')[0]);
    setFreezerStatus(freezer.status || freezer.freezer_status || 'Active');
    setNotes(freezer.notes || '');

    // Match brand
    const matchedBrand = availableBrands.find(b => modelName.toLowerCase().includes(b.toLowerCase())) || 'Blue Star';
    setSelectedBrand(matchedBrand);
    const brandList = allAvailableModels.filter(m => (m.brand || '').toLowerCase() === matchedBrand.toLowerCase());
    const matchedModelObj = brandList.find(m => m.model_name.toLowerCase() === modelName.toLowerCase()) || brandList[0];
    setSelectedModelId(matchedModelObj?.id || '');

    setShowAssignModal(true);
  };

  // Handle target shop selection change inside modal
  const handleShopChangeInModal = (newShopId) => {
    setSelectedShopId(newShopId);
    const targetShop = shops.find(s => String(s.id) === String(newShopId));
    if (targetShop) {
      setShopSearchText(`${targetShop.name} (${targetShop.code})`);
      if (!editingFreezer) {
        setSerial(generateSerial(newShopId, customModelName));
      }
    }
  };

  // Handle brand change in assign modal
  const handleBrandChangeInAssign = (brand) => {
    setSelectedBrand(brand);
    const modelsForBrand = allAvailableModels.filter(m => (m.brand || '').toLowerCase().trim() === brand.toLowerCase().trim());
    if (modelsForBrand.length > 0) {
      const first = modelsForBrand[0];
      setSelectedModelId(first.id);
      setCustomModelName(first.model_name);
      if (!editingFreezer) {
        setSerial(generateSerial(selectedShopId, first.model_name));
      }
    } else {
      setSelectedModelId('');
      const fallbackName = `${brand} 300L Deep Freezer`;
      setCustomModelName(fallbackName);
      if (!editingFreezer) {
        setSerial(generateSerial(selectedShopId, fallbackName));
      }
    }
  };

  // Handle model selection in assign modal
  const handleModelChangeInAssign = (modelId) => {
    setSelectedModelId(modelId);
    const found = allAvailableModels.find(m => String(m.id) === String(modelId));
    if (found) {
      setCustomModelName(found.model_name);
      if (!editingFreezer) {
        setSerial(generateSerial(selectedShopId, found.model_name));
      }
    }
  };

  // Handle save freezer (both new assignment and editing existing asset)
  const handleSaveFreezer = async () => {
    if (!selectedShopId) {
      toast.error("Please select a target shop!");
      return;
    }

    const finalModel = customModelName.trim() || `${selectedBrand} 300L Deep Freezer`;
    const finalSerial = serial.trim() || generateSerial(selectedShopId, finalModel);

    setSaving(true);
    let res;

    if (editingFreezer && editingFreezer.id && !String(editingFreezer.id).startsWith('legacy-')) {
      // Update existing freezer asset
      res = await updateFreezer(editingFreezer.id, {
        shop_id: selectedShopId,
        model_name: finalModel,
        freezer_model: finalModel,
        serial_no: finalSerial,
        freezer_serial: finalSerial,
        allocation_date: allocationDate || new Date().toISOString().split('T')[0],
        freezer_date: allocationDate || new Date().toISOString().split('T')[0],
        status: freezerStatus || 'Active',
        freezer_status: freezerStatus || 'Active',
        notes: notes || null
      });
    } else {
      // Assign new freezer asset (can be 1st, 2nd, 3rd, etc.)
      res = await assignFreezer(selectedShopId, {
        model: finalModel,
        freezer_model: finalModel,
        model_name: finalModel,
        serial: finalSerial,
        freezer_serial: finalSerial,
        serial_no: finalSerial,
        date: allocationDate || new Date().toISOString().split('T')[0],
        freezer_date: allocationDate || new Date().toISOString().split('T')[0],
        allocation_date: allocationDate || new Date().toISOString().split('T')[0],
        status: freezerStatus || 'Active',
        freezer_status: freezerStatus || 'Active',
        notes: notes || null
      });
    }
    setSaving(false);

    if (res.success) {
      toast.success(editingFreezer ? `🎉 Freezer asset '${finalModel}' updated successfully!` : `🎉 Freezer '${finalModel}' assigned to shop!`);
      setShowAssignModal(false);
      setEditingFreezer(null);
    } else {
      toast.error("Error saving freezer: " + (res.message || "Failed to save"));
    }
  };

  // Handle create new model
  const handleCreateNewModel = async (e) => {
    e.preventDefault();
    const brand = newModelBrand === 'Other' ? customBrandInput.trim() : newModelBrand.trim();
    const capacity = newModelCapacity === 'Other' ? customCapacityInput.trim() : newModelCapacity.trim();
    const modelName = newModelDisplayName.trim() || `${brand} ${capacity} ${newModelType}`.trim();

    if (!brand) {
      toast.error("Please enter or select a brand name");
      return;
    }
    if (!capacity) {
      toast.error("Please enter or select a capacity (e.g. 300L)");
      return;
    }

    setCreatingModel(true);
    const res = await addFreezerModel({
      brand,
      capacity,
      model_name: modelName,
      freezer_type: newModelType,
      description: newModelDesc.trim()
    });
    setCreatingModel(false);

    if (res.success && res.model) {
      toast.success(`✨ New model '${res.model.model_name}' registered successfully!`);
      setShowCreateModelModal(false);

      // Auto-select this newly created model in the assign modal
      setSelectedBrand(res.model.brand);
      setSelectedModelId(res.model.id);
      setCustomModelName(res.model.model_name);
      setSerial(generateSerial(selectedShopId, res.model.model_name));
    } else {
      toast.error(res.message || "Failed to create freezer model");
    }
  };

  // Handle delete freezer allocation
  const handleConfirmDelete = async () => {
    if (!deleteModal.freezer && !deleteModal.shop) return;
    const freezerId = deleteModal.freezer?.id;
    const shopId = deleteModal.shop?.id || deleteModal.freezer?.shop_id;
    const shopName = deleteModal.shop?.name || deleteModal.freezer?.shop_name || 'Shop';
    
    const targetId = freezerId && !String(freezerId).startsWith('legacy-') ? freezerId : shopId;
    const res = await unassignFreezer(targetId, shopId);
    if (res.success) {
      toast.success(`🗑️ Freezer asset removed successfully from '${shopName}'!`);
      setDeleteModal({ isOpen: false, freezer: null, shop: null });
      if (showAssignModal) setShowAssignModal(false);
    } else {
      toast.error(res.message || "Failed to delete freezer allocation");
    }
  };

  const currentModalShop = useMemo(() => {
    return shops.find(s => String(s.id) === String(selectedShopId));
  }, [shops, selectedShopId]);

  return (
    <div className="space-y-6 pb-8">
      
      {/* ==================================================================== */}
      {/* TOP HEADER & ACTION BUTTONS */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold border border-cyan-200">
              <Snowflake className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">FREEZER ASSET MANAGEMENT</h2>
              <p className="text-xs text-slate-500 font-bold">Track, deploy & assign multiple cold storage freezer assets per shop</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Create New Model Button */}
          <button
            onClick={() => setShowCreateModelModal(true)}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center gap-2 border border-indigo-200 shadow-sm transition"
            title="Add a new brand/capacity freezer specification"
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            <span>+ CREATE NEW MODEL</span>
          </button>

          {/* Manage Models Button */}
          <button
            onClick={() => setShowManageModelsModal(true)}
            className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            title="View and manage registered freezer specifications"
          >
            <Tag className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Model Catalog</span> ({freezerModels.length})
          </button>

          {/* Assign New Freezer Button */}
          <button
            onClick={() => handleOpenAssignModal()}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ ASSIGN FREEZER TO SHOP</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* METRIC CARDS */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-cyan-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block uppercase tracking-wider">Total Freezers Deployed</span>
          <div className="font-mono font-black text-3xl text-cyan-600 mt-1">
            {allFreezersList.length} <span className="text-sm font-sans font-bold text-slate-400">Assets</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-emerald-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block uppercase tracking-wider">Active In Shops</span>
          <div className="font-mono font-black text-3xl text-emerald-600 mt-1">
            {allFreezersList.filter(f => (f.status || f.freezer_status || 'Active') === 'Active').length} <span className="text-sm font-sans font-bold text-slate-400">Active</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl bg-white border-l-4 border-amber-500 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-extrabold block uppercase tracking-wider">Shops Without Freezer</span>
          <div className="font-mono font-black text-3xl text-amber-600 mt-1">
            {shops.filter(s => !s.has_freezer && !(shopFreezersMap.get(String(s.id))?.length > 0)).length} <span className="text-sm font-sans font-bold text-slate-400">Shops</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SEARCH & BRAND FILTER BAR */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by shop name, code, model (e.g. Blue Star, 300L), serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-extrabold text-slate-500 whitespace-nowrap flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Brand:
          </span>
          <button
            onClick={() => setBrandFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap ${brandFilter === 'ALL' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All Brands
          </button>
          {availableBrands.map(b => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap ${brandFilter === b ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* LEVEL 1 (DEFAULT) OR LEVEL 2 (VILLAGE SELECTED) VIEW */}
      {/* ==================================================================== */}
      {!selectedVillage ? (
        /* ------------------------------------------------------------------ */
        /* LEVEL 1: VILLAGES WITH FREEZER ASSETS GRID                         */
        /* ------------------------------------------------------------------ */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-600" />
              VILLAGES WITH FREEZER ASSETS ({filteredVillageGroups.length})
            </h3>
            <span className="text-xs font-bold text-slate-400">Click any village card to view its shops & freezers</span>
          </div>

          {filteredVillageGroups.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto text-2xl font-bold">
                📍
              </div>
              <h4 className="font-extrabold text-slate-700 text-sm">No Villages Found</h4>
              <p className="text-xs text-slate-400">No villages match the selected search or brand filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVillageGroups.map(vg => {
                const totalShops = vg.shops.length;
                const totalFreezers = vg.allFreezers.length;
                const pendingShops = vg.noFreezerShops.length;
                const brandsArray = Array.from(vg.brands || []);

                return (
                  <div
                    key={vg.id || vg.name}
                    onClick={() => setSelectedVillage(vg)}
                    className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-lg transition cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-105 transition shadow-sm">
                            📍
                          </div>
                          <div>
                            <h4 className="font-black text-base text-slate-900 group-hover:text-cyan-600 transition">
                              {vg.name}
                            </h4>
                            {vg.code && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-black bg-slate-100 text-slate-700 border border-slate-200">
                                {vg.code}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex-shrink-0 ${
                          totalFreezers > 0 ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {totalFreezers} {totalFreezers === 1 ? 'Freezer' : 'Freezers'}
                        </span>
                      </div>

                      <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold text-[11px]">Total Shops:</span>
                          <span className="font-black text-slate-900">{totalShops} shops</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-bold text-[11px]">Freezers Deployed:</span>
                          <span className="font-black text-emerald-600 font-mono">{totalFreezers} freezers</span>
                        </div>
                        {pendingShops > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold text-[11px]">Pending Allocation:</span>
                            <span className="font-bold text-amber-600 font-mono">{pendingShops} shops</span>
                          </div>
                        )}
                        {brandsArray.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Brands:</span>
                            {brandsArray.slice(0, 3).map(b => (
                              <span key={b} className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                {b}
                              </span>
                            ))}
                            {brandsArray.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold">+{brandsArray.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-cyan-600 group-hover:text-cyan-700 font-black text-xs">
                      <span>View Shops & Freezers</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ------------------------------------------------------------------ */
        /* LEVEL 2: SELECTED VILLAGE SHOPS & MULTI-FREEZER VIEW               */
        /* ------------------------------------------------------------------ */
        <div className="space-y-6">
          {/* Back Navigation & Village Banner */}
          <div className="bg-gradient-to-r from-cyan-900 via-slate-900 to-cyan-950 p-5 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedVillage(null)}
                className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black transition flex items-center gap-2 text-xs border border-white/15 cursor-pointer shadow-sm"
                title="Back to all villages"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← BACK TO ALL VILLAGES</span>
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black tracking-tight">{activeVillageGroup?.name}</h2>
                  {activeVillageGroup?.code && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30">
                      {activeVillageGroup.code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-cyan-200/80 font-medium mt-0.5">
                  Managing Freezers for {activeVillageGroup?.shops?.length || 0} Shops in {activeVillageGroup?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="text-right">
                <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-wider block">Deployed in Village</span>
                <span className="text-lg font-black font-mono text-white">
                  {activeVillageGroup?.allFreezers?.length || 0} <span className="text-xs font-normal text-cyan-200">Freezers</span>
                </span>
              </div>
            </div>
          </div>

          {/* SHOPS WITH FREEZER DEPLOYED (MULTI-FREEZER CARDS) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Store className="w-4 h-4 text-cyan-600" />
                SHOPS WITH FREEZER DEPLOYED IN {activeVillageGroup?.name} ({activeVillageFreezerShops.length})
              </h3>
            </div>

            {activeVillageFreezerShops.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-300 p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto text-2xl font-bold">
                  🧊
                </div>
                <h4 className="font-extrabold text-slate-700 text-sm">No Freezers Deployed in {activeVillageGroup?.name}</h4>
                <p className="text-xs text-slate-400">Click below to assign a freezer to any eligible shop in this village.</p>
                <button
                  onClick={() => handleOpenAssignModal()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Assign Freezer
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeVillageFreezerShops.map(shop => {
                  const sFreezers = shopFreezersMap.get(String(shop.id)) || [];
                  const freezerList = sFreezers.length > 0 ? sFreezers : [{
                    id: `legacy-${shop.id}`,
                    shop_id: shop.id,
                    model_name: shop.freezer_model || 'Deep Freezer',
                    serial_no: shop.freezer_serial || `FRZ-${shop.code}`,
                    allocation_date: shop.freezer_date || 'N/A',
                    status: shop.freezer_status || 'Active'
                  }];

                  return (
                    <div key={shop.id} className="glass-panel p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm hover:border-cyan-300 transition relative">
                      
                      {/* Shop Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center font-bold text-xl flex-shrink-0">
                            🏪
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-black text-base text-slate-900">{shop.name}</h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-black bg-slate-100 text-slate-700 border border-slate-200">
                                {shop.code}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">
                              {shop.owner_name} {shop.phone ? `• 📞 ${shop.phone}` : ''}
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-50 text-cyan-800 border border-cyan-200 flex-shrink-0">
                          🧊 {freezerList.length} {freezerList.length === 1 ? 'Freezer' : 'Freezers'}
                        </span>
                      </div>

                      {/* List of Freezers for this Shop */}
                      <div className="space-y-2.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Assigned Freezer Assets ({freezerList.length})
                        </span>

                        {freezerList.map((frz, idx) => (
                          <div key={frz.id || idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900">{frz.model_name}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                                    (frz.status || 'Active') === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                                  }`}>
                                    {frz.status || 'Active'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                                  <span>Tag: <strong className="text-cyan-700">{frz.serial_no}</strong></span>
                                  <span>Allocated: <strong>{frz.allocation_date || 'N/A'}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleOpenEditModal(frz, shop)}
                                  className="p-1.5 bg-white hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 rounded-lg border border-slate-200 shadow-2xs transition"
                                  title="Edit this freezer specification"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, freezer: frz, shop })}
                                  className="p-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg border border-slate-200 shadow-2xs transition"
                                  title="Delete this freezer allocation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Another Freezer Action Button */}
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenAssignModal(shop.id)}
                          className="w-full py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-extrabold text-xs flex items-center justify-center gap-2 border border-cyan-200/80 transition cursor-pointer"
                        >
                          <PlusCircle className="w-4 h-4 text-cyan-600" />
                          <span>+ ADD ANOTHER FREEZER TO THIS SHOP</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SHOPS WITHOUT FREEZER IN THIS VILLAGE */}
          {activeVillageNoFreezerShops.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-500" />
                  ELIGIBLE SHOPS PENDING FREEZER ALLOCATION IN {activeVillageGroup?.name} ({activeVillageNoFreezerShops.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeVillageNoFreezerShops.map(shop => (
                  <div key={shop.id} className="glass-card p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-sm hover:border-cyan-300 transition">
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">{shop.name} ({shop.code})</h5>
                      <p className="text-[10px] text-slate-500 font-semibold">{shop.owner_name}</p>
                    </div>
                    <button
                      onClick={() => handleOpenAssignModal(shop.id)}
                      className="px-3 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white rounded-xl text-[11px] font-extrabold border border-cyan-200 transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Assign Freezer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: ASSIGN / EDIT FREEZER TO SHOP */}
      {/* ==================================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${editingFreezer ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-cyan-100 text-cyan-700 border-cyan-200'}`}>
                  {editingFreezer ? <Edit3 className="w-5 h-5" /> : <Snowflake className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">
                    {editingFreezer ? 'Edit Freezer Asset' : (currentModalShop?.has_freezer ? 'Add Additional Freezer' : 'Assign Freezer to Shop')}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {editingFreezer 
                      ? `Update spec for ${currentModalShop?.name || 'Shop'} • Tag: ${editingFreezer.serial_no}`
                      : 'Deploy multiple freezer assets per shop'}
                  </span>
                </div>
              </div>
              <button onClick={() => { setShowAssignModal(false); setEditingFreezer(null); }} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. VILLAGE SELECTOR */}
            {!editingFreezer && (
              <div className="space-y-1.5 bg-gradient-to-r from-cyan-50/70 to-blue-50/70 p-3 rounded-2xl border border-cyan-100 relative">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-cyan-950 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                    Select Village (கிராமம்)
                  </label>
                  {modalVillageFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleSelectVillage('ALL', '')}
                      className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Show All Villages
                    </button>
                  )}
                </div>

                {/* Village Combobox Input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Type or select village name (e.g. இறையூர்)..."
                    value={villageSearchText}
                    onChange={(e) => {
                      setVillageSearchText(e.target.value);
                      setIsVillageDropdownOpen(true);
                    }}
                    onFocus={() => setIsVillageDropdownOpen(true)}
                    className="w-full bg-white border border-cyan-200 rounded-xl pl-3 pr-16 py-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-2xs transition"
                  />
                  
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                    {villageSearchText && (
                      <button
                        type="button"
                        onClick={() => handleSelectVillage('ALL', '')}
                        className="p-1 hover:text-slate-700 rounded-md"
                        title="Clear village filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsVillageDropdownOpen(!isVillageDropdownOpen)}
                      className="p-1 hover:text-slate-700 rounded-md"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isVillageDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Village Suggestions Dropdown List */}
                  {isVillageDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectVillage('ALL', '');
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-bold transition flex items-center justify-between hover:bg-cyan-50 ${modalVillageFilter === 'ALL' ? 'bg-cyan-100/60 text-cyan-900' : 'text-slate-700'}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>🌐</span>
                          <span>All Villages (அனைத்து கிராமங்களும்)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-black">{shops.length} கடைகள்</span>
                      </button>

                      {filteredVillageOptions.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-medium">
                          No matching village found for "{villageSearchText}"
                        </div>
                      ) : (
                        filteredVillageOptions.map(v => {
                          const vShopsCount = shops.filter(s => String(s.village_id) === String(v.id) || (s.village_name && s.village_name.toLowerCase() === v.name.toLowerCase())).length;
                          const isSelected = String(modalVillageFilter) === String(v.id);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectVillage(String(v.id), v.name);
                              }}
                              className={`w-full text-left px-3.5 py-2 text-xs font-bold transition flex items-center justify-between hover:bg-cyan-50 ${isSelected ? 'bg-cyan-100/60 text-cyan-900' : 'text-slate-700'}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-cyan-600">📍</span>
                                <span>{v.name}</span>
                                {v.code && <span className="text-[10px] font-mono text-slate-400 font-semibold">({v.code})</span>}
                              </div>
                              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono font-black text-slate-600">
                                {vShopsCount} கடைகள்
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. TARGET SHOP SELECTOR */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-600" />
                  Target Shop (கடை) *
                </label>
                {!editingFreezer && (
                  <span className="text-[10px] font-bold text-slate-500">
                    {modalFilteredShops.length} Shop{modalFilteredShops.length === 1 ? '' : 's'} Available
                  </span>
                )}
              </div>

              {/* Shop Combobox Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Type shop name / code to search & select..."
                  value={shopSearchText}
                  disabled={Boolean(editingFreezer)}
                  onChange={(e) => {
                    setShopSearchText(e.target.value);
                    setIsShopDropdownOpen(true);
                  }}
                  onFocus={() => { if (!editingFreezer) setIsShopDropdownOpen(true); }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-10 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition disabled:opacity-80"
                />

                {!editingFreezer && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                    <button
                      type="button"
                      onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                      className="p-1 hover:text-slate-700 rounded-md"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isShopDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}

                {/* Shop Suggestions Dropdown List */}
                {isShopDropdownOpen && !editingFreezer && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {modalFilteredShops.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 font-medium">
                        No shops found matching "{shopSearchText}"
                      </div>
                    ) : (
                      modalFilteredShops.map(s => {
                        const isSelected = String(selectedShopId) === String(s.id);
                        const vName = getShopVillageName(s);
                        const sCount = shopFreezersMap.get(String(s.id))?.length || (s.has_freezer ? 1 : 0);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectShop(s);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-bold transition flex items-center justify-between hover:bg-cyan-50 ${isSelected ? 'bg-cyan-100/60 text-cyan-950 font-black' : 'text-slate-800'}`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{s.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{s.code}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                📍 {vName} {s.owner_name ? `• ${s.owner_name}` : ''}
                              </p>
                            </div>

                            {sCount > 0 ? (
                              <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-bold">
                                🧊 {sCount} {sCount === 1 ? 'Freezer' : 'Freezers'}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                ✨ 0 Freezers
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Brand Cascade Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase">1. Select Brand *</label>
                <button
                  type="button"
                  onClick={() => setShowCreateModelModal(true)}
                  className="text-[10px] text-indigo-600 font-black hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add New Model
                </button>
              </div>

              {/* Brand chips */}
              <div className="flex flex-wrap gap-1.5">
                {availableBrands.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleBrandChangeInAssign(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${selectedBrand.toLowerCase() === b.toLowerCase() ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Model / Capacity Dropdown based on chosen brand */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 uppercase">
                2. Freezer Model / Capacity ({selectedBrand}) *
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => handleModelChangeInAssign(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 focus:outline-none focus:border-cyan-500"
              >
                {filteredBrandModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.model_name} {m.capacity ? `(${m.capacity})` : ''} - {m.freezer_type || 'Deep Freezer'}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Model Text Preview / Editable */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-500 uppercase">Selected Model Full Name</label>
              <input
                type="text"
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900"
                placeholder="e.g. Blue Star 300L Deep Freezer"
              />
            </div>

            {/* Serial Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase">Serial Number (Asset Tag)</label>
                <button
                  type="button"
                  onClick={() => setSerial(generateSerial(selectedShopId, customModelName))}
                  className="text-[10px] text-cyan-600 font-bold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-slate-900 uppercase"
                placeholder="e.g. FRZ-SHOP013-BS300-904"
              />
            </div>

            {/* Date & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase">Allocation Date</label>
                <input
                  type="date"
                  value={allocationDate}
                  onChange={(e) => setAllocationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase">Freezer Status</label>
                <select
                  value={freezerStatus}
                  onChange={(e) => setFreezerStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="Active">Active (Deployed)</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Transit">In Transit</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            {editingFreezer ? (
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModal({ isOpen: true, freezer: editingFreezer, shop: currentModalShop });
                  }}
                  className="py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs flex items-center justify-center gap-1.5 border border-rose-200 shadow-sm transition"
                  title="Delete this freezer asset"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Asset</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveFreezer}
                  disabled={saving}
                  className="flex-1 py-3 text-xs sm:text-sm font-black bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'UPDATING ASSET...' : 'UPDATE FREEZER ASSET'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveFreezer}
                disabled={saving}
                className="touch-btn touch-btn-primary w-full py-3 text-sm font-black bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition"
              >
                <Save className="w-5 h-5" />
                {saving ? 'SAVING ALLOCATION...' : 'SAVE FREEZER ALLOCATION'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CREATE NEW FREEZER MODEL */}
      {/* ==================================================================== */}
      {showCreateModelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">Create New Freezer Model</h4>
                  <span className="text-[10px] text-slate-500 font-bold">Register Brand & Capacity Specs</span>
                </div>
              </div>
              <button onClick={() => setShowCreateModelModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewModel} className="space-y-4 text-xs">
              
              {/* Brand Selection */}
              <div>
                <label className="font-black text-slate-700 block mb-1.5">Freezer Brand *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_BRANDS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { setNewModelBrand(b); setCustomBrandInput(''); }}
                      className={`px-3 py-1.5 rounded-xl font-extrabold transition ${newModelBrand === b ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {b}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewModelBrand('Other')}
                    className={`px-3 py-1.5 rounded-xl font-extrabold transition ${newModelBrand === 'Other' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    + Custom Brand
                  </button>
                </div>

                {newModelBrand === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter custom brand name (e.g. Panasonic, Celfrost)"
                    value={customBrandInput}
                    onChange={(e) => setCustomBrandInput(e.target.value)}
                    className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                )}
              </div>

              {/* Capacity Selection */}
              <div>
                <label className="font-black text-slate-700 block mb-1.5">Capacity / Volume (Liters) *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_CAPACITIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setNewModelCapacity(c); setCustomCapacityInput(''); }}
                      className={`px-2.5 py-1 rounded-xl font-extrabold transition ${newModelCapacity === c ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewModelCapacity('Other')}
                    className={`px-2.5 py-1 rounded-xl font-extrabold transition ${newModelCapacity === 'Other' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    + Other
                  </button>
                </div>

                {newModelCapacity === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter capacity (e.g. 600L, 800L, 1000L)"
                    value={customCapacityInput}
                    onChange={(e) => setCustomCapacityInput(e.target.value)}
                    className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Freezer Type */}
              <div>
                <label className="font-black text-slate-700 block mb-1">Freezer Category / Type</label>
                <select
                  value={newModelType}
                  onChange={(e) => setNewModelType(e.target.value)}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900"
                >
                  {FREEZER_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Full Display Name (Auto-Generated & Editable) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-slate-700 flex items-center gap-1.5">
                    Model Full Display Name
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-200 font-bold">
                      ⚡ Live Auto-Generated
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  value={newModelDisplayName}
                  onChange={(e) => setNewModelDisplayName(e.target.value)}
                  className="w-full p-2.5 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900"
                  placeholder="e.g. Blue Star 300L Deep Freezer"
                />
              </div>

              {/* Description / Notes */}
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Single Door, Hard Top, Low Power Consumption"
                  value={newModelDesc}
                  onChange={(e) => setNewModelDesc(e.target.value)}
                  className="w-full p-2.5 font-medium bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creatingModel}
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  <Save className="w-4 h-4" />
                  {creatingModel ? 'SAVING MODEL...' : 'SAVE & REGISTER MODEL'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModelModal(false)}
                  className="py-3 px-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: MANAGE FREEZER MODELS CATALOG */}
      {/* ==================================================================== */}
      {showManageModelsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto my-auto p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold border border-slate-200">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">Registered Freezer Models Catalog</h4>
                  <span className="text-[10px] text-slate-500 font-bold">{freezerModels.length} Specifications Available</span>
                </div>
              </div>
              <button onClick={() => setShowManageModelsModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowManageModelsModal(false);
                  setShowCreateModelModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Specification
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {freezerModels.map(m => {
                const deployedCount = allFreezersList.filter(f => (f.model_name || '').includes(m.model_name)).length;
                return (
                  <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{m.model_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700">
                          {m.brand}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        Type: {m.freezer_type || 'Deep Freezer'} • Capacity: {m.capacity || 'Standard'} • Deployed: {deployedCount} freezers
                      </p>
                    </div>

                    {deleteFreezerModel && (
                      <button
                        onClick={async () => {
                          if (confirm(`Remove freezer specification '${m.model_name}'?`)) {
                            const res = await deleteFreezerModel(m.id);
                            if (res.success) toast.success("Model removed from catalog");
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete model"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: DELETE FREEZER ALLOCATION CONFIRMATION */}
      {/* ==================================================================== */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h4 className="font-black text-base text-slate-900">Delete Freezer Allocation?</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Are you sure you want to remove this freezer asset from <strong className="text-slate-900">{deleteModal.shop?.name || deleteModal.freezer?.shop_name || 'Shop'}</strong> ({deleteModal.shop?.code || deleteModal.freezer?.shop_code || 'CODE'})?
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Model:</span>
                <span className="font-black text-slate-900">{deleteModal.freezer?.model_name || deleteModal.shop?.freezer_model || 'Assigned Cold Storage Freezer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Serial No:</span>
                <span className="font-black text-cyan-700">{deleteModal.freezer?.serial_no || deleteModal.shop?.freezer_serial || 'FRZ-ASSET'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete Freezer
              </button>
              <button
                onClick={() => setDeleteModal({ isOpen: false, freezer: null, shop: null })}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

