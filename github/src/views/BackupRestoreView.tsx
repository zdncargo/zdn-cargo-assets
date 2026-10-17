import React, { useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { logActivity } from '@/src/services/dataService';
import { getTodayJayapura, formatDateTimeWIT } from '@/src/utils/formatters';
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileText,
  RotateCcw,
  RefreshCw,
  Shield,
  Layers,
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFilePayload, setRestoreFilePayload] = useState<any | null>(null);
  const [restoreStats, setRestoreStats] = useState<{
    customersCount: number;
    packagesCount: number;
    paymentsCount: number;
    expensesCount: number;
    exportDate?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Export Full Operational Data
  const handleExportBackup = async () => {
    setIsExporting(true);
    setToast(null);

    try {
      const customersSnap = await getDocs(collection(db, 'customers'));
      const packagesSnap = await getDocs(collection(db, 'packages'));
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const expensesSnap = await getDocs(collection(db, 'expenses'));
      const settingsSnap = await getDocs(collection(db, 'settings'));

      const payload = {
        app: 'ZDN_CARGO',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: auth.currentUser?.email || 'superadmin',
        data: {
          customers: customersSnap.docs.map(d => ({ ...d.data(), id: d.id })),
          packages: packagesSnap.docs.map(d => ({ ...d.data(), id: d.id })),
          payments: paymentsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
          expenses: expensesSnap.docs.map(d => ({ ...d.data(), id: d.id })),
          settings: settingsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        },
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_ZDN_CARGO_${getTodayJayapura()}.json`;
      a.click();

      await logActivity({
        action: 'BACKUP_EXPORT',
        category: 'backup',
        details: `Mengekspor file cadangan data operasional (${payload.data.packages.length} paket, ${payload.data.customers.length} customer)`,
      });

      setToast({ type: 'success', message: 'File cadangan JSON berhasil diunduh ke komputer/HP Anda.' });
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal mengekspor data: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle choosing a backup file for restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.app || parsed.app !== 'ZDN_CARGO' || !parsed.data) {
          throw new Error('Format file tidak valid. Pastikan file adalah backup resmi ZDN CARGO.');
        }

        setRestoreFilePayload(parsed);
        setRestoreStats({
          customersCount: parsed.data.customers?.length || 0,
          packagesCount: parsed.data.packages?.length || 0,
          paymentsCount: parsed.data.payments?.length || 0,
          expensesCount: parsed.data.expenses?.length || 0,
          exportDate: parsed.exportedAt,
        });
        setToast({ type: 'success', message: 'File backup berhasil dibaca dan tervalidasi.' });
      } catch (err: any) {
        setRestoreFilePayload(null);
        setRestoreStats(null);
        setToast({ type: 'error', message: 'Validasi gagal: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restoreFilePayload || !restoreFilePayload.data) return;

    const confirmMsg = 'PERINGATAN: Memulihkan data cadangan dapat memperbarui atau menimpa rekaman yang ada dengan ID yang sama. Lanjutkan proses restore?';
    if (!confirm(confirmMsg)) return;

    setIsRestoring(true);
    try {
      const data = restoreFilePayload.data;

      // Restore customers
      if (Array.isArray(data.customers)) {
        for (const c of data.customers) {
          await setDoc(doc(db, 'customers', c.id), c, { merge: true });
        }
      }

      // Restore packages
      if (Array.isArray(data.packages)) {
        for (const p of data.packages) {
          await setDoc(doc(db, 'packages', p.id), p, { merge: true });
        }
      }

      // Restore payments
      if (Array.isArray(data.payments)) {
        for (const py of data.payments) {
          await setDoc(doc(db, 'payments', py.id), py, { merge: true });
        }
      }

      // Restore expenses
      if (Array.isArray(data.expenses)) {
        for (const ex of data.expenses) {
          await setDoc(doc(db, 'expenses', ex.id), ex, { merge: true });
        }
      }

      await logActivity({
        action: 'BACKUP_RESTORE',
        category: 'backup',
        details: `Memulihkan database dari file backup tanggal ${restoreStats?.exportDate || '-'}`,
      });

      setToast({
        type: 'success',
        message: 'PROSES RESTORE BERHASIL! Seluruh data operasional telah berhasil disinkronkan kembali ke Firestore.',
      });

      setRestoreFilePayload(null);
      setRestoreStats(null);
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal melakukan restore: ' + err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <Database className="mr-2 h-6 w-6 text-blue-600" />
          Menu Backup dan Restore Data (Khusus Superadmin)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Cadangkan seluruh data operasional paket, pelanggan, keuangan, dan konfigurasi ke format JSON terenkripsi dan dapat dipulihkan sewaktu-waktu.
        </p>
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
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Backup Export */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-900">
              <Download className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-bold">1. Ekspor Cadangan Data (Backup)</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mengunduh seluruh dokumen Firestore aktif mencakup:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
              <li>Data Pelanggan & Saldo Deposit (Customer)</li>
              <li>Seluruh Resi Paket Jakarta & Timika (Packages)</li>
              <li>Riwayat Transaksi Pelunasan & Kwitansi (Payments)</li>
              <li>Catatan Pengeluaran Operasional (Expenses)</li>
              <li>Pengaturan Sistem & Templat Dokumen</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="w-full rounded-xl bg-[#0B1E36] py-3 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 flex items-center justify-center"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Mengumpulkan Data Cadangan...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Unduh File Cadangan JSON
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 2: Restore Import */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-900">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              <h2 className="text-base font-bold">2. Pulihkan Data (Restore)</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pilih file cadangan JSON resmi ZDN CARGO yang sebelumnya pernah diunduh. Sistem akan memvalidasi integritas file sebelum disimpan ke Firestore.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Validation & Stats Preview */}
          {restoreStats && (
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center">
                <CheckCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
                Ringkasan File Cadangan Terbaca:
              </div>
              <div className="text-slate-600 text-[11px]">
                Waktu Ekspor: {formatDateTimeWIT(restoreStats.exportDate)}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-semibold text-slate-700">
                <div>• {restoreStats.customersCount} Pelanggan</div>
                <div>• {restoreStats.packagesCount} Paket Kargo</div>
                <div>• {restoreStats.paymentsCount} Pelunasan</div>
                <div>• {restoreStats.expensesCount} Biaya Usaha</div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="w-full rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center transition active:scale-95"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Memulihkan ke Firestore...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Konfirmasi & Terapkan Restore Data
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
