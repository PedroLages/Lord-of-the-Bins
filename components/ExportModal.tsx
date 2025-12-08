import React, { useState, useEffect } from 'react';
import { X, Download, FileImage, FileText, MessageCircle, Check, Loader2, Palette } from 'lucide-react';
import { WeeklySchedule, Operator, TaskType } from '../types';
import {
  exportToPng,
  exportToPdf,
  shareToWhatsApp,
  downloadFile,
  generateFilename,
  ExportTheme
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
}

type ExportFormat = 'png' | 'pdf' | 'whatsapp';

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  week,
  scheduleRef,
  theme,
  operators,
  tasks
}) => {
  const [animateIn, setAnimateIn] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfTheme, setPdfTheme] = useState<ExportTheme>('modern');

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimateIn(true), 10);
      // Reset state when opening
      setSelectedFormat(null);
      setExportSuccess(null);
      setError(null);
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
          const dataUrl = await exportToPng(scheduleRef.current, week);
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
      }
      setExportSuccess(format);
    } catch (err) {
      console.error('Export failed:', err);
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
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
      id: 'whatsapp' as ExportFormat,
      icon: MessageCircle,
      title: 'Share to WhatsApp',
      description: 'Send schedule to team chat',
      color: 'text-green-500',
      bgColor: isDark ? 'bg-green-500/10' : 'bg-green-50',
      borderColor: isDark ? 'border-green-500/30' : 'border-green-200'
    }
  ];

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
          {/* PDF Theme Selector */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Palette className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>PDF Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPdfTheme('modern')}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  pdfTheme === 'modern'
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
                onClick={() => setPdfTheme('classic')}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  pdfTheme === 'classic'
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

            return (
              <button
                key={option.id}
                onClick={() => handleExport(option.id)}
                disabled={isExporting}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                  isSuccess
                    ? `${option.bgColor} ${option.borderColor}`
                    : isExporting && isSelected
                    ? `${option.bgColor} ${option.borderColor} cursor-wait`
                    : isDark
                    ? 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                } ${isExporting && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
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
