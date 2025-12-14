import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Bug, Lightbulb, Palette, HelpCircle, Upload, Image, Trash2, Send, ChevronDown, Check } from 'lucide-react';
import {
  FeedbackItem,
  FeedbackCategory,
  FeedbackPriority,
  FEEDBACK_CATEGORIES,
  FEEDBACK_PRIORITIES,
  createEmptyFeedbackItem,
} from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackItem) => void;
  currentPage?: string;  // Which page/view user is on
  isDark?: boolean;
}

// Icon mapping for categories
const CategoryIcons: Record<FeedbackCategory, React.FC<{ className?: string }>> = {
  bug: Bug,
  feature: Lightbulb,
  'ui-ux': Palette,
  question: HelpCircle,
};

// Color classes for categories
const getCategoryColors = (category: FeedbackCategory, isSelected: boolean, isDark: boolean) => {
  const colors: Record<FeedbackCategory, { bg: string; border: string; text: string; selectedBg: string; selectedBorder: string; selectedText: string }> = {
    bug: {
      bg: isDark ? 'bg-slate-800/50' : 'bg-white',
      border: isDark ? 'border-slate-700' : 'border-gray-200',
      text: isDark ? 'text-slate-300' : 'text-gray-600',
      selectedBg: isDark ? 'bg-red-500/10' : 'bg-red-50',
      selectedBorder: isDark ? 'border-red-500/50' : 'border-red-300',
      selectedText: isDark ? 'text-red-400' : 'text-red-600',
    },
    feature: {
      bg: isDark ? 'bg-slate-800/50' : 'bg-white',
      border: isDark ? 'border-slate-700' : 'border-gray-200',
      text: isDark ? 'text-slate-300' : 'text-gray-600',
      selectedBg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
      selectedBorder: isDark ? 'border-amber-500/50' : 'border-amber-300',
      selectedText: isDark ? 'text-amber-400' : 'text-amber-600',
    },
    'ui-ux': {
      bg: isDark ? 'bg-slate-800/50' : 'bg-white',
      border: isDark ? 'border-slate-700' : 'border-gray-200',
      text: isDark ? 'text-slate-300' : 'text-gray-600',
      selectedBg: isDark ? 'bg-purple-500/10' : 'bg-purple-50',
      selectedBorder: isDark ? 'border-purple-500/50' : 'border-purple-300',
      selectedText: isDark ? 'text-purple-400' : 'text-purple-600',
    },
    question: {
      bg: isDark ? 'bg-slate-800/50' : 'bg-white',
      border: isDark ? 'border-slate-700' : 'border-gray-200',
      text: isDark ? 'text-slate-300' : 'text-gray-600',
      selectedBg: isDark ? 'bg-blue-500/10' : 'bg-blue-50',
      selectedBorder: isDark ? 'border-blue-500/50' : 'border-blue-300',
      selectedText: isDark ? 'text-blue-400' : 'text-blue-600',
    },
  };

  const c = colors[category];
  return isSelected
    ? `${c.selectedBg} ${c.selectedBorder} ${c.selectedText}`
    : `${c.bg} ${c.border} ${c.text} hover:border-slate-400`;
};

