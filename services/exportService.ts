import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { WeeklySchedule, Operator, TaskType, MOCK_TASKS, WeekDay } from '../types';
import { getWeekLabel, getWeekRangeString } from './weekUtils';

export type ExportTheme = 'modern' | 'classic';
export type ExportFormat = 'png' | 'pdf' | 'whatsapp' | 'csv' | 'excel';

export interface ExportOptions {
  format: 'png' | 'pdf' | 'whatsapp';
  quality?: number;
  includeHeader?: boolean;
  theme?: ExportTheme;
}

// Task colors for classic theme (matching the original Excel schedule exactly)
const CLASSIC_TASK_COLORS: Record<string, { bg: string; text: string }> = {
  'Troubleshooter': { bg: '#0ea5e9', text: '#FFFFFF' },     // Sky blue
  'Troubleshooter AD': { bg: '#f97316', text: '#FFFFFF' }, // Orange
  'Quality checker': { bg: '#374151', text: '#FFFFFF' },   // Dark gray
  'MONO counter': { bg: '#fbbf24', text: '#000000' },      // Amber
  'Filler': { bg: '#84cc16', text: '#000000' },            // Lime
  'LVB Sheet': { bg: '#fbbf24', text: '#000000' },         // Amber
  'Decanting': { bg: '#86efac', text: '#000000' },         // Light green
  'Platform': { bg: '#f472b6', text: '#000000' },          // Pink
  'EST': { bg: '#a78bfa', text: '#FFFFFF' },               // Purple
  'Exceptions': { bg: '#ef4444', text: '#FFFFFF' },        // Red
  'Exceptions/Station': { bg: '#f87171', text: '#FFFFFF' },// Light red
  'Training': { bg: '#00B0F0', text: '#000000' },
  'Trainer': { bg: '#00B0F0', text: '#000000' },
  'Process': { bg: '#dcfce7', text: '#000000' },           // Pale green
  'People': { bg: '#dcfce7', text: '#000000' },            // Pale green
  'Off process': { bg: '#e5e7eb', text: '#000000' },       // Gray
  'Process/AD': { bg: '#dcfce7', text: '#000000' },        // Pale green
};

// Dutch day abbreviations
const DUTCH_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];

/**
 * Export the schedule grid as a PNG image
 * Only captures the table element, not the surrounding toolbar/buttons
 */
