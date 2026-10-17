import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Package, Customer, Payment, Expense, AppSettings } from '@/src/types';
import { useAuth } from '@/src/context/AuthContext';
import { formatRupiah } from '@/src/utils/formatters';
import {
  PackageCheck,
  Plane,
  Truck,
  MapPin,
  Scale,
  Clock,
  CheckCircle2,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string, filter?: string) => void;
  settings: AppSettings;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, settings }) => {
  const { isSuperAdmin } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for packages
    const unsubPackages = onSnapshot(collection(db, 'packages'), (snap) => {
      const pkgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      setPackages(pkgs);
      setLoading(false);
    }, (err) => {
      console.warn('Packages snapshot error:', err);
      setLoading(false);
    });

    // Real-time listener for customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    }, () => {});

    // If superadmin, also listen to payments & expenses
    let unsubPayments = () => {};
    let unsubExpenses = () => {};

    if (isSuperAdmin) {
      unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
        setPayments(snap.docs.map(d => ({ ...d.data(), id: d.id } as Payment)));
      }, () => {});

      unsubExpenses = onSnapshot(collection(db, 'expenses'), (snap) => {
        setExpenses(snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense)));
      }, () => {});
    }

    return () => {
      unsubPackages();
      unsubCustomers();
      unsubPayments();
      unsubExpenses();
    };
  }, [isSuperAdmin]);

  // Operational metrics
  const activePackages = packages.filter(p => !p.isArchived);
  const jakartaCount = activePackages.filter(p => p.status === 'Tiba di Gudang Jakarta').length;
  const inTransitCount = activePackages.filter(p => p.status === 'Terbang' || p.status === 'Dalam Perjalanan').length;
  const timikaCount = activePackages.filter(p => p.status === 'Tiba di Timika').length;
  const weighedCount = activePackages.filter(p => (p.weight || 0) > 0).length;
  const unpaidCount = activePackages.filter(p => p.paymentStatus !== 'paid').length;
  const paidCount = packages.filter(p => p.paymentStatus === 'paid').length;

  // Financial calculations for Superadmin
  const totalIncome = payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;
  const totalCustomerDeposits = customers.reduce((sum, c) => sum + (c.depositBalance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B1E36] via-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-full bg-blue-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-200">
                Operasional Kargo Udara
              </span>
              <span className="flex items-center text-xs text-blue-200">
                <Sparkles className="mr-1 h-3.5 w-3.5 text-yellow-300" />
                {settings.routeInfo || 'Jakarta — Timika'}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {settings.businessName || 'ZDN CARGO'}
            </h1>
            <p className="mt-1 text-sm text-blue-100 max-w-xl">
              {settings.promoInfo || 'Ongkir mulai Rp10.000 per paket.'} Tarif normal Rp{settings.tariffPerKg.toLocaleString('id-ID')}/kg ke Timika.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('scan')}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0B1E36] shadow transition hover:bg-blue-50 active:scale-95"
            >
              <PackageCheck className="mr-2 h-4 w-4 text-blue-600" />
              Mulai Scan Paket
            </button>
            <button
              onClick={() => onNavigate('timbang')}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600/80 backdrop-blur-md px-4 py-2.5 text-sm font-bold text-white border border-blue-400/30 shadow transition hover:bg-blue-600 active:scale-95"
            >
              <Scale className="mr-2 h-4 w-4" />
              Menu Timbang
            </button>
          </div>
        </div>
      </div>

      {/* Operational Stats Grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Status Operasional Paket</h2>
          <span className="text-xs text-slate-500">Klik kartu untuk membuka menu terkait</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* Gudang Jakarta */}
          <div
            onClick={() => onNavigate('scan')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Gudang Jakarta</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600 group-hover:bg-amber-100">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-slate-900">{loading ? '...' : jakartaCount}</span>
              <span className="ml-1 text-xs text-slate-500">paket</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Baru di-scan di Jakarta</p>
          </div>

          {/* Terbang / Perjalanan */}
          <div
            onClick={() => onNavigate('update_status')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Dalam Perjalanan</span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600 group-hover:bg-blue-100">
                <Plane className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-slate-900">{loading ? '...' : inTransitCount}</span>
              <span className="ml-1 text-xs text-slate-500">paket</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Terbang menuju Timika</p>
          </div>

          {/* Tiba di Timika */}
          <div
            onClick={() => onNavigate('update_status')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tiba di Timika</span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 group-hover:bg-emerald-100">
                <Truck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-slate-900">{loading ? '...' : timikaCount}</span>
              <span className="ml-1 text-xs text-slate-500">paket</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Siap ditimbang / diambil</p>
          </div>

          {/* Sudah Ditimbang */}
          <div
            onClick={() => onNavigate('timbang')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Sudah Ditimbang</span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 group-hover:bg-indigo-100">
                <Scale className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-slate-900">{loading ? '...' : weighedCount}</span>
              <span className="ml-1 text-xs text-slate-500">paket</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Memiliki rincian berat & ongkir</p>
          </div>

          {/* Belum Lunas */}
          <div
            onClick={() => onNavigate('pelunasan')}
            className="group cursor-pointer rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm transition hover:border-rose-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700">Tagihan Belum Lunas</span>
              <div className="rounded-lg bg-rose-100 p-2 text-rose-600 group-hover:bg-rose-200">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-rose-900">{loading ? '...' : unpaidCount}</span>
              <span className="ml-1 text-xs text-rose-600">paket</span>
            </div>
            <p className="mt-1 text-[11px] text-rose-600/80">Menunggu pembayaran</p>
          </div>

          {/* Lunas */}
          <div
            onClick={() => onNavigate('arsip')}
            className="group cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm transition hover:border-emerald-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700">Paket Lunas</span>
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 group-hover:bg-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-emerald-900">{loading ? '...' : paidCount}</span>
              <span className="ml-1 text-xs text-emerald-600">paket</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600/80">Tersimpan di Arsip</p>
          </div>

          {/* Pelanggan */}
          <div
            onClick={() => onNavigate('customers')}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Pelanggan</span>
              <div className="rounded-lg bg-purple-50 p-2 text-purple-600 group-hover:bg-purple-100">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-bold text-slate-900">{loading ? '...' : customers.length}</span>
              <span className="ml-1 text-xs text-slate-500">orang</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Database Info Customer</p>
          </div>
        </div>
      </div>

      {/* Superadmin Financial Overview */}
      {isSuperAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Wallet className="mr-2 h-5 w-5 text-blue-600" />
                Ringkasan Keuangan (Khusus Superadmin)
              </h2>
              <p className="text-xs text-slate-500">Berdasarkan data pembayaran riil dan catatan pengeluaran usaha</p>
            </div>
            <button
              onClick={() => onNavigate('keuangan')}
              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
            >
              Buka Laporan Keuangan →
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Pemasukan Ongkir</span>
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(totalIncome)}</p>
              <p className="mt-0.5 text-[11px] text-emerald-600 font-medium">{payments.length} transaksi pelunasan</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Pengeluaran Usaha</span>
                <ArrowDownRight className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(totalExpense)}</p>
              <p className="mt-0.5 text-[11px] text-rose-600 font-medium">{expenses.length} pos biaya</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Laba Bersih Operasional</span>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <p className={`mt-2 text-xl font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatRupiah(netProfit)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Pemasukan dikurangi pengeluaran</p>
            </div>

            <div className="rounded-xl bg-amber-50/60 p-4 border border-amber-200/60">
              <div className="flex items-center justify-between text-xs text-amber-800 font-medium">
                <span>Kewajiban Deposit Pelanggan</span>
                <Wallet className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-xl font-bold text-amber-900">{formatRupiah(totalCustomerDeposits)}</p>
              <p className="mt-0.5 text-[11px] text-amber-700">Saldo titipan / belum terpakai</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-sm text-slate-800 mb-2">Alur Kerja Harian Admin ZDN:</h3>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600">
            <li><span className="font-medium text-slate-800">Scan Resi Jakarta:</span> Input resi paket marketplace/kargo yang baru tiba di gudang Jakarta.</li>
            <li><span className="font-medium text-slate-800">Update Status:</span> Ubah status ke <span className="text-blue-600 font-medium">Dalam Perjalanan</span> saat kargo diterbangkan.</li>
            <li><span className="font-medium text-slate-800">Timbang di Timika:</span> Saat paket tiba, timbang tiap paket dan tentukan promo. Status otomatis menjadi <span className="text-emerald-600 font-medium">Tiba di Timika</span>.</li>
            <li><span className="font-medium text-slate-800">Pelunasan & Penyerahan:</span> Tagih via WhatsApp / PDF dan catat pembayaran cash/transfer/QRIS.</li>
          </ol>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-sm text-slate-800 mb-2">Akses Cepat Pelacakan Pelanggan:</h3>
          <p className="text-xs text-slate-600 mb-3">
            Pelanggan Anda dapat melacak paket dan mengecek tagihan tanpa login melalui tautan web:
          </p>
          <div className="flex items-center justify-between rounded-lg bg-slate-100 p-2.5">
            <span className="text-xs font-mono font-semibold text-blue-700">app.zdncargo.com</span>
            <button
              onClick={() => onNavigate('tracking_public')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Buka Halaman Tracking →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
