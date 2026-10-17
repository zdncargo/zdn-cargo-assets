import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Payment, Expense, Customer } from '@/src/types';
import { formatRupiah, formatDateDDMMYYYY, getTodayJayapura } from '@/src/utils/formatters';
import { logActivity } from '@/src/services/dataService';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  Download,
  Filter,
  DollarSign,
  PieChart,
  X,
  CheckCircle,
} from 'lucide-react';

export const KeuanganView: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Filter
  const [dateRangeMode, setDateRangeMode] = useState<'all' | 'today' | 'this_month' | 'custom'>('this_month');
  const todayStr = getTodayJayapura();
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);

  // Expense modal
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCategory, setExpCategory] = useState('Bagasi Udara / Maskapai');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(todayStr);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubPay = onSnapshot(collection(db, 'payments'), (snap) => {
      setPayments(snap.docs.map(d => ({ ...d.data(), id: d.id } as Payment)));
    });

    const unsubExp = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense)));
    });

    const unsubCust = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    });

    return () => {
      unsubPay();
      unsubExp();
      unsubCust();
    };
  }, []);

  // Filter date helper
  const filterByDate = (dateIso: string) => {
    const itemDate = dateIso.split('T')[0];
    if (dateRangeMode === 'today') {
      return itemDate === todayStr;
    } else if (dateRangeMode === 'this_month') {
      const currentMonth = todayStr.substring(0, 7); // YYYY-MM
      return itemDate.startsWith(currentMonth);
    } else if (dateRangeMode === 'custom') {
      return itemDate >= customFrom && itemDate <= customTo;
    }
    return true;
  };

  const filteredPayments = payments.filter(p => filterByDate(p.paidAt));
  const filteredExpenses = expenses.filter(e => filterByDate(e.date));

  // Totals
  const totalIncome = filteredPayments.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const totalCash = filteredPayments.filter(p => p.paymentMethod === 'cash').reduce((s, p) => s + (p.totalAmount || 0), 0);
  const totalTransfer = filteredPayments.filter(p => p.paymentMethod === 'transfer').reduce((s, p) => s + (p.totalAmount || 0), 0);
  const totalQRIS = filteredPayments.filter(p => p.paymentMethod === 'qris').reduce((s, p) => s + (p.totalAmount || 0), 0);

  const totalExpense = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  // Deposit liability is distinct from operational income
  const totalDepositLiability = customers.reduce((s, c) => s + (c.depositBalance || 0), 0);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount.replace(/\D/g, '')) || 0;
    if (amt <= 0) {
      alert('Jumlah pengeluaran harus lebih dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newExp: Expense = {
        id,
        category: expCategory,
        amount: amt,
        description: expDesc.trim(),
        date: expDate,
        recordedBy: auth.currentUser?.email || 'admin',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'expenses', id), newExp);
      await logActivity({
        action: 'CREATE_EXPENSE',
        category: 'payment',
        targetId: id,
        details: `Mencatat pengeluaran ${expCategory}: ${formatRupiah(amt)} (${expDesc})`,
      });

      setShowAddExpense(false);
      setExpAmount('');
      setExpDesc('');
    } catch (err: any) {
      alert('Gagal menambah pengeluaran: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, desc: string) => {
    if (!confirm(`Hapus catatan pengeluaran "${desc}"?`)) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      await logActivity({
        action: 'DELETE_EXPENSE',
        category: 'payment',
        targetId: id,
        details: `Menghapus catatan pengeluaran ${desc}`,
      });
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    let csv = 'Laporan Keuangan ZDN CARGO\n';
    csv += `Periode: ${dateRangeMode}\n\n`;
    csv += 'PEMASUKAN ONGKIR:\n';
    csv += 'No Transaksi,Tanggal,Pelanggan,Metode,Total Ongkir\n';
    filteredPayments.forEach(p => {
      csv += `"${p.id}","${p.paidAt}","${p.customerName}","${p.paymentMethod}",${p.totalAmount}\n`;
    });
    csv += `Total Pemasukan: ${totalIncome}\n\n`;

    csv += 'PENGELUARAN USAHA:\n';
    csv += 'Tanggal,Kategori,Keterangan,Jumlah\n';
    filteredExpenses.forEach(e => {
      csv += `"${e.date}","${e.category}","${e.description}",${e.amount}\n`;
    });
    csv += `Total Pengeluaran: ${totalExpense}\n`;
    csv += `Laba Bersih: ${netProfit}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Keuangan_ZDN_CARGO_${todayStr}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <Wallet className="mr-2 h-6 w-6 text-blue-600" />
            Laporan Keuangan & Pengeluaran Usaha (Superadmin)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Rekap pemasukan ongkir riil, pencatatan pengeluaran operasional Jakarta & Timika, serta pemantauan kewajiban deposit pelanggan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportToCSV}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center shadow-sm"
          >
            <Download className="mr-1.5 h-4 w-4 text-slate-500" />
            Ekspor CSV
          </button>
          <button
            onClick={() => setShowAddExpense(true)}
            className="rounded-xl bg-[#0B1E36] px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 flex items-center"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Catat Pengeluaran Baru
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-600">Pilih Periode:</span>
          <button
            onClick={() => setDateRangeMode('today')}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${
              dateRangeMode === 'today' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setDateRangeMode('this_month')}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${
              dateRangeMode === 'this_month' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Bulan Ini
          </button>
          <button
            onClick={() => setDateRangeMode('all')}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${
              dateRangeMode === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Waktu
          </button>
          <button
            onClick={() => setDateRangeMode('custom')}
            className={`rounded-lg px-3 py-1.5 font-bold transition ${
              dateRangeMode === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Kustom
          </button>
        </div>

        {dateRangeMode === 'custom' && (
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
            />
          </div>
        )}
      </div>

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Pemasukan Ongkir</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(totalIncome)}</p>
          <div className="mt-2 flex items-center space-x-2 text-[10px] text-slate-500">
            <span>Transfer: {formatRupiah(totalTransfer)}</span>
            <span>•</span>
            <span>Cash: {formatRupiah(totalCash)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Pengeluaran Usaha</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(totalExpense)}</p>
          <p className="mt-2 text-[10px] text-rose-600 font-medium">{filteredExpenses.length} transaksi pengeluaran</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Laba Bersih Operasional</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className={`mt-2 text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatRupiah(netProfit)}
          </p>
          <p className="mt-2 text-[10px] text-slate-400">Pemasukan dikurangi biaya operasional</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-800 font-semibold">
            <span>Kewajiban Deposit Pelanggan</span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{formatRupiah(totalDepositLiability)}</p>
          <p className="mt-2 text-[10px] text-amber-700">Saldo uang pelanggan yang belum digunakan</p>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Rincian Pengeluaran Operasional ({filteredExpenses.length} catatan)
        </h2>

        <div className="overflow-x-auto max-h-[400px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3">Dicatat Oleh</th>
                <th className="py-2.5 px-3 text-right">Jumlah (IDR)</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada catatan pengeluaran pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 text-slate-600">{formatDateDDMMYYYY(exp.date)}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{exp.category}</td>
                    <td className="py-2.5 px-3 text-slate-600">{exp.description || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{exp.recordedBy}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-700">{formatRupiah(exp.amount)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp.id, exp.description || exp.category)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Catat Pengeluaran Operasional Baru
              </h3>
              <button
                onClick={() => setShowAddExpense(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Pengeluaran</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                >
                  <option value="Bagasi Udara / Maskapai">Bagasi Udara / Biaya Maskapai (SMU)</option>
                  <option value="Sewa Gudang Jakarta">Sewa Gudang / Hub Jakarta</option>
                  <option value="Sewa Gudang Timika">Sewa Gudang / Operasional Timika</option>
                  <option value="BBM & Transportasi">BBM & Transportasi Antar-Jemput Kargo</option>
                  <option value="Gaji & Upah Staf">Gaji & Upah Staf Operasional</option>
                  <option value="Lakban, Karung & Packing">Lakban, Karung & Packing Kargo</option>
                  <option value="Listrik & Internet">Listrik & Internet</option>
                  <option value="Lain-Lain">Lain-Lain</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Biaya (Rp) *</label>
                <input
                  type="text"
                  placeholder="Contoh: 1500000"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-mono font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Pengeluaran</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Rinci</label>
                <textarea
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Contoh: Pembayaran SMU Garuda flight GA654 tgl 17 Okt"
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-5 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0B1E36] px-5 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