export async function exportToPng(
  element: HTMLElement,
  week: WeeklySchedule,
  options: { quality?: number } = {}
): Promise<string> {
  const quality = options.quality || 1;

  // Find the actual table element within the container
  // This ensures we only capture the schedule table, not toolbar buttons
  const tableElement = element.querySelector('table') as HTMLElement;
  const targetElement = tableElement || element;

  // Apply export-specific styles
  targetElement.classList.add('exporting');

  try {
    const dataUrl = await toPng(targetElement, {
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
    targetElement.classList.remove('exporting');
  }
}

/**
 * Export the schedule in the classic "Operational Plan 4M" format as a PNG image
 * Uses Canvas to render the Excel-style layout
 */
export async function exportToPngClassic(
  week: WeeklySchedule,
  operators: Operator[],
  tasks: TaskType[]
): Promise<string> {
  // Canvas dimensions (A4 landscape at 150 DPI for good quality)
  const scale = 2; // For retina displays
  const canvasWidth = 1190 * scale; // ~A4 landscape width
  const canvasHeight = 842 * scale; // ~A4 landscape height

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Scale for high DPI
  ctx.scale(scale, scale);
  const width = canvasWidth / scale;
  const height = canvasHeight / scale;

  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Layout configuration
  const margin = 20;
  const nameColWidth = 100;
  const dayColWidth = (width - margin * 2 - nameColWidth) / 5;

  // Count operators by type
  const regularOps = operators.filter(op => op.type === 'Regular' && op.status === 'Active');
  const flexOps = operators.filter(op => op.type === 'Flex' && op.status === 'Active');
  const coordinators = operators.filter(op => op.type === 'Coordinator' && op.status === 'Active');
  const totalOperators = regularOps.length + flexOps.length + coordinators.length;

  // Calculate available height for operators
  const fixedHeaderHeight = 110;
  const sectionSpacing = 6; // Small spacing between sections (no labels like original Excel)
  const numSections = (regularOps.length > 0 ? 1 : 0) + (flexOps.length > 0 ? 1 : 0) + (coordinators.length > 0 ? 1 : 0);
  const totalSectionSpacingHeight = Math.max(0, numSections - 1) * sectionSpacing; // Spacing between sections only
  const bottomMargin = margin;

  const availableHeight = height - margin - fixedHeaderHeight - totalSectionSpacingHeight - bottomMargin;
  let rowHeight = totalOperators > 0 ? availableHeight / totalOperators : 24;
  rowHeight = Math.max(18, Math.min(28, rowHeight));

  let y = margin;
  const headerRowHeight = 22;

  // Helper function to draw filled rect with stroke
  const drawCell = (x: number, y: number, w: number, h: number, fillColor: string, strokeColor = '#C8C8C8') => {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  };

  // Helper to center text in cell
  const drawCenteredText = (text: string, x: number, y: number, w: number, h: number, font: string, color: string) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  };

  // === MAIN HEADER - Green Banner ===
  drawCell(margin, y, width - margin * 2, 30, '#228B22', '#228B22');
  ctx.font = 'bold 18px Helvetica';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OPERATIONAL PLAN 4M', width / 2, y + 15);
  y += 30;

  // === WEEKLY PLANNING SUBHEADER ===
  drawCell(margin, y, width - margin * 2, 22, '#F0F0F0');
  drawCenteredText('WEEKLY PLANNING', margin, y, width - margin * 2, 22, 'bold 14px Helvetica', '#000000');
  y += 22;

  // === WEEK NUMBER ROW ===
  drawCell(margin, y, nameColWidth, headerRowHeight, '#FFFFFF');
  drawCenteredText('Week', margin, y, nameColWidth, headerRowHeight, 'bold 12px Helvetica', '#000000');

  drawCell(margin + nameColWidth, y, dayColWidth * 5, headerRowHeight, '#FFFFC8');
  drawCenteredText(`WEEK ${week.weekNumber} - ${week.year}`, margin + nameColWidth, y, dayColWidth * 5, headerRowHeight, 'bold 14px Helvetica', '#000000');
  y += headerRowHeight;

  // === DAY ROW ===
  const dayColors = ['#FFC0CB', '#FFFF99', '#ADD8E6', '#90EE90', '#DDA0DD'];
  drawCell(margin, y, nameColWidth, headerRowHeight, '#FFFFFF');
  drawCenteredText('Day', margin, y, nameColWidth, headerRowHeight, 'bold 12px Helvetica', '#000000');

  DUTCH_DAYS.forEach((day, i) => {
    drawCell(margin + nameColWidth + i * dayColWidth, y, dayColWidth, headerRowHeight, dayColors[i]);
    drawCenteredText(day, margin + nameColWidth + i * dayColWidth, y, dayColWidth, headerRowHeight, 'bold 12px Helvetica', '#000000');
  });
  y += headerRowHeight;

  // === DATE ROW ===
  drawCell(margin, y, nameColWidth, headerRowHeight, '#FFFFFF');
  drawCenteredText('Date', margin, y, nameColWidth, headerRowHeight, '11px Helvetica', '#505050');

  week.days.forEach((d, i) => {
    const date = new Date(d.date);
    const dateStr = `${date.getDate()}-${date.toLocaleString('nl', { month: 'short' })}`;
    drawCell(margin + nameColWidth + i * dayColWidth, y, dayColWidth, headerRowHeight, '#FFFFFF');
    drawCenteredText(dateStr, margin + nameColWidth + i * dayColWidth, y, dayColWidth, headerRowHeight, '11px Helvetica', '#505050');
  });
  y += headerRowHeight;

  // Add section spacing (no labels like original Excel)
  const addSectionSpacing = () => {
    y += sectionSpacing;
  };

  // Render operator rows
  const renderOperatorRows = (ops: Operator[]) => {
    const fontSize = Math.max(9, Math.min(12, rowHeight * 0.45));
    const taskFontSize = Math.max(8, Math.min(10, rowHeight * 0.4));

    ops.forEach(op => {
      // Operator name cell - gray background like original Excel
      drawCell(margin, y, nameColWidth, rowHeight, '#E0E0E0');
      ctx.font = `bold ${fontSize}px Helvetica`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const displayOpName = op.name.length > 14 ? op.name.substring(0, 13) + '..' : op.name;
      ctx.fillText(displayOpName, margin + 6, y + rowHeight / 2);

      // Day cells
      week.days.forEach((day, dayIdx) => {
        const assignment = day.assignments[op.id];
        const taskId = assignment?.taskId;
        const task = taskId ? tasks.find(t => t.id === taskId) : null;
        const taskName = task?.name || '';

        const colors = CLASSIC_TASK_COLORS[taskName] || { bg: '#FFFFFF', text: '#000000' };
        drawCell(margin + nameColWidth + dayIdx * dayColWidth, y, dayColWidth, rowHeight, colors.bg);

        if (taskName) {
          ctx.font = `${taskFontSize}px Helvetica`;
          ctx.fillStyle = colors.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const maxChars = Math.floor(dayColWidth / 7);
          const displayName = taskName.length > maxChars ? taskName.substring(0, maxChars - 2) + '..' : taskName;
          ctx.fillText(displayName, margin + nameColWidth + dayIdx * dayColWidth + dayColWidth / 2, y + rowHeight / 2);
        }
      });

      y += rowHeight;
    });
  };

  // Render regular operators (no section labels like original Excel)
  if (regularOps.length > 0) {
    renderOperatorRows(regularOps);
  }

  // Render flex operators with spacing separator
  if (flexOps.length > 0) {
    if (regularOps.length > 0) addSectionSpacing();
    renderOperatorRows(flexOps);
  }

  // Render coordinators with spacing separator
  if (coordinators.length > 0) {
    if (regularOps.length > 0 || flexOps.length > 0) addSectionSpacing();
    renderOperatorRows(coordinators);
  }

  // Convert canvas to data URL
  return canvas.toDataURL('image/png');
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
  const margin = 8; // Reduced margin for wider schedule
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
 * Matches the original Excel format exactly with task legend
 * Dynamically calculates row height to fit all content on one page
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
  const margin = 6;
  const nameColWidth = 28;
  const dayColWidth = (pageWidth - margin * 2 - nameColWidth) / 5;

  // Count operators by type
  const regularOps = operators.filter(op => op.type === 'Regular' && op.status === 'Active');
  const flexOps = operators.filter(op => op.type === 'Flex' && op.status === 'Active');
  const coordinators = operators.filter(op => op.type === 'Coordinator' && op.status === 'Active');
  const totalOperators = regularOps.length + flexOps.length + coordinators.length;

  // Calculate available height for operators
  // Fixed heights: main header(10) + subheader(7) + week row(6) + day row(6) + date row(6) = 35mm
  // Section spacing: 2mm between sections (no labels like original Excel)
  const fixedHeaderHeight = 35;
  const sectionSpacing = 2;
  const numSections = (regularOps.length > 0 ? 1 : 0) + (flexOps.length > 0 ? 1 : 0) + (coordinators.length > 0 ? 1 : 0);
  const totalSectionSpacingHeight = Math.max(0, numSections - 1) * sectionSpacing;
  const bottomMargin = margin;

  // Available height for operator rows (no legend anymore)
  const availableHeight = pageHeight - margin - fixedHeaderHeight - totalSectionSpacingHeight - bottomMargin;

  // Calculate row height (minimum 4.5mm, maximum 7mm for readability)
  let rowHeight = totalOperators > 0 ? availableHeight / totalOperators : 6;
  rowHeight = Math.max(4.5, Math.min(7, rowHeight));

  // Font size scales with row height
  const nameFontSize = Math.max(6, Math.min(9, rowHeight * 1.2));
  const taskFontSize = Math.max(5, Math.min(7, rowHeight * 0.95));

  let y = margin;

  // Header row height (fixed)
  const headerRowHeight = 6;

  // === MAIN HEADER - Green Banner ===
  pdf.setFillColor(34, 139, 34); // Forest green
  pdf.rect(margin, y, pageWidth - margin * 2, 9, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('OPERATIONAL PLAN 4M', pageWidth / 2, y + 6, { align: 'center' });
  y += 9;

  // === WEEKLY PLANNING SUBHEADER ===
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(margin, y, pageWidth - margin * 2, 6, 'D');
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('WEEKLY PLANNING', pageWidth / 2, y + 4.2, { align: 'center' });
  y += 6;

  // === WEEK NUMBER ROW ===
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(180, 180, 180);
  pdf.rect(margin, y, nameColWidth, headerRowHeight, 'FD');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Week', margin + nameColWidth / 2, y + headerRowHeight / 2 + 1.2, { align: 'center' });

  // Week number spans all day columns
  pdf.setFillColor(255, 255, 200); // Light yellow highlight
  pdf.rect(margin + nameColWidth, y, dayColWidth * 5, headerRowHeight, 'FD');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`WEEK ${week.weekNumber} - ${week.year}`, margin + nameColWidth + (dayColWidth * 5) / 2, y + headerRowHeight / 2 + 1.2, { align: 'center' });
  y += headerRowHeight;

  // === DAY ROW - Colored backgrounds ===
  pdf.setFillColor(255, 255, 255);
  pdf.rect(margin, y, nameColWidth, headerRowHeight, 'FD');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Day', margin + nameColWidth / 2, y + headerRowHeight / 2 + 1.2, { align: 'center' });

  DUTCH_DAYS.forEach((day, i) => {
    const bgColor = getHeaderDayColor(i);
    pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    pdf.rect(margin + nameColWidth + i * dayColWidth, y, dayColWidth, headerRowHeight, 'FD');
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text(day, margin + nameColWidth + i * dayColWidth + dayColWidth / 2, y + headerRowHeight / 2 + 1.2, { align: 'center' });
  });
  y += headerRowHeight;

  // === DATE ROW ===
  pdf.setFillColor(255, 255, 255);
  pdf.rect(margin, y, nameColWidth, headerRowHeight, 'FD');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Date', margin + nameColWidth / 2, y + headerRowHeight / 2 + 1.2, { align: 'center' });

  week.days.forEach((d, i) => {
    const date = new Date(d.date);
    const dateStr = `${date.getDate()}-${date.toLocaleString('nl', { month: 'short' })}`;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(margin + nameColWidth + i * dayColWidth, y, dayColWidth, headerRowHeight, 'FD');
    pdf.setTextColor(80, 80, 80);
    pdf.setFont('helvetica', 'normal');
    pdf.text(dateStr, margin + nameColWidth + i * dayColWidth + dayColWidth / 2, y + headerRowHeight / 2 + 1.2, { align: 'center' });
  });
  y += headerRowHeight;

  // === OPERATOR SECTIONS ===
  // Add section spacing (no labels like original Excel)
  const addSectionSpacing = () => {
    y += sectionSpacing;
  };

  // Render regular operators (no section labels like original Excel)
  if (regularOps.length > 0) {
    renderOperatorSection(pdf, regularOps, week, tasks, margin, nameColWidth, dayColWidth, rowHeight, y, nameFontSize, taskFontSize);
    y += regularOps.length * rowHeight;
  }

  // Render flex operators with spacing separator
  if (flexOps.length > 0) {
    if (regularOps.length > 0) addSectionSpacing();
    renderOperatorSection(pdf, flexOps, week, tasks, margin, nameColWidth, dayColWidth, rowHeight, y, nameFontSize, taskFontSize);
    y += flexOps.length * rowHeight;
  }

  // Render coordinators with spacing separator
  if (coordinators.length > 0) {
    if (regularOps.length > 0 || flexOps.length > 0) addSectionSpacing();
    renderOperatorSection(pdf, coordinators, week, tasks, margin, nameColWidth, dayColWidth, rowHeight, y, nameFontSize, taskFontSize);
    y += coordinators.length * rowHeight;
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
  startY: number,
  nameFontSize: number = 8,
  taskFontSize: number = 6
): void {
  let y = startY;

  // Calculate text vertical position based on row height
  const textYOffset = rowHeight / 2 + (rowHeight * 0.15);

  operators.forEach(op => {
    // Operator name cell - gray background like original Excel
    pdf.setFillColor(224, 224, 224); // #E0E0E0
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y, nameColWidth, rowHeight, 'FD');
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(nameFontSize);
    pdf.setFont('helvetica', 'bold');
    // Truncate name if needed
    const displayOpName = op.name.length > 12 ? op.name.substring(0, 11) + '..' : op.name;
    pdf.text(displayOpName, margin + 1.5, y + textYOffset);

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
        pdf.setFontSize(taskFontSize);
        pdf.setFont('helvetica', 'normal');
        // Truncate long task names based on available width
        const maxChars = Math.floor(dayColWidth / 2);
        const displayName = taskName.length > maxChars ? taskName.substring(0, maxChars - 2) + '..' : taskName;
        pdf.text(displayName, margin + nameColWidth + dayIdx * dayColWidth + dayColWidth / 2, y + textYOffset, { align: 'center' });
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
 * Export the schedule as a CSV file
 */
export function exportToCsv(
  week: WeeklySchedule,
  operators: Operator[],
  tasks: TaskType[]
): string {
  const dayHeaders = ['Operator', 'Type', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const rows: string[][] = [dayHeaders];

  // Sort operators by type: Regular, Flex, Coordinator
  const sortedOperators = [
    ...operators.filter(op => op.type === 'Regular' && op.status === 'Active'),
    ...operators.filter(op => op.type === 'Flex' && op.status === 'Active'),
    ...operators.filter(op => op.type === 'Coordinator' && op.status === 'Active'),
  ];

  sortedOperators.forEach(op => {
    const row: string[] = [op.name, op.type];

    week.days.forEach(day => {
      const assignment = day.assignments[op.id];
      const taskId = assignment?.taskId;
      const task = taskId ? tasks.find(t => t.id === taskId) : null;
      row.push(task?.name || '');
    });

    rows.push(row);
  });

  // Convert to CSV string with proper escaping
  return rows.map(row =>
    row.map(cell => {
      // Escape cells that contain commas, quotes, or newlines
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}

/**
 * Export the schedule as an Excel-compatible file (XLSX)
 * Uses a simple XML-based format that Excel can open
 */
export function exportToExcel(
  week: WeeklySchedule,
  operators: Operator[],
  tasks: TaskType[]
): Blob {
  // Sort operators by type
  const sortedOperators = [
    ...operators.filter(op => op.type === 'Regular' && op.status === 'Active'),
    ...operators.filter(op => op.type === 'Flex' && op.status === 'Active'),
    ...operators.filter(op => op.type === 'Coordinator' && op.status === 'Active'),
  ];

  // Build Excel XML (SpreadsheetML format)
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Size="12"/>
   <Interior ss:Color="#228B22" ss:Pattern="Solid"/>
   <Font ss:Color="#FFFFFF"/>
  </Style>
  <Style ss:ID="SubHeader">
   <Font ss:Bold="1" ss:Size="10"/>
   <Interior ss:Color="#F0F0F0" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DayMon"><Interior ss:Color="#FFC0CB" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="DayTue"><Interior ss:Color="#FFFF99" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="DayWed"><Interior ss:Color="#ADD8E6" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="DayThu"><Interior ss:Color="#90EE90" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="DayFri"><Interior ss:Color="#DDA0DD" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="OperatorName"><Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/><Font ss:Bold="1"/></Style>
  <Style ss:ID="Regular"><Font ss:Color="#3B82F6"/></Style>
  <Style ss:ID="Flex"><Font ss:Color="#A855F7"/></Style>
  <Style ss:ID="Coordinator"><Font ss:Color="#10B981"/></Style>
 </Styles>
 <Worksheet ss:Name="Schedule Week ${week.weekNumber}">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="6" ss:StyleID="Header"><Data ss:Type="String">OPERATIONAL PLAN 4M - Week ${week.weekNumber}, ${week.year}</Data></Cell>
   </Row>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="6" ss:StyleID="SubHeader"><Data ss:Type="String">Weekly Planning - ${getWeekRangeString(new Date(week.days[0].date))}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="SubHeader"><Data ss:Type="String">Operator</Data></Cell>
    <Cell ss:StyleID="SubHeader"><Data ss:Type="String">Type</Data></Cell>
    <Cell ss:StyleID="DayMon"><Data ss:Type="String">Mon ${week.days[0].date.slice(5)}</Data></Cell>
    <Cell ss:StyleID="DayTue"><Data ss:Type="String">Tue ${week.days[1].date.slice(5)}</Data></Cell>
    <Cell ss:StyleID="DayWed"><Data ss:Type="String">Wed ${week.days[2].date.slice(5)}</Data></Cell>
    <Cell ss:StyleID="DayThu"><Data ss:Type="String">Thu ${week.days[3].date.slice(5)}</Data></Cell>
    <Cell ss:StyleID="DayFri"><Data ss:Type="String">Fri ${week.days[4].date.slice(5)}</Data></Cell>
   </Row>`;

  // Add operator rows
  sortedOperators.forEach(op => {
    const typeStyle = op.type === 'Regular' ? 'Regular' : op.type === 'Flex' ? 'Flex' : 'Coordinator';
    xml += `
   <Row>
    <Cell ss:StyleID="OperatorName"><Data ss:Type="String">${escapeXml(op.name)}</Data></Cell>
    <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${op.type}</Data></Cell>`;

    week.days.forEach(day => {
      const assignment = day.assignments[op.id];
      const taskId = assignment?.taskId;
      const task = taskId ? tasks.find(t => t.id === taskId) : null;
      xml += `
    <Cell><Data ss:Type="String">${task ? escapeXml(task.name) : ''}</Data></Cell>`;
    });

    xml += `
   </Row>`;
  });

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return new Blob([xml], { type: 'application/vnd.ms-excel' });
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate filename for exports
 */
export function generateFilename(week: WeeklySchedule, extension: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `schedule-week${week.weekNumber}-${week.year}-${date}.${extension}`;
}
