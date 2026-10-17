import { AppSettings } from '@/src/types';

/**
 * Format number to Indonesian Rupiah currency string (IDR)
 * e.g., 75000 -> "Rp75.000"
 */
export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rp0';
  }
  const rounded = Math.round(amount);
  return 'Rp' + rounded.toLocaleString('id-ID');
}

/**
 * Format any ISO/timestamp or date string to DD-MM-YYYY in Asia/Jayapura timezone
 */
export function formatDateDDMMYYYY(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      // If it's already YYYY-MM-DD
      if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const parts = dateInput.split('-');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return String(dateInput);
    }
    
    // Format according to Asia/Jayapura timezone (UTC+9)
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jayapura',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    const formatted = formatter.format(d);
    // id-ID format is usually dd/mm/yyyy or dd-mm-yyyy
    return formatted.replace(/\//g, '-');
  } catch {
    return String(dateInput);
  }
}

/**
 * Format date + time in Asia/Jayapura timezone
 */
export function formatDateTimeWIT(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jayapura',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d).replace(/\//g, '-') + ' WIT';
  } catch {
    return String(dateInput);
  }
}

/**
 * Get current date string in YYYY-MM-DD format based on Asia/Jayapura timezone
 */
export function getTodayJayapura(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jayapura',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).format(now); // en-CA produces YYYY-MM-DD
  return parts;
}

/**
 * Normalize WhatsApp / phone number to international format without + or spaces
 * e.g. "0812-3456-7890" -> "6281234567890"
 * e.g. "+62 812 3456 7890" -> "6281234567890"
 */
export function normalizeWhatsapp(input: string): string {
  if (!input) return '';
  let cleaned = input.replace(/\D/g, ''); // keep only numbers
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '628' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Calculate shipping cost strictly according to ZDN CARGO business rules:
 * - Base cost = weight (kg) * tariffPerKg (default 75.000)
 * - Normal cost = max(baseCost, minTariff (default 10.000)), rounded UP to multiple of roundUpMultiple (default 5.000)
 * - Final cost = max(0, normalCost - (isPromo ? promoAmount : 0))
 */
export function calculateShippingCost(
  weight: number,
  settings: Pick<AppSettings, 'tariffPerKg' | 'minTariff' | 'roundUpMultiple' | 'promoAmount' | 'promoActive'>,
  isPromo: boolean
): {
  baseCost: number;
  normalCost: number;
  promoDiscount: number;
  finalCost: number;
} {
  const safeWeight = Math.max(0, weight || 0);
  const tariff = settings.tariffPerKg || 75000;
  const minTariff = settings.minTariff || 10000;
  const roundMultiple = settings.roundUpMultiple || 5000;
  const promoAmt = settings.promoAmount || 10000;
  
  if (safeWeight <= 0) {
    return { baseCost: 0, normalCost: 0, promoDiscount: 0, finalCost: 0 };
  }

  const baseCost = Math.round(safeWeight * tariff);
  const preRound = Math.max(baseCost, minTariff);
  const normalCost = Math.ceil(preRound / roundMultiple) * roundMultiple;
  const promoDiscount = (isPromo && settings.promoActive !== false) ? promoAmt : 0;
  const finalCost = Math.max(0, normalCost - promoDiscount);

  return {
    baseCost,
    normalCost,
    promoDiscount,
    finalCost,
  };
}

/**
 * Generate a WhatsApp click-to-chat URL
 */
export function getWhatsappUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsapp(phone);
  const encodedMsg = encodeURIComponent(message);
  if (!normalized) {
    return `https://wa.me/?text=${encodedMsg}`;
  }
  return `https://wa.me/${normalized}?text=${encodedMsg}`;
}
