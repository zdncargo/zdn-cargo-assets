import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { AuditLog } from '@/src/types';
import { formatDateTimeWIT } from '@/src/utils/formatters';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  User,
  Barcode,
  Scale,
  CreditCard,
  Settings,
  Database,
  Trash2,
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.performedByEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'scan':
        return <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-semibold">Scan</span>;
      case 'weigh':
        return <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-semibold">Timbang</span>;
      case 'status_update':
        return <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">Status</span>;
      case 'payment':
        return <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">Pelunasan</span>;
      case 'customer':
        return <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-semibold">Customer</span>;
      case 'admin':
        return <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-semibold">Admin</span>;
      case 'settings':
        return <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">Settings</span>;
      case 'backup':
        return <span className="rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 text-[10px] font-semibold">Backup</span>;
      default:
        return <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-semibold">{category}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <History className="mr-2 h-6 w-6 text-blue-600" />
          Riwayat Aktivitas & Audit Trail (Khusus Superadmin)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Pencatatan kronologis permanen setiap aksi operasional, penimbangan, perubahan status, transaksi pembayaran, dan pengubahan pengaturan.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari aktivitas, pelaku, atau nomor resi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="all">Semua Kategori Aktivitas</option>
              <option value="scan">Scan Paket</option>
              <option value="weigh">Timbang di Timika</option>
              <option value="status_update">Pembaruan Status</option>
              <option value="payment">Pelunasan & Kasir</option>
              <option value="customer">Customer Info</option>
              <option value="admin">Manajemen Akun</option>
              <option value="settings">Pengaturan Sistem</option>
              <option value="backup">Backup / Restore</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="overflow-x-auto max-h-[500px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Waktu (WIT)</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Aksi / Event</th>
                <th className="py-2.5 px-3">Rincian Aktivitas</th>
                <th className="py-2.5 px-3 text-right">Pelaku (Actor)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {loading ? 'Memuat audit log...' : 'Belum ada riwayat aktivitas yang tercatat.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatDateTimeWIT(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3">{getCategoryBadge(log.category)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-mono text-[11px]">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-md">
                      {log.details}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                      {log.performedByEmail || 'system'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