// Priority color classes
const getPriorityColors = (priority: FeedbackPriority, isSelected: boolean, isDark: boolean) => {
  const colors: Record<FeedbackPriority, { selected: string; unselected: string }> = {
    low: {
      selected: isDark ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-500 text-white border-slate-500',
      unselected: isDark ? 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
    },
    medium: {
      selected: isDark ? 'bg-amber-600 text-white border-amber-500' : 'bg-amber-500 text-white border-amber-500',
      unselected: isDark ? 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-amber-500/50' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400',
    },
    high: {
      selected: isDark ? 'bg-red-600 text-white border-red-500' : 'bg-red-500 text-white border-red-500',
      unselected: isDark ? 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-red-500/50' : 'bg-white text-gray-600 border-gray-200 hover:border-red-400',
    },
  };

  return isSelected ? colors[priority].selected : colors[priority].unselected;
};

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentPage,
  isDark = false,
}) => {
  const [animateIn, setAnimateIn] = useState(false);
  const [formData, setFormData] = useState(createEmptyFeedbackItem());
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animation on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimateIn(true), 10);
    } else {
      setAnimateIn(false);
    }
  }, [isOpen]);

  // ESC key handler
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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(createEmptyFeedbackItem());
      setScreenshot(null);
      setScreenshotName(null);
      setShowSuccess(false);
    }
  }, [isOpen]);

  // Handle paste for screenshots
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!isOpen) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setScreenshot(event.target?.result as string);
            setScreenshotName('Pasted image');
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot(event.target?.result as string);
        setScreenshotName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    setIsSubmitting(true);

    // Create the feedback item
    const feedback: FeedbackItem = {
      id: crypto.randomUUID(),
      ...formData,
      screenshot: screenshot || undefined,
      screenshotName: screenshotName || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      appVersion: '1.0.0', // Could be dynamic
      currentPage: currentPage,
    };

    // Simulate a brief delay for feedback
    await new Promise((resolve) => setTimeout(resolve, 500));

    onSubmit(feedback);
    setIsSubmitting(false);
    setShowSuccess(true);

    // Auto close after success
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  const categories = Object.keys(FEEDBACK_CATEGORIES) as FeedbackCategory[];
  const priorities = Object.keys(FEEDBACK_PRIORITIES) as FeedbackPriority[];

  // Theme-aware styles
  const modalBg = isDark ? 'bg-slate-900' : 'bg-white';
  const headerBg = isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50/50 border-gray-100';
  const inputBg = isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400';
  const inputFocus = isDark ? 'focus:ring-indigo-500/20 focus:border-indigo-500' : 'focus:ring-blue-500/20 focus:border-blue-500';
  const labelColor = isDark ? 'text-slate-400' : 'text-gray-500';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const subtextColor = isDark ? 'text-slate-500' : 'text-gray-500';
  const borderColor = isDark ? 'border-slate-700' : 'border-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-slate-900/40'} backdrop-blur-sm transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative ${modalBg} rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-all duration-300 transform ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
      >
        {/* Success Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/95 backdrop-blur-sm">
            <div className="text-center text-white">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Thank you!</h3>
              <p className="text-emerald-100 mt-1">Your feedback has been submitted</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className={`flex items-center justify-between px-8 py-6 border-b ${headerBg}`}>
          <div>
            <h2 className={`text-xl font-bold ${textColor}`}>Send Feedback</h2>
            <p className={`text-sm ${subtextColor} mt-1`}>Help us improve Lord of the Bins</p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-200/50 text-gray-400 hover:text-gray-600'}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Category Selection */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-3 ${labelColor}`}>
              What type of feedback?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const Icon = CategoryIcons[cat];
                const meta = FEEDBACK_CATEGORIES[cat];
                const isSelected = formData.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat })}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 ${getCategoryColors(cat, isSelected, isDark)}`}
                  >
                    <Icon className="h-5 w-5 mb-2" />
                    <span className="font-semibold text-sm">{meta.label}</span>
                    <span className={`text-xs mt-0.5 ${isSelected ? '' : isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelColor}`}>
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-4 py-3 border rounded-xl outline-none transition-all font-medium ${inputBg} ${inputFocus}`}
              placeholder="Brief summary of your feedback"
            />
          </div>

          {/* Description */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelColor}`}>
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className={`w-full px-4 py-3 border rounded-xl outline-none transition-all font-medium resize-none ${inputBg} ${inputFocus}`}
              placeholder={
                formData.category === 'bug'
                  ? 'What happened? What did you expect to happen? Steps to reproduce...'
                  : formData.category === 'feature'
                  ? 'Describe the feature you\'d like to see...'
                  : formData.category === 'ui-ux'
                  ? 'What could look or work better?'
                  : 'What would you like to know?'
              }
            />
          </div>

          {/* Priority */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelColor}`}>
              Priority
            </label>
            <div className="flex gap-2">
              {priorities.map((priority) => {
                const meta = FEEDBACK_PRIORITIES[priority];
                const isSelected = formData.priority === priority;
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority })}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${getPriorityColors(priority, isSelected, isDark)}`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelColor}`}>
              Screenshot (Optional)
            </label>
            {screenshot ? (
              <div className={`relative rounded-xl border-2 border-dashed p-4 ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-gray-200 bg-gray-50'}`}>
                <img
                  src={screenshot}
                  alt="Screenshot preview"
                  className="max-h-40 mx-auto rounded-lg object-contain"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs font-medium truncate ${subtextColor}`}>
                    {screenshotName}
                  </span>
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-gray-200 text-gray-400 hover:text-red-500'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${isDark ? 'border-slate-700 hover:border-slate-500 bg-slate-800/30' : 'border-gray-200 hover:border-gray-400 bg-gray-50'}`}
              >
                <div className={`flex items-center justify-center gap-2 ${subtextColor}`}>
                  <Upload className="h-5 w-5" />
                  <span className="font-medium text-sm">Click to upload or paste (Ctrl+V)</span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                  PNG, JPG up to 5MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Contact Email (Optional) */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${labelColor}`}>
              Contact Email (Optional)
            </label>
            <input
              type="email"
              value={formData.contactEmail || ''}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className={`w-full px-4 py-3 border rounded-xl outline-none transition-all font-medium ${inputBg} ${inputFocus}`}
              placeholder="your@email.com (for follow-up)"
            />
            <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
              We'll only use this to follow up on your feedback
            </p>
          </div>

          {/* Submit Button */}
          <div className={`pt-4 flex justify-end gap-3 border-t ${borderColor} mt-4`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
              className={`px-6 py-2.5 rounded-xl font-medium shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                isDark
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
