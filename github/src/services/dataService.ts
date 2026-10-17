import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import {
  AppSettings,
  Customer,
  Package,
  Payment,
  Expense,
  AuditLog,
  MessageTemplate,
  DocumentTemplate,
} from '@/src/types';
import { getTodayJayapura } from '@/src/utils/formatters';

export const DEFAULT_SETTINGS: AppSettings = {
  tariffPerKg: 75000,
  minTariff: 10000,
  roundUpMultiple: 5000,
  promoAmount: 10000,
  promoActive: true,
  promoName: 'Promo Hemat Ongkir',
  promoDescription: 'Potongan Rp10.000 per paket untuk pelanggan setia',
  effectiveDate: '2026-01-01',
  businessName: 'ZDN CARGO — Zona Distribusi Niaga',
  businessAddress: 'Jl. Ahmad Yani, Timika, Papua Tengah & Hub Kargo Bandara Soekarno-Hatta Cengkareng',
  businessPhone: '081240001234',
  businessWhatsapp: '6281240001234',
  routeInfo: 'Jakarta — Timika via Udara (Ekspres & Reguler)',
  promoInfo: 'Ongkir mulai Rp10.000 per paket',
  logoUrl: '',
  qrisImageUrl: '',
  bankName: 'Bank BCA / Mandiri',
  bankAccount: '123-456-7890',
  bankAccountHolder: 'Zona Distribusi Niaga',
  paymentInstructions: 'Transfer via BCA/Mandiri atau scan QRIS ZDN CARGO. Sertakan nama pelanggan pada berita transfer.',
  dateFormat: 'DD-MM-YYYY',
  timezone: 'Asia/Jayapura',
  currency: 'IDR',
  theme: {
    primaryColor: '#0b1e36', // Navy ZDN
    secondaryColor: '#1e3a8a',
    accentColor: '#2563eb',
    surfaceColor: '#ffffff',
    textColor: '#0f172a',
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'unpaid_bill',
    messageType: 'unpaid_bill',
    title: 'Pemberitahuan Tagihan Belum Lunas',
    content: `Yth. Bapak/Ibu {nama},
Berikut rincian tagihan paket Anda di ZDN CARGO (Jakarta - Timika):

Tanggal Closing: {tanggal_closing}
Daftar Resi:
{daftar_resi}

Jumlah Paket: {jumlah_paket} paket
Total Berat: {total_berat} kg
Total Potongan Promo: {total_promo}
TOTAL TAGIHAN: {total_tagihan}

Informasi Pembayaran:
{informasi_rekening}

Mohon konfirmasi setelah melakukan transfer.
Cek status paket Anda di app.zdncargo.com
Terima kasih!`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'paid_receipt',
    messageType: 'paid_receipt',
    title: 'Konfirmasi Pembayaran Lunas',
    content: `Yth. Bapak/Ibu {nama},
Terima kasih! Pembayaran kargo Anda di ZDN CARGO telah kami terima LUNAS.

Nomor Pembayaran: {nomor_pembayaran}
Total Bayar: {total_bayar}
Metode: {metode_pembayaran}
Status Pengambilan: {status_penyerahan}
Waktu: {tanggal_pembayaran}

Paket dapat diambil di gudang ZDN CARGO Timika dengan menunjukkan pesan ini.
Salam,
ZDN CARGO — Zona Distribusi Niaga`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'closing_summary',
    messageType: 'closing_summary',
    title: 'Pengumuman Closing Tiba di Timika',
    content: `PAKET TIBA DI TIMIKA

Closing tanggal: {tanggal_closing}

{daftar_pelanggan_dan_jumlah_paket}

Jumlah paket: {total_paket} paket

Info lebih lengkap dan ongkir cek app.zdncargo.com

Terima kasih.`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'arrived_timika',
    messageType: 'arrived_timika',
    title: 'Pemberitahuan Paket Tiba di Timika',
    content: `Halo {nama}, paket Anda via ZDN CARGO telah TIBA DI TIMIKA!
Silakan kunjungi app.zdncargo.com untuk melihat rincian resi dan ongkir Anda.`,
    updatedAt: new Date().toISOString(),
  },
];

