export type UserRole = 'superadmin' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  whatsapp: string; // normalized international format (e.g., 6281234567890)
  notes?: string;
  depositBalance: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type PackageStatus = 'Tiba di Gudang Jakarta' | 'Terbang' | 'Dalam Perjalanan' | 'Tiba di Timika';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Package {
  id: string;
  waybill: string; // original marketplace / expedition AWB
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  closingDate: string; // YYYY-MM-DD
  status: PackageStatus;
  paymentStatus: PaymentStatus;
  weight: number; // in kg
  isPromo: boolean;
  promoAmount: number;
  normalCost: number;
  finalCost: number;
  paidAmount: number;
  remainingCost: number;
  paymentId?: string;
  scannedBy: string;
  weighedBy?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  weighedAt?: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'qris';
export type DeliveryStatus = 'diambil' | 'titip';

export interface PaymentItemDetail {
  packageId: string;
  waybill: string;
  weight: number;
  cost: number;
  closingDate: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  packageIds: string[];
  packageDetails?: PaymentItemDetail[];
  totalAmount: number; // sum of packages finalCost
  amountReceived: number; // cash/transfer/qris given by customer
  depositUsed: number; // deducted from customer deposit
  excessToDeposit: number; // change credited to deposit
  paymentMethod: PaymentMethod;
  deliveryStatus: DeliveryStatus;
  paidAt: string;
  receivedBy: string;
  receivedByEmail: string;
  recipientName?: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerDeposit {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  type: 'credit' | 'debit';
  balanceAfter: number;
  reason: string;
  paymentId?: string;
  createdBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  recordedBy: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface AppSettings {
  tariffPerKg: number; // default 75000
  minTariff: number; // default 10000
  roundUpMultiple: number; // default 5000
  promoAmount: number; // default 10000
  promoActive: boolean;
  promoName: string;
  promoDescription: string;
  effectiveDate: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessWhatsapp: string;
  routeInfo: string;
  promoInfo: string;
  logoUrl?: string;
  qrisImageUrl?: string;
  bankName: string;
  bankAccount: string;
  bankAccountHolder: string;
  paymentInstructions: string;
  dateFormat: string;
  timezone: string;
  currency: string;
  theme: {
    primaryColor: string; // e.g. #0B1E36 (Navy ZDN)
    secondaryColor: string; // e.g. #1E3A8A
    accentColor: string; // e.g. #2563EB
    surfaceColor: string; // e.g. #FFFFFF
    textColor: string; // e.g. #0F172A
  };
  updatedAt: string;
  updatedBy: string;
}

export interface DocumentTemplate {
  id: string;
  templateType: 'unpaid_bill' | 'paid_receipt' | 'closing_report' | 'financial_report';
  name: string;
  paperSize: 'A4' | 'A5' | 'custom';
  orientation: 'portrait' | 'landscape';
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
  showBankDetails: boolean;
  accentColor: string;
  notes: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  messageType: 'unpaid_bill' | 'paid_receipt' | 'closing_summary' | 'arrived_timika';
  title: string;
  content: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  category: 'scan' | 'weigh' | 'status_update' | 'payment' | 'customer' | 'admin' | 'settings' | 'backup';
  targetId?: string;
  details: string;
  performedBy: string;
  performedByEmail: string;
  timestamp: string;
}
