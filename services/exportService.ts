import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { WeeklySchedule, Operator, TaskType, MOCK_TASKS } from '../types';
import { getWeekLabel, getWeekRangeString } from './weekUtils';

export type ExportTheme = 'modern' | 'classic';

export interface ExportOptions {
  format: 'png' | 'pdf' | 'whatsapp';
  quality?: number;
  includeHeader?: boolean;
  theme?: ExportTheme;
}

// Task colors for classic theme (matching the original schedule)
const CLASSIC_TASK_COLORS: Record<string, { bg: string; text: string }> = {
  'Troubleshooter': { bg: '#00B0F0', text: '#000000' },
  'Troubleshooter AD': { bg: '#FF6600', text: '#FFFFFF' },
  'Quality checker': { bg: '#808080', text: '#FFFFFF' },
  'MONO counter': { bg: '#FFFF00', text: '#000000' },
  'Filler': { bg: '#92D050', text: '#000000' },
  'LVB Sheet': { bg: '#FFFF00', text: '#000000' },
  'Decanting': { bg: '#92D050', text: '#000000' },
  'Platform': { bg: '#FF66FF', text: '#000000' },
  'EST': { bg: '#9966FF', text: '#FFFFFF' },
  'Exceptions': { bg: '#FF0000', text: '#FFFFFF' },
  'Exceptions/Station': { bg: '#C0C0C0', text: '#000000' },
  'Training': { bg: '#00B0F0', text: '#000000' },
  'Trainer': { bg: '#00B0F0', text: '#000000' },
  'Process': { bg: '#90EE90', text: '#000000' },
  'People': { bg: '#90EE90', text: '#000000' },
  'Off process': { bg: '#C0C0C0', text: '#000000' },
  'Process/AD': { bg: '#90EE90', text: '#000000' },
};

