import React, { useState, useRef } from 'react';
import { AppSettings, MessageTemplate, DocumentTemplate } from '@/src/types';
import { saveAppSettings, DEFAULT_SETTINGS, DEFAULT_MESSAGE_TEMPLATES, logActivity } from '@/src/services/dataService';
import { formatRupiah, calculateShippingCost } from '@/src/utils/formatters';
import { printThermalReceipt } from '@/src/utils/documentGenerator';
import {
  Settings,
  DollarSign,
  Building,
  FileText,
  MessageSquare,
  Printer,
  Palette,
  CreditCard,
  Sliders,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  QrCode,
  Upload,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export type SettingsTabId = 'tariff' | 'business' | 'pdf' | 'whatsapp' | 'thermal' | 'theme' | 'payment' | 'general';

interface TabItem {
  id: SettingsTabId;
  label: string;
  badge?: string;
  icon: React.ElementType;
}

const SETTINGS_TABS: TabItem[] = [
  { id: 'tariff', label: 'Tarif & Ongkir', badge: 'Ongkir', icon: DollarSign },
  { id: 'business', label: 'Identitas Usaha', badge: 'Profil', icon: Building },
  { id: 'pdf', label: 'Templat PDF', badge: 'Faktur', icon: FileText },
  { id: 'whatsapp', label: 'Pesan WhatsApp', badge: 'Format', icon: MessageSquare },
  { id: 'thermal', label: 'Resi & Printer', badge: 'Thermal', icon: Printer },
  { id: 'theme', label: 'Tema Global', badge: 'Warna', icon: Palette },
  { id: 'payment', label: 'Rekening & QRIS', badge: 'Kasir', icon: CreditCard },
  { id: 'general', label: 'Umum & Sistem', badge: 'Sistem', icon: Sliders },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('tariff');
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Form State cloned from settings
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Simulation calculator for tariff
  const [simWeight, setSimWeight] = useState<number>(0.3);
  const [simPromo, setSimPromo] = useState<boolean>(true);

  // WhatsApp message templates state
  const [msgTemplates, setMsgTemplates] = useState<MessageTemplate[]>(DEFAULT_MESSAGE_TEMPLATES);
  const [selectedMsgType, setSelectedMsgType] = useState<string>('unpaid_bill');

  // QRIS image preview
  const [qrisPreview, setQrisPreview] = useState<string>(settings.qrisImageUrl || '');

  // Calculate simulation result
  const simCalc = calculateShippingCost(simWeight, {
    tariffPerKg: formData.tariffPerKg,
    minTariff: formData.minTariff,
    roundUpMultiple: formData.roundUpMultiple,
    promoAmount: formData.promoAmount,
    promoActive: formData.promoActive,
  }, simPromo);

  const handleSave = async () => {
    setIsSaving(true);
    setToast(null);
    try {
      const updated = {
        ...formData,
        qrisImageUrl: qrisPreview,
        updatedAt: new Date().toISOString(),
      };
      await saveAppSettings(updated);
      onUpdateSettings(updated);
      setToast({ type: 'success', message: 'Semua pengaturan berhasil disimpan ke Firestore!' });
    } catch (err: any) {
      setToast({ type: 'error', message: 'Gagal menyimpan: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (confirm('Kembalikan semua pengaturan ke nilai bawaan ZDN CARGO?')) {
      setFormData({ ...DEFAULT_SETTINGS });
      setQrisPreview('');
      setToast({ type: 'success', message: 'Pengaturan dikembalikan ke nilai bawaan. Klik Simpan untuk menerapkan.' });
    }
  };

  // Handle QRIS image file upload
  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setQrisPreview(dataUrl);
      setFormData(prev => ({ ...prev, qrisImageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const currentTemplate = msgTemplates.find(t => t.messageType === selectedMsgType) || msgTemplates[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <Settings className="mr-2 h-6 w-6 text-blue-600" />
            Pengaturan Sistem ZDN CARGO (Superadmin)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola tarif ongkir, profil usaha, templat PDF & WhatsApp, tema warna global, dan informasi rekening/QRIS.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetDefault}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Reset Bawaan
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-[#0B1E36] px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center shadow-md active:scale-95 transition"
          >
            {isSaving ? (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-4 w-4" />
                Simpan Perubahan
              </>
            )}
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
            {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-rose-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Submenu Navigation: Simple Mobile Selector + Smooth Horizontal Scrollable Pills with Arrow Controls */}
      <div className="space-y-2">
        {/* Mobile Quick Dropdown: Simple and compact on small screens */}
        <div className="sm:hidden">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Pilih Submenu Pengaturan:
          </label>
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as SettingsTabId)}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-9 text-xs font-bold text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              {SETTINGS_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Horizontal Scrollable Tabs Bar with Left/Right Buttons */}
        <div className="relative flex items-center bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-sm">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95"
            title="Geser ke kiri"
            aria-label="Geser ke kiri"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Scrollable Container */}
          <div
            ref={tabsScrollRef}
            className="flex-1 flex items-center space-x-1.5 overflow-x-auto scroll-smooth py-1 px-1 scrollbar-thin scrollbar-thumb-slate-200"
            style={{ scrollbarWidth: 'thin' }}
          >
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-[#0B1E36] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95"
            title="Geser ke kanan"
            aria-label="Geser ke kanan"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* TAB A: TARIF & ONGKIR */}
      {activeTab === 'tariff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              Konfigurasi Tarif & Aturan Pembulatan
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tarif Kargo Per Kilogram (IDR)
                </label>
                <input
                  type="number"
                  value={formData.tariffPerKg}
                  onChange={(e) => setFormData({ ...formData, tariffPerKg: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Bawaan: Rp75.000 / kg</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tarif Minimum Per Paket (IDR)
                </label>
                <input
                  type="number"
                  value={formData.minTariff}
                  onChange={(e) => setFormData({ ...formData, minTariff: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Bawaan: Rp10.000 per paket</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kelipatan Pembulatan Ke Atas (IDR)
                </label>
                <input
                  type="number"
                  value={formData.roundUpMultiple}
                  onChange={(e) => setFormData({ ...formData, roundUpMultiple: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Bawaan: Rp5.000 (contoh Rp22.500 jadi Rp25.000)</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nominal Potongan Promo (IDR)
                </label>
                <input
                  type="number"
                  value={formData.promoAmount}
                  onChange={(e) => setFormData({ ...formData, promoAmount: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Bawaan: Rp10.000 per paket</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Promo
                </label>
                <input
                  type="text"
                  value={formData.promoName}
                  onChange={(e) => setFormData({ ...formData, promoName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status Promo
                </label>
                <label className="flex items-center space-x-2 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.promoActive}
                    onChange={(e) => setFormData({ ...formData, promoActive: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-800">Aktifkan Promo Ongkir</span>
                </label>
              </div>
            </div>
          </div>

          {/* Simulation Calculator */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm space-y-3 text-xs">
            <h3 className="font-bold text-sm text-blue-900 flex items-center">
              <Eye className="mr-1.5 h-4 w-4 text-blue-600" />
              Pratinjau Simulasi Kalkulasi Ongkir
            </h3>
            <p className="text-slate-600">
              Uji coba rumus ongkir secara langsung sebelum menyimpan perubahan ke database:
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Berat Contoh (kg)
              </label>
              <input
                type="number"
                step="0.05"
                value={simWeight}
                onChange={(e) => setSimWeight(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2 font-mono font-bold outline-none"
              />
            </div>

            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={simPromo}
                  onChange={(e) => setSimPromo(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600"
                />
                <span className="ml-2 font-medium text-slate-700">Terapkan Promo Hemat</span>
              </label>
            </div>

            <div className="rounded-xl bg-white p-3 border border-blue-100 space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span>Biaya Dasar:</span>
                <span>{formatRupiah(simCalc.baseCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Biaya Normal (+Bulat):</span>
                <span>{formatRupiah(simCalc.normalCost)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Potongan Promo:</span>
                <span>-{formatRupiah(simCalc.promoDiscount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-sm text-blue-800">
                <span>BIAYA AKHIR:</span>
                <span>{formatRupiah(simCalc.finalCost)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: IDENTITAS USAHA */}
      {activeTab === 'business' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Profil & Identitas Usaha ZDN CARGO
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Usaha</label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Informasi Rute</label>
              <input
                type="text"
                value={formData.routeInfo}
                onChange={(e) => setFormData({ ...formData, routeInfo: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor WhatsApp CS</label>
              <input
                type="text"
                value={formData.businessWhatsapp}
                onChange={(e) => setFormData({ ...formData, businessWhatsapp: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Slogan Promosi</label>
              <input
                type="text"
                value={formData.promoInfo}
                onChange={(e) => setFormData({ ...formData, promoInfo: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Gudang / Kantor</label>
              <textarea
                value={formData.businessAddress}
                onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB C: TEMPLAT PDF */}
      {activeTab === 'pdf' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Editor Visual Templat Dokumen PDF
          </h2>
          <p className="text-xs text-slate-500">
            Atur parameter pencetakan PDF resmi ZDN CARGO untuk tagihan, nota lunas, dan laporan closing.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="font-bold text-slate-900">1. Tagihan Belum Lunas</h3>
              <p className="text-slate-500 text-[11px]">Format A4 Portrait dengan rincian resi dan nomor rekening transfer.</p>
              <span className="inline-block rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-semibold">Aktif</span>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="font-bold text-slate-900">2. Kwitansi Pembayaran LUNAS</h3>
              <p className="text-slate-500 text-[11px]">Format A4 Portrait dengan stempel LUNAS resmi dan tanda tangan.</p>
              <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">Aktif</span>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="font-bold text-slate-900">3. Rekap Closing Timika</h3>
              <p className="text-slate-500 text-[11px]">Manifest ringkasan penerimaan per pelanggan untuk manifest kargo.</p>
              <span className="inline-block rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-semibold">Aktif</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB D: PESAN WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-900">
              Editor Templat Pesan WhatsApp
            </h2>
            <select
              value={selectedMsgType}
              onChange={(e) => setSelectedMsgType(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-500"
            >
              <option value="unpaid_bill">Tagihan Belum Lunas</option>
              <option value="paid_receipt">Konfirmasi Pembayaran Lunas</option>
              <option value="closing_summary">Pengumuman Closing Timika</option>
              <option value="arrived_timika">Paket Tiba di Timika</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Isi Templat Pesan:</label>
              <textarea
                value={currentTemplate.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setMsgTemplates(prev => prev.map(t => t.messageType === selectedMsgType ? { ...t, content: val } : t));
                }}
                rows={10}
                className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs outline-none focus:border-blue-500"
              />
              <div className="mt-2 text-[11px] text-slate-500">
                <strong>Variabel Didukung:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded">&#123;nama&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">&#123;tanggal_closing&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">&#123;daftar_resi&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">&#123;total_berat&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">&#123;total_tagihan&#125;</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">&#123;informasi_rekening&#125;</code>.
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pratinjau dengan Data Contoh:</label>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 font-mono text-xs whitespace-pre-wrap text-slate-800 shadow-inner h-64 overflow-y-auto">
                {currentTemplate.content
                  .replace(/\{nama\}/g, 'Ibu Fatimah')
                  .replace(/\{tanggal_closing\}/g, '17-10-2026')
                  .replace(/\{daftar_resi\}/g, '• JP98234123 (0.50 kg) = Rp37.500\n• JP98234124 (1.20 kg) = Rp90.000')
                  .replace(/\{jumlah_paket\}/g, '2')
                  .replace(/\{total_berat\}/g, '1.70')
                  .replace(/\{total_promo\}/g, 'Rp10.000')
                  .replace(/\{total_tagihan\}/g, 'Rp117.500')
                  .replace(/\{total_bayar\}/g, 'Rp117.500')
                  .replace(/\{metode_pembayaran\}/g, 'TRANSFER BCA')
                  .replace(/\{status_penyerahan\}/g, 'Sudah Diambil')
                  .replace(/\{nomor_pembayaran\}/g, 'PAY-83921')
                  .replace(/\{informasi_rekening\}/g, `${formData.bankName} - ${formData.bankAccount} (a.n. ${formData.bankAccountHolder})`)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB E: RESI & PRINTER THERMAL */}
      {activeTab === 'thermal' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Pengaturan Printer Termal Kasir (58 mm / 80 mm)
          </h2>
          <p className="text-xs text-slate-500">
            Mendukung printer struk kasir Bluetooth / USB dengan layout monokrom bersih.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => printThermalReceipt({
                title: 'UJI COBA CETAK STRUK',
                customerName: 'Pelanggan Tes Timika',
                packages: [{ waybill: 'TEST-AWB-001', weight: 0.5, cost: 37500 }],
                total: 37500,
                date: new Date().toISOString(),
                isPaid: true,
                settings: formData,
                paperWidth: '58mm',
              })}
              className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center"
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Uji Cetak Struk 58 mm
            </button>
            <button
              onClick={() => printThermalReceipt({
                title: 'UJI COBA CETAK STRUK',
                customerName: 'Pelanggan Tes Timika',
                packages: [{ waybill: 'TEST-AWB-001', weight: 1.2, cost: 90000 }],
                total: 90000,
                date: new Date().toISOString(),
                isPaid: true,
                settings: formData,
                paperWidth: '80mm',
              })}
              className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center"
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Uji Cetak Struk 80 mm
            </button>
          </div>
        </div>
      )}

      {/* TAB F: TEMA GLOBAL */}
      {activeTab === 'theme' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Tema Global & Palet Warna ZDN CARGO
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Warna Utama (Navy ZDN)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={formData.theme?.primaryColor || '#0b1e36'}
                  onChange={(e) => setFormData({
                    ...formData,
                    theme: { ...(formData.theme || DEFAULT_SETTINGS.theme), primaryColor: e.target.value },
                  })}
                  className="h-9 w-12 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={formData.theme?.primaryColor || '#0b1e36'}
                  onChange={(e) => setFormData({
                    ...formData,
                    theme: { ...(formData.theme || DEFAULT_SETTINGS.theme), primaryColor: e.target.value },
                  })}
                  className="w-full rounded-xl border border-slate-300 p-2 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Warna Sekunder</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={formData.theme?.secondaryColor || '#1e3a8a'}
                  onChange={(e) => setFormData({
                    ...formData,
                    theme: { ...(formData.theme || DEFAULT_SETTINGS.theme), secondaryColor: e.target.value },
                  })}
                  className="h-9 w-12 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={formData.theme?.secondaryColor || '#1e3a8a'}
                  onChange={(e) => setFormData({
                    ...formData,
                    theme: { ...(formData.theme || DEFAULT_SETTINGS.theme), secondaryColor: e.target.value },
                  })}
                  className="w-full rounded-xl border border-slate-300 p-2 font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB G: REKENING & QRIS */}
      {activeTab === 'payment' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Pengaturan Rekening Bank & QRIS ZDN CARGO
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Bank</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Rekening</label>
              <input
                type="text"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Atas Nama Rekening</label>
              <input
                type="text"
                value={formData.bankAccountHolder}
                onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Petunjuk Pembayaran</label>
              <input
                type="text"
                value={formData.paymentInstructions}
                onChange={(e) => setFormData({ ...formData, paymentInstructions: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-blue-500"
              />
            </div>

            {/* QRIS Image Upload & Preview */}
            <div className="sm:col-span-2 pt-2 border-t border-slate-100 space-y-3">
              <label className="block font-bold text-slate-900">
                Unggah Gambar QRIS Resmi
              </label>
              <p className="text-slate-500 text-[11px]">
                Pilih file gambar QRIS langsung dari HP atau komputer. Pratinjau langsung ditampilkan sebelum disimpan.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleQrisFileChange}
                className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />

              {qrisPreview ? (
                <div className="mt-3 flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-xs">
                  <span className="text-[11px] font-semibold text-slate-500 mb-2">Pratinjau QRIS Aktif:</span>
                  <img
                    src={qrisPreview}
                    alt="Pratinjau QRIS"
                    className="max-h-52 object-contain rounded-lg border shadow-sm"
                  />
                  <button
                    onClick={() => {
                      setQrisPreview('');
                      setFormData(prev => ({ ...prev, qrisImageUrl: '' }));
                    }}
                    className="mt-2 text-[10px] text-rose-600 font-bold hover:underline"
                  >
                    Hapus Gambar QRIS
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                  Belum ada gambar QRIS yang diunggah.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB H: PENGATURAN UMUM */}
      {activeTab === 'general' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Pengaturan Umum Aplikasi
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Format Tanggal</label>
              <input
                type="text"
                value="DD-MM-YYYY"
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-slate-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Standar wajib: DD-MM-YYYY</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Zona Waktu Operasional</label>
              <input
                type="text"
                value="Asia/Jayapura (WIT, UTC+9)"
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-slate-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Waktu Indonesia Timur (Timika)</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mata Uang</label>
              <input
                type="text"
                value="IDR (Rupiah Indonesia)"
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-slate-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Bilangan bulat Rupiah</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
