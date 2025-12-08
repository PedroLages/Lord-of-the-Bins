import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { WeeklySchedule } from '../types';
import { getWeekLabel, getWeekRangeString } from './weekUtils';

export interface ExportOptions {
  format: 'png' | 'pdf' | 'whatsapp';
  quality?: number;
  includeHeader?: boolean;
}

/**
 * Export the schedule grid as a PNG image
 */
export async function exportToPng(
  element: HTMLElement,
  week: WeeklySchedule,
  options: { quality?: number } = {}
): Promise<string> {
  const quality = options.quality || 1;

  // Apply export-specific styles
  element.classList.add('exporting');

  try {
    const dataUrl = await toPng(element, {
      quality,
      backgroundColor: '#ffffff',
      pixelRatio: 2, // Higher resolution for crisp output
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
      filter: (node) => {
        // Filter out elements with 'no-print' class
        if (node.classList?.contains('no-print')) return false;
        return true;
      }
    });

    return dataUrl;
  } finally {
    element.classList.remove('exporting');
  }
}

/**
 * Export the schedule grid as a PDF document
 */
export async function exportToPdf(
  element: HTMLElement,
  week: WeeklySchedule
): Promise<Blob> {
  // First get the PNG data
  const dataUrl = await exportToPng(element, week, { quality: 1 });

  // Create PDF
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Add header text
  const title = `Schedule - ${getWeekLabel(week)}`;
  const dateRange = getWeekRangeString(new Date(week.days[0].date));

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 14, 15);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(dateRange, 14, 22);

  // Add status badge
  pdf.setFontSize(9);
  pdf.text(`Status: ${week.status}${week.locked ? ' (Locked)' : ''}`, 14, 28);

  // Calculate image dimensions to fit page
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const headerSpace = 35;

  const maxWidth = pageWidth - (margin * 2);
  const maxHeight = pageHeight - headerSpace - margin;

  // Load image to get dimensions
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  // Calculate scaled dimensions maintaining aspect ratio
  const imgRatio = img.width / img.height;
  let finalWidth = maxWidth;
  let finalHeight = finalWidth / imgRatio;

  if (finalHeight > maxHeight) {
    finalHeight = maxHeight;
    finalWidth = finalHeight * imgRatio;
  }

  // Center the image horizontally
  const xOffset = (pageWidth - finalWidth) / 2;

  // Add the image
  pdf.addImage(dataUrl, 'PNG', xOffset, headerSpace, finalWidth, finalHeight);

  // Add footer
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Generated on ${new Date().toLocaleDateString()} • Lord of the Bins`,
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  );

  return pdf.output('blob');
}

/**
 * Download a file from a data URL or blob
 */
export function downloadFile(data: string | Blob, filename: string): void {
  const link = document.createElement('a');

  if (typeof data === 'string') {
    link.href = data;
  } else {
    link.href = URL.createObjectURL(data);
  }

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof data !== 'string') {
    URL.revokeObjectURL(link.href);
  }
}

/**
 * Share to WhatsApp with the schedule image
 * On mobile: opens WhatsApp directly
 * On desktop: opens WhatsApp Web
 */
export async function shareToWhatsApp(
  element: HTMLElement,
  week: WeeklySchedule
): Promise<void> {
  // Generate the image
  const dataUrl = await exportToPng(element, week);

  // First download the image so user has it
  const filename = `schedule-${week.id}.png`;
  downloadFile(dataUrl, filename);

  // Prepare WhatsApp message
  const weekLabel = getWeekLabel(week);
  const dateRange = getWeekRangeString(new Date(week.days[0].date));
  const message = encodeURIComponent(
    `📅 *${weekLabel}*\n${dateRange}\n\nStatus: ${week.status}${week.locked ? ' 🔒' : ''}\n\n_Please see the attached schedule image._`
  );

  // Detect if mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Open WhatsApp
  const whatsappUrl = isMobile
    ? `whatsapp://send?text=${message}`
    : `https://web.whatsapp.com/send?text=${message}`;

  window.open(whatsappUrl, '_blank');
}

/**
 * Generate filename for exports
 */
export function generateFilename(week: WeeklySchedule, extension: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `schedule-week${week.weekNumber}-${week.year}-${date}.${extension}`;
}
