import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Customer, Package } from '@/src/types';
import { saveScannedPackage, findOrCreateCustomer, logActivity } from '@/src/services/dataService';
import { getTodayJayapura, formatDateDDMMYYYY, normalizeWhatsapp } from '@/src/utils/formatters';
import { BarcodeCameraScanner } from '@/src/components/BarcodeCameraScanner';
import {
  Barcode,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Edit2,
  Calendar,
  User,
  Phone,
  Search,
  Plus,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const ScanView: React.FC = () => {
  // Form State
  const [closingDate, setClosingDate] = useState<string>(getTodayJayapura());
  const [waybill, setWaybill] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Autocomplete & Customer list
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Active scanned packages list
  const [recentPackages, setRecentPackages] = useState<Package[]>([]);
  const [searchTableQuery, setSearchTableQuery] = useState('');

  // UI state
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'duplicate';
    message: string;
  } | null>(null);

  // Edit modal
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [deleteConfirmPkg, setDeleteConfirmPkg] = useState<Package | null>(null);

  const waybillInputRef = useRef<HTMLInputElement>(null);

  // Real-time listener for customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    });
    return () => unsub();
  }, []);

  // Real-time listener for active scanned packages (Tiba di Gudang Jakarta / active unpaid)
  useEffect(() => {
    const q = query(
      collection(db, 'packages'),
      where('isArchived', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      // Sort newest first
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentPackages(all);
    }, (err) => {
      console.warn('Scan packages listen error:', err);
    });
    return () => unsub();
  }, []);

  // Customer Autocomplete filtering
  useEffect(() => {
    if (customerInput.trim().length >= 2) {
      const match = customers.filter(c =>
        c.name.toLowerCase().includes(customerInput.toLowerCase())
      );
      setFilteredCustomers(match);
      setShowDropdown(match.length > 0);
    } else {
      setFilteredCustomers([]);
      setShowDropdown(false);
    }
  }, [customerInput, customers]);

  const selectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setCustomerInput(cust.name);
    setCustomerWhatsapp(cust.whatsapp || '');
    setShowDropdown(false);
  };

  const handleSavePackage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanWaybill = waybill.trim().toUpperCase();
    const cleanCustomerName = customerInput.trim();

    if (!cleanWaybill) {
      setNotification({
        type: 'error',
        message: 'Nomor resi wajib diisi atau di-scan.',
      });
      waybillInputRef.current?.focus();
      return;
    }

    if (!cleanCustomerName) {
      setNotification({
        type: 'error',
        message: 'Nama pelanggan wajib diisi atau dipilih.',
      });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      // 1. Resolve or create customer
      let cust = customers.find(c =>
        c.id === selectedCustomerId ||
        c.name.toLowerCase() === cleanCustomerName.toLowerCase()
      );

      if (!cust) {
        cust = await findOrCreateCustomer(
          cleanCustomerName,
          customerWhatsapp ? normalizeWhatsapp(customerWhatsapp) : ''
        );
      }

      // 2. Save package with duplicate check
      const saved = await saveScannedPackage({
        waybill: cleanWaybill,
        customerId: cust.id,
        customerName: cust.name,
        customerWhatsapp: cust.whatsapp || '',
        closingDate: closingDate,
        notes: notes.trim(),
      });

      // 3. Log audit
      await logActivity({
        action: 'SCAN_PACKAGE',
        category: 'scan',
        targetId: saved.id,
        details: `Scan resi ${saved.waybill} untuk pelanggan ${saved.customerName}`,
      });

      // 4. Success feedback
      setNotification({
        type: 'success',
        message: `BERHASIL! Resi ${cleanWaybill} berhasil disimpan untuk ${cust.name}.`,
      });

      // 5. Reset form: clear waybill and customer name, LEAVE DATE UNCHANGED, refocus waybill
      setWaybill('');
      setCustomerInput('');
      setCustomerWhatsapp('');
      setNotes('');
      setSelectedCustomerId(null);
      setTimeout(() => {
        waybillInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      console.error('Error saving package:', err);
      if (err.message && err.message.includes('DUPLICATE_WAYBILL')) {
        setNotification({
          type: 'duplicate',
          message: `DUPLIKAT! ${err.message}`,
        });
      } else {
        setNotification({
          type: 'error',
          message: `GAGAL: ${err.message || 'Terjadi kesalahan saat menyimpan resi.'}`,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCameraScanSuccess = (scannedText: string) => {
    setShowCamera(false);
    setWaybill(scannedText.toUpperCase());
    setNotification({
      type: 'success',
      message: `Barcode terbaca: ${scannedText}. Lengkapi nama pelanggan dan simpan.`,
    });
  };

  const handleDeletePackage = async () => {
    if (!deleteConfirmPkg) return;
    try {
      await deleteDoc(doc(db, 'packages', deleteConfirmPkg.id));
      await logActivity({
        action: 'DELETE_PACKAGE',
        category: 'scan',
        targetId: deleteConfirmPkg.id,
        details: `Menghapus resi ${deleteConfirmPkg.waybill} (${deleteConfirmPkg.customerName})`,
      });
      setNotification({
        type: 'success',
        message: `Resi ${deleteConfirmPkg.waybill} berhasil dihapus.`,
      });
      setDeleteConfirmPkg(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'Gagal menghapus resi: ' + err.message,
      });
    }
  };

  const handleUpdatePackage = async () => {
    if (!editingPackage) return;
    try {
      await updateDoc(doc(db, 'packages', editingPackage.id), {
        notes: editNotes,
        updatedAt: new Date().toISOString(),
      });
      await logActivity({
        action: 'EDIT_PACKAGE',
        category: 'scan',
        targetId: editingPackage.id,
        details: `Mengedit catatan resi ${editingPackage.waybill}`,
      });
      setEditingPackage(null);
      setNotification({
        type: 'success',
        message: 'Perubahan resi berhasil disimpan.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: 'Gagal menyimpan perubahan: ' + err.message,
      });
    }
  };

  const filteredRecentPackages = recentPackages.filter(p =>
    p.waybill.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
    p.customerName.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
    p.closingDate.includes(searchTableQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <Barcode className="mr-2 h-6 w-6 text-blue-600" />
            Menu Scan Paket Masuk Jakarta
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Penerimaan resi ekspedisi/marketplace di Gudang Jakarta. Status awal otomatis: <strong>Tiba di Gudang Jakarta</strong>.
          </p>
        </div>
        <button
          onClick={() => setShowCamera(true)}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all"
        >
          <Camera className="mr-2 h-5 w-5 text-blue-200" />
          Buka Kamera HP
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`flex items-start justify-between rounded-xl p-4 shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : notification.type === 'duplicate'
              ? 'bg-amber-50 border border-amber-300 text-amber-900'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-3">
            {notification.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />}
            {notification.type === 'duplicate' && <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />}
            {notification.type === 'error' && <XCircle className="h-5 w-5 text-rose-600 shrink-0" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Scan Entry Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <form onSubmit={handleSavePackage} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tanggal Closing */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                Tanggal Closing / Diterima
              </label>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Format: {formatDateDDMMYYYY(closingDate)} (tetap tersimpan setelah scan)
              </span>
            </div>

            {/* Nomor Resi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center">
                  <Barcode className="mr-1.5 h-4 w-4 text-blue-600" />
                  Nomor Resi / AWB Asli
                </span>
                <span className="text-[10px] text-blue-600 font-normal">Support Scanner USB/BT</span>
              </label>
              <div className="relative">
                <input
                  ref={waybillInputRef}
                  type="text"
                  placeholder="Scan barcode atau ketik resi..."
                  value={waybill}
                  onChange={(e) => setWaybill(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase tracking-wide text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  title="Scan pakai kamera HP"
                  className="absolute right-2 top-2 rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Nama Pelanggan (Autocomplete) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                <User className="mr-1.5 h-4 w-4 text-slate-400" />
                Nama Pelanggan (Customer)
              </label>
              <input
                type="text"
                placeholder="Ketik minimal 2 huruf..."
                value={customerInput}
                onChange={(e) => {
                  setCustomerInput(e.target.value);
                  setSelectedCustomerId(null);
                }}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                required
              />

              {/* Autocomplete Dropdown */}
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {filteredCustomers.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => selectCustomer(cust)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-xs flex items-center justify-between border-b border-slate-100 last:border-0"
                    >
                      <span className="font-semibold text-slate-800">{cust.name}</span>
                      <span className="text-slate-400">{cust.whatsapp || 'Tanpa No. WA'}</span>
                    </button>
                  ))}
                  <div className="p-2 bg-slate-50 text-[11px] text-slate-500 text-center">
                    Jika pelanggan baru, langsung simpan untuk mendaftarkan otomatis.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: WhatsApp Opsional & Catatan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                <Phone className="mr-1.5 h-4 w-4 text-slate-400" />
                Nomor WhatsApp Pelanggan (Opsional)
              </label>
              <input
                type="text"
                placeholder="081234567890 (bisa dilengkapi nanti)"
                value={customerWhatsapp}
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Paket (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Fragile / Pakaian / Kosmetik"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl bg-[#0B1E36] px-6 py-3 text-sm font-bold text-white shadow hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan Resi...
                </>
              ) : (
                <>
                  Simpan Paket (Enter)
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Scanned Packages Active Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daftar Paket Aktif Hasil Scan ({filteredRecentPackages.length} paket)
            </h2>
            <p className="text-xs text-slate-500">
              Paket yang belum lunas. Paket LUNAS otomatis keluar dari daftar aktif dan tersimpan di Arsip.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari resi / customer..."
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Scrollable table container */}
        <div className="overflow-x-auto max-h-[460px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nomor Resi / AWB</th>
                <th className="py-2.5 px-3">Nama Pelanggan</th>
                <th className="py-2.5 px-3">Closing</th>
                <th className="py-2.5 px-3">Status Perjalanan</th>
                <th className="py-2.5 px-3">Berat</th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecentPackages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Belum ada paket aktif yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredRecentPackages.map((pkg, idx) => (
                  <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{pkg.waybill}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <div>{pkg.customerName}</div>
                      {pkg.customerWhatsapp && (
                        <div className="text-[10px] text-slate-400">{pkg.customerWhatsapp}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{formatDateDDMMYYYY(pkg.closingDate)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          pkg.status === 'Tiba di Gudang Jakarta'
                            ? 'bg-amber-100 text-amber-800'
                            : pkg.status === 'Terbang' || pkg.status === 'Dalam Perjalanan'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {pkg.weight > 0 ? `${pkg.weight.toFixed(2)} kg` : <span className="text-slate-400 italic">Belum timbang</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate">
                      {pkg.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setEditingPackage(pkg);
                            setEditNotes(pkg.notes || '');
                          }}
                          title="Edit Catatan"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmPkg(pkg)}
                          title="Hapus Resi"
                          className="rounded-md p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-700"
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

      {/* Camera Barcode Scanner Modal */}
      {showCamera && (
        <BarcodeCameraScanner
          onScanSuccess={handleCameraScanSuccess}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Edit Modal */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Edit Resi: {editingPackage.waybill}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pelanggan: {editingPackage.customerName} | Closing: {formatDateDDMMYYYY(editingPackage.closingDate)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Paket
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdatePackage}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Simpan Perubahan
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
            <h3 className="text-center text-base font-bold text-slate-900">Hapus Resi Paket?</h3>
            <p className="mt-1 text-center text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus resi <strong className="text-slate-800">{deleteConfirmPkg.waybill}</strong> milik <strong className="text-slate-800">{deleteConfirmPkg.customerName}</strong>? Tindakan ini akan dicatat di audit log.
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
                onClick={handleDeletePackage}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Ya, Hapus Resi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
