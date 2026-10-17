import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppSettings, Customer, Package, Payment } from '@/src/types';
import { formatRupiah, formatDateDDMMYYYY, formatDateTimeWIT } from '@/src/utils/formatters';

// Generate Unpaid Bill PDF
export function generateUnpaidBillPDF(
  customer: Customer,
  packages: Package[],
  settings: AppSettings
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const navy = [11, 30, 54]; // #0B1E36
  const blue = [37, 99, 235];

  // Header banner
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, 210, 32, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ZDN CARGO — ZONA DISTRIBUSI NIAGA', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Layanan Kargo Udara Jakarta — Timika | Ongkir Mulai Rp10.000', 14, 21);
  doc.text(`Alamat: ${settings.businessAddress} | WA: ${settings.businessWhatsapp}`, 14, 27);

  // Document Title
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAGIHAN ONGKOS KIRIM (BELUM LUNAS)', 14, 44);

  // Metadata block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  const leftX = 14;
  const rightX = 120;
  let currentY = 52;

  doc.text(`Nama Pelanggan: ${customer.name}`, leftX, currentY);
  doc.text(`No. WhatsApp: ${customer.whatsapp || '-'}`, leftX, currentY + 6);
  doc.text(`Tanggal Cetak: ${formatDateDDMMYYYY(new Date())}`, rightX, currentY);
  doc.text(`Total Paket: ${packages.length} paket`, rightX, currentY + 6);

  currentY += 16;

  // Table
  const tableData = packages.map((pkg, idx) => [
    idx + 1,
    pkg.waybill,
    formatDateDDMMYYYY(pkg.closingDate),
    `${pkg.weight.toFixed(2)} kg`,
    pkg.isPromo ? formatRupiah(pkg.promoAmount) : '-',
    formatRupiah(pkg.finalCost),
  ]);

  const totalWeight = packages.reduce((sum, p) => sum + (p.weight || 0), 0);
  const totalCost = packages.reduce((sum, p) => sum + (p.finalCost || 0), 0);
  const totalPromo = packages.reduce((sum, p) => sum + (p.isPromo ? p.promoAmount : 0), 0);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Nomor Resi / AWB', 'Closing', 'Berat', 'Promo', 'Biaya (IDR)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [11, 30, 54],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' },
    },
    foot: [
      [
        { content: 'TOTAL KESELURUHAN', colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: `${totalWeight.toFixed(2)} kg`, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: totalPromo > 0 ? `-${formatRupiah(totalPromo)}` : '-', styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: formatRupiah(totalCost), styles: { fontStyle: 'bold' as const, halign: 'right' as const, textColor: [37, 99, 235] as [number, number, number] } },
      ],
    ] as any,
    footStyles: {
      fillColor: [240, 244, 248],
      textColor: [11, 30, 54],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;

  // Payment Instructions Box
  doc.setDrawColor(200, 215, 230);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, 182, 38, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('PETUNJUK PEMBAYARAN:', 18, finalY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(`Rekening Bank: ${settings.bankName} - ${settings.bankAccount} (a.n. ${settings.bankAccountHolder})`, 18, finalY + 14);
  doc.text(`Catatan: ${settings.paymentInstructions}`, 18, finalY + 20);
  doc.text(`Konfirmasi & Bukti Transfer: WhatsApp ${settings.businessWhatsapp}`, 18, finalY + 26);
  doc.text(`Pelacakan Paket Online: app.zdncargo.com`, 18, finalY + 32);

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('Terima kasih atas kepercayaan Anda menggunakan jasa pengiriman ZDN CARGO.', 14, 285);

  doc.save(`Tagihan_${customer.name.replace(/\s+/g, '_')}_${formatDateDDMMYYYY(new Date())}.pdf`);
}

// Generate Paid Receipt PDF
export function generatePaidReceiptPDF(
  payment: Payment,
  packages: Package[],
  settings: AppSettings
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const navy = [11, 30, 54];

  // Header banner
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ZDN CARGO — ZONA DISTRIBUSI NIAGA', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Kwitansi Bukti Pembayaran Resmi Kargo Udara Jakarta — Timika', 14, 21);
  doc.text(`Alamat: ${settings.businessAddress} | WA: ${settings.businessWhatsapp}`, 14, 27);

  // Stamp LUNAS
  doc.setDrawColor(22, 163, 74);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(145, 38, 50, 18, 2, 2, 'FD');
  doc.setTextColor(22, 163, 74);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LUNAS / PAID', 152, 50);

  // Title
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('BUKTI PEMBAYARAN ONGKIR', 14, 44);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`No. Transaksi: ${payment.id}`, 14, 50);
  doc.text(`Nama Pelanggan: ${payment.customerName}`, 14, 56);
  doc.text(`Nama Penerima: ${payment.recipientName || payment.customerName}`, 14, 62);
  doc.text(`Waktu Bayar: ${formatDateTimeWIT(payment.paidAt)}`, 14, 68);
  doc.text(`Metode Bayar: ${payment.paymentMethod.toUpperCase()}`, 90, 56);
  doc.text(`Status Penyerahan: ${payment.deliveryStatus === 'diambil' ? 'Sudah Diambil di Gudang' : 'Dititipkan di Gudang'}`, 90, 62);

  const tableData = packages.map((pkg, idx) => [
    idx + 1,
    pkg.waybill,
    formatDateDDMMYYYY(pkg.closingDate),
    `${pkg.weight.toFixed(2)} kg`,
    pkg.isPromo ? formatRupiah(pkg.promoAmount) : '-',
    formatRupiah(pkg.finalCost),
  ]);

  const totalWeight = packages.reduce((sum, p) => sum + (p.weight || 0), 0);

  autoTable(doc, {
    startY: 74,
    head: [['No', 'Nomor Resi / AWB', 'Closing', 'Berat', 'Promo', 'Biaya']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [11, 30, 54], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' },
    },
    foot: [
      [
        { content: 'TOTAL ONGKIR', colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: `${totalWeight.toFixed(2)} kg`, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: '', styles: { fontStyle: 'bold' as const } },
        { content: formatRupiah(payment.totalAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
      ],
      [
        { content: 'JUMLAH DITERIMA', colSpan: 5, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: formatRupiah(payment.amountReceived), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
      ],
      ...(payment.depositUsed > 0 ? [[
        { content: 'DEPOSIT DIGUNAKAN', colSpan: 5, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: formatRupiah(payment.depositUsed), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
      ]] : []),
      ...(payment.excessToDeposit > 0 ? [[
        { content: 'KELEBIHAN DITAMBAH KE DEPOSIT', colSpan: 5, styles: { fontStyle: 'bold' as const, halign: 'right' as const, textColor: [22, 163, 74] as [number, number, number] } },
        { content: formatRupiah(payment.excessToDeposit), styles: { fontStyle: 'bold' as const, halign: 'right' as const, textColor: [22, 163, 74] as [number, number, number] } },
      ]] : []),
    ] as any,
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Diterima oleh:', 14, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text(payment.receivedByEmail || 'Staff ZDN Timika', 14, finalY + 14);

  doc.setFont('helvetica', 'normal');
  doc.text('Tanda Tangan Pelanggan:', 130, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text(payment.customerName, 130, finalY + 14);

  doc.save(`Kwitansi_${payment.customerName.replace(/\s+/g, '_')}_${payment.id}.pdf`);
}

// Generate Closing Report PDF
export function generateClosingReportPDF(
  closingDate: string,
  packages: Package[],
  settings: AppSettings
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy = [11, 30, 54];

  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('ZDN CARGO — REKAP CLOSING PENERIMAAN TIMIKA', 14, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Rute: Jakarta — Timika via Udara | Tanggal Closing: ${formatDateDDMMYYYY(closingDate)}`, 14, 21);

  // Group by customer
  const customerMap: { [name: string]: Package[] } = {};
  packages.forEach(p => {
    if (!customerMap[p.customerName]) {
      customerMap[p.customerName] = [];
    }
    customerMap[p.customerName].push(p);
  });

  const rows: any[] = [];
  let idx = 1;
  for (const [name, pkgs] of Object.entries(customerMap)) {
    const totalW = pkgs.reduce((s, p) => s + (p.weight || 0), 0);
    const totalCost = pkgs.reduce((s, p) => s + (p.finalCost || 0), 0);
    rows.push([
      idx++,
      name,
      `${pkgs.length} paket`,
      `${totalW.toFixed(2)} kg`,
      formatRupiah(totalCost),
      pkgs[0]?.customerWhatsapp || '-',
    ]);
  }

  const grandPackages = packages.length;
  const grandWeight = packages.reduce((s, p) => s + (p.weight || 0), 0);
  const grandCost = packages.reduce((s, p) => s + (p.finalCost || 0), 0);

  autoTable(doc, {
    startY: 36,
    head: [['No', 'Nama Pelanggan', 'Jumlah Paket', 'Total Berat', 'Total Biaya', 'No. WhatsApp']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [11, 30, 54], textColor: [255, 255, 255] },
    foot: [
      [
        { content: 'TOTAL KESELURUHAN', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `${grandPackages} paket`, styles: { fontStyle: 'bold' } },
        { content: `${grandWeight.toFixed(2)} kg`, styles: { fontStyle: 'bold' } },
        { content: formatRupiah(grandCost), styles: { fontStyle: 'bold' } },
        { content: '', styles: {} },
      ],
    ],
  });

  doc.save(`Rekap_Closing_${formatDateDDMMYYYY(closingDate)}.pdf`);
}

// Thermal receipt printing in 58mm or 80mm
export function printThermalReceipt(data: {
  title: string;
  customerName: string;
  packages: Array<{ waybill: string; weight: number; cost: number }>;
  total: number;
  date: string;
  isPaid: boolean;
  method?: string;
  settings: AppSettings;
  paperWidth?: '58mm' | '80mm';
}) {
  const width = data.paperWidth === '80mm' ? '76mm' : '48mm';
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Thermal Receipt</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${width};
            margin: 0 auto;
            padding: 4px;
            font-size: 11px;
            color: #000;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; }
          .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        </style>
      </head>
      <body>
        <div class="center bold">${data.settings.businessName}</div>
        <div class="center" style="font-size: 10px;">Kargo Udara Jakarta — Timika</div>
        <div class="center" style="font-size: 9px;">WA: ${data.settings.businessWhatsapp}</div>
        <div class="divider"></div>
        <div class="center bold">${data.title}</div>
        <div class="row"><span>Waktu:</span><span>${formatDateDDMMYYYY(data.date)}</span></div>
        <div class="row"><span>Customer:</span><span class="bold">${data.customerName}</span></div>
        ${data.method ? `<div class="row"><span>Metode:</span><span>${data.method.toUpperCase()}</span></div>` : ''}
        <div class="row"><span>Status:</span><span class="bold">${data.isPaid ? 'LUNAS' : 'BELUM LUNAS'}</span></div>
        <div class="divider"></div>
        <div class="bold">Rincian Paket:</div>
        ${data.packages.map((p, i) => `
          <div class="row">
            <span class="nowrap">${i + 1}. ${p.waybill}</span>
          </div>
          <div class="row" style="padding-left: 10px; font-size: 10px;">
            <span>${p.weight.toFixed(2)} kg</span>
            <span>${formatRupiah(p.cost)}</span>
          </div>
        `).join('')}
        <div class="double-divider"></div>
        <div class="row bold" style="font-size: 12px;">
          <span>TOTAL:</span>
          <span>${formatRupiah(data.total)}</span>
        </div>
        <div class="divider"></div>
        <div class="center" style="font-size: 9px; margin-top: 6px;">
          Lacak resi Anda di app.zdncargo.com<br/>
          Terima kasih atas kepercayaan Anda!
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}
