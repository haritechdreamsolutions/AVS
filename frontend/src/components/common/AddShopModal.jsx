import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, X, Save, Snowflake, CheckCircle2, MapPin, Route as RouteIcon, Mic, MicOff, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

export const AddShopModal = ({ onClose, villageId = null, villageName = null }) => {
  const { addShop, villages = [], routes = [] } = useApp();
  
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState(villageId ? String(villageId) : '');
  const [distanceKm, setDistanceKm] = useState('3.0');
  const [hasFreezer, setHasFreezer] = useState(false);
  const [freezerModel, setFreezerModel] = useState('Blue Star 300L Visicooler');
  const [saving, setSaving] = useState(false);
  const [createdShop, setCreatedShop] = useState(null);

  // Speech Recognition (Voice-to-Text) State - 100% Free Native Web Speech API
  const [speechLang, setSpeechLang] = useState('ta-IN'); // 'ta-IN' (தமிழ்) or 'en-IN' (English)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = speechLang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info(speechLang === 'ta-IN' ? "🎙️ கடை பெயரை தமிழில் பேசவும்... (Listening)" : "🎙️ Speak shop name in English... (Listening)");
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setName(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please allow mic in browser settings.");
        } else if (event.error !== 'no-speech') {
          toast.error(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition startup error:", err);
      setIsListening(false);
      toast.error("Failed to start voice input.");
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Filter active villages for the company
  const activeVillages = useMemo(() => {
    return (villages || []).filter(v => v.status === 'ACTIVE' || v.is_active !== false);
  }, [villages]);

  // If no village selected initially and not passed via prop, default to first active village
  useEffect(() => {
    if (!selectedVillageId && !villageId && activeVillages.length > 0) {
      setSelectedVillageId(String(activeVillages[0].id));
    }
  }, [activeVillages, selectedVillageId, villageId]);

  // Derived Village and Route object
  const currentVillage = useMemo(() => {
    const vId = selectedVillageId ? Number(selectedVillageId) : (villageId ? Number(villageId) : null);
    if (!vId) return null;
    return activeVillages.find(v => Number(v.id) === vId) || null;
  }, [activeVillages, selectedVillageId, villageId]);

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!name.trim()) {
      toast.error("கடை பெயர் உள்ளிடவும்! (Please enter shop name)");
      return;
    }

    const finalVillageId = selectedVillageId ? Number(selectedVillageId) : (villageId ? Number(villageId) : null);
    if (!finalVillageId) {
      toast.error("கிராமம் தேர்வு செய்யவும்! (Please select a Village)");
      return;
    }

    const distNum = parseFloat(distanceKm);
    const parsedDistance = isNaN(distNum) || distNum < 0 ? 0 : distNum;

    setSaving(true);
    const res = await addShop({
      name: name.trim(),
      owner_name: ownerName ? ownerName.trim() : null,
      phone: phone ? phone.trim() : null,
      distance_km: parsedDistance,
      distance: `${parsedDistance} km`,
      village_id: finalVillageId,
      has_freezer: Boolean(hasFreezer),
      freezer_model: hasFreezer ? (freezerModel.trim() || 'Blue Star 300L Visicooler') : null
    });
    setSaving(false);

    if (res.success && res.shop) {
      setCreatedShop(res.shop);
      toast.success(`🎉 New Shop Created: ${res.shop.name} (Shop ID: ${res.shop.code})`);
    } else {
      toast.error("Error adding shop: " + (res.message || "Failed to add shop"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 lg:p-6 overflow-y-auto">
      {/* Light Blue Themed Container - Optimized for Laptop & Responsive for Mobile */}
      <div className="bg-gradient-to-b from-sky-50 via-white to-sky-50/90 border-2 border-sky-200 rounded-3xl max-w-full sm:max-w-2xl lg:max-w-3xl w-full p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 shadow-2xl max-h-[92dvh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-sky-200/80 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-200 shrink-0">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg lg:text-xl text-slate-900 tracking-tight flex items-center gap-2">
                Add New Shop
                <span className="text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-extrabold border border-sky-300 uppercase">
                  NEW
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs font-bold text-sky-700 mt-0.5">புது கடை சேர்க்க & விவரங்கள் பதிவு</p>
              {villageName && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-800 font-black bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Village: <span className="text-slate-900">{villageName}</span>
                  <span className="text-[10px] text-amber-600 font-bold ml-auto">(Auto-assigned)</span>
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-sky-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {createdShop ? (
          /* Post-creation Success Confirmation */
          <div className="py-4 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-300 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-lg sm:text-xl text-slate-900">Shop Created Successfully!</h4>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">கடை வெற்றிகரமாக பதிவு செய்யப்பட்டது</p>
            </div>

            <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 sm:p-5 text-left space-y-2.5 text-xs sm:text-sm shadow-2xs">
              <div className="flex justify-between items-center pb-2.5 border-b border-sky-200">
                <span className="font-black text-slate-600 uppercase">Shop ID:</span>
                <span className="font-mono font-black text-sm sm:text-base text-sky-800 bg-sky-100 px-3 py-1 rounded-xl border border-sky-300">
                  {createdShop.code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-black text-slate-600">Shop Name:</span>
                <span className="font-black text-slate-900">{createdShop.name}</span>
              </div>
              {(createdShop.village_name || villageName) && (
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-600">Village:</span>
                  <span className="font-black text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    {createdShop.village_name || villageName}
                  </span>
                </div>
              )}
              {createdShop.owner_name && (
                <div className="flex justify-between">
                  <span className="font-black text-slate-600">Owner:</span>
                  <span className="font-bold text-slate-800">{createdShop.owner_name}</span>
                </div>
              )}
              {createdShop.phone && (
                <div className="flex justify-between">
                  <span className="font-black text-slate-600">Phone:</span>
                  <span className="font-black text-slate-800 font-mono">{createdShop.phone}</span>
                </div>
              )}
              {createdShop.route_name && (
                <div className="flex justify-between">
                  <span className="font-black text-slate-600">Route:</span>
                  <span className="font-bold text-slate-800">{createdShop.route_name}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setCreatedShop(null);
                  setName('');
                  setOwnerName('');
                  setPhone('');
                }}
                className="w-1/2 py-3.5 px-4 rounded-2xl bg-sky-100 hover:bg-sky-200 text-sky-900 font-black text-xs sm:text-sm cursor-pointer transition border border-sky-200"
              >
                + Add Another Shop
              </button>
              <button
                onClick={onClose}
                className="w-1/2 py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs sm:text-sm cursor-pointer transition shadow-lg shadow-sky-300/60"
              >
                Done / Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Shop Name (Required) with Voice Recognition & Language Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs sm:text-sm font-black text-slate-700 uppercase">
                  Shop Name (கடை பெயர்) *
                </label>
                
                {/* Language Switcher Buttons: தமிழ் / English */}
                <div className="flex items-center gap-1 bg-sky-100/80 p-1 rounded-xl border border-sky-200">
                  <button
                    type="button"
                    onClick={() => setSpeechLang('ta-IN')}
                    className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                      speechLang === 'ta-IN'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-sky-800 hover:text-slate-900'
                    }`}
                  >
                    தமிழ்
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeechLang('en-IN')}
                    className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                      speechLang === 'en-IN'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-sky-800 hover:text-slate-900'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder={speechLang === 'ta-IN' ? "எ.கா. லட்சுமி ஸ்டோர்" : "e.g. Lakshmi Store"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-white border-2 rounded-2xl pl-4 pr-12 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none transition shadow-2xs ${
                    isListening ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/30' : 'border-sky-200 hover:border-sky-300 focus:border-sky-600'
                  }`}
                  autoFocus
                />

                {/* Mic Button on Right Side */}
                <button
                  type="button"
                  onClick={startVoiceInput}
                  title={isListening ? "Stop Listening" : (speechLang === 'ta-IN' ? "குரல் உள்ளீடு (Mic) - தமிழ்" : "Voice Input (Mic) - English")}
                  className={`absolute right-2 p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/40 ring-2 ring-rose-300'
                      : 'bg-sky-100 hover:bg-sky-200 text-sky-700 border border-sky-300 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isListening ? 'animate-bounce' : ''}`} />
                </button>
              </div>

              {/* Listening Live Indicator */}
              {isListening && (
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
                  <span>
                    {speechLang === 'ta-IN' 
                      ? '🔴 கேட்கிறது... கடை பெயரை தமிழில் பேசவும்...' 
                      : '🔴 Listening... Speak shop name in English...'}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Owner Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-black text-slate-700 uppercase">Owner Name</label>
                <input
                  type="text"
                  placeholder="e.g. Lakshmanan"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-white border-2 border-sky-200 hover:border-sky-300 focus:border-sky-600 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none shadow-2xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-black text-slate-700 uppercase">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border-2 border-sky-200 hover:border-sky-300 focus:border-sky-600 rounded-2xl px-4 py-3 text-sm sm:text-base font-mono font-black text-slate-900 focus:outline-none shadow-2xs"
                />
              </div>
            </div>

            {/* 3. Village Selector & Route Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Village Selector (Required) */}
              {!villageId ? (
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-black text-slate-700 uppercase flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    Village (கிராமம்) *
                  </label>
                  <select
                    value={selectedVillageId}
                    onChange={(e) => setSelectedVillageId(e.target.value)}
                    className="w-full bg-white border-2 border-sky-200 hover:border-sky-400 focus:border-sky-600 rounded-2xl px-4 py-3 text-sm sm:text-base font-black text-slate-900 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="" disabled>-- Select Village --</option>
                    {activeVillages.length === 0 ? (
                      <option value="" disabled>No active villages found.</option>
                    ) : (
                      activeVillages.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : null}

              {/* Auto-Derived Route Display (Read-Only) */}
              <div className={`space-y-1.5 ${villageId ? 'sm:col-span-2' : ''}`}>
                <label className="text-xs sm:text-sm font-black text-slate-700 uppercase flex items-center gap-1.5">
                  <RouteIcon className="w-4 h-4 text-sky-600" />
                  Route (வழித்தடம்)
                </label>
                <div className="w-full bg-sky-100/70 border-2 border-sky-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-black text-sky-950 flex items-center justify-between shadow-2xs min-h-[48px]">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-pulse shrink-0"></span>
                    <span className="truncate">{currentVillage?.route_name ? `${currentVillage.route_name} (${currentVillage.route_code || 'Route'})` : (villageName ? `Auto Route for ${villageName}` : 'Select village')}</span>
                  </span>
                  <span className="text-[10px] sm:text-xs font-black uppercase text-sky-800 bg-sky-200/80 px-2.5 py-0.5 rounded-lg border border-sky-300 shrink-0 ml-2">
                    Auto-Derived
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Distance (KM) */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-black text-slate-700 uppercase">Distance (KM)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="3.0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full bg-white border-2 border-sky-200 hover:border-sky-300 focus:border-sky-600 rounded-2xl px-4 py-3 text-sm sm:text-base font-mono font-black text-slate-900 focus:outline-none shadow-2xs"
              />
            </div>

            {/* 5. Provide Free Freezer Option */}
            <div className="p-3.5 sm:p-4 bg-sky-100/60 border-2 border-sky-200 rounded-2xl space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs sm:text-sm font-black text-sky-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasFreezer}
                  onChange={(e) => setHasFreezer(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                />
                <Snowflake className="w-4 h-4 text-sky-600" />
                Provide Free Freezer Asset 🧊
              </label>
              {hasFreezer && (
                <input
                  type="text"
                  placeholder="Freezer Model / Capacity"
                  value={freezerModel}
                  onChange={(e) => setFreezerModel(e.target.value)}
                  className="w-full bg-white border-2 border-sky-300 focus:border-sky-600 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-900 focus:outline-none shadow-2xs"
                />
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="touch-btn touch-btn-primary w-full text-sm sm:text-base font-black flex items-center justify-center gap-2 uppercase tracking-wider py-3.5 sm:py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-300/60 cursor-pointer transition active:scale-[0.98]"
            >
              <Save className="w-5 h-5 stroke-[2.5]" />
              {saving ? 'SAVING SHOP...' : 'SAVE NEW SHOP'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