// Dutch day abbreviations
const DUTCH_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];

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
  week: WeeklySchedule,
  options: {
    theme?: ExportTheme;
    operators?: Operator[];
    tasks?: TaskType[];
  } = {}
): Promise<Blob> {
  const { theme = 'modern', operators = [], tasks = MOCK_TASKS } = options;

  if (theme === 'classic' && operators.length > 0) {
    return exportToPdfClassic(week, operators, tasks);
  }

  // Modern theme - screenshot-based export
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
 * Export the schedule in the classic "Operational Plan 4M" format
 */
function exportToPdfClassic(
  week: WeeklySchedule,
  operators: Operator[],
  tasks: TaskType[]
): Blob {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Layout configuration
  const margin = 10;
  const nameColWidth = 35;
  const dayColWidth = (pageWidth - margin * 2 - nameColWidth) / 5;
  const headerHeight = 25;
  const rowHeight = 7;

  let y = margin;

  // === MAIN HEADER ===
  pdf.setFillColor(0, 128, 0); // Green header
  pdf.rect(margin, y, pageWidth - margin * 2, 12, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('OPERATIONAL PLAN 4M', pageWidth / 2, y + 8, { align: 'center' });
  y += 12;

  // === WEEKLY PLANNING SUBHEADER ===
  pdf.setFillColor(255, 255, 255);
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  pdf.text('WEEKLY PLANNING', pageWidth / 2, y + 6, { align: 'center' });
  y += 10;

  // === WEEK/DAY/DATE HEADER ROWS ===
  const headerRows = [
    { label: 'Week', values: [`WEEK ${week.weekNumber}`], span: true },
    { label: 'Day', values: DUTCH_DAYS, span: false },
    { label: 'Date', values: week.days.map(d => {
      const date = new Date(d.date);
      return `${date.getDate()}-${date.toLocaleString('en', { month: 'short' }).toLowerCase()}`;
    }), span: false }
  ];

  headerRows.forEach((row, rowIdx) => {
    // Name column
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin, y, nameColWidth, rowHeight, 'FD');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.text(row.label, margin + nameColWidth / 2, y + rowHeight / 2 + 1.5, { align: 'center' });

    // Day columns
    if (row.span) {
      // Span across all days
      pdf.setFillColor(255, 255, 255);
      pdf.rect(margin + nameColWidth, y, dayColWidth * 5, rowHeight, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.text(row.values[0], margin + nameColWidth + (dayColWidth * 5) / 2, y + rowHeight / 2 + 1.5, { align: 'center' });
    } else {
      row.values.forEach((val, i) => {
        const bgColor = rowIdx === 1 ? getHeaderDayColor(i) : [255, 255, 255];
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        pdf.rect(margin + nameColWidth + i * dayColWidth, y, dayColWidth, rowHeight, 'FD');
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', rowIdx === 1 ? 'bold' : 'normal');
        pdf.text(val, margin + nameColWidth + i * dayColWidth + dayColWidth / 2, y + rowHeight / 2 + 1.5, { align: 'center' });
      });
    }
    y += rowHeight;
  });

  y += 2; // Small gap after header

  // === OPERATOR SECTIONS ===
  const regularOps = operators.filter(op => op.type === 'Regular');
  const flexOps = operators.filter(op => op.type === 'Flex');
  const coordinators = operators.filter(op => op.type === 'Coordinator');

  // Render regular operators
  renderOperatorSection(pdf, regularOps, week, tasks, margin, nameColWidth, dayColWidth, rowHeight, y);
  y += regularOps.length * rowHeight + 3;

  // Render flex operators with separator
  if (flexOps.length > 0) {
    pdf.setFillColor(200, 200, 200);
    pdf.rect(margin, y, pageWidth - margin * 2, 1, 'F');
    y += 3;
    renderOperatorSection(pdf, flexOps, week, tasks, margin, nameColWidth, dayColWidth, rowHeight, y);
    y += flexOps.length * rowHeight + 3;
  }

  // Render coordinators with separator
  if (coordinators.length > 0) {
    pdf.setFillColor(200, 200, 200);
    pdf.rect(margin, y, pageWidth - margin * 2, 1, 'F');
    y += 3;
    renderOperatorSection(pdf, coordinators, week, tasks, margin, nameColWidth, dayColWidth, rowHeight, y);
  }

  return pdf.output('blob');
}

/**
 * Get header day column background color based on index
 */
function getHeaderDayColor(index: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [255, 192, 203], // Pink - Monday
    [255, 255, 153], // Yellow - Tuesday
    [173, 216, 230], // Light Blue - Wednesday
    [144, 238, 144], // Light Green - Thursday
    [221, 160, 221], // Plum - Friday
  ];
  return colors[index] || [255, 255, 255];
}

/**
 * Render a section of operators in the classic format
 */
function renderOperatorSection(
  pdf: jsPDF,
  operators: Operator[],
  week: WeeklySchedule,
  tasks: TaskType[],
  margin: number,
  nameColWidth: number,
  dayColWidth: number,
  rowHeight: number,
  startY: number
): void {
  let y = startY;

  operators.forEach(op => {
    // Operator name cell
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y, nameColWidth, rowHeight, 'FD');
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(op.name, margin + 2, y + rowHeight / 2 + 1.5);

    // Day cells
    week.days.forEach((day, dayIdx) => {
      const assignment = day.assignments[op.id];
      const taskId = assignment?.taskId;
      const task = taskId ? tasks.find(t => t.id === taskId) : null;
      const taskName = task?.name || '';

      // Get color for this task
      const colors = CLASSIC_TASK_COLORS[taskName] || { bg: '#FFFFFF', text: '#000000' };
      const bgColor = hexToRgb(colors.bg);
      const textColor = hexToRgb(colors.text);

      pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin + nameColWidth + dayIdx * dayColWidth, y, dayColWidth, rowHeight, 'FD');

      if (taskName) {
        pdf.setTextColor(textColor.r, textColor.g, textColor.b);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        // Truncate long task names
        const displayName = taskName.length > 18 ? taskName.substring(0, 16) + '...' : taskName;
        pdf.text(displayName, margin + nameColWidth + dayIdx * dayColWidth + dayColWidth / 2, y + rowHeight / 2 + 1.5, { align: 'center' });
      }
    });

    y += rowHeight;
  });
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
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