// Load or initialize AppSettings
export async function getAppSettings(): Promise<AppSettings> {
  const ref = doc(db, 'settings', 'global');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...snap.data() } as AppSettings;
    } else {
      // Initialize default settings document in Firestore if not yet created
      try {
        await setDoc(ref, DEFAULT_SETTINGS);
      } catch {
        // If unauthenticated or offline, use in-memory defaults gracefully
      }
      return DEFAULT_SETTINGS;
    }
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Save AppSettings
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const ref = doc(db, 'settings', 'global');
  try {
    await setDoc(ref, {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || 'admin',
    }, { merge: true });

    await logActivity({
      action: 'UPDATE_SETTINGS',
      category: 'settings',
      details: 'Memperbarui konfigurasi sistem, tarif, atau identitas ZDN Cargo',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/global');
  }
}

// Log operational activity to auditLogs collection
export async function logActivity(log: {
  action: string;
  category: AuditLog['category'];
  details: string;
  targetId?: string;
}): Promise<void> {
  try {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ref = doc(db, 'auditLogs', id);
    const entry: AuditLog = {
      id,
      action: log.action,
      category: log.category,
      targetId: log.targetId || '',
      details: log.details,
      performedBy: auth.currentUser?.uid || 'system',
      performedByEmail: auth.currentUser?.email || 'anonymous',
      timestamp: new Date().toISOString(),
    };
    await setDoc(ref, entry);
  } catch (err) {
    console.warn('Audit logging failed silently:', err);
  }
}

// Customer Operations
export async function getCustomers(): Promise<Customer[]> {
  try {
    const snap = await getDocs(collection(db, 'customers'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'customers');
  }
}

export async function findOrCreateCustomer(name: string, whatsapp?: string): Promise<Customer> {
  const cleanName = name.trim();
  const q = query(collection(db, 'customers'), where('name', '==', cleanName));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const existing = { ...snap.docs[0].data(), id: snap.docs[0].id } as Customer;
    if (whatsapp && (!existing.whatsapp || existing.whatsapp === '')) {
      const ref = doc(db, 'customers', existing.id);
      await updateDoc(ref, { whatsapp, updatedAt: new Date().toISOString() });
      existing.whatsapp = whatsapp;
    }
    return existing;
  }

  // Create new customer
  const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newCust: Customer = {
    id,
    name: cleanName,
    whatsapp: whatsapp || '',
    depositBalance: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'customers', id), newCust);
  await logActivity({
    action: 'CREATE_CUSTOMER',
    category: 'customer',
    targetId: id,
    details: `Menambah pelanggan baru: ${cleanName}`,
  });
  return newCust;
}

// Check Waybill Duplicate safely
export async function checkWaybillExists(waybill: string): Promise<boolean> {
  const clean = waybill.trim().toUpperCase();
  const q = query(collection(db, 'packages'), where('waybill', '==', clean));
  const snap = await getDocs(q);
  return !snap.empty;
}

// Save scanned package with duplicate protection
export async function saveScannedPackage(pkg: {
  waybill: string;
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  closingDate: string;
  notes?: string;
}): Promise<Package> {
  const cleanWaybill = pkg.waybill.trim().toUpperCase();

  return await runTransaction(db, async (tx) => {
    // Check duplicate inside transaction
    const q = query(collection(db, 'packages'), where('waybill', '==', cleanWaybill));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`DUPLICATE_WAYBILL: Nomor resi ${cleanWaybill} sudah terdaftar di sistem.`);
    }

    const id = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const packageDocRef = doc(db, 'packages', id);

    const newPackage: Package = {
      id,
      waybill: cleanWaybill,
      customerId: pkg.customerId,
      customerName: pkg.customerName,
      customerWhatsapp: pkg.customerWhatsapp || '',
      closingDate: pkg.closingDate || getTodayJayapura(),
      status: 'Tiba di Gudang Jakarta',
      paymentStatus: 'unpaid',
      weight: 0,
      isPromo: false,
      promoAmount: 0,
      normalCost: 0,
      finalCost: 0,
      paidAmount: 0,
      remainingCost: 0,
      scannedBy: auth.currentUser?.email || 'admin',
      notes: pkg.notes || '',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tx.set(packageDocRef, newPackage);
    return newPackage;
  });
}
