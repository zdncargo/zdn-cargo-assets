import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { getAppSettings, DEFAULT_SETTINGS, logActivity } from '@/src/services/dataService';
import { testConnection } from '@/src/lib/firebase';
import { AppSettings } from '@/src/types';
import { DashboardView } from '@/src/views/DashboardView';
import { ScanView } from '@/src/views/ScanView';
import { CustomerView } from '@/src/views/CustomerView';
import { TimbangView } from '@/src/views/TimbangView';
import { UpdateStatusView } from '@/src/views/UpdateStatusView';
import { PelunasanView } from '@/src/views/PelunasanView';
import { ArsipView } from '@/src/views/ArsipView';
import { TrackingPublicView } from '@/src/views/TrackingPublicView';
import { SettingsView } from '@/src/views/SettingsView';
import { AdminManagementView } from '@/src/views/AdminManagementView';
import { KeuanganView } from '@/src/views/KeuanganView';
import { AuditLogView } from '@/src/views/AuditLogView';
import { BackupRestoreView } from '@/src/views/BackupRestoreView';
import {
  PackageCheck,
  Users,
  Scale,
  Clock,
  CreditCard,
  Archive,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
  History,
  Database,
  LogOut,
  Menu,
  X,
  Lock,
  Mail,
  User,
  Shield,
  LayoutDashboard,
  Plane,
  Truck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

function MainApp() {
  const {
    currentUser,
    userProfile,
    role,
    isAdmin,
    isSuperAdmin,
    loading: authLoading,
    loginWithEmail,
    loginWithGoogle,
    registerInitialSuperadmin,
    logout,
    authError,
    clearAuthError,
  } = useAuth();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Login Modal
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginTab, setLoginTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Current Jayapura time ticker
  const [currentTimeWIT, setCurrentTimeWIT] = useState('');

  useEffect(() => {
    testConnection();

    getAppSettings().then((s) => {
      setSettings(s);
    });

    const timer = setInterval(() => {
      const now = new Date();
      const str = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jayapura',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now) + ' WIT';
      setCurrentTimeWIT(str);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    try {
      if (loginTab === 'login') {
        await loginWithEmail(loginEmail.trim(), loginPassword);
        setShowLoginModal(false);
        setLoginEmail('');
        setLoginPassword('');
      } else {
        await registerInitialSuperadmin(loginEmail.trim(), loginPassword, registerName.trim());
        setShowLoginModal(false);
        setLoginEmail('');
        setLoginPassword('');
        setRegisterName('');
      }
    } catch (err) {
      // Error is set in AuthContext
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthSubmitting(true);
    try {
      await loginWithGoogle();
      setShowLoginModal(false);
    } catch (err) {
      // Auth error handled
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // If not logged in, show the public tracking view directly with option to login
  if (!currentUser) {
    return (
      <>
        <TrackingPublicView
          settings={settings}
          onOpenAdminLogin={() => {
            clearAuthError();
            setShowLoginModal(true);
          }}
        />

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1E36] text-white font-bold text-xs">
                    ZDN
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Login Staf Operasional
                    </h3>
                    <p className="text-[10px] text-slate-400">Firebase Project: zona-distribusi-90</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Login / Register tabs */}
              <div className="flex border-b border-slate-200 mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('login');
                    clearAuthError();
                  }}
                  className={`flex-1 py-2 border-b-2 text-center transition ${
                    loginTab === 'login'
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('register');
                    clearAuthError();
                  }}
                  className={`flex-1 py-2 border-b-2 text-center transition ${
                    loginTab === 'register'
                      ? 'border-blue-600 text-blue-600 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Daftarkan Akun
                </button>
              </div>

              {authError && (
                <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-start space-x-2">
                  <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleEmailLoginSubmit} className="space-y-3.5 text-xs">
                {loginTab === 'register' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      placeholder="Nama Staf / Superadmin"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Firebase</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="juhartininasa@gmail.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 outline-none focus:border-blue-500 font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 outline-none focus:border-blue-500 font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full rounded-xl bg-[#0B1E36] py-3 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 flex items-center justify-center"
                >
                  {isAuthSubmitting ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Memproses...
                    </>
                  ) : loginTab === 'login' ? (
                    'Masuk dengan Email & Password'
                  ) : (
                    'Daftarkan Akun ke Firebase'
                  )}
                </button>
              </form>

              <div className="my-4 flex items-center">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-[10px] text-slate-400 font-semibold uppercase">Atau</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* 1-Click Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isAuthSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center transition"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                Masuk dengan Akun Google (1-Klik)
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Logged-in Staff / Admin Layout
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col bg-[#0B1E36] text-white shadow-xl select-none">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 px-5 py-4 border-b border-blue-900/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-sm">
            ZDN
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">ZDN CARGO</h1>
            <span className="text-[10px] text-blue-300 block">Zona Distribusi Niaga</span>
          </div>
        </div>

        {/* Navigation Menus */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs font-semibold scrollbar-none">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
            Operasional Kargo
          </div>

          <button
            onClick={() => setActiveMenu('dashboard')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LayoutDashboard className="mr-2.5 h-4 w-4" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveMenu('scan')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'scan' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <PackageCheck className="mr-2.5 h-4 w-4" />
            Scan Paket Jakarta
          </button>

          <button
            onClick={() => setActiveMenu('customers')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'customers' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users className="mr-2.5 h-4 w-4" />
            Info Customer
          </button>

          <button
            onClick={() => setActiveMenu('timbang')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'timbang' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Scale className="mr-2.5 h-4 w-4" />
            Timbang di Timika
          </button>

          <button
            onClick={() => setActiveMenu('update_status')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'update_status' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Clock className="mr-2.5 h-4 w-4" />
            Update Status & Closing
          </button>

          <button
            onClick={() => setActiveMenu('pelunasan')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'pelunasan' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <CreditCard className="mr-2.5 h-4 w-4" />
            Pelunasan & Kasir
          </button>

          <button
            onClick={() => setActiveMenu('tracking_public')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
              activeMenu === 'tracking_public' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Search className="mr-2.5 h-4 w-4" />
            Halaman Tracking Publik
          </button>

          {/* Superadmin Exclusive Menus */}
          {isSuperAdmin && (
            <>
              <div className="pt-4 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                Menu Khusus Superadmin
              </div>

              <button
                onClick={() => setActiveMenu('arsip')}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
                  activeMenu === 'arsip' ? 'bg-purple-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Archive className="mr-2.5 h-4 w-4" />
                Arsip Transaksi Lunas
              </button>

              <button
                onClick={() => setActiveMenu('keuangan')}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
                  activeMenu === 'keuangan' ? 'bg-purple-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Wallet className="mr-2.5 h-4 w-4" />
                Laporan Keuangan
              </button>

              <button
                onClick={() => setActiveMenu('admin_management')}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
                  activeMenu === 'admin_management' ? 'bg-purple-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ShieldCheck className="mr-2.5 h-4 w-4" />
                Manajemen Admin
              </button>

              <button
                onClick={() => setActiveMenu('audit_logs')}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
                  activeMenu === 'audit_logs' ? 'bg-purple-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <History className="mr-2.5 h-4 w-4" />
                Riwayat Aktivitas
              </button>

              <button
                onClick={() => setActiveMenu('settings')}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
                  activeMenu === 'settings' ? 'bg-purple-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Settings className="mr-2.5 h-4 w-4" />
                Pengaturan Sistem
              </button>

              <button
                onClick={() => setActiveMenu('backup_restore')}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl transition ${
                  activeMenu === 'backup_restore' ? 'bg-purple-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Database className="mr-2.5 h-4 w-4" />
                Backup dan Restore
              </button>
            </>
          )}
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-blue-900/40 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="truncate mr-2">
              <div className="text-xs font-bold text-white truncate">
                {userProfile?.displayName || currentUser.email}
              </div>
              <span className="text-[10px] text-blue-300 font-semibold uppercase">
                {userProfile?.role || 'Staff'}
              </span>
            </div>
            <button
              onClick={logout}
              title="Keluar"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-rose-400 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-sm z-20">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              Rute: <strong className="text-slate-800">{settings.routeInfo}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              <Clock className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              {currentTimeWIT || 'WIT (Timika)'}
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isSuperAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isSuperAdmin ? 'SUPERADMIN' : 'ADMIN'}
              </span>
              <button
                onClick={logout}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 hidden sm:inline"
              >
                Keluar
              </button>
            </div>
          </div>
        </header>

        {/* View Content with Scroll */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeMenu === 'dashboard' && (
            <DashboardView
              settings={settings}
              onNavigate={(view) => setActiveMenu(view)}
            />
          )}
          {activeMenu === 'scan' && <ScanView />}
          {activeMenu === 'customers' && <CustomerView />}
          {activeMenu === 'timbang' && <TimbangView settings={settings} />}
          {activeMenu === 'update_status' && <UpdateStatusView settings={settings} />}
          {activeMenu === 'pelunasan' && <PelunasanView settings={settings} />}
          {activeMenu === 'arsip' && isSuperAdmin && <ArsipView settings={settings} />}
          {activeMenu === 'tracking_public' && (
            <TrackingPublicView
              settings={settings}
              onOpenAdminLogin={() => {}}
            />
          )}
          {activeMenu === 'settings' && isSuperAdmin && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(newS) => setSettings(newS)}
            />
          )}
          {activeMenu === 'admin_management' && isSuperAdmin && <AdminManagementView />}
          {activeMenu === 'keuangan' && isSuperAdmin && <KeuanganView />}
          {activeMenu === 'audit_logs' && isSuperAdmin && <AuditLogView />}
          {activeMenu === 'backup_restore' && isSuperAdmin && <BackupRestoreView />}
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 flex-col bg-[#0B1E36] text-white p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-blue-900/40 mb-3">
              <span className="font-bold text-sm">Menu ZDN CARGO</span>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 text-xs font-semibold">
              <button
                onClick={() => { setActiveMenu('dashboard'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Dashboard
              </button>
              <button
                onClick={() => { setActiveMenu('scan'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Scan Paket Jakarta
              </button>
              <button
                onClick={() => { setActiveMenu('customers'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Info Customer
              </button>
              <button
                onClick={() => { setActiveMenu('timbang'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Timbang di Timika
              </button>
              <button
                onClick={() => { setActiveMenu('update_status'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Update Status & Closing
              </button>
              <button
                onClick={() => { setActiveMenu('pelunasan'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Pelunasan & Kasir
              </button>
              <button
                onClick={() => { setActiveMenu('tracking_public'); setMobileMenuOpen(false); }}
                className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
              >
                Halaman Tracking Publik
              </button>

              {isSuperAdmin && (
                <>
                  <div className="pt-3 pb-1 text-[10px] text-purple-400 font-bold uppercase">Superadmin</div>
                  <button
                    onClick={() => { setActiveMenu('arsip'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
                  >
                    Arsip Transaksi Lunas
                  </button>
                  <button
                    onClick={() => { setActiveMenu('keuangan'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
                  >
                    Laporan Keuangan
                  </button>
                  <button
                    onClick={() => { setActiveMenu('admin_management'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
                  >
                    Manajemen Admin
                  </button>
                  <button
                    onClick={() => { setActiveMenu('audit_logs'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
                  >
                    Riwayat Aktivitas
                  </button>
                  <button
                    onClick={() => { setActiveMenu('settings'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
                  >
                    Pengaturan Sistem
                  </button>
                  <button
                    onClick={() => { setActiveMenu('backup_restore'); setMobileMenuOpen(false); }}
                    className="w-full text-left py-2 px-3 rounded-lg hover:bg-white/10"
                  >
                    Backup dan Restore
                  </button>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-blue-900/40">
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full py-2 text-center text-xs font-bold text-rose-300 hover:text-rose-100"
              >
                Keluar dari Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
