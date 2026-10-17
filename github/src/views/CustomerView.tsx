import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Customer } from '@/src/types';
import { normalizeWhatsapp, formatRupiah, formatDateDDMMYYYY } from '@/src/utils/formatters';
import { logActivity } from '@/src/services/dataService';
import * as XLSX from 'xlsx';
import {
  Users,
  UserPlus,
  Search,
  Upload,
  Phone,
  Edit2,
  Trash2,
  FileSpreadsheet,
  FileText,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Wallet,
  ArrowRight,
  RefreshCw,
  X,
} from 'lucide-react';

interface ImportCandidate {
  name: string;
  whatsapp: string;
  notes?: string;
  status: 'valid' | 'duplicate_db' | 'duplicate_file' | 'invalid_name';
  reason?: string;
}

export const CustomerView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal create/edit customer
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Import Modal & States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'csv' | 'excel' | 'device'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importResultReport, setImportResultReport] = useState<{
    valid: number;
    duplicate: number;
    failed: number;
  } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Real-time listener for customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormWhatsapp('');
    setFormNotes('');
    setFormStatus('active');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormWhatsapp(cust.whatsapp || '');
    setFormNotes(cust.notes || '');
    setFormStatus(cust.status || 'active');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Nama pelanggan tidak boleh kosong.');
      return;
    }

    const cleanWA = formWhatsapp.trim() ? normalizeWhatsapp(formWhatsapp.trim()) : '';

    // Check duplicate phone if provided
    if (cleanWA) {
      const duplicatePhone = customers.find(c =>
        c.whatsapp === cleanWA && (!editingCustomer || c.id !== editingCustomer.id)
      );
      if (duplicatePhone) {
        setFormError(`Nomor WhatsApp ini sudah digunakan oleh pelanggan "${duplicatePhone.name}".`);
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingCustomer) {
        // Update
        const ref = doc(db, 'customers', editingCustomer.id);
        await updateDoc(ref, {
          name: cleanName,
          whatsapp: cleanWA,
          notes: formNotes.trim(),
          status: formStatus,
          updatedAt: new Date().toISOString(),
        });

        await logActivity({
          action: 'UPDATE_CUSTOMER',
          category: 'customer',
          targetId: editingCustomer.id,
          details: `Memperbarui data pelanggan: ${cleanName}`,
        });

        setToast({ type: 'success', message: `Data pelanggan ${cleanName} berhasil diperbarui.` });
      } else {
        // Create
        const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newCust: Customer = {
          id,
          name: cleanName,
          whatsapp: cleanWA,
          notes: formNotes.trim(),
          status: formStatus,
          depositBalance: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'customers', id), newCust);
        await logActivity({
          action: 'CREATE_CUSTOMER',
          category: 'customer',
          targetId: id,
          details: `Menambah pelanggan baru: ${cleanName}`,
        });

        setToast({ type: 'success', message: `Pelanggan ${cleanName} berhasil ditambahkan.` });
      }

      setShowFormModal(false);
    } catch (err: any) {
      setFormError('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'customers', deleteTarget.id));
      await logActivity({
        action: 'DELETE_CUSTOMER',
        category: 'customer',
        targetId: deleteTarget.id,
        details: `Menghapus pelanggan ${deleteTarget.name}`,
      });
      setToast({ type: 'success', message: `Pelanggan ${deleteTarget.name} berhasil dihapus.` });
      setDeleteTarget(null);
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal menghapus pelanggan: ' + err.message });
    }
  };

  // Analyze raw imported rows into candidates with validation & duplicate detection
  const processImportRows = (rows: Array<{ name: string; whatsapp?: string; notes?: string }>) => {
    const existingNames = new Set(customers.map(c => c.name.toLowerCase()));
    const existingPhones = new Set(customers.filter(c => !!c.whatsapp).map(c => c.whatsapp));
    const seenNames = new Set<string>();
    const seenPhones = new Set<string>();

    const candidates: ImportCandidate[] = [];

    for (const r of rows) {
      const rawName = (r.name || '').trim();
      const rawWA = (r.whatsapp || '').trim();
      const normWA = rawWA ? normalizeWhatsapp(rawWA) : '';

      if (!rawName) {
        candidates.push({
          name: '(Kosong)',
          whatsapp: normWA,
          status: 'invalid_name',
          reason: 'Nama pelanggan tidak boleh kosong',
        });
        continue;
      }

      const lowerName = rawName.toLowerCase();
      if (seenNames.has(lowerName)) {
        candidates.push({
          name: rawName,
          whatsapp: normWA,
          status: 'duplicate_file',
          reason: 'Duplikat dalam file impor',
        });
        continue;
      }

      if (normWA && seenPhones.has(normWA)) {
        candidates.push({
          name: rawName,
          whatsapp: normWA,
          status: 'duplicate_file',
          reason: 'Nomor WhatsApp duplikat dalam file impor',
        });
        continue;
      }

      if (existingNames.has(lowerName)) {
        candidates.push({
          name: rawName,
          whatsapp: normWA,
          status: 'duplicate_db',
          reason: 'Nama sudah ada di database pelanggan',
        });
        continue;
      }

      if (normWA && existingPhones.has(normWA)) {
        candidates.push({
          name: rawName,
          whatsapp: normWA,
          status: 'duplicate_db',
          reason: 'Nomor WhatsApp sudah terdaftar di database',
        });
        continue;
      }

      seenNames.add(lowerName);
      if (normWA) seenPhones.add(normWA);

      candidates.push({
        name: rawName,
        whatsapp: normWA,
        notes: r.notes || '',
        status: 'valid',
      });
    }

    setImportCandidates(candidates);
    setImportResultReport(null);
  };

  // Method 1: Salin-Tempel Teks
  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n');
    const rows: Array<{ name: string; whatsapp?: string }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Supported delimiters: comma, semicolon, tab, pipe
      const parts = trimmed.split(/[,;\t|]/);
      const name = parts[0]?.trim();
      const wa = parts[1]?.trim() || '';
      if (name) {
        rows.push({ name, whatsapp: wa });
      }
    }
    processImportRows(rows);
  };

  // Method 2 & 3: File Upload (CSV & Excel)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const rows: Array<{ name: string; whatsapp?: string; notes?: string }> = [];

        // Check if row 0 is header
        let startIdx = 0;
        if (rawJson.length > 0 && typeof rawJson[0][0] === 'string') {
          const h0 = String(rawJson[0][0]).toLowerCase();
          if (h0.includes('nama') || h0.includes('name') || h0.includes('pelanggan')) {
            startIdx = 1;
          }
        }

        for (let i = startIdx; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;
          const name = String(row[0] || '').trim();
          const wa = String(row[1] || '').trim();
          const notes = String(row[2] || '').trim();
          if (name) {
            rows.push({ name, whatsapp: wa, notes });
          }
        }

        processImportRows(rows);
      } catch (err: any) {
        alert('Gagal membaca file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Method 4: Pick Contacts from Phone (Contact Picker API)
  const handleDeviceContactsPick = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      alert('Fitur akses kontak browser tidak didukung di perangkat/browser ini. Silakan gunakan metode Impor CSV, Excel, atau Salin-Tempel Teks.');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const contacts = await (navigator as any).contacts.select(props, { multiple: true });
      if (contacts && contacts.length > 0) {
        const rows = contacts.map((c: any) => ({
          name: Array.isArray(c.name) ? c.name[0] : c.name,
          whatsapp: Array.isArray(c.tel) ? c.tel[0] : c.tel,
        }));
        processImportRows(rows);
      }
    } catch (err: any) {
      console.warn('Contacts pick cancelled or failed:', err);
    }
  };

  // Commit valid candidates to Firestore
  const handleCommitImport = async () => {
    const validOnes = importCandidates.filter(c => c.status === 'valid');
    if (validOnes.length === 0) {
      alert('Tidak ada data kontak yang valid untuk disimpan.');
      return;
    }

    setIsProcessingImport(true);
    let successCount = 0;

    try {
      for (const item of validOnes) {
        const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newCust: Customer = {
          id,
          name: item.name,
          whatsapp: item.whatsapp,
          notes: item.notes || '',
          depositBalance: 0,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'customers', id), newCust);
        successCount++;
      }

      await logActivity({
        action: 'IMPORT_CUSTOMERS',
        category: 'customer',
        details: `Berhasil mengimpor ${successCount} pelanggan baru`,
      });

      setImportResultReport({
        valid: successCount,
        duplicate: importCandidates.filter(c => c.status === 'duplicate_db' || c.status === 'duplicate_file').length,
        failed: importCandidates.filter(c => c.status === 'invalid_name').length,
      });

      setToast({
        type: 'success',
        message: `Berhasil menyimpan ${successCount} pelanggan ke database!`,
      });

      // Clear candidates
      setImportCandidates([]);
      setPasteText('');
    } catch (err: any) {
      alert('Gagal menyimpan impor: ' + err.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.whatsapp?.includes(searchQuery) ||
    c.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <Users className="mr-2 h-6 w-6 text-blue-600" />
            Database Info Customer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Sumber utama data nama, nomor WhatsApp terverifikasi, dan saldo deposit pelanggan ZDN Cargo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95"
          >
            <Upload className="mr-1.5 h-4 w-4 text-slate-500" />
            Impor Kontak (4 Metode)
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-xl bg-[#0B1E36] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow hover:bg-slate-800 transition active:scale-95"
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Tambah Pelanggan
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 text-xs sm:text-sm shadow-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Customer Registry Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-slate-800">
              Total Pelanggan Terdaftar: {customers.length}
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau no. WhatsApp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nama Pelanggan</th>
                <th className="py-2.5 px-3">Nomor WhatsApp</th>
                <th className="py-2.5 px-3">Saldo Deposit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Catatan</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {loading ? 'Memuat data pelanggan...' : 'Belum ada data pelanggan yang sesuai.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust, idx) => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{cust.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {cust.whatsapp ? (
                        <a
                          href={`https://wa.me/${cust.whatsapp}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <Phone className="mr-1 h-3 w-3 text-emerald-600" />
                          {cust.whatsapp}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Belum diisi</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${cust.depositBalance > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {formatRupiah(cust.depositBalance || 0)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          cust.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {cust.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate">
                      {cust.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => openEditModal(cust)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          title="Edit Pelanggan"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(cust)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Hapus Pelanggan"
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

      {/* Add / Edit Customer Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 flex items-center">
                <AlertTriangle className="mr-1.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ibu Fatimah Timika"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp (Format otomatis disesuaikan)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Boleh dikosongkan terlebih dahulu saat scan awal.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: Toko Berkah Timika / Pengiriman rutin"
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-5 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0B1E36] px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Contacts Modal (4 Methods) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Impor Kontak Pelanggan (4 Metode)
                </h3>
                <p className="text-xs text-slate-500">
                  Dukung validasi duplikasi, pratinjau data, dan normalisasi nomor WhatsApp.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportCandidates([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-slate-200 mb-4 text-xs font-semibold">
              <button
                onClick={() => setImportTab('paste')}
                className={`flex items-center px-3 py-2 border-b-2 transition ${
                  importTab === 'paste'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                1. Salin-Tempel Teks
              </button>
              <button
                onClick={() => setImportTab('csv')}
                className={`flex items-center px-3 py-2 border-b-2 transition ${
                  importTab === 'csv'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                2. Impor CSV
              </button>
              <button
                onClick={() => setImportTab('excel')}
                className={`flex items-center px-3 py-2 border-b-2 transition ${
                  importTab === 'excel'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                3. Impor Excel (.xlsx)
              </button>
              <button
                onClick={() => setImportTab('device')}
                className={`flex items-center px-3 py-2 border-b-2 transition ${
                  importTab === 'device'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="mr-1.5 h-4 w-4" />
                4. Kontak HP
              </button>
            </div>

            {/* Tab 1: Paste Text */}
            {importTab === 'paste' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Tempel daftar nama dan nomor WhatsApp per baris, dipisahkan koma atau tab:
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Budi Santoso, 081234567890\nSiti Rahma, 081398765432\nToko Sumber Rezeki, 082199887766`}
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleParsePasteText}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Proses & Periksa Data Teks
                </button>
              </div>
            )}

            {/* Tab 2: CSV */}
            {importTab === 'csv' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Unggah file CSV dengan kolom: <code className="bg-slate-100 px-1 py-0.5 rounded">Nama, Nomor WhatsApp, Catatan</code>
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            )}

            {/* Tab 3: Excel */}
            {importTab === 'excel' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Unggah file Excel (.xlsx / .xls). Baris pertama dapat berupa header: <code className="bg-slate-100 px-1 py-0.5 rounded">Nama | WhatsApp | Catatan</code>
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            )}

            {/* Tab 4: Device Contacts */}
            {importTab === 'device' && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs text-slate-700">
                  Fitur Contact Picker API memungkinkan Anda memilih kontak langsung dari daftar kontak smartphone atau browser Chrome/Edge yang mendukung.
                </p>
                <button
                  onClick={handleDeviceContactsPick}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 flex items-center"
                >
                  <Smartphone className="mr-1.5 h-4 w-4" />
                  Buka Pemilih Kontak HP
                </button>
                <p className="text-[11px] text-slate-400">
                  Catatan: Jika browser tidak mendukung Contact Picker API, browser akan menampilkan pesan dan Anda dapat menggunakan metode CSV atau Salin-Tempel.
                </p>
              </div>
            )}

            {/* Preview Candidates Table */}
            {importCandidates.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Hasil Pratinjau & Validasi ({importCandidates.length} baris)
                  </h4>
                  <div className="flex space-x-2 text-[11px]">
                    <span className="text-emerald-700 font-semibold">
                      Valid: {importCandidates.filter(c => c.status === 'valid').length}
                    </span>
                    <span className="text-amber-700 font-semibold">
                      Duplikat: {importCandidates.filter(c => c.status.startsWith('duplicate')).length}
                    </span>
                    <span className="text-rose-700 font-semibold">
                      Gagal: {importCandidates.filter(c => c.status === 'invalid_name').length}
                    </span>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-700 sticky top-0">
                      <tr>
                        <th className="py-2 px-2.5">Nama</th>
                        <th className="py-2 px-2.5">WhatsApp</th>
                        <th className="py-2 px-2.5">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importCandidates.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 font-medium">{c.name}</td>
                          <td className="py-1.5 px-2.5 font-mono text-slate-600">{c.whatsapp || '-'}</td>
                          <td className="py-1.5 px-2.5">
                            {c.status === 'valid' && (
                              <span className="text-emerald-700 font-medium flex items-center">
                                <CheckCircle className="mr-1 h-3.5 w-3.5" /> Siap Disimpan
                              </span>
                            )}
                            {c.status === 'duplicate_db' && (
                              <span className="text-amber-700 font-medium flex items-center" title={c.reason}>
                                <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Duplikat Database (Dilewati)
                              </span>
                            )}
                            {c.status === 'duplicate_file' && (
                              <span className="text-amber-700 font-medium flex items-center" title={c.reason}>
                                <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Duplikat File (Dilewati)
                              </span>
                            )}
                            {c.status === 'invalid_name' && (
                              <span className="text-rose-700 font-medium flex items-center">
                                <XCircle className="mr-1 h-3.5 w-3.5" /> Nama Kosong
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-slate-500">
                    Sistem otomatis melewati data duplikat tanpa menimpa data pelanggan lama.
                  </p>
                  <button
                    onClick={handleCommitImport}
                    disabled={isProcessingImport || importCandidates.filter(c => c.status === 'valid').length === 0}
                    className="rounded-xl bg-[#0B1E36] px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center"
                  >
                    {isProcessingImport ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        Simpan Data Valid ({importCandidates.filter(c => c.status === 'valid').length})
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Result Report */}
            {importResultReport && (
              <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900">
                <h4 className="font-bold flex items-center mb-1">
                  <CheckCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
                  Laporan Hasil Impor Kontak
                </h4>
                <p>Data baru berhasil disimpan: <strong>{importResultReport.valid} pelanggan</strong></p>
                <p>Data duplikat dilewati: <strong>{importResultReport.duplicate} kontak</strong></p>
                <p>Data gagal / tidak valid: <strong>{importResultReport.failed} kontak</strong></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-center text-base font-bold text-slate-900">Hapus Pelanggan?</h3>
            <p className="mt-1 text-center text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus pelanggan <strong className="text-slate-800">{deleteTarget.name}</strong>? Riwayat transaksi paket lama tetap tersimpan.
            </p>
            <div className="mt-5 flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
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
