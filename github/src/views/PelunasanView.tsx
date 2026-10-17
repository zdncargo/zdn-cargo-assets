import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  runTransaction,
  doc,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Customer, Package, Payment, PaymentMethod, DeliveryStatus, AppSettings } from '@/src/types';
import { formatRupiah, formatDateDDMMYYYY, getTodayJayapura, getWhatsappUrl } from '@/src/utils/formatters';
import { logActivity } from '@/src/services/dataService';
import { generateUnpaidBillPDF } from '@/src/utils/documentGenerator';
import {
  CreditCard,
  Search,
  User,
  CheckCircle,
  AlertTriangle,
  Printer,
  Share2,
  Wallet,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  QrCode,
  DollarSign,
  Building,
} from 'lucide-react';

interface PelunasanViewProps {
  settings: AppSettings;
}

export const PelunasanView: React.FC<PelunasanViewProps> = ({ settings }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Customer unpaid weighed packages
  const [unpaidPackages, setUnpaidPackages] = useState<Package[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());

  // Payment Form inputs
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('diambil');
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [useDepositAmount, setUseDepositAmount] = useState<number>(0);
  const [recipientName, setRecipientName] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Real-time listener for customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    });
    return () => unsub();
  }, []);

  // Real-time listener for unpaid weighed packages of selected customer
  useEffect(() => {
    if (!selectedCustomer) {
      setUnpaidPackages([]);
      setSelectedPackageIds(new Set());
      setAmountReceivedInput('');
      setUseDepositAmount(0);
      setRecipientName('');
      return;
    }

    const q = query(
      collection(db, 'packages'),
      where('customerId', '==', selectedCustomer.id),
      where('isArchived', '==', false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Package));
      // Only packages that have been weighed (weight > 0) and not yet fully paid
      const weighedUnpaid = all.filter(p => (p.weight || 0) > 0 && p.paymentStatus !== 'paid');
      setUnpaidPackages(weighedUnpaid);

      // Auto-select all by default
      const allIds = new Set(weighedUnpaid.map(p => p.id));
      setSelectedPackageIds(allIds);

      // Compute total for input default
      const totalBill = weighedUnpaid.reduce((sum, p) => sum + (p.finalCost || 0), 0);
      setAmountReceivedInput(String(totalBill));
      setRecipientName(selectedCustomer.name);
    });

    return () => unsub();
  }, [selectedCustomer]);

  // Selected packages subset
  const selectedPackages = unpaidPackages.filter(p => selectedPackageIds.has(p.id));

  // Totals of selected packages
  const totalBillSelected = selectedPackages.reduce((sum, p) => sum + (p.finalCost || 0), 0);
  const totalWeightSelected = selectedPackages.reduce((sum, p) => sum + (p.weight || 0), 0);
  const totalPromoSelected = selectedPackages.reduce((sum, p) => sum + (p.isPromo ? p.promoAmount : 0), 0);

  // Financial calculation
  const parsedReceived = parseFloat(amountReceivedInput.replace(/\D/g, '')) || 0;
  const customerAvailableDeposit = selectedCustomer?.depositBalance || 0;
  const safeDepositUsed = Math.min(useDepositAmount, customerAvailableDeposit);
  const totalEffectivePayment = parsedReceived + safeDepositUsed;
  const excessToDeposit = Math.max(0, totalEffectivePayment - totalBillSelected);
  const isFullyPaid = totalEffectivePayment >= totalBillSelected && totalBillSelected > 0;

  // Group packages by closing date
  const closingGroups: { [date: string]: Package[] } = {};
  unpaidPackages.forEach(p => {
    if (!closingGroups[p.closingDate]) {
      closingGroups[p.closingDate] = [];
    }
    closingGroups[p.closingDate].push(p);
  });

  const toggleSelectPackage = (id: string) => {
    const next = new Set(selectedPackageIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPackageIds(next);
  };

  const toggleSelectClosingGroup = (date: string) => {
    const group = closingGroups[date] || [];
    const allGroupSelected = group.every(p => selectedPackageIds.has(p.id));
    const next = new Set(selectedPackageIds);

    if (allGroupSelected) {
      group.forEach(p => next.delete(p.id));
    } else {
      group.forEach(p => next.add(p.id));
    }
    setSelectedPackageIds(next);
  };

  // Generate WhatsApp unpaid bill message
  const generateBillWhatsappMessage = () => {
    if (!selectedCustomer || selectedPackages.length === 0) return '';
    const resiList = selectedPackages.map((p, idx) =>
      `• ${p.waybill} (${p.weight.toFixed(2)} kg) = ${formatRupiah(p.finalCost)}`
    ).join('\n');

    return `Yth. Bapak/Ibu ${selectedCustomer.name},\nBerikut rincian tagihan paket ZDN CARGO (Jakarta - Timika):\n\nDaftar Resi:\n${resiList}\n\nTotal Paket: ${selectedPackages.length} paket\nTotal Berat: ${totalWeightSelected.toFixed(2)} kg\nTotal Potongan: ${totalPromoSelected > 0 ? formatRupiah(totalPromoSelected) : '-'}\nTOTAL TAGIHAN: ${formatRupiah(totalBillSelected)}\n\nPembayaran dapat ditransfer ke:\n${settings.bankName}: ${settings.bankAccount} (a.n. ${settings.bankAccountHolder})\n\nCek rincian paket di app.zdncargo.com\nTerima kasih!`;
  };

  const handleSendBillWhatsapp = () => {
    if (!selectedCustomer) return;
    const msg = generateBillWhatsappMessage();
    const url = getWhatsappUrl(selectedCustomer.whatsapp, msg);
    window.open(url, '_blank');
  };

  const handlePrintBillPDF = () => {
    if (!selectedCustomer || selectedPackages.length === 0) return;
    generateUnpaidBillPDF(selectedCustomer, selectedPackages, settings);
  };

  // Transactional Settlement Handler
  const handleExecutePayment = async () => {
    if (!selectedCustomer || selectedPackages.length === 0) return;
    if (totalEffectivePayment < totalBillSelected) {
      alert('Jumlah pembayaran dan deposit belum mencukupi total tagihan untuk pelunasan penuh.');
      return;
    }

    setIsProcessingPayment(true);
    setShowConfirmModal(false);

    try {
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const currentUserEmail = auth.currentUser?.email || 'admin';

      await runTransaction(db, async (tx) => {
        // Read customer document to lock and verify deposit balance
        const customerRef = doc(db, 'customers', selectedCustomer.id);
        const custSnap = await tx.get(customerRef);
        if (!custSnap.exists()) {
          throw new Error('Pelanggan tidak ditemukan.');
        }

        const currentBalance = custSnap.data().depositBalance || 0;
        if (safeDepositUsed > currentBalance) {
          throw new Error('Saldo deposit pelanggan tidak mencukupi.');
        }

        // Verify each package is still unpaid (concurrency guard)
        for (const pkg of selectedPackages) {
          const pkgRef = doc(db, 'packages', pkg.id);
          const pkgSnap = await tx.get(pkgRef);
          if (!pkgSnap.exists()) {
            throw new Error(`Paket ${pkg.waybill} tidak ditemukan.`);
          }
          if (pkgSnap.data().paymentStatus === 'paid') {
            throw new Error(`Paket ${pkg.waybill} sudah dilunasi dalam transaksi lain.`);
          }
        }

        // Calculate new customer deposit balance
        const newBalance = currentBalance - safeDepositUsed + excessToDeposit;
        tx.update(customerRef, {
          depositBalance: newBalance,
          updatedAt: now,
        });

        // Update each package to PAID and ARCHIVE
        selectedPackages.forEach((pkg) => {
          const pkgRef = doc(db, 'packages', pkg.id);
          tx.update(pkgRef, {
            paymentStatus: 'paid',
            paidAmount: pkg.finalCost,
            remainingCost: 0,
            paymentId,
            isArchived: true, // Archived logically without losing history
            updatedAt: now,
          });
        });

        // Create Payment Document
        const paymentDocRef = doc(db, 'payments', paymentId);
        const paymentRecord: Payment = {
          id: paymentId,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          customerWhatsapp: selectedCustomer.whatsapp || '',
          packageIds: selectedPackages.map(p => p.id),
          packageDetails: selectedPackages.map(p => ({
            packageId: p.id,
            waybill: p.waybill,
            weight: p.weight,
            cost: p.finalCost,
            closingDate: p.closingDate,
          })),
          totalAmount: totalBillSelected,
          amountReceived: parsedReceived,
          depositUsed: safeDepositUsed,
          excessToDeposit,
          paymentMethod,
          deliveryStatus,
          recipientName: recipientName.trim() || selectedCustomer.name,
          paidAt: now,
          receivedBy: auth.currentUser?.uid || 'admin',
          receivedByEmail: currentUserEmail,
          notes: paymentNotes.trim(),
          createdAt: now,
        };
        tx.set(paymentDocRef, paymentRecord);

        // Record deposit ledger if used or excess credited
        if (safeDepositUsed > 0) {
          const depUseRef = doc(db, 'customerDeposits', `dep_${Date.now()}_use`);
          tx.set(depUseRef, {
            id: depUseRef.id,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            amount: safeDepositUsed,
            type: 'debit',
            balanceAfter: currentBalance - safeDepositUsed,
            reason: `Penggunaan deposit untuk pelunasan ${paymentId}`,
            paymentId,
            createdBy: currentUserEmail,
            createdAt: now,
          });
        }

        if (excessToDeposit > 0) {
          const depExcessRef = doc(db, 'customerDeposits', `dep_${Date.now()}_cred`);
          tx.set(depExcessRef, {
            id: depExcessRef.id,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            amount: excessToDeposit,
            type: 'credit',
            balanceAfter: newBalance,
            reason: `Kelebihan pembayaran transaksi ${paymentId}`,
            paymentId,
            createdBy: currentUserEmail,
            createdAt: now,
          });
        }
      });

      // Audit log
      await logActivity({
        action: 'SETTLE_PAYMENT',
        category: 'payment',
        targetId: paymentId,
        details: `Pelunasan ${selectedPackages.length} paket sebesar ${formatRupiah(totalBillSelected)} via ${paymentMethod.toUpperCase()} (${deliveryStatus}).`,
      });

      setToast({
        type: 'success',
        message: `PELUNASAN BERHASIL! Paket telah ditandai LUNAS dan dipindahkan ke Arsip.`,
      });

      setSelectedPackageIds(new Set());
    } catch (err: any) {
      console.error('Payment settlement error:', err);
      setToast({
        type: 'error',
        message: 'Gagal memproses pelunasan: ' + err.message,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const filteredCustomerMatches = customerSearch.trim().length >= 2
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
          <CreditCard className="mr-2 h-6 w-6 text-blue-600" />
          Menu Pelunasan Ongkir & Penyerahan Paket
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Proses tagihan aktif yang telah ditimbang. Paket yang lunas otomatis masuk ke Arsip dan keluar dari alur aktif.
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

      {/* Step 1: Customer Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
          <User className="mr-1.5 h-4 w-4 text-blue-600" />
          Cari Pelanggan Yang Memiliki Tagihan Belum Lunas
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Ketik nama pelanggan..."
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />

          {showDropdown && filteredCustomerMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {filteredCustomerMatches.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(cust);
                    setCustomerSearch(cust.name);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs flex items-center justify-between border-b border-slate-100 last:border-0"
                >
                  <span className="font-semibold text-slate-900">{cust.name}</span>
                  <span className="text-slate-500 font-mono">{cust.whatsapp || 'Tanpa WhatsApp'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50/70 p-3 border border-blue-100 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-blue-900">Pelanggan:</span>
              <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
              <span className="rounded-full bg-blue-200/80 px-2 py-0.5 text-[10px] text-blue-900 font-semibold">
                Deposit Tersedia: {formatRupiah(selectedCustomer.depositBalance || 0)}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerSearch('');
              }}
              className="text-xs text-blue-700 hover:underline font-semibold"
            >
              Ganti Pelanggan
            </button>
          </div>
        )}
      </div>

      {/* Main Billing and Settlement Layout */}
      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Unpaid Packages by Closing Group */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center">
                    <Layers className="mr-2 h-5 w-5 text-blue-600" />
                    Tagihan Belum Lunas ({unpaidPackages.length} paket)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pilih paket yang akan dilunasi atau cetak tagihannya.
                  </p>
                </div>

                {/* Only 2 allowed utility buttons for unpaid bills */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePrintBillPDF}
                    disabled={selectedPackages.length === 0}
                    className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    title="Cetak PDF Tagihan"
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    1. Cetak PDF Tagihan
                  </button>
                  <button
                    onClick={handleSendBillWhatsapp}
                    disabled={selectedPackages.length === 0}
                    className="inline-flex items-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                    title="Kirim Pesan WhatsApp Tagihan"
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    2. Kirim Teks WhatsApp
                  </button>
                </div>
              </div>

              {unpaidPackages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Semua paket pelanggan ini sudah lunas atau belum ada paket yang ditimbang.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(closingGroups).map(([date, pkgs]) => {
                    const allGroupSelected = pkgs.every(p => selectedPackageIds.has(p.id));
                    return (
                      <div key={date} className="rounded-xl border border-slate-200 overflow-hidden">
                        {/* Group Header */}
                        <div
                          onClick={() => toggleSelectClosingGroup(date)}
                          className="flex items-center justify-between bg-slate-50 px-4 py-2.5 cursor-pointer hover:bg-slate-100 transition border-b border-slate-200"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={allGroupSelected}
                              onChange={() => toggleSelectClosingGroup(date)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded text-blue-600"
                            />
                            <span className="text-xs font-bold text-slate-800 flex items-center">
                              <Calendar className="mr-1 h-3.5 w-3.5 text-slate-500" />
                              Closing: {formatDateDDMMYYYY(date)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({pkgs.length} paket)
                            </span>
                          </div>
                          <span className="text-xs font-bold text-blue-700">
                            {formatRupiah(pkgs.reduce((s, p) => s + (p.finalCost || 0), 0))}
                          </span>
                        </div>

                        {/* Group Package Items */}
                        <div className="divide-y divide-slate-100">
                          {pkgs.map((pkg) => {
                            const isSelected = selectedPackageIds.has(pkg.id);
                            return (
                              <div
                                key={pkg.id}
                                onClick={() => toggleSelectPackage(pkg.id)}
                                className={`flex items-center justify-between p-3 text-xs cursor-pointer transition ${
                                  isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectPackage(pkg.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 rounded text-blue-600"
                                  />
                                  <div>
                                    <span className="font-mono font-bold text-slate-900">{pkg.waybill}</span>
                                    <div className="text-[11px] text-slate-500">
                                      Berat: <strong className="text-slate-700">{pkg.weight.toFixed(2)} kg</strong>
                                      {pkg.isPromo && <span className="ml-2 text-emerald-600 font-semibold">(Promo -Rp10.000)</span>}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-bold text-slate-900">{formatRupiah(pkg.finalCost)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Payment Action Box */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center border-b border-slate-100 pb-2">
                <CreditCard className="mr-2 h-4 w-4 text-blue-600" />
                Formulir Pelunasan Transaksi
              </h3>

              {/* Bill Summary */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Paket Dipilih:</span>
                  <span className="font-bold text-slate-900">{selectedPackages.length} paket</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Berat:</span>
                  <span className="font-bold text-slate-900">{totalWeightSelected.toFixed(2)} kg</span>
                </div>
                {totalPromoSelected > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Total Promo:</span>
                    <span>-{formatRupiah(totalPromoSelected)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-bold text-blue-900">
                  <span>TOTAL TAGIHAN:</span>
                  <span>{formatRupiah(totalBillSelected)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`rounded-xl border py-2 text-xs font-bold transition flex flex-col items-center justify-center ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building className="h-4 w-4 mb-1" />
                    Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`rounded-xl border py-2 text-xs font-bold transition flex flex-col items-center justify-center ${
                      paymentMethod === 'cash'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="h-4 w-4 mb-1" />
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    className={`rounded-xl border py-2 text-xs font-bold transition flex flex-col items-center justify-center ${
                      paymentMethod === 'qris'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="h-4 w-4 mb-1" />
                    QRIS
                  </button>
                </div>
              </div>

              {/* Delivery Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Penyerahan Paket
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryStatus('diambil')}
                    className={`rounded-xl border py-2 font-semibold transition ${
                      deliveryStatus === 'diambil'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Langsung Diambil
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryStatus('titip')}
                    className={`rounded-xl border py-2 font-semibold transition ${
                      deliveryStatus === 'titip'
                        ? 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Titip di Gudang
                  </button>
                </div>
              </div>

              {/* Recipient Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                  <User className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  Keterangan Nama Penerima / Yang Mengambil Paket *
                </label>
                <input
                  type="text"
                  placeholder="Nama orang yang mengambil paket di gudang Timika"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Amount Inputs */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah Uang Diterima (Rp)
                </label>
                <input
                  type="text"
                  value={amountReceivedInput}
                  onChange={(e) => setAmountReceivedInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              {/* Deposit Balance Usage */}
              {customerAvailableDeposit > 0 && (
                <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-200 text-xs space-y-2">
                  <div className="flex justify-between items-center text-amber-900 font-semibold">
                    <span className="flex items-center">
                      <Wallet className="mr-1 h-3.5 w-3.5 text-amber-700" />
                      Gunakan Deposit Pelanggan:
                    </span>
                    <span>Tersedia: {formatRupiah(customerAvailableDeposit)}</span>
                  </div>
                  <input
                    type="number"
                    max={customerAvailableDeposit}
                    value={useDepositAmount}
                    onChange={(e) => setUseDepositAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Excess Deposit Info */}
              {excessToDeposit > 0 && (
                <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-200 text-xs text-emerald-800">
                  Kelebihan bayar sebesar <strong>{formatRupiah(excessToDeposit)}</strong> akan otomatis ditambahkan ke saldo deposit pelanggan.
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pembayaran (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Titip ke tetangga / transfer jam 14:00"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isProcessingPayment || !isFullyPaid}
                className="w-full rounded-xl bg-[#0B1E36] py-3 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-40 transition active:scale-95 flex items-center justify-center"
              >
                {isProcessingPayment ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Memproses Pelunasan...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-emerald-400" />
                    Proses Pelunasan Lunas
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 text-center mb-2">
              Konfirmasi Pelunasan Paket
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4">
              Apakah Anda yakin ingin memproses pelunasan untuk <strong className="text-slate-900">{selectedCustomer?.name}</strong>?
            </p>

            <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1 mb-4 border border-slate-200">
              <div className="flex justify-between">
                <span>Total Paket:</span>
                <span className="font-bold">{selectedPackages.length} paket</span>
              </div>
              <div className="flex justify-between">
                <span>Total Tagihan:</span>
                <span className="font-bold text-blue-700">{formatRupiah(totalBillSelected)}</span>
              </div>
              <div className="flex justify-between">
                <span>Metode:</span>
                <span className="font-bold uppercase">{paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Penerima Paket:</span>
                <span className="font-bold text-slate-900">{recipientName || selectedCustomer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Penyerahan:</span>
                <span className="font-bold">{deliveryStatus === 'diambil' ? 'Diambil' : 'Titip di Gudang'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecutePayment}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Ya, Proses LUNAS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
