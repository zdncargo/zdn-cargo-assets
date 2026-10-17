import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { UserProfile, UserRole } from '@/src/types';
import { formatDateDDMMYYYY } from '@/src/utils/formatters';
import { logActivity } from '@/src/services/dataService';
import {
  ShieldAlert,
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
  RefreshCw,
  Mail,
  Key,
  X,
} from 'lucide-react';

export const AdminManagementView: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal create/invite admin
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete modal
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      setUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanName = newName.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setModalError('Email tidak valid.');
      return;
    }

    // Check if user already registered
    const exists = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      setModalError(`Akun dengan email ${cleanEmail} sudah ada.`);
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      // Create user document with role pre-configured
      const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const profile: UserProfile = {
        uid,
        email: cleanEmail,
        displayName: cleanName || 'Staff Admin',
        role: newRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', uid), profile);

      if (newRole === 'superadmin') {
        await setDoc(doc(db, 'admins', uid), {
          email: cleanEmail,
          role: 'superadmin',
          createdAt: new Date().toISOString(),
        });
      }

      await logActivity({
        action: 'CREATE_ADMIN_ACCOUNT',
        category: 'admin',
        targetId: uid,
        details: `Menambahkan akun operasional: ${cleanEmail} (${newRole})`,
      });

      setToast({
        type: 'success',
        message: `Akun ${cleanEmail} berhasil didaftarkan sebagai ${newRole.toUpperCase()}. Pengguna dapat masuk menggunakan email tersebut.`,
      });

      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
    } catch (err: any) {
      setModalError('Gagal menambahkan akun: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    // Last superadmin guard
    const superadmins = users.filter(u => u.role === 'superadmin' && u.status === 'active');
    if (user.role === 'superadmin' && superadmins.length <= 1 && user.status === 'active') {
      alert('Tindakan ditolak: Tidak dapat menonaktifkan Superadmin terakhir dalam sistem!');
      return;
    }

    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      await logActivity({
        action: 'TOGGLE_ADMIN_STATUS',
        category: 'admin',
        targetId: user.uid,
        details: `Mengubah status akun ${user.email} menjadi ${nextStatus}`,
      });

      setToast({
        type: 'success',
        message: `Status akun ${user.email} diubah menjadi ${nextStatus.toUpperCase()}.`,
      });
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal mengubah status: ' + err.message });
    }
  };

  const toggleUserRole = async (user: UserProfile) => {
    const nextRole: UserRole = user.role === 'superadmin' ? 'admin' : 'superadmin';

    // Last superadmin guard
    if (user.role === 'superadmin') {
      const activeSuperadmins = users.filter(u => u.role === 'superadmin' && u.status === 'active');
      if (activeSuperadmins.length <= 1) {
        alert('Tindakan ditolak: Minimal harus ada 1 Superadmin aktif dalam sistem.');
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: nextRole,
        updatedAt: new Date().toISOString(),
      });

      if (nextRole === 'superadmin') {
        await setDoc(doc(db, 'admins', user.uid), {
          email: user.email,
          role: 'superadmin',
          createdAt: new Date().toISOString(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', user.uid));
      }

      await logActivity({
        action: 'CHANGE_ADMIN_ROLE',
        category: 'admin',
        targetId: user.uid,
        details: `Mengubah role ${user.email} menjadi ${nextRole}`,
      });

      setToast({ type: 'success', message: `Role akun ${user.email} diubah menjadi ${nextRole.toUpperCase()}.` });
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal mengubah role: ' + err.message });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;

    // Last superadmin guard
    if (deleteConfirmUser.role === 'superadmin') {
      const activeSuperadmins = users.filter(u => u.role === 'superadmin' && u.status === 'active');
      if (activeSuperadmins.length <= 1) {
        alert('Tindakan ditolak: Tidak dapat menghapus Superadmin terakhir!');
        setDeleteConfirmUser(null);
        return;
      }
    }

    // Do not delete currently logged in account
    if (auth.currentUser?.uid === deleteConfirmUser.uid) {
      alert('Tindakan ditolak: Anda tidak dapat menghapus akun yang sedang Anda gunakan saat ini.');
      setDeleteConfirmUser(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', deleteConfirmUser.uid));
      try {
        await deleteDoc(doc(db, 'admins', deleteConfirmUser.uid));
      } catch {}

      await logActivity({
        action: 'DELETE_ADMIN_ACCOUNT',
        category: 'admin',
        targetId: deleteConfirmUser.uid,
        details: `Menghapus akun admin ${deleteConfirmUser.email}`,
      });

      setToast({ type: 'success', message: `Akun ${deleteConfirmUser.email} berhasil dihapus.` });
      setDeleteConfirmUser(null);
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal menghapus akun: ' + err.message });
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <ShieldAlert className="mr-2 h-6 w-6 text-blue-600" />
            Manajemen Akun Admin & Superadmin
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola hak akses pengguna, tambah akun staf operasional, aktifkan/nonaktifkan, dan ganti peran administrator.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-xl bg-[#0B1E36] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow hover:bg-slate-800 transition active:scale-95 flex items-center"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          Tambah Akun Admin Baru
        </button>
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
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm font-bold text-slate-800">
            Daftar Akun Terdaftar ({users.length} akun)
          </span>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari email atau nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nama Pengguna</th>
                <th className="py-2.5 px-3">Email Akun</th>
                <th className="py-2.5 px-3">Peran / Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {loading ? 'Memuat daftar akun...' : 'Belum ada akun yang sesuai.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => (
                  <tr key={user.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{user.displayName || 'Staf Admin'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{user.email}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => toggleUserRole(user)}
                        title="Klik untuk ubah role"
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          user.role === 'superadmin'
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        <Shield className="mr-1 h-3 w-3" />
                        {user.role === 'superadmin' ? 'SUPERADMIN' : 'ADMIN'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          user.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => toggleUserStatus(user)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                            user.status === 'active'
                              ? 'text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmUser(user)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Hapus Akun"
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

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Tambah Akun Admin Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 flex items-center">
                <AlertTriangle className="mr-1.5 h-4 w-4 shrink-0" />
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Akun *
                </label>
                <input
                  type="email"
                  placeholder="admin.timika@zdncargo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap / Jabatan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi - Staff Gudang Timika"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Peran / Hak Akses (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                >
                  <option value="admin">Admin Operasional (Scan, Timbang, Pelunasan, Status, Customer)</option>
                  <option value="superadmin">Superadmin (Akses Penuh Seluruh Menu & Pengaturan)</option>
                </select>
              </div>

              <div className="mt-5 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0B1E36] px-5 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Mendaftarkan...' : 'Daftarkan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              Hapus Akun Pengguna?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Apakah Anda yakin ingin menghapus akun <strong className="text-slate-800">{deleteConfirmUser.email}</strong>? Riwayat transaksi dan audit paket yang pernah diproses oleh akun ini tetap tersimpan.
            </p>
            <div className="flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
