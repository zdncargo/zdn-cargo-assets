import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Payment, Package, AppSettings } from '@/src/types';
import { formatRupiah, formatDateDDMMYYYY, formatDateTimeWIT } from '@/src/utils/formatters';
import { generatePaidReceiptPDF, printThermalReceipt } from '@/src/utils/documentGenerator';
import { logActivity } from '@/src/services/dataService';
import {
  Archive,
  Search,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
  Calendar,
  CheckCircle,
  AlertTriangle,
  User,
  Eye,
  X,
  CreditCard,
} from 'lucide-react';

interface ArsipViewProps {
  settings: AppSettings;
}

export const ArsipView: React.FC<ArsipViewProps> = ({ settings }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentPackages, setPaymentPackages] = useState<Package[]>([]);

  // Restore & Delete confirmation
  const [restoreConfirmPay, setRestoreConfirmPay] = useState<Payment | null>(null);
  const [deleteConfirmPay, setDeleteConfirmPay] = useState<Payment | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'payments'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Payment));
      list.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      setPayments(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openDetailModal = async (pay: Payment) => {
    setSelectedPayment(pay);
    try {
      // Fetch packages for this payment
      const q = query(collection(db, 'packages'), where('paymentId', '==', pay.id));
      const snap = await getDocs(q);
      const pkgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      setPaymentPackages(pkgs);
    } catch (err) {
      console.warn('Error fetching payment packages:', err);
    }
  };

  const handlePrintPDF = (pay: Payment) => {
    // If details already cached or fetch
    const pkgs: Package[] = (pay.packageDetails || []).map((p, idx) => ({
      id: p.packageId || `item_${idx}`,
      waybill: p.waybill,
      customerId: pay.customerId,
      customerName: pay.customerName,
      customerWhatsapp: pay.customerWhatsapp,
      closingDate: p.closingDate || pay.paidAt.split('T')[0],
      status: 'Tiba di Timika',
      paymentStatus: 'paid',
      weight: p.weight,
      isPromo: false,
      promoAmount: 0,
      normalCost: p.cost,
      finalCost: p.cost,
      paidAmount: p.cost,
      remainingCost: 0,
      scannedBy: 'system',
      isArchived: true,
      createdAt: pay.createdAt,
      updatedAt: pay.paidAt,
    }));
    generatePaidReceiptPDF(pay, pkgs, settings);
  };

  const handlePrintThermal = (pay: Payment, width: '58mm' | '80mm') => {
    const pkgs = (pay.packageDetails || []).map(p => ({
      waybill: p.waybill,
      weight: p.weight,
      cost: p.cost,
    }));

    printThermalReceipt({
      title: 'BUKTI PEMBAYARAN LUNAS',
      customerName: pay.customerName,
      packages: pkgs,
      total: pay.totalAmount,
      date: pay.paidAt,
      isPaid: true,
      method: pay.paymentMethod,
      settings,
      paperWidth: width,
    });
  };

  const handleRestorePayment = async () => {
    if (!restoreConfirmPay) return;
    try {
      // Un-archive packages back to active unpaid
      const q = query(collection(db, 'packages'), where('paymentId', '==', restoreConfirmPay.id));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'packages', d.id), {
          paymentStatus: 'unpaid',
          isArchived: false,
          paymentId: '',
          paidAmount: 0,
          updatedAt: new Date().toISOString(),
        });
      }

      await deleteDoc(doc(db, 'payments', restoreConfirmPay.id));

      await logActivity({
        action: 'RESTORE_ARCHIVE',
        category: 'payment',
        targetId: restoreConfirmPay.id,
        details: `Memulihkan transaksi ${restoreConfirmPay.id} milik ${restoreConfirmPay.customerName} kembali ke tagihan belum lunas.`,
      });

      setToast({ type: 'success', message: 'Transaksi berhasil dipulihkan kembali ke tagihan belum lunas.' });
      setRestoreConfirmPay(null);
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal memulihkan: ' + err.message });
    }
  };

  const handleDeletePayment = async () => {
    if (!deleteConfirmPay) return;
    try {
      await deleteDoc(doc(db, 'payments', deleteConfirmPay.id));
      await logActivity({
        action: 'DELETE_PAYMENT',
        category: 'payment',
        targetId: deleteConfirmPay.id,
        details: `Menghapus arsip pembayaran ${deleteConfirmPay.id} (${deleteConfirmPay.customerName})`,
      });
      setToast({ type: 'success', message: 'Arsip pembayaran berhasil dihapus permanen.' });
      setDeleteConfirmPay(null);
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal menghapus: ' + err.message });
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !dateFilter || p.paidAt.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <Archive className="mr-2 h-6 w-6 text-blue-600" />
          Menu Arsip Transaksi Pelunasan (Khusus Superadmin)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Riwayat lengkap semua transaksi kargo yang telah lunas. Dilengkapi cetak ulang PDF nota dan struk printer termal 58mm/80mm.
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
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama pelanggan atau No. Transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Archived Transactions Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto max-h-[500px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Waktu Bayar</th>
                <th className="py-2.5 px-3">Nama Pelanggan</th>
                <th className="py-2.5 px-3">Jumlah Paket</th>
                <th className="py-2.5 px-3">Total Ongkir</th>
                <th className="py-2.5 px-3">Metode</th>
                <th className="py-2.5 px-3">Penyerahan</th>
                <th className="py-2.5 px-3 text-right">Cetak / Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {loading ? 'Memuat arsip transaksi...' : 'Belum ada riwayat transaksi lunas.'}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay, idx) => (
                  <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-slate-700">{formatDateDDMMYYYY(pay.paidAt)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{pay.customerName}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {(pay.packageIds || []).length} paket
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-800">{formatRupiah(pay.totalAmount)}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                        {pay.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          pay.deliveryStatus === 'diambil'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pay.deliveryStatus === 'diambil' ? 'Diambil' : 'Titip Gudang'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openDetailModal(pay)}
                          title="Lihat Rincian"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrintPDF(pay)}
                          title="Cetak Ulang Kwitansi PDF"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrintThermal(pay, '58mm')}
                          title="Cetak Struk Thermal 58mm"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setRestoreConfirmPay(pay)}
                          title="Pulihkan Transaksi (Batalkan Lunas)"
                          className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmPay(pay)}
                          title="Hapus Permanen"
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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

      {/* Transaction Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Detail Transaksi: {selectedPayment.id}
              </h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Pelanggan:</span>
                  <span className="font-bold text-slate-900">{selectedPayment.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Waktu Bayar:</span>
                  <span className="font-bold text-slate-900">{formatDateTimeWIT(selectedPayment.paidAt)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Metode Pembayaran:</span>
                  <span className="font-bold uppercase text-slate-900">{selectedPayment.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status Penyerahan:</span>
                  <span className="font-bold text-slate-900">{selectedPayment.deliveryStatus === 'diambil' ? 'Sudah Diambil' : 'Dititipkan'}</span>
                </div>
              </div>

              <div className="font-bold text-slate-800">Daftar Paket Terbayar:</div>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="py-2 px-2.5">Resi / AWB</th>
                      <th className="py-2 px-2.5">Berat</th>
                      <th className="py-2 px-2.5 text-right">Biaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedPayment.packageDetails || []).map((p, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2.5 font-mono font-bold">{p.waybill}</td>
                        <td className="py-1.5 px-2.5">{p.weight.toFixed(2)} kg</td>
                        <td className="py-1.5 px-2.5 text-right font-semibold">{formatRupiah(p.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-sm text-slate-900">
                <span>TOTAL TRANSAKSI:</span>
                <span className="text-blue-700">{formatRupiah(selectedPayment.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => handlePrintThermal(selectedPayment, '58mm')}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
              >
                <Receipt className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                Struk 58mm
              </button>
              <button
                type="button"
                onClick={() => handlePrintPDF(selectedPayment)}
                className="rounded-xl bg-[#0B1E36] px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 flex items-center"
              >
                <Printer className="mr-1 h-3.5 w-3.5" />
                Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirmPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              Pulihkan Transaksi?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Apakah Anda ingin memulihkan transaksi <strong className="text-slate-800">{restoreConfirmPay.id}</strong> ({restoreConfirmPay.customerName})? Paket akan kembali berstatus BELUM LUNAS di menu Pelunasan.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmPay(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRestorePayment}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Ya, Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              Hapus Arsip Transaksi?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Apakah Anda yakin ingin menghapus permanen catatan transaksi <strong className="text-slate-800">{deleteConfirmPay.id}</strong>?
            </p>
            <div className="flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPay(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeletePayment}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
