import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Package, PackageStatus, AppSettings } from '@/src/types';
import { formatDateDDMMYYYY, getTodayJayapura, getWhatsappUrl } from '@/src/utils/formatters';
import { logActivity } from '@/src/services/dataService';
import { generateClosingReportPDF } from '@/src/utils/documentGenerator';
import {
  Clock,
  Filter,
  CheckSquare,
  Square,
  Plane,
  Truck,
  Copy,
  Share2,
  Printer,
  CheckCircle,
  AlertCircle,
  Calendar,
  Check,
  RefreshCw,
} from 'lucide-react';

interface UpdateStatusViewProps {
  settings: AppSettings;
}

export const UpdateStatusView: React.FC<UpdateStatusViewProps> = ({ settings }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'closing'>('status');

  // Filter dates
  const today = getTodayJayapura();
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Packages list
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());

  // Mass update state
  const [targetStatus, setTargetStatus] = useState<PackageStatus>('Dalam Perjalanan');
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copy success state
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'packages'),
      where('isArchived', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      setAllPackages(list);
    });
    return () => unsub();
  }, []);

  // Filtered packages by closing date range and status
  const filteredPackages = allPackages.filter(p => {
    const matchesDate = (!fromDate || p.closingDate >= fromDate) && (!toDate || p.closingDate <= toDate);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesDate && matchesStatus;
  });

  const toggleSelectAll = () => {
    if (selectedPackageIds.size === filteredPackages.length) {
      setSelectedPackageIds(new Set());
    } else {
      setSelectedPackageIds(new Set(filteredPackages.map(p => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedPackageIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPackageIds(next);
  };

  // Perform bulk status update
  const handleBulkUpdateStatus = async () => {
    if (selectedPackageIds.size === 0) {
      setToast({ type: 'error', message: 'Pilih minimal satu paket untuk diperbarui statusnya.' });
      return;
    }

    setIsUpdating(true);
    setToast(null);

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      selectedPackageIds.forEach(id => {
        const ref = doc(db, 'packages', id);
        batch.update(ref, {
          status: targetStatus,
          updatedAt: now,
        });
      });

      await batch.commit();

      await logActivity({
        action: 'UPDATE_STATUS_BULK',
        category: 'status_update',
        details: `Memperbarui status ${selectedPackageIds.size} paket menjadi "${targetStatus}"`,
      });

      setToast({
        type: 'success',
        message: `BERHASIL! Status ${selectedPackageIds.size} paket diperbarui menjadi "${targetStatus}".`,
      });

      setSelectedPackageIds(new Set());
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal memperbarui status: ' + err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  // Generate "Salin Closing" WhatsApp text
  const generateClosingText = () => {
    // Packages filtered by date range
    const pkgs = filteredPackages;
    if (pkgs.length === 0) return 'Tidak ada data paket pada rentang tanggal closing yang dipilih.';

    // Aggregate by customer
    const countsByCustomer: { [name: string]: number } = {};
    let latestClosing = fromDate;

    pkgs.forEach(p => {
      countsByCustomer[p.customerName] = (countsByCustomer[p.customerName] || 0) + 1;
      if (p.closingDate > latestClosing) {
        latestClosing = p.closingDate;
      }
    });

    const customerListLines = Object.entries(countsByCustomer)
      .map(([name, count]) => `${name} ${count} paket`)
      .join('\n');

    return `PAKET TIBA DI TIMIKA\n\nClosing tanggal: ${formatDateDDMMYYYY(latestClosing)}\n\n${customerListLines}\n\nJumlah paket: ${pkgs.length} paket\n\nInfo lebih lengkap dan ongkir cek app.zdncargo.com\n\nTerima kasih.`;
  };

  const handleCopyClosingText = () => {
    const text = generateClosingText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = generateClosingText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePrintClosingPDF = () => {
    if (filteredPackages.length === 0) {
      alert('Tidak ada paket untuk dicetak.');
      return;
    }
    generateClosingReportPDF(toDate || fromDate, filteredPackages, settings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <Clock className="mr-2 h-6 w-6 text-blue-600" />
          Menu Update Status & Salin Closing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Kelola perpindahan status kargo Jakarta - Timika dan buat pengumuman closing untuk grup / WhatsApp pelanggan.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex items-center px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeTab === 'status'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Filter className="mr-2 h-4 w-4" />
          1. Update Status Perjalanan
        </button>
        <button
          onClick={() => setActiveTab('closing')}
          className={`flex items-center px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeTab === 'closing'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Share2 className="mr-2 h-4 w-4" />
          2. Salin Closing WhatsApp & PDF
        </button>
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
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
              <Calendar className="mr-1 h-3.5 w-3.5 text-slate-400" />
              Tanggal Dari (Closing)
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
              <Calendar className="mr-1 h-3.5 w-3.5 text-slate-400" />
              Tanggal Ke (Closing)
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Filter Status Saat Ini
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="all">Semua Status Aktif</option>
              <option value="Tiba di Gudang Jakarta">Tiba di Gudang Jakarta</option>
              <option value="Dalam Perjalanan">Dalam Perjalanan / Terbang</option>
              <option value="Tiba di Timika">Tiba di Timika</option>
            </select>
          </div>
        </div>
      </div>

      {/* TAB 1: UPDATE STATUS */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-medium text-slate-300">
                Terpilih: <strong className="text-white text-sm">{selectedPackageIds.size}</strong> dari {filteredPackages.length} paket
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-300">Ubah Status Menjadi:</span>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as PackageStatus)}
                className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-blue-400"
              >
                <option value="Dalam Perjalanan">Dalam Perjalanan (Terbang)</option>
                <option value="Tiba di Timika">Tiba di Timika</option>
              </select>

              <button
                onClick={handleBulkUpdateStatus}
                disabled={isUpdating || selectedPackageIds.size === 0}
                className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40 transition active:scale-95 flex items-center"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Terapkan Status Masal'
                )}
              </button>
            </div>
          </div>

          {/* Packages Table with Checkboxes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="overflow-x-auto max-h-[480px] rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        onClick={toggleSelectAll}
                        className="text-slate-500 hover:text-blue-600"
                        title="Pilih Semua"
                      >
                        {selectedPackageIds.size === filteredPackages.length && filteredPackages.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Nomor Resi / AWB</th>
                    <th className="py-2.5 px-3">Nama Pelanggan</th>
                    <th className="py-2.5 px-3">Closing</th>
                    <th className="py-2.5 px-3">Status Saat Ini</th>
                    <th className="py-2.5 px-3">Berat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPackages.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada paket yang sesuai dengan filter tanggal closing.
                      </td>
                    </tr>
                  ) : (
                    filteredPackages.map((pkg) => {
                      const isSelected = selectedPackageIds.has(pkg.id);
                      return (
                        <tr
                          key={pkg.id}
                          onClick={() => toggleSelectOne(pkg.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(pkg.id)}
                              className="h-4 w-4 rounded text-blue-600 border-slate-300"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{pkg.waybill}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{pkg.customerName}</td>
                          <td className="py-2 px-3 text-slate-600">{formatDateDDMMYYYY(pkg.closingDate)}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                pkg.status === 'Tiba di Gudang Jakarta'
                                  ? 'bg-amber-100 text-amber-800'
                                  : pkg.status === 'Dalam Perjalanan'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {pkg.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {pkg.weight > 0 ? `${pkg.weight.toFixed(2)} kg` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALIN CLOSING */}
      {activeTab === 'closing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pesan WhatsApp Pengumuman Closing Timika
              </h2>
              <p className="text-xs text-slate-500">
                Dihasilkan otomatis dari data aktual {filteredPackages.length} paket pada rentang tanggal closing yang dipilih.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyClosingText}
                className="inline-flex items-center rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95"
              >
                {copied ? <Check className="mr-1.5 h-4 w-4 text-emerald-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied ? 'Tersalin!' : 'Salin Teks'}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition active:scale-95 shadow-sm"
              >
                <Share2 className="mr-1.5 h-4 w-4" />
                Buka di WhatsApp
              </button>
              <button
                onClick={handlePrintClosingPDF}
                className="inline-flex items-center rounded-xl bg-[#0B1E36] px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-95 shadow-sm"
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Cetak PDF Rekap
              </button>
            </div>
          </div>

          <div className="relative rounded-xl bg-slate-50 p-4 border border-slate-200 font-mono text-xs whitespace-pre-wrap text-slate-800 leading-relaxed shadow-inner">
            {generateClosingText()}
          </div>
        </div>
      )}
    </div>
  );
};
