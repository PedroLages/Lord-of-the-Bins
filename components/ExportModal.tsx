import React, { useState, useEffect } from 'react';
import { X, Download, FileImage, FileText, MessageCircle, Check, Loader2, Palette, FileSpreadsheet, Table2, AlertTriangle, AlertCircle } from 'lucide-react';
import { WeeklySchedule, Operator, TaskType, ScheduleWarning } from '../types';
import {
  exportToPng,
  exportToPngClassic,
  exportToPdf,
  shareToWhatsApp,
  downloadFile,
  generateFilename,
  ExportTheme,
  exportToCsv,
  exportToExcel
} from '../services/exportService';
import { getWeekLabel, getWeekRangeString } from '../services/weekUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  week: WeeklySchedule;
  scheduleRef: React.RefObject<HTMLElement>;
  theme: string;
  operators: Operator[];
  tasks: TaskType[];
  scheduleWarnings?: ScheduleWarning[];
  warningsAcknowledged?: boolean;
  onAcknowledgeWarnings?: () => void;
  onReviewWarnings?: () => void;
}

type ExportFormat = 'png' | 'pdf' | 'whatsapp' | 'csv' | 'excel';

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  week,
  scheduleRef,
  theme,
  operators,
  tasks,
  scheduleWarnings = [],
  warningsAcknowledged = false,
  onAcknowledgeWarnings,
  onReviewWarnings
}) => {
  const hasWarnings = scheduleWarnings.length > 0;
  const [animateIn, setAnimateIn] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfTheme, setPdfTheme] = useState<ExportTheme>('modern');
  const [pngTheme, setPngTheme] = useState<ExportTheme>('modern');
  const [localAcknowledged, setLocalAcknowledged] = useState(false);

  // Combine parent acknowledgment with local acknowledgment
  const isAcknowledged = warningsAcknowledged || localAcknowledged;

  // Get warning severity summary
  const getWarningSeverity = (type: ScheduleWarning['type']): 'critical' | 'warning' | 'info' => {
    switch (type) {
      case 'skill_mismatch':
      case 'double_assignment':
        return 'critical';
      case 'availability_conflict':
      case 'understaffed':
      case 'overstaffed':
        return 'warning';
      default:
        return 'info';
    }
  };

  const criticalCount = scheduleWarnings.filter(w => getWarningSeverity(w.type) === 'critical').length;
  const warningCount = scheduleWarnings.filter(w => getWarningSeverity(w.type) === 'warning').length;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimateIn(true), 10);
      // Reset state when opening
      setSelectedFormat(null);
      setExportSuccess(null);
      setError(null);
      setLocalAcknowledged(false);
    } else {
      setAnimateIn(false);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = theme === 'Midnight';

  const handleExport = async (format: ExportFormat) => {
    if (!scheduleRef.current) {
      setError('Schedule element not found');
      return;
    }

    setSelectedFormat(format);
    setIsExporting(true);
    setError(null);
    setExportSuccess(null);

    try {
      switch (format) {
        case 'png': {
          let dataUrl: string;
          if (pngTheme === 'classic') {
            dataUrl = await exportToPngClassic(week, operators, tasks);
          } else {
            dataUrl = await exportToPng(scheduleRef.current, week);
          }
          downloadFile(dataUrl, generateFilename(week, 'png'));
          break;
        }
        case 'pdf': {
          const blob = await exportToPdf(scheduleRef.current, week, {
            theme: pdfTheme,
            operators,
            tasks
          });
          downloadFile(blob, generateFilename(week, 'pdf'));
          break;
        }
        case 'whatsapp': {
          await shareToWhatsApp(scheduleRef.current, week);
          break;
        }
        case 'csv': {
          const csvContent = exportToCsv(week, operators, tasks);
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          downloadFile(blob, generateFilename(week, 'csv'));
          break;
        }
        case 'excel': {
          const excelBlob = exportToExcel(week, operators, tasks);
          downloadFile(excelBlob, generateFilename(week, 'xls'));
          break;
        }
      }
      setExportSuccess(format);
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAcknowledge = () => {
    setLocalAcknowledged(true);
    onAcknowledgeWarnings?.();
  };

  const exportOptions = [
    {
      id: 'png' as ExportFormat,
      icon: FileImage,
      title: 'PNG Image',
      description: 'High-quality image for sharing',
      color: 'text-blue-500',
      bgColor: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
      borderColor: isDark ? 'border-blue-500/30' : 'border-blue-200'
    },
    {
      id: 'pdf' as ExportFormat,
      icon: FileText,
      title: 'PDF Document',
      description: 'Printable document with header',
      color: 'text-red-500',
      bgColor: isDark ? 'bg-red-500/10' : 'bg-red-50',
      borderColor: isDark ? 'border-red-500/30' : 'border-red-200'
    },
    {
      id: 'excel' as ExportFormat,
      icon: FileSpreadsheet,
      title: 'Excel Spreadsheet',
      description: 'Editable spreadsheet (.xls)',
      color: 'text-emerald-500',
      bgColor: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
      borderColor: isDark ? 'border-emerald-500/30' : 'border-emerald-200'
    },
    {
      id: 'csv' as ExportFormat,
      icon: Table2,
      title: 'CSV File',
      description: 'Plain text data format',
      color: 'text-amber-500',
      bgColor: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
      borderColor: isDark ? 'border-amber-500/30' : 'border-amber-200'
    },
    {
      id: 'whatsapp' as ExportFormat,
      icon: MessageCircle,
      title: 'Share to WhatsApp',
      description: 'Send schedule to team chat',
      color: 'text-green-500',
      bgColor: isDark ? 'bg-green-500/10' : 'bg-green-50',
      borderColor: isDark ? 'border-green-500/30' : 'border-green-200'
    }
  ];

  // Show warnings block only if there are warnings AND not acknowledged
  const showWarningsBlock = hasWarnings && !isAcknowledged;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-md overflow-hidden transition-all duration-300 transform ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'} ${
          isDark
            ? 'bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl'
            : 'bg-white rounded-2xl shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-gray-50/50'
        }`}>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Export Schedule
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {getWeekLabel(week)} • {getWeekRangeString(new Date(week.days[0].date))}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                : 'hover:bg-gray-200/50 text-gray-400 hover:text-gray-600'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warnings Block - Shows when warnings exist and not acknowledged */}
          {showWarningsBlock && (
            <div className={`p-4 rounded-xl border ${
              criticalCount > 0
                ? (isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200')
                : (isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200')
            }`}>
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                  criticalCount > 0
                    ? (isDark ? 'text-red-400' : 'text-red-600')
                    : (isDark ? 'text-amber-400' : 'text-amber-600')
                }`} />
                <div className="flex-1">
                  <p className={`font-semibold ${
                    criticalCount > 0
                      ? (isDark ? 'text-red-300' : 'text-red-800')
                      : (isDark ? 'text-amber-300' : 'text-amber-800')
                  }`}>
                    Schedule Has Warnings
                  </p>
                  <p className={`text-sm mt-1 ${
                    criticalCount > 0
                      ? (isDark ? 'text-red-400/80' : 'text-red-700')
                      : (isDark ? 'text-amber-400/80' : 'text-amber-700')
                  }`}>
                    {scheduleWarnings.length} {scheduleWarnings.length === 1 ? 'issue' : 'issues'} found
                    {criticalCount > 0 && ` (${criticalCount} critical)`}
                  </p>
                </div>
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {criticalCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-500">
                    {criticalCount} Critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-600">
                    {warningCount} Warning
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {onReviewWarnings && (
                  <button
                    onClick={() => {
                      onClose();
                      onReviewWarnings();
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Review Warnings
                  </button>
                )}
                <button
                  onClick={handleAcknowledge}
                  className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                    criticalCount > 0
                      ? (isDark
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                        : 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300')
                      : (isDark
                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300')
                  }`}
                >
                  <Check className="h-4 w-4" />
                  Acknowledge & Export
                </button>
              </div>
            </div>
          )}

          {/* Acknowledged indicator */}
          {hasWarnings && isAcknowledged && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <Check className={`h-4 w-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                Warnings acknowledged - you can proceed with export
              </span>
            </div>
          )}

          {/* Theme Selector - applies to both PNG and PDF */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-gray-100 bg-gray-50'} ${showWarningsBlock ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <Palette className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Export Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setPngTheme('modern'); setPdfTheme('modern'); }}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  pngTheme === 'modern'
                    ? isDark
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-blue-500 bg-blue-50'
                    : isDark
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Modern</div>
                <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>App-style layout</div>
              </button>
              <button
                type="button"
                onClick={() => { setPngTheme('classic'); setPdfTheme('classic'); }}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  pngTheme === 'classic'
                    ? isDark
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-green-600 bg-green-50'
                    : isDark
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Classic</div>
                <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Operational Plan 4M</div>
              </button>
            </div>
          </div>

          {exportOptions.map((option) => {
            const isSelected = selectedFormat === option.id;
            const isSuccess = exportSuccess === option.id;
            const Icon = option.icon;
            const isDisabled = isExporting || showWarningsBlock;

            return (
              <button
                key={option.id}
                onClick={() => handleExport(option.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                  showWarningsBlock
                    ? 'opacity-50 cursor-not-allowed'
                    : isSuccess
                    ? `${option.bgColor} ${option.borderColor}`
                    : isExporting && isSelected
                    ? `${option.bgColor} ${option.borderColor} cursor-wait`
                    : isDark
                    ? 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                } ${isExporting && !isSelected && !showWarningsBlock ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`p-3 rounded-xl transition-colors ${option.bgColor}`}>
                  {isExporting && isSelected ? (
                    <Loader2 className={`h-6 w-6 ${option.color} animate-spin`} />
                  ) : isSuccess ? (
                    <Check className={`h-6 w-6 ${option.color}`} />
                  ) : (
                    <Icon className={`h-6 w-6 ${option.color}`} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {option.title}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {isSuccess
                      ? option.id === 'whatsapp'
                        ? 'Image downloaded, WhatsApp opened'
                        : 'Downloaded successfully!'
                      : option.description
                    }
                  </p>
                </div>
                {!isExporting && !isSuccess && (
                  <Download className={`h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isDark ? 'text-slate-400' : 'text-gray-400'
                  }`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mx-6 mb-4 p-3 rounded-lg ${
            isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
          }`}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-gray-100 bg-gray-50/30'
        }`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-xl font-medium transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
