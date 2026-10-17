import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Customer, Package, AppSettings } from '@/src/types';
import { calculateShippingCost, formatRupiah, formatDateDDMMYYYY } from '@/src/utils/formatters';
import { logActivity } from '@/src/services/dataService';
import {
  Scale,
  Search,
  User,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Save,
  Trash2,
  Edit2,
  Tag,
  RefreshCw,
  Info,
  Calendar,
} from 'lucide-react';

interface TimbangViewProps {
  settings: AppSettings;
}

interface WeighRowState {
  weightInput: string;
  isPromo: boolean;
  normalCost: number;
  promoDiscount: number;
  finalCost: number;
  isValid: boolean;
}

export const TimbangView: React.FC<TimbangViewProps> = ({ settings }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Active packages for selected customer
  const [customerPackages, setCustomerPackages] = useState<Package[]>([]);
  // Weighing inputs per package ID
  const [weighInputs, setWeighInputs] = useState<{ [packageId: string]: WeighRowState }>({});

  // List of all weighed active packages across system (for bottom scroll table)
  const [allWeighedPackages, setAllWeighedPackages] = useState<Package[]>([]);
  const [weighedSearchQuery, setWeighedSearchQuery] = useState('');

  // UI status
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete / Edit modal
  const [deleteConfirmPkg, setDeleteConfirmPkg] = useState<Package | null>(null);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [editWeightInput, setEditWeightInput] = useState('');
  const [editPromoInput, setEditPromoInput] = useState(false);

  // Real-time listener for customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    });
    return () => unsub();
  }, []);

  // Real-time listener for packages of selected customer
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerPackages([]);
      setWeighInputs({});
      return;
    }

    const q = query(
      collection(db, 'packages'),
      where('customerId', '==', selectedCustomer.id),
      where('isArchived', '==', false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const pkgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      // Only unpaid or partial
      const activeUnpaid = pkgs.filter(p => p.paymentStatus !== 'paid');
      setCustomerPackages(activeUnpaid);

      // Pre-fill existing weights if any
      const newInputs: { [packageId: string]: WeighRowState } = {};
      activeUnpaid.forEach((p) => {
        const hasWeight = p.weight > 0;
        const initialWeightStr = hasWeight ? String(p.weight) : '';
        const isPromo = p.isPromo || false;
        const calc = calculateShippingCost(p.weight || 0, settings, isPromo);

        newInputs[p.id] = {
          weightInput: initialWeightStr,
          isPromo,
          normalCost: calc.normalCost,
          promoDiscount: calc.promoDiscount,
          finalCost: calc.finalCost,
          isValid: hasWeight,
        };
      });
      setWeighInputs(newInputs);
    });

    return () => unsub();
  }, [selectedCustomer, settings]);

  // Real-time listener for ALL weighed active packages
  useEffect(() => {
    const q = query(
      collection(db, 'packages'),
      where('isArchived', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      const weighed = all.filter(p => p.weight > 0 && p.paymentStatus !== 'paid');
      weighed.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      setAllWeighedPackages(weighed);
    });
    return () => unsub();
  }, []);

  // Update a single package row weigh input
  const handleWeightChange = (packageId: string, val: string) => {
    const parsed = parseFloat(val.replace(',', '.'));
    const isValid = !isNaN(parsed) && parsed > 0;
    const currentPromo = weighInputs[packageId]?.isPromo ?? false;
    const calc = calculateShippingCost(isValid ? parsed : 0, settings, currentPromo);

    setWeighInputs(prev => ({
      ...prev,
      [packageId]: {
        weightInput: val,
        isPromo: currentPromo,
        normalCost: calc.normalCost,
        promoDiscount: calc.promoDiscount,
        finalCost: calc.finalCost,
        isValid,
      },
    }));
  };

  const handleTogglePromo = (packageId: string) => {
    const current = weighInputs[packageId];
    if (!current) return;
    const newPromo = !current.isPromo;
    const parsed = parseFloat(current.weightInput.replace(',', '.'));
    const isValid = !isNaN(parsed) && parsed > 0;
    const calc = calculateShippingCost(isValid ? parsed : 0, settings, newPromo);

    setWeighInputs(prev => ({
      ...prev,
      [packageId]: {
        ...current,
        isPromo: newPromo,
        normalCost: calc.normalCost,
        promoDiscount: calc.promoDiscount,
        finalCost: calc.finalCost,
      },
    }));
  };

  // Pre-save Summary Calculation
  const validPackagesToSave = customerPackages.filter(p => weighInputs[p.id]?.isValid);
  const summaryTotalWeight = validPackagesToSave.reduce((sum, p) => {
    const w = parseFloat(weighInputs[p.id]?.weightInput.replace(',', '.') || '0');
    return sum + (isNaN(w) ? 0 : w);
  }, 0);
  const summaryNormalCost = validPackagesToSave.reduce((sum, p) => sum + (weighInputs[p.id]?.normalCost || 0), 0);
  const summaryPromoCount = validPackagesToSave.filter(p => weighInputs[p.id]?.isPromo).length;
  const summaryTotalDiscount = validPackagesToSave.reduce((sum, p) => sum + (weighInputs[p.id]?.promoDiscount || 0), 0);
  const summaryFinalCost = validPackagesToSave.reduce((sum, p) => sum + (weighInputs[p.id]?.finalCost || 0), 0);

  // Bulk Save all valid weighed packages for selected customer
  const handleSaveAllWeights = async () => {
    if (validPackagesToSave.length === 0) {
      setToast({
        type: 'error',
        message: 'Tidak ada paket dengan berat yang valid (> 0 kg) untuk disimpan.',
      });
      return;
    }

    setIsSaving(true);
    setToast(null);

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const currentUserEmail = auth.currentUser?.email || 'admin';

      validPackagesToSave.forEach((pkg) => {
        const row = weighInputs[pkg.id];
        const weightVal = parseFloat(row.weightInput.replace(',', '.'));
        const ref = doc(db, 'packages', pkg.id);

        batch.update(ref, {
          weight: weightVal,
          isPromo: row.isPromo,
          promoAmount: row.promoDiscount,
          normalCost: row.normalCost,
          finalCost: row.finalCost,
          remainingCost: row.finalCost - (pkg.paidAmount || 0),
          // Rule requirement: status becomes "Tiba di Timika" automatically upon weighing
          status: 'Tiba di Timika',
          weighedAt: now,
          weighedBy: currentUserEmail,
          updatedAt: now,
        });
      });

      await batch.commit();

      await logActivity({
        action: 'WEIGH_PACKAGES',
        category: 'weigh',
        details: `Menyimpan timbangan untuk ${validPackagesToSave.length} paket milik ${selectedCustomer?.name}. Status diubah ke Tiba di Timika.`,
      });

      setToast({
        type: 'success',
        message: `BERHASIL! ${validPackagesToSave.length} paket berhasil ditimbang dan status otomatis menjadi "Tiba di Timika".`,
      });
    } catch (err: any) {
      console.error('Error saving weights:', err);
      setToast({
        type: 'error',
        message: 'Gagal menyimpan timbangan: ' + err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Edit single package modal save
  const handleSaveEditModal = async () => {
    if (!editingPkg) return;
    const parsed = parseFloat(editWeightInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      alert('Berat harus berupa angka positif lebih dari 0.');
      return;
    }

    const calc = calculateShippingCost(parsed, settings, editPromoInput);
    try {
      await updateDoc(doc(db, 'packages', editingPkg.id), {
        weight: parsed,
        isPromo: editPromoInput,
        promoAmount: calc.promoDiscount,
        normalCost: calc.normalCost,
        finalCost: calc.finalCost,
        remainingCost: calc.finalCost - (editingPkg.paidAmount || 0),
        status: 'Tiba di Timika',
        updatedAt: new Date().toISOString(),
      });

      await logActivity({
        action: 'EDIT_WEIGH',
        category: 'weigh',
        targetId: editingPkg.id,
        details: `Koreksi berat resi ${editingPkg.waybill} menjadi ${parsed} kg`,
      });

      setEditingPkg(null);
      setToast({ type: 'success', message: `Timbangan resi ${editingPkg.waybill} berhasil diperbarui.` });
    } catch (err: any) {
      alert('Gagal update: ' + err.message);
    }
  };

  // Delete package weight / package
  const handleDeleteWeighedPackage = async () => {
    if (!deleteConfirmPkg) return;
    try {
      await deleteDoc(doc(db, 'packages', deleteConfirmPkg.id));
      await logActivity({
        action: 'DELETE_PACKAGE',
        category: 'weigh',
        targetId: deleteConfirmPkg.id,
        details: `Menghapus paket ${deleteConfirmPkg.waybill} (${deleteConfirmPkg.customerName})`,
      });
      setDeleteConfirmPkg(null);
      setToast({ type: 'success', message: `Paket ${deleteConfirmPkg.waybill} berhasil dihapus.` });
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal menghapus: ' + err.message });
    }
  };

  const filteredCustomerMatches = customerSearch.trim().length >= 2
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : [];

  const filteredAllWeighed = allWeighedPackages.filter(p =>
    p.waybill.toLowerCase().includes(weighedSearchQuery.toLowerCase()) ||
    p.customerName.toLowerCase().includes(weighedSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <Scale className="mr-2 h-6 w-6 text-blue-600" />
          Menu Timbang di Timika & Perhitungan Ongkir
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Input berat per paket. Tarif Rp{settings.tariffPerKg.toLocaleString('id-ID')}/kg, minimum Rp{settings.minTariff.toLocaleString('id-ID')}, pembulatan ke atas kelipatan Rp{settings.roundUpMultiple.toLocaleString('id-ID')}. Paket yang disimpan otomatis berstatus <strong>Tiba di Timika</strong>.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 text-xs sm:text-sm shadow-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Step 1: Customer Autocomplete Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
          <User className="mr-1.5 h-4 w-4 text-blue-600" />
          Langkah 1: Cari & Pilih Pelanggan untuk Ditimbang
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Ketik nama pelanggan (minimal 2 huruf)..."
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />

          {showCustomerDropdown && filteredCustomerMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {filteredCustomerMatches.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(cust);
                    setCustomerSearch(cust.name);
                    setShowCustomerDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs flex items-center justify-between border-b border-slate-100 last:border-0"
                >
                  <span className="font-semibold text-slate-900">{cust.name}</span>
                  <span className="text-slate-500">{cust.whatsapp || 'Tanpa WhatsApp'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50/70 p-3 border border-blue-100 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-blue-900">Pelanggan Terpilih:</span>
              <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
              {selectedCustomer.whatsapp && (
                <span className="text-slate-600 font-mono">({selectedCustomer.whatsapp})</span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerSearch('');
              }}
              className="text-xs text-blue-700 hover:underline font-semibold"
            >
              Ganti Pelanggan
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Package Weighing Table for Selected Customer */}
      {selectedCustomer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Scale className="mr-2 h-5 w-5 text-blue-600" />
                Paket Aktif Milik: {selectedCustomer.name} ({customerPackages.length} paket)
              </h2>
              <p className="text-xs text-slate-500">
                Input berat setiap paket secara terpisah. Paket yang belum ditimbang tetap dapat diproses kemudian.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 border border-emerald-200">
                <Tag className="mr-1 h-3.5 w-3.5" />
                Promo Aktif: Potongan {formatRupiah(settings.promoAmount)}/paket
              </span>
            </div>
          </div>

          {customerPackages.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Tidak ada paket aktif untuk pelanggan ini. Silakan scan resi terlebih dahulu di menu Scan.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Nomor Resi / AWB</th>
                    <th className="py-2.5 px-3">Closing</th>
                    <th className="py-2.5 px-3">Status Saat Ini</th>
                    <th className="py-2.5 px-3 w-32">Input Berat (kg)</th>
                    <th className="py-2.5 px-3 text-center">Promo Hemat</th>
                    <th className="py-2.5 px-3 text-right">Biaya Normal</th>
                    <th className="py-2.5 px-3 text-right">Biaya Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerPackages.map((pkg, idx) => {
                    const row = weighInputs[pkg.id] || {
                      weightInput: '',
                      isPromo: false,
                      normalCost: 0,
                      promoDiscount: 0,
                      finalCost: 0,
                      isValid: false,
                    };

                    return (
                      <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{pkg.waybill}</td>
                        <td className="py-2.5 px-3 text-slate-600">{formatDateDDMMYYYY(pkg.closingDate)}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              pkg.status === 'Tiba di Timika'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {pkg.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={row.weightInput}
                            onChange={(e) => handleWeightChange(pkg.id, e.target.value)}
                            className={`w-24 rounded-lg border px-2.5 py-1.5 text-xs font-mono font-bold outline-none ${
                              row.isValid
                                ? 'border-emerald-400 bg-emerald-50/30 text-emerald-900 focus:ring-1 focus:ring-emerald-400'
                                : 'border-slate-300 text-slate-800 focus:border-blue-500'
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.isPromo}
                              onChange={() => handleTogglePromo(pkg.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-1.5 text-[11px] font-medium text-slate-600">
                              -Rp10rb
                            </span>
                          </label>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                          {formatRupiah(row.normalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                          {formatRupiah(row.finalCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pre-save Summary Box */}
          {customerPackages.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center">
                <Info className="mr-1.5 h-4 w-4 text-blue-600" />
                Ringkasan Sebelum Menyimpan Timbangan
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Paket Lengkap:</span>
                  <span className="text-base font-bold text-slate-900">{validPackagesToSave.length} paket</span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Total Berat:</span>
                  <span className="text-base font-bold text-slate-900">{summaryTotalWeight.toFixed(2)} kg</span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Total Biaya Normal:</span>
                  <span className="text-base font-bold text-slate-900">{formatRupiah(summaryNormalCost)}</span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Paket Promo:</span>
                  <span className="text-base font-bold text-emerald-700">{summaryPromoCount} paket</span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Total Potongan:</span>
                  <span className="text-base font-bold text-emerald-700">-{formatRupiah(summaryTotalDiscount)}</span>
                </div>
                <div className="rounded-lg bg-blue-50 p-2.5 border border-blue-200">
                  <span className="text-blue-700 block text-[11px] font-semibold">Total Biaya Akhir:</span>
                  <span className="text-base font-bold text-blue-900">{formatRupiah(summaryFinalCost)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  *Hanya paket dengan input berat lengkap dan valid yang akan disimpan. Status otomatis berubah ke <strong>Tiba di Timika</strong>.
                </span>
                <button
                  onClick={handleSaveAllWeights}
                  disabled={isSaving || validPackagesToSave.length === 0}
                  className="rounded-xl bg-[#0B1E36] px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 flex items-center"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan Timbangan...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Simpan Semua Timbangan ({validPackagesToSave.length} Paket)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: All Weighed Active Packages Registry */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daftar Paket Sudah Ditimbang ({filteredAllWeighed.length} paket)
            </h2>
            <p className="text-xs text-slate-500">
              Paket aktif yang telah memiliki berat & ongkir (status Tiba di Timika). Siap dilunasi di menu Pelunasan.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari resi / nama pelanggan..."
              value={weighedSearchQuery}
              onChange={(e) => setWeighedSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nomor Resi</th>
                <th className="py-2.5 px-3">Pelanggan</th>
                <th className="py-2.5 px-3">Closing</th>
                <th className="py-2.5 px-3">Berat</th>
                <th className="py-2.5 px-3">Promo</th>
                <th className="py-2.5 px-3 text-right">Total Ongkir</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAllWeighed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Belum ada paket yang sudah ditimbang.
                  </td>
                </tr>
              ) : (
                filteredAllWeighed.map((pkg, idx) => (
                  <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{pkg.waybill}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{pkg.customerName}</td>
                    <td className="py-2 px-3 text-slate-600">{formatDateDDMMYYYY(pkg.closingDate)}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{pkg.weight.toFixed(2)} kg</td>
                    <td className="py-2 px-3">
                      {pkg.isPromo ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          -Rp10rb
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700">
                      {formatRupiah(pkg.finalCost)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditingPkg(pkg);
                            setEditWeightInput(String(pkg.weight));
                            setEditPromoInput(pkg.isPromo);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          title="Edit Timbangan"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmPkg(pkg)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Hapus Paket"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Koreksi Timbangan: {editingPkg.waybill}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pelanggan: {editingPkg.customerName}
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Berat Paket (kg)
                </label>
                <input
                  type="text"
                  value={editWeightInput}
                  onChange={(e) => setEditWeightInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-sm font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPromoInput}
                    onChange={(e) => setEditPromoInput(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="ml-2 font-medium text-slate-700">Dapatkan Promo Potongan Rp10.000</span>
                </label>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingPkg(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Simpan Koreksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-center text-base font-bold text-slate-900">Hapus Paket Timbangan?</h3>
            <p className="mt-1 text-center text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus resi <strong className="text-slate-800">{deleteConfirmPkg.waybill}</strong> ({deleteConfirmPkg.customerName})?
            </p>
            <div className="mt-5 flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPkg(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteWeighedPackage}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
