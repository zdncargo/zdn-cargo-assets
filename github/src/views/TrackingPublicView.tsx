import React, { useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Package, AppSettings } from '@/src/types';
import { normalizeWhatsapp, formatRupiah, formatDateDDMMYYYY } from '@/src/utils/formatters';
import {
  Search,
  Phone,
  Barcode,
  Truck,
  Plane,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Building,
  QrCode,
  ArrowRight,
  User,
} from 'lucide-react';

interface TrackingPublicViewProps {
  settings: AppSettings;
  onOpenAdminLogin: () => void;
}

export const TrackingPublicView: React.FC<TrackingPublicViewProps> = ({
  settings,
  onOpenAdminLogin,
}) => {
  const [searchMode, setSearchMode] = useState<'whatsapp' | 'waybill'>('whatsapp');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [waybillInput, setWaybillInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);

  // Search results
  const [whatsappPackages, setWhatsappPackages] = useState<Package[]>([]);
  const [customerNameResult, setCustomerNameResult] = useState<string>('');
  const [singleWaybillPackage, setSingleWaybillPackage] = useState<Package | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setIsSearching(true);
    setSearchDone(true);
    setWhatsappPackages([]);
    setSingleWaybillPackage(null);

    try {
      if (searchMode === 'whatsapp') {
        const cleanWA = normalizeWhatsapp(whatsappInput.trim());
        if (!cleanWA || cleanWA.length < 6) {
          setSearchError('Nomor WhatsApp tidak valid. Masukkan nomor yang terdaftar.');
          setIsSearching(false);
          return;
        }

        // Search customer packages:
        // Rule: Paket yang sudah ditimbang atau tiba di Timika dan belum lunas!
        // Paket yang baru di-scan di Jakarta atau masih dalam perjalanan tetapi belum ditimbang TIDAK BOLEH ditampilkan!
        const q = query(
          collection(db, 'packages'),
          where('customerWhatsapp', '==', cleanWA),
          where('isArchived', '==', false)
        );

        const snap = await getDocs(q);
        const pkgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));

        // Filter: only weighed (> 0) or Tiba di Timika, and NOT paid
        const eligible = pkgs.filter(p =>
          p.paymentStatus !== 'paid' &&
          (p.weight > 0 || p.status === 'Tiba di Timika')
        );

        if (eligible.length > 0) {
          setWhatsappPackages(eligible);
          setCustomerNameResult(eligible[0].customerName);
        } else {
          setSearchError('Tidak ditemukan paket belum lunas yang telah tiba/ditimbang untuk nomor WhatsApp ini.');
        }
      } else {
        // Mode: Waybill lookup
        const cleanAWB = waybillInput.trim().toUpperCase();
        if (!cleanAWB) {
          setSearchError('Nomor resi tidak boleh kosong.');
          setIsSearching(false);
          return;
        }

        const q = query(
          collection(db, 'packages'),
          where('waybill', '==', cleanAWB),
          where('isArchived', '==', false)
        );

        const snap = await getDocs(q);
        if (snap.empty) {
          setSearchError(`Resi "${cleanAWB}" tidak ditemukan atau paket sudah selesai dilunasi.`);
        } else {
          const pkg = { ...snap.docs[0].data(), id: snap.docs[0].id } as Package;
          if (pkg.paymentStatus === 'paid') {
            setSearchError(`Paket dengan resi ${cleanAWB} telah LUNAS dan diambil.`);
          } else {
            setSingleWaybillPackage(pkg);
          }
        }
      }
    } catch (err: any) {
      console.error('Tracking error:', err);
      setSearchError('Terjadi kesalahan saat mencari data: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Group whatsapp results by closing date
  const groupedWhatsapp: { [closing: string]: Package[] } = {};
  whatsappPackages.forEach(p => {
    if (!groupedWhatsapp[p.closingDate]) {
      groupedWhatsapp[p.closingDate] = [];
    }
    groupedWhatsapp[p.closingDate].push(p);
  });

  const totalBillWhatsApp = whatsappPackages.reduce((sum, p) => sum + (p.finalCost || 0), 0);
  const totalWeightWhatsApp = whatsappPackages.reduce((sum, p) => sum + (p.weight || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-[#0B1E36] px-4 py-3.5 text-white sticky top-0 z-30 shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-sm">
              ZDN
            </div>
            <div>
              <span className="font-bold tracking-tight text-sm sm:text-base block leading-tight">
                ZDN CARGO
              </span>
              <span className="text-[10px] text-blue-200">
                Zona Distribusi Niaga | Timika
              </span>
            </div>
          </div>

          <button
            onClick={onOpenAdminLogin}
            className="rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/20 transition"
          >
            Masuk Staff Operasional
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 py-8 max-w-4xl mx-auto w-full space-y-6">
        {/* Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            <Truck className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            Layanan Kargo Udara Jakarta — Timika
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Lacak Paket & Cek Ongkos Kirim
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
            Masukkan nomor WhatsApp atau nomor resi kurir asal Anda untuk memeriksa status kargo dan rincian ongkir ke Timika.
          </p>
        </div>

        {/* Tracking Card Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSearchMode('whatsapp');
                setSearchDone(false);
                setSearchError(null);
              }}
              className={`rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center ${
                searchMode === 'whatsapp'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone className="mr-1.5 h-4 w-4" />
              A. Cari Pakai No. WhatsApp
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchMode('waybill');
                setSearchDone(false);
                setSearchError(null);
              }}
              className={`rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center ${
                searchMode === 'waybill'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode className="mr-1.5 h-4 w-4" />
              B. Cari Pakai Resi Asli
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            {searchMode === 'whatsapp' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp Terdaftar
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm font-mono text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Menampilkan paket milik Anda yang sudah tiba di Timika atau telah ditimbang dan belum lunas.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor Resi / AWB Ekspedisi Asal
                </label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: JP1234567890 / SPXID04829..."
                    value={waybillInput}
                    onChange={(e) => setWaybillInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm font-mono uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Menampilkan riwayat perjalanan resi individual mulai dari Tiba di Jakarta hingga Tiba di Timika.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSearching}
              className="w-full rounded-xl bg-[#0B1E36] py-3 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50 transition active:scale-95 flex items-center justify-center"
            >
              {isSearching ? 'Mencari Data Paket...' : 'Periksa Status Paket'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Search Error */}
        {searchError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 flex items-start space-x-2.5">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{searchError}</span>
          </div>
        )}

        {/* RESULTS: MODE A (WHATSAPP BILLING) */}
        {searchMode === 'whatsapp' && whatsappPackages.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs text-slate-400 block">Nama Penerima / Pelanggan:</span>
                <h2 className="text-lg font-bold text-slate-900 flex items-center">
                  <User className="mr-1.5 h-4 w-4 text-blue-600" />
                  {customerNameResult}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total Tagihan Belum Lunas:</span>
                <span className="text-xl font-extrabold text-blue-700">{formatRupiah(totalBillWhatsApp)}</span>
              </div>
            </div>

            {/* Packages grouped by closing */}
            <div className="space-y-4">
              {Object.entries(groupedWhatsapp).map(([closing, pkgs]) => (
                <div key={closing} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 text-xs font-bold text-slate-800">
                    <span className="flex items-center">
                      <Calendar className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                      Closing Tanggal: {formatDateDDMMYYYY(closing)}
                    </span>
                    <span className="text-blue-700">
                      {formatRupiah(pkgs.reduce((s, p) => s + (p.finalCost || 0), 0))}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {pkgs.map((pkg) => (
                      <div key={pkg.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{pkg.waybill}</span>
                          <div className="text-[11px] text-slate-500">
                            Penerima: <strong className="text-slate-800 mr-2">{pkg.customerName}</strong>
                            Berat: <strong className="text-slate-800">{pkg.weight.toFixed(2)} kg</strong>
                            {pkg.isPromo && (
                              <span className="ml-2 text-emerald-600 font-semibold">(Promo Ongkir)</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{formatRupiah(pkg.finalCost)}</span>
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-800">
                            {pkg.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Bank Details */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-2">
              <h3 className="font-bold text-slate-900 flex items-center">
                <Building className="mr-1.5 h-4 w-4 text-blue-600" />
                Informasi Rekening Pembayaran
              </h3>
              <p className="text-slate-600">
                Pembayaran dapat ditransfer ke rekening resmi:
              </p>
              <div className="rounded-lg bg-white p-3 border border-slate-200 font-mono text-xs">
                <div><strong>Bank:</strong> {settings.bankName}</div>
                <div><strong>No. Rekening:</strong> {settings.bankAccount}</div>
                <div><strong>Atas Nama:</strong> {settings.bankAccountHolder}</div>
              </div>
              <p className="text-[11px] text-slate-500">
                Harap kirimkan bukti transfer ke WhatsApp admin: <strong>{settings.businessWhatsapp}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* RESULTS: MODE B (SINGLE WAYBILL TRACKING) */}
        {searchMode === 'waybill' && singleWaybillPackage && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-xs text-slate-400 block">Nomor Resi / AWB:</span>
                <h2 className="text-xl font-bold font-mono text-slate-900">{singleWaybillPackage.waybill}</h2>
                <div className="mt-1 flex items-center text-xs text-slate-600">
                  <User className="mr-1 h-3.5 w-3.5 text-blue-600" />
                  <span className="text-slate-500 mr-1">Nama Penerima:</span>
                  <strong className="text-slate-900">{singleWaybillPackage.customerName}</strong>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Status Saat Ini:</span>
                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                  {singleWaybillPackage.status}
                </span>
              </div>
            </div>

            {/* Tracking Progress Steps */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Riwayat Pengiriman Kargo:
              </h3>
              <div className="relative pl-6 space-y-5 border-l-2 border-blue-200">
                {/* Step 1: Jakarta */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                    ✓
                  </div>
                  <div className="text-xs font-bold text-slate-900">Tiba di Gudang Jakarta</div>
                  <div className="text-[11px] text-slate-500">
                    Paket diterima di hub kargo Jakarta. Closing: {formatDateDDMMYYYY(singleWaybillPackage.closingDate)}
                  </div>
                </div>

                {/* Step 2: In transit */}
                <div className="relative">
                  <div className={`absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    singleWaybillPackage.status === 'Dalam Perjalanan' || singleWaybillPackage.status === 'Tiba di Timika'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Plane className="h-3 w-3" />
                  </div>
                  <div className="text-xs font-bold text-slate-900">Dalam Perjalanan Udara</div>
                  <div className="text-[11px] text-slate-500">
                    Kargo diterbangkan via kargo udara Jakarta menuju Timika.
                  </div>
                </div>

                {/* Step 3: Timika */}
                <div className="relative">
                  <div className={`absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    singleWaybillPackage.status === 'Tiba di Timika'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div className="text-xs font-bold text-slate-900">Tiba di Gudang Timika</div>
                  <div className="text-[11px] text-slate-500">
                    {singleWaybillPackage.status === 'Tiba di Timika'
                      ? `Paket telah tiba dan ditimbang (${singleWaybillPackage.weight.toFixed(2)} kg). Siap diambil di gudang.`
                      : 'Menunggu paket mendarat di Timika.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Package details */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block">Nama Penerima:</span>
                <span className="font-bold text-slate-900 flex items-center mt-0.5">
                  <User className="mr-1 h-3.5 w-3.5 text-blue-600" />
                  {singleWaybillPackage.customerName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Berat Paket:</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {singleWaybillPackage.weight > 0 ? `${singleWaybillPackage.weight.toFixed(2)} kg` : 'Dalam proses timbang'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Tanggal Closing:</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{formatDateDDMMYYYY(singleWaybillPackage.closingDate)}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-auto">
        <p className="font-semibold text-slate-700">{settings.businessName}</p>
        <p className="mt-1">{settings.businessAddress}</p>
        <p className="mt-1">WhatsApp CS: {settings.businessWhatsapp} | Domain: app.zdncargo.com</p>
      </footer>
    </div>
  );
};
