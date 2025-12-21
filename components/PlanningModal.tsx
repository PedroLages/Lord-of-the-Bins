import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  Plus,
  Trash2,
  Users,
  User,
  Sparkles,
  AlertTriangle,
  UserPlus,
  Hash,
  Check,
  Calendar,
  BarChart3,
  Loader2,
  Palmtree,
  Thermometer,
  GraduationCap,
  CircleDashed,
  UserMinus,
  Save,
  FolderOpen,
  ChevronDown,
} from 'lucide-react';
import type {
  Operator,
  PlanningRule,
  NumericStaffingRule,
  OperatorPairingRule,
  SkillRequirement,
  WeeklyPlanningConfig,
  ConjunctionType,
  WeekDay,
  PeopleRulePreference,
  WeeklyExclusions,
  OperatorExclusion,
  ExclusionReason,
  PlanningTemplate,
} from '../types';
import {
  createEmptyNumericRule,
  createEmptyPairingRule,
  createEmptySkillRequirement,
  getTimeframeReadableText,
  getSelectedDaysReadableText,
  getEffectiveDays,
  getTotalFromNumericRule,
  detectRuleConflicts,
  INITIAL_SKILLS,
  ALL_WEEKDAYS,
  EXCLUSION_REASONS,
  createPlanningTemplate,
} from '../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: WeeklyPlanningConfig, exclusions?: WeeklyExclusions) => void;
  operators: Operator[];
  weekNumber: number;
  year: number;
  theme: 'Modern' | 'Midnight';
  existingConfig?: WeeklyPlanningConfig | null;
  existingExclusions?: WeeklyExclusions | null;
  skills?: string[]; // Custom skills, defaults to INITIAL_SKILLS if not provided
  // Template support
  templates?: PlanningTemplate[];
  onSaveTemplate?: (template: PlanningTemplate) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  onLoadTemplates?: () => Promise<PlanningTemplate[]>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DAYS: { key: WeekDay; label: string; fullLabel: string }[] = [
  { key: 'Mon', label: 'M', fullLabel: 'Mon' },
  { key: 'Tue', label: 'T', fullLabel: 'Tue' },
  { key: 'Wed', label: 'W', fullLabel: 'Wed' },
  { key: 'Thu', label: 'T', fullLabel: 'Thu' },
  { key: 'Fri', label: 'F', fullLabel: 'Fri' },
];

// Filter skills to exclude TC-only skills - now handled dynamically in component

// ============================================================================
// ANIMATION SYSTEM - Premium, choreographed, purposeful
// ============================================================================

// Core spring configurations
const springs = {
  // Standard smooth motion
  smooth: { type: 'spring' as const, stiffness: 200, damping: 25 },
  // Bouncy for emphasis
  bouncy: { type: 'spring' as const, stiffness: 300, damping: 15 },
  // Snappy for quick feedback
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  // Gentle for subtle movements
  gentle: { type: 'spring' as const, stiffness: 150, damping: 20 },
};

// Modal entrance/exit
const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...springs.smooth, delay: 0.05 }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 10,
    transition: { duration: 0.15, ease: 'easeOut' }
  },
};

// Backdrop
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// Entry cards (empty state)
const entryCardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...springs.smooth, delay: 0.1 + i * 0.08 },
  }),
  hover: {
    y: -4,
    scale: 1.02,
    transition: springs.snappy,
  },
  tap: { scale: 0.98 },
};

// Rule card animations
const ruleCardVariants = {
  hidden: { opacity: 0, x: -30, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { ...springs.smooth, delay: i * 0.06 },
  }),
  exit: {
    opacity: 0,
    scale: 0.9,
    x: -20,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// Day dot animations
const dayDotVariants = {
  inactive: { scale: 1, backgroundColor: 'var(--dot-inactive)' },
  active: {
    scale: 1,
    backgroundColor: 'var(--dot-active)',
    transition: springs.bouncy,
  },
  hover: { scale: 1.15 },
  tap: { scale: 0.9 },
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

// Visual Timeline Day Selector
const DayTimeline: React.FC<{
  selectedDays: WeekDay[];
  onChange: (days: WeekDay[]) => void;
  isDark: boolean;
  compact?: boolean;
}> = ({ selectedDays, onChange, isDark, compact = false }) => {
  const prefersReducedMotion = useReducedMotion();

  const toggleDay = (day: WeekDay) => {
    if (selectedDays.includes(day)) {
      // Allow removing any day (can have 0 days selected)
      onChange(selectedDays.filter(d => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  const toggleAll = () => {
    // Toggle: if all selected, deselect all; otherwise select all
    if (selectedDays.length === 5) {
      onChange([]); // Deselect all
    } else {
      onChange([...ALL_WEEKDAYS]); // Select all
    }
  };
  const allSelected = selectedDays.length === 5;
  const noneSelected = selectedDays.length === 0;

  return (
    <div className="flex items-center gap-2">
      {/* All/None toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleAll}
        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
          allSelected
            ? isDark
              ? 'bg-emerald-500/25 text-emerald-400'
              : 'bg-emerald-100 text-emerald-700'
            : noneSelected
              ? isDark
                ? 'bg-red-500/20 text-red-400'
                : 'bg-red-100 text-red-600'
              : isDark
                ? 'bg-slate-700/60 text-slate-500 hover:text-slate-400'
                : 'bg-stone-100 text-stone-400 hover:text-stone-600'
        }`}
      >
        {allSelected ? 'All' : noneSelected ? 'None' : 'All'}
      </motion.button>

      {/* Day dots with connecting lines */}
      <div className="relative flex items-center">
        {/* Connecting line (background) */}
        <div
          className={`absolute top-1/2 left-3 right-3 h-0.5 -translate-y-1/2 ${
            isDark ? 'bg-slate-700' : 'bg-stone-200'
          }`}
        />

        {/* Active connecting segments */}
        {DAYS.map((day, idx) => {
          const isActive = selectedDays.includes(day.key);
          const nextDay = DAYS[idx + 1];
          const nextIsActive = nextDay && selectedDays.includes(nextDay.key);

          if (isActive && nextIsActive && idx < DAYS.length - 1) {
            return (
              <motion.div
                key={`connector-${idx}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                className={`absolute h-0.5 ${
                  isDark ? 'bg-emerald-500' : 'bg-emerald-500'
                }`}
                style={{
                  left: `${(idx * 36) + 18}px`,
                  width: '36px',
                  transformOrigin: 'left',
                }}
                transition={springs.smooth}
              />
            );
          }
          return null;
        })}

        {/* Day dots */}
        <div className="relative flex items-center gap-4">
          {DAYS.map((day) => {
            const isActive = selectedDays.includes(day.key);
            return (
              <motion.button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                whileHover={prefersReducedMotion ? {} : { scale: 1.2 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.85 }}
                className="relative flex flex-col items-center gap-1"
              >
                {/* Label */}
                <span className={`text-[10px] font-semibold ${
                  isActive
                    ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                    : isDark ? 'text-slate-500' : 'text-stone-400'
                }`}>
                  {compact ? day.label : day.fullLabel}
                </span>

                {/* Dot */}
                <motion.div
                  animate={{
                    scale: isActive ? 1 : 0.85,
                    backgroundColor: isActive
                      ? isDark ? '#34d399' : '#10b981'
                      : isDark ? '#475569' : '#d6d3d1',
                  }}
                  transition={springs.bouncy}
                  className={`w-3 h-3 rounded-full ${
                    isActive ? 'ring-4 ring-emerald-500/20' : ''
                  }`}
                />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Sentence-style Number Stepper
const NumberStepper: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  isDark: boolean;
}> = ({ value, onChange, min = 1, max = 10, isDark }) => {
  return (
    <motion.div
      className={`inline-flex items-center rounded-lg overflow-hidden ${
        isDark ? 'bg-slate-700' : 'bg-stone-100'
      }`}
      whileHover={{ scale: 1.02 }}
    >
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`w-8 h-9 flex items-center justify-center text-lg font-bold transition-colors ${
          isDark
            ? 'text-slate-400 hover:text-white hover:bg-slate-600'
            : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200'
        }`}
      >
        −
      </motion.button>
      <motion.span
        key={value}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-10 text-center text-lg font-black ${
          isDark ? 'text-white' : 'text-stone-800'
        }`}
      >
        {value}
      </motion.span>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`w-8 h-9 flex items-center justify-center text-lg font-bold transition-colors ${
          isDark
            ? 'text-slate-400 hover:text-white hover:bg-slate-600'
            : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200'
        }`}
      >
        +
      </motion.button>
    </motion.div>
  );
};

// Task Selector Dropdown
const TaskSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  placeholder?: string;
  availableSkills: string[];
}> = ({ value, onChange, isDark, placeholder = 'Select task...', availableSkills }) => {
  return (
    <motion.select
      whileFocus={{ scale: 1.02 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer outline-none transition-all ${
        value
          ? isDark
            ? 'bg-violet-500/25 text-violet-300 ring-1 ring-violet-500/30'
            : 'bg-violet-100 text-violet-700 ring-1 ring-violet-300'
          : isDark
            ? 'bg-slate-700 text-slate-400'
            : 'bg-stone-100 text-stone-500'
      }`}
    >
      <option value="">{placeholder}</option>
      {availableSkills.map(skill => (
        <option key={skill} value={skill}>{skill}</option>
      ))}
    </motion.select>
  );
};

// Operator Type Selector (Regular / Flex)
const OperatorTypeSelector: React.FC<{
  value: 'Regular' | 'Flex';
  onChange: (value: 'Regular' | 'Flex') => void;
  isDark: boolean;
}> = ({ value, onChange, isDark }) => {
  return (
    <motion.select
      whileFocus={{ scale: 1.02 }}
      value={value}
      onChange={(e) => onChange(e.target.value as 'Regular' | 'Flex')}
      className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer outline-none transition-all ${
        value === 'Flex'
          ? isDark
            ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/30'
            : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
          : isDark
            ? 'bg-blue-500/25 text-blue-300 ring-1 ring-blue-500/30'
            : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
      }`}
    >
      <option value="Regular">Regular</option>
      <option value="Flex">Flex</option>
    </motion.select>
  );
};

// Person Chip for Team Up
const PersonChip: React.FC<{
  name: string;
  onRemove: () => void;
  isDark: boolean;
}> = ({ name, onRemove, isDark }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={springs.bouncy}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        isDark
          ? 'bg-purple-500/25 text-purple-300'
          : 'bg-purple-100 text-purple-700'
      }`}
    >
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        isDark ? 'bg-purple-500/40 text-purple-200' : 'bg-purple-200 text-purple-700'
      }`}>
        {initials}
      </span>
      {name}
      <motion.button
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        onClick={onRemove}
        className={`ml-0.5 p-0.5 rounded-full transition-colors ${
          isDark ? 'hover:bg-purple-500/30' : 'hover:bg-purple-200'
        }`}
      >
        <X className="w-3 h-3" />
      </motion.button>
    </motion.span>
  );
};

// Live Preview Panel
const LivePreview: React.FC<{
  rules: PlanningRule[];
  exclusions: OperatorExclusion[];
  operators: Operator[];
  isDark: boolean;
}> = ({ rules, exclusions, operators, isDark }) => {
  // Calculate per-day counts
  const dayStats = useMemo(() => {
    const stats: Record<WeekDay, number> = {
      Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0,
    };

    rules.filter(r => r.enabled).forEach(rule => {
      const days = getEffectiveDays(rule);
      if (rule.type === 'numeric') {
        const count = getTotalFromNumericRule(rule);
        days.forEach(day => { stats[day] += count; });
      } else {
        const count = rule.operatorIds.length;
        days.forEach(day => { stats[day] += count; });
      }
    });

    return stats;
  }, [rules]);

  const maxCount = Math.max(...Object.values(dayStats), 1);
  const totalAssignments = Object.values(dayStats).reduce((a, b) => a + b, 0);
  const numericRules = rules.filter(r => r.type === 'numeric' && r.enabled).length;
  const pairingRules = rules.filter(r => r.type === 'pairing' && r.enabled).length;

  return (
    <div className={`p-5 rounded-2xl ${
      isDark ? 'bg-slate-800/50' : 'bg-stone-50'
    }`}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-stone-500'}`} />
        <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-stone-600'}`}>
          Your Plan
        </span>
      </div>

      {/* Day bars - Vertical layout for better visual impact */}
      <div className="flex items-end justify-between gap-2 mb-6 h-32">
        {DAYS.map(day => {
          const percentage = maxCount > 0 ? (dayStats[day.key] / maxCount) * 100 : 0;
          const hasValue = dayStats[day.key] > 0;
          return (
            <div key={day.key} className="flex-1 flex flex-col items-center gap-2">
              {/* Count label */}
              <motion.span
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm font-bold ${
                  hasValue
                    ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                    : (isDark ? 'text-slate-600' : 'text-stone-300')
                }`}
              >
                {dayStats[day.key]}
              </motion.span>
              {/* Bar container */}
              <div className={`w-full h-20 rounded-lg relative overflow-hidden ${
                isDark ? 'bg-slate-700/30' : 'bg-stone-100'
              }`}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${percentage}%` }}
                  transition={springs.smooth}
                  className={`absolute bottom-0 left-0 right-0 rounded-lg ${
                    hasValue
                      ? (isDark ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-emerald-500 to-emerald-400')
                      : ''
                  }`}
                />
              </div>
              {/* Day label */}
              <span className={`text-xs font-semibold ${
                isDark ? 'text-slate-400' : 'text-stone-500'
              }`}>
                {day.fullLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className={`space-y-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
        {numericRules > 0 && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
            <span>{numericRules} headcount rule{numericRules > 1 ? 's' : ''}</span>
          </div>
        )}
        {pairingRules > 0 && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
            <span>{pairingRules} team pairing{pairingRules > 1 ? 's' : ''}</span>
          </div>
        )}
        {exclusions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
            <span>{exclusions.length} on leave</span>
          </div>
        )}
        <div className={`pt-2 mt-2 border-t ${isDark ? 'border-slate-700' : 'border-stone-200'}`}>
          <span className="font-semibold">{totalAssignments} total assignments</span>
        </div>
      </div>

      {/* Validation status */}
      {(rules.length > 0 || exclusions.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 p-3 rounded-lg ${
            isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              Ready to apply
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Icon map for exclusion reasons
const ExclusionIcons: Record<ExclusionReason, React.FC<{ className?: string }>> = {
  vacation: Palmtree,
  sick: Thermometer,
  training: GraduationCap,
  other: CircleDashed,
};

const PlanningModal: React.FC<PlanningModalProps> = ({
  isOpen,
  onClose,
  onApply,
  operators,
  weekNumber,
  year,
  theme,
  existingConfig,
  existingExclusions,
  skills: customSkills,
  templates = [],
  onSaveTemplate,
  onDeleteTemplate,
  onLoadTemplates,
}) => {
  const isDark = theme === 'Midnight';
  const prefersReducedMotion = useReducedMotion();

  // Use provided skills or fall back to INITIAL_SKILLS, filtering out TC skills
  const AVAILABLE_SKILLS = useMemo(() => {
    const allSkills = customSkills || INITIAL_SKILLS;
    return allSkills.filter(s => !['Process', 'People', 'Off Process'].includes(s));
  }, [customSkills]);

  // State
  const [rules, setRules] = useState<PlanningRule[]>([]);
  const [excludedTasks, setExcludedTasks] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [personSearches, setPersonSearches] = useState<Record<string, string>>({});
  const [personDropdownOpen, setPersonDropdownOpen] = useState<Record<string, boolean>>({});

  // Exclusions state
  const [exclusions, setExclusions] = useState<OperatorExclusion[]>([]);
  const [exclusionSearch, setExclusionSearch] = useState('');
  const [exclusionDropdownOpen, setExclusionDropdownOpen] = useState(false);

  // Template state
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // Track the last initialized config to avoid re-initializing on every open
  // We use config ID + updatedAt to detect actual changes
  const lastInitializedConfigRef = useRef<string | null>(null);
  const currentConfigKey = existingConfig
    ? `${existingConfig.id}-${existingConfig.updatedAt}`
    : `${year}-W${weekNumber}-empty`;
  const currentExclusionsKey = existingExclusions
    ? `${existingExclusions.id}-${existingExclusions.updatedAt}`
    : `${year}-W${weekNumber}-no-exclusions`;

  // Available operators (non-coordinators)
  const availableOperators = useMemo(() =>
    operators.filter(op => op.type !== 'Coordinator' && op.status === 'Active' && !op.archived),
    [operators]
  );

  // Initialize from existing config only when config actually changes (not on every open)
  useEffect(() => {
    const initKey = `${currentConfigKey}|${currentExclusionsKey}`;

    // Only initialize if the config has actually changed
    if (isOpen && lastInitializedConfigRef.current !== initKey) {
      lastInitializedConfigRef.current = initKey;

      if (existingConfig) {
        setRules(existingConfig.rules);
        setExcludedTasks(existingConfig.excludedTasks || []);
      } else {
        setRules([]);
        setExcludedTasks([]);
      }
      // Initialize exclusions
      if (existingExclusions) {
        setExclusions(existingExclusions.exclusions);
      } else {
        setExclusions([]);
      }
    }
  }, [existingConfig, existingExclusions, isOpen, currentConfigKey, currentExclusionsKey]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ============================================================================
  // RULE MANAGEMENT
  // ============================================================================

  const addNumericRule = () => {
    const newRule = createEmptyNumericRule();
    setRules(prev => [...prev, newRule]);
  };

  const addPairingRule = () => {
    const newRule = createEmptyPairingRule();
    setRules(prev => [...prev, newRule]);
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleRuleEnabled = (id: string) => {
    setRules(prev => prev.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const updateNumericRule = (id: string, updates: Partial<NumericStaffingRule>) => {
    setRules(prev => prev.map(r =>
      r.id === id && r.type === 'numeric' ? { ...r, ...updates } : r
    ));
  };

  const updatePairingRule = (id: string, updates: Partial<OperatorPairingRule>) => {
    setRules(prev => prev.map(r =>
      r.id === id && r.type === 'pairing' ? { ...r, ...updates } : r
    ));
  };

  const updateSkillRequirement = (ruleId: string, reqId: string, updates: Partial<SkillRequirement>) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId || r.type !== 'numeric') return r;
      return {
        ...r,
        requirements: r.requirements.map(req =>
          req.id === reqId ? { ...req, ...updates } : req
        ),
      };
    }));
  };

  const addSkillRequirement = (ruleId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId || r.type !== 'numeric') return r;
      return {
        ...r,
        requirements: [...r.requirements, createEmptySkillRequirement()],
      };
    }));
  };

  const removeSkillRequirement = (ruleId: string, reqId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId || r.type !== 'numeric') return r;
      if (r.requirements.length <= 1) return r;
      return {
        ...r,
        requirements: r.requirements.filter(req => req.id !== reqId),
      };
    }));
  };

  const addOperatorToPairing = (ruleId: string, operatorId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId || r.type !== 'pairing') return r;
      if (r.operatorIds.includes(operatorId)) return r;
      return {
        ...r,
        operatorIds: [...r.operatorIds, operatorId],
      };
    }));
    setPersonSearches(prev => ({ ...prev, [ruleId]: '' }));
    setPersonDropdownOpen(prev => ({ ...prev, [ruleId]: false }));
  };

  const removeOperatorFromPairing = (ruleId: string, operatorId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId || r.type !== 'pairing') return r;
      return {
        ...r,
        operatorIds: r.operatorIds.filter(id => id !== operatorId),
      };
    }));
  };

  // ============================================================================
  // EXCLUSION MANAGEMENT
  // ============================================================================

  const addExclusion = (operatorId: string, reason: ExclusionReason = 'vacation') => {
    setExclusions(prev => {
      if (prev.some(e => e.operatorId === operatorId)) return prev;
      return [...prev, { operatorId, reason }];
    });
    setExclusionSearch('');
    setExclusionDropdownOpen(false);
  };

  const removeExclusion = (operatorId: string) => {
    setExclusions(prev => prev.filter(e => e.operatorId !== operatorId));
  };

  const updateExclusionReason = (operatorId: string, reason: ExclusionReason) => {
    setExclusions(prev => prev.map(e =>
      e.operatorId === operatorId ? { ...e, reason } : e
    ));
  };

  const updateExclusionDays = (operatorId: string, days: WeekDay[]) => {
    setExclusions(prev => prev.map(e =>
      e.operatorId === operatorId
        ? { ...e, excludedDays: days.length === 5 ? undefined : days }
        : e
    ));
  };

  const toggleExclusionDay = (operatorId: string, day: WeekDay) => {
    setExclusions(prev => prev.map(e => {
      if (e.operatorId !== operatorId) return e;
      const currentDays = e.excludedDays || ALL_WEEKDAYS;
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      return { ...e, excludedDays: newDays.length === 5 ? undefined : newDays };
    }));
  };

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  // Close template menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
        setShowTemplateMenu(false);
      }
    };

    if (showTemplateMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTemplateMenu]);

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !onSaveTemplate) return;

    setIsSavingTemplate(true);
    try {
      const template = createPlanningTemplate(
        templateName.trim(),
        exclusions,
        rules,
        templateDescription.trim() || undefined
      );
      await onSaveTemplate(template);
      setTemplateName('');
      setTemplateDescription('');
      setShowSaveTemplateModal(false);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (template: PlanningTemplate) => {
    // Load rules from template
    if (template.rules) {
      setRules(template.rules);
    }
    // Load exclusions from template (convert TemplateExclusion to OperatorExclusion)
    if (template.exclusions) {
      setExclusions(template.exclusions.map(e => ({
        operatorId: e.operatorId,
        reason: e.reason,
        excludedDays: e.excludedDays,
        note: e.note,
      })));
    }
    setShowTemplateMenu(false);
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering load
    if (!onDeleteTemplate) return;
    try {
      await onDeleteTemplate(templateId);
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  // Check if we have anything to save as a template
  const hasContentToSave = rules.length > 0 || exclusions.length > 0;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleApply = async () => {
    setIsApplying(true);

    // Small delay for animation
    await new Promise(resolve => setTimeout(resolve, 300));

    const config: WeeklyPlanningConfig = {
      id: existingConfig?.id || crypto.randomUUID(),
      weekNumber,
      year,
      rules: rules.filter(r => r.enabled),
      excludedTasks,
      createdAt: existingConfig?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Build exclusions object if there are any
    const weeklyExclusions: WeeklyExclusions | undefined = exclusions.length > 0
      ? {
          id: existingExclusions?.id || crypto.randomUUID(),
          weekNumber,
          year,
          exclusions,
          createdAt: existingExclusions?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : undefined;

    onApply(config, weeklyExclusions);
    setIsApplying(false);
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  const hasRules = rules.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={prefersReducedMotion ? {} : modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`w-[80vw] max-w-[1400px] h-[80vh] flex flex-col overflow-hidden rounded-3xl shadow-2xl ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}
          >
            {/* Header */}
            <div className={`px-6 py-5 border-b ${
              isDark ? 'border-slate-800' : 'border-stone-100'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'
                  }`}>
                    <Calendar className={`w-5 h-5 ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${
                      isDark ? 'text-white' : 'text-stone-800'
                    }`}>
                      Plan Week {weekNumber}
                    </h2>
                    <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>
                      {year} · Build your schedule requirements
                    </p>
                  </div>
                </div>

                {/* Template Controls & Close Button */}
                <div className="flex items-center gap-2">
                  {/* Load Template Dropdown */}
                  {onLoadTemplates && (
                    <div className="relative" ref={templateMenuRef}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          isDark
                            ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Templates</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`} />
                      </motion.button>

                      {/* Dropdown Menu */}
                      <AnimatePresence>
                        {showTemplateMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className={`absolute right-0 mt-2 w-72 rounded-xl shadow-xl overflow-hidden z-50 ${
                              isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-stone-200'
                            }`}
                          >
                            {templates.length === 0 ? (
                              <div className={`p-4 text-center ${isDark ? 'text-slate-500' : 'text-stone-400'}`}>
                                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No saved templates</p>
                                <p className="text-xs mt-1">Save your first template to reuse it later</p>
                              </div>
                            ) : (
                              <div className="max-h-64 overflow-y-auto">
                                {templates.map((template) => (
                                  <div
                                    key={template.id}
                                    onClick={() => handleLoadTemplate(template)}
                                    className={`group flex items-center justify-between p-3 cursor-pointer transition-colors ${
                                      isDark
                                        ? 'hover:bg-slate-700/50'
                                        : 'hover:bg-stone-50'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium truncate ${
                                        isDark ? 'text-white' : 'text-stone-800'
                                      }`}>
                                        {template.name}
                                      </p>
                                      {template.description && (
                                        <p className={`text-xs truncate mt-0.5 ${
                                          isDark ? 'text-slate-500' : 'text-stone-400'
                                        }`}>
                                          {template.description}
                                        </p>
                                      )}
                                      <p className={`text-xs mt-1 ${
                                        isDark ? 'text-slate-600' : 'text-stone-300'
                                      }`}>
                                        {template.rules?.length || 0} rules · {template.exclusions?.length || 0} leave entries
                                      </p>
                                    </div>
                                    {onDeleteTemplate && (
                                      <button
                                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                                        className={`ml-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                                          isDark
                                            ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400'
                                            : 'hover:bg-red-50 text-stone-400 hover:text-red-500'
                                        }`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Save Template Button */}
                  {onSaveTemplate && hasContentToSave && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowSaveTemplateModal(true)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'text-emerald-400 hover:bg-emerald-500/20'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Template</span>
                    </motion.button>
                  )}

                  {/* Close Button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className={`p-2 rounded-xl transition-colors ${
                      isDark
                        ? 'text-slate-500 hover:text-white hover:bg-slate-800'
                        : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Body - Split Layout */}
            <div className="flex flex-1 min-h-0">
              {/* Left: Rule Builder */}
              <div className={`flex-1 overflow-y-auto p-6 ${
                isDark ? 'border-r border-slate-800' : 'border-r border-stone-100'
              }`}>
                <AnimatePresence mode="wait">
                  {!hasRules ? (
                    /* Empty State - Entry Cards */
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col"
                    >
                      <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-stone-800'}`}>
                        What do you need for this week?
                      </h3>
                      <p className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                        Choose a rule type to get started, or mark operators on leave
                      </p>

                      <div className="grid grid-cols-3 gap-4 flex-1">
                        {/* Headcount Entry Card */}
                        <motion.button
                          custom={0}
                          variants={entryCardVariants}
                          initial="hidden"
                          animate="visible"
                          whileHover="hover"
                          whileTap="tap"
                          onClick={addNumericRule}
                          className={`p-6 rounded-3xl text-left flex flex-col items-center justify-center min-h-[240px] border-2 border-dashed transition-all ${
                            isDark
                              ? 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700 hover:border-blue-500/50'
                              : 'bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-stone-200 hover:border-blue-300'
                          }`}
                        >
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                            isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                          }`}>
                            <Users className={`w-8 h-8 ${
                              isDark ? 'text-blue-400' : 'text-blue-600'
                            }`} />
                          </div>
                          <h3 className={`text-lg font-bold mb-1 ${
                            isDark ? 'text-white' : 'text-stone-800'
                          }`}>
                            Headcount
                          </h3>
                          <p className={`text-center text-sm ${
                            isDark ? 'text-slate-400' : 'text-stone-500'
                          }`}>
                            "I need X for Y"
                          </p>
                          <div className={`mt-4 text-xs font-medium px-2.5 py-1 rounded-full ${
                            isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                          }`}>
                            Most common
                          </div>
                        </motion.button>

                        {/* People Entry Card */}
                        <motion.button
                          custom={1}
                          variants={entryCardVariants}
                          initial="hidden"
                          animate="visible"
                          whileHover="hover"
                          whileTap="tap"
                          onClick={addPairingRule}
                          className={`p-6 rounded-3xl text-left flex flex-col items-center justify-center min-h-[240px] border-2 border-dashed transition-all ${
                            isDark
                              ? 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700 hover:border-purple-500/50'
                              : 'bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-stone-200 hover:border-purple-300'
                          }`}
                        >
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                            isDark ? 'bg-purple-500/20' : 'bg-purple-100'
                          }`}>
                            <User className={`w-8 h-8 ${
                              isDark ? 'text-purple-400' : 'text-purple-600'
                            }`} />
                          </div>
                          <h3 className={`text-lg font-bold mb-1 ${
                            isDark ? 'text-white' : 'text-stone-800'
                          }`}>
                            People
                          </h3>
                          <p className={`text-center text-sm ${
                            isDark ? 'text-slate-400' : 'text-stone-500'
                          }`}>
                            "Who does what"
                          </p>
                          <div className={`mt-4 text-xs font-medium px-2.5 py-1 rounded-full ${
                            isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                          }`}>
                            Specific people
                          </div>
                        </motion.button>

                        {/* Leave Entry Card */}
                        <motion.button
                          custom={2}
                          variants={entryCardVariants}
                          initial="hidden"
                          animate="visible"
                          whileHover="hover"
                          whileTap="tap"
                          onClick={() => setExclusionDropdownOpen(true)}
                          className={`p-6 rounded-3xl text-left flex flex-col items-center justify-center min-h-[240px] border-2 border-dashed transition-all ${
                            isDark
                              ? 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700 hover:border-emerald-500/50'
                              : 'bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-stone-200 hover:border-emerald-300'
                          }`}
                        >
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                            isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                          }`}>
                            <UserMinus className={`w-8 h-8 ${
                              isDark ? 'text-emerald-400' : 'text-emerald-600'
                            }`} />
                          </div>
                          <h3 className={`text-lg font-bold mb-1 ${
                            isDark ? 'text-white' : 'text-stone-800'
                          }`}>
                            Leave
                          </h3>
                          <p className={`text-center text-sm ${
                            isDark ? 'text-slate-400' : 'text-stone-500'
                          }`}>
                            "Who's away"
                          </p>
                          <div className={`mt-4 text-xs font-medium px-2.5 py-1 rounded-full ${
                            isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {exclusions.length > 0 ? `${exclusions.length} on leave` : 'None yet'}
                          </div>
                        </motion.button>
                      </div>

                      {/* Exclusions Section (visible when dropdown open or exclusions exist) */}
                      <AnimatePresence>
                        {(exclusionDropdownOpen || exclusions.length > 0) && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className={`mt-6 p-5 rounded-2xl ${isDark ? 'bg-slate-800/50' : 'bg-stone-50'}`}
                          >
                            <div className="flex items-center gap-2 mb-4">
                              <div className={`p-1.5 rounded-lg ${
                                isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                              }`}>
                                <UserMinus className={`w-3.5 h-3.5 ${
                                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                                }`} />
                              </div>
                              <span className={`text-xs font-semibold uppercase tracking-wide ${
                                isDark ? 'text-slate-500' : 'text-stone-400'
                              }`}>
                                Operators on Leave
                              </span>
                              {exclusions.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {exclusions.length}
                                </span>
                              )}
                            </div>

                            {/* Exclusions List */}
                            <AnimatePresence>
                              {exclusions.map((exclusion, idx) => {
                                const op = availableOperators.find(o => o.id === exclusion.operatorId);
                                if (!op) return null;
                                const excludedDays = exclusion.excludedDays || ALL_WEEKDAYS;
                                const isFullWeek = !exclusion.excludedDays || exclusion.excludedDays.length === 5;

                                return (
                                  <motion.div
                                    key={exclusion.operatorId}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`mb-3 p-4 rounded-xl ${
                                      isDark ? 'bg-slate-800' : 'bg-white ring-1 ring-stone-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                          isDark ? 'bg-slate-700 text-slate-300' : 'bg-stone-200 text-stone-600'
                                        }`}>
                                          {op.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-stone-700'}`}>
                                          {op.name}
                                        </span>
                                      </div>
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => removeExclusion(exclusion.operatorId)}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                          isDark
                                            ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
                                            : 'text-stone-300 hover:text-red-500 hover:bg-red-50'
                                        }`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </motion.button>
                                    </div>

                                    {/* Reason Selector */}
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                      {(Object.keys(EXCLUSION_REASONS) as ExclusionReason[]).map((reason) => {
                                        const config = EXCLUSION_REASONS[reason];
                                        const Icon = ExclusionIcons[reason];
                                        const isSelected = exclusion.reason === reason;
                                        return (
                                          <motion.button
                                            key={reason}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => updateExclusionReason(exclusion.operatorId, reason)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                              isSelected
                                                ? isDark
                                                  ? `bg-${config.color}-500/25 text-${config.color}-400 ring-1 ring-${config.color}-500/30`
                                                  : `bg-${config.color}-100 text-${config.color}-700 ring-1 ring-${config.color}-300`
                                                : isDark
                                                  ? 'bg-slate-700/50 text-slate-500 hover:text-slate-300'
                                                  : 'bg-stone-100 text-stone-400 hover:text-stone-600'
                                            }`}
                                          >
                                            <Icon className="w-3.5 h-3.5" />
                                            {config.label}
                                          </motion.button>
                                        );
                                      })}
                                    </div>

                                    {/* Day Selection */}
                                    <div className="flex items-center gap-3">
                                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-stone-400'}`}>
                                        Days:
                                      </span>
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => updateExclusionDays(exclusion.operatorId, isFullWeek ? [] : [...ALL_WEEKDAYS])}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                          isFullWeek
                                            ? isDark
                                              ? 'bg-emerald-500/20 text-emerald-400'
                                              : 'bg-emerald-100 text-emerald-700'
                                            : isDark
                                              ? 'bg-slate-700 text-slate-500 hover:text-slate-400'
                                              : 'bg-stone-100 text-stone-400 hover:text-stone-600'
                                        }`}
                                      >
                                        {isFullWeek ? 'All Week' : 'Custom'}
                                      </motion.button>
                                      <div className="flex items-center gap-1">
                                        {DAYS.map(day => {
                                          const isExcluded = excludedDays.includes(day.key);
                                          return (
                                            <motion.button
                                              key={day.key}
                                              whileTap={{ scale: 0.9 }}
                                              onClick={() => toggleExclusionDay(exclusion.operatorId, day.key)}
                                              className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${
                                                isExcluded
                                                  ? isDark
                                                    ? 'bg-red-500/25 text-red-400'
                                                    : 'bg-red-100 text-red-600'
                                                  : isDark
                                                    ? 'bg-slate-700/50 text-slate-600 hover:text-slate-400'
                                                    : 'bg-stone-100 text-stone-300 hover:text-stone-500'
                                              }`}
                                            >
                                              {day.fullLabel}
                                            </motion.button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>

                            {/* Add Exclusion Search */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search operators to add..."
                                autoFocus={exclusionDropdownOpen && exclusions.length === 0}
                                value={exclusionSearch}
                                onChange={(e) => setExclusionSearch(e.target.value)}
                                onFocus={() => setExclusionDropdownOpen(true)}
                                className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all ${
                                  isDark
                                    ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/30'
                                    : 'bg-white text-stone-700 placeholder:text-stone-400 ring-1 ring-stone-200 focus:ring-2 focus:ring-emerald-300'
                                }`}
                              />

                              {/* Results dropdown */}
                              <AnimatePresence>
                                {exclusionDropdownOpen && exclusionSearch && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className={`absolute top-full left-0 right-0 mt-2 rounded-xl z-50 overflow-hidden ${
                                      isDark ? 'bg-slate-800' : 'bg-white'
                                    }`}
                                    style={{
                                      boxShadow: isDark
                                        ? '0 4px 20px -4px rgba(0,0,0,0.5)'
                                        : '0 4px 20px -4px rgba(0,0,0,0.15)',
                                    }}
                                  >
                                    <div className="max-h-48 overflow-y-auto">
                                      {(() => {
                                        const search = exclusionSearch.toLowerCase();
                                        const filtered = availableOperators
                                          .filter(op => !exclusions.some(e => e.operatorId === op.id))
                                          .filter(op => op.name.toLowerCase().includes(search));

                                        if (filtered.length === 0) {
                                          return (
                                            <div className={`px-3 py-4 text-center text-sm ${
                                              isDark ? 'text-slate-500' : 'text-stone-400'
                                            }`}>
                                              No matches found
                                            </div>
                                          );
                                        }

                                        return filtered.map(op => (
                                          <button
                                            key={op.id}
                                            onClick={() => addExclusion(op.id, 'vacation')}
                                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                                              isDark
                                                ? 'text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300'
                                                : 'text-stone-600 hover:bg-emerald-100 hover:text-emerald-700'
                                            }`}
                                          >
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              isDark ? 'bg-slate-700 text-slate-400' : 'bg-stone-200 text-stone-500'
                                            }`}>
                                              {op.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            {op.name}
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    /* Rule Cards */
                    <motion.div
                      key="rules"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <AnimatePresence>
                        {rules.map((rule, index) => (
                          <motion.div
                            key={rule.id}
                            custom={index}
                            variants={ruleCardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                          >
                            {rule.type === 'numeric' ? (
                              /* Headcount Rule - Sentence Style */
                              <div className={`p-5 rounded-2xl ${
                                rule.enabled
                                  ? isDark ? 'bg-slate-800' : 'bg-white ring-1 ring-stone-200'
                                  : isDark ? 'bg-slate-800/40 opacity-60' : 'bg-stone-50 opacity-60'
                              }`}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                      isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                                    }`}>
                                      <Hash className={`w-3.5 h-3.5 ${
                                        isDark ? 'text-blue-400' : 'text-blue-600'
                                      }`} />
                                    </div>
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                                      isDark ? 'text-slate-500' : 'text-stone-400'
                                    }`}>
                                      Headcount
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleRuleEnabled(rule.id)}
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                        rule.enabled
                                          ? isDark
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-emerald-100 text-emerald-700'
                                          : isDark
                                            ? 'bg-slate-700 text-slate-500'
                                            : 'bg-stone-100 text-stone-400'
                                      }`}
                                    >
                                      {rule.enabled ? 'ON' : 'OFF'}
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => deleteRule(rule.id)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isDark
                                          ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
                                          : 'text-stone-300 hover:text-red-500 hover:bg-red-50'
                                      }`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </motion.button>
                                  </div>
                                </div>

                                {/* Sentence Builder */}
                                <div className="space-y-3">
                                  {rule.requirements.map((req, reqIdx) => (
                                    <div key={req.id} className="flex items-center gap-3 flex-wrap">
                                      {reqIdx > 0 && (
                                        <motion.button
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => {
                                            const newConj: ConjunctionType = (req.conjunction || 'AND') === 'AND' ? 'OR' : 'AND';
                                            updateSkillRequirement(rule.id, req.id, { conjunction: newConj });
                                          }}
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            (req.conjunction || 'AND') === 'AND'
                                              ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                                              : isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                                          }`}
                                        >
                                          {(req.conjunction || 'AND') === 'AND' ? '+' : 'or'}
                                        </motion.button>
                                      )}

                                      <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                                        {reqIdx === 0 ? 'I need' : ''}
                                      </span>

                                      <NumberStepper
                                        value={req.count}
                                        onChange={(count) => updateSkillRequirement(rule.id, req.id, { count })}
                                        isDark={isDark}
                                      />

                                      <OperatorTypeSelector
                                        value={req.operatorType}
                                        onChange={(operatorType) => updateSkillRequirement(rule.id, req.id, { operatorType })}
                                        isDark={isDark}
                                      />

                                      <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                                        for
                                      </span>

                                      <TaskSelector
                                        value={req.skill}
                                        onChange={(skill) => updateSkillRequirement(rule.id, req.id, { skill })}
                                        isDark={isDark}
                                        availableSkills={AVAILABLE_SKILLS}
                                      />

                                      {rule.requirements.length > 1 && (
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => removeSkillRequirement(rule.id, req.id)}
                                          className={`p-1 rounded ${
                                            isDark ? 'text-slate-600 hover:text-red-400' : 'text-stone-300 hover:text-red-500'
                                          }`}
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </motion.button>
                                      )}
                                    </div>
                                  ))}

                                  <motion.button
                                    whileHover={{ x: 3 }}
                                    onClick={() => addSkillRequirement(rule.id)}
                                    className={`text-xs font-medium flex items-center gap-1 ${
                                      isDark ? 'text-slate-500 hover:text-blue-400' : 'text-stone-400 hover:text-blue-600'
                                    }`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add another requirement
                                  </motion.button>
                                </div>

                                {/* Day Timeline */}
                                <div className={`mt-5 pt-4 border-t ${
                                  isDark ? 'border-slate-700/50' : 'border-stone-100'
                                }`}>
                                  <DayTimeline
                                    selectedDays={rule.selectedDays !== undefined ? rule.selectedDays : [...ALL_WEEKDAYS]}
                                    onChange={(days) => updateNumericRule(rule.id, { selectedDays: days })}
                                    isDark={isDark}
                                  />
                                </div>
                              </div>
                            ) : (
                              /* People Rule - Enhanced with want/don't want */
                              <div className={`p-5 rounded-2xl ${
                                rule.enabled
                                  ? isDark ? 'bg-slate-800' : 'bg-white ring-1 ring-stone-200'
                                  : isDark ? 'bg-slate-800/40 opacity-60' : 'bg-stone-50 opacity-60'
                              }`}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                      isDark ? 'bg-purple-500/20' : 'bg-purple-100'
                                    }`}>
                                      <User className={`w-3.5 h-3.5 ${
                                        isDark ? 'text-purple-400' : 'text-purple-600'
                                      }`} />
                                    </div>
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${
                                      isDark ? 'text-slate-500' : 'text-stone-400'
                                    }`}>
                                      People
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => toggleRuleEnabled(rule.id)}
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                        rule.enabled
                                          ? isDark
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-emerald-100 text-emerald-700'
                                          : isDark
                                            ? 'bg-slate-700 text-slate-500'
                                            : 'bg-stone-100 text-stone-400'
                                      }`}
                                    >
                                      {rule.enabled ? 'ON' : 'OFF'}
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => deleteRule(rule.id)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isDark
                                          ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
                                          : 'text-stone-300 hover:text-red-500 hover:bg-red-50'
                                      }`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </motion.button>
                                  </div>
                                </div>

                                {/* Sentence Builder */}
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    {/* Want/Don't Want Toggle Pill */}
                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => updatePairingRule(rule.id, {
                                        preference: (rule.preference || 'want') === 'want' ? 'dont-want' : 'want'
                                      })}
                                      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                        (rule.preference || 'want') === 'want'
                                          ? isDark
                                            ? 'bg-emerald-500/25 text-emerald-400 ring-1 ring-emerald-500/30'
                                            : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                                          : isDark
                                            ? 'bg-red-500/25 text-red-400 ring-1 ring-red-500/30'
                                            : 'bg-red-100 text-red-700 ring-1 ring-red-300'
                                      }`}
                                    >
                                      {(rule.preference || 'want') === 'want' ? 'I want' : "I don't want"}
                                    </motion.button>

                                    {/* Person Chips */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      <AnimatePresence>
                                        {rule.operatorIds.map((opId, idx) => {
                                          const op = availableOperators.find(o => o.id === opId);
                                          if (!op) return null;
                                          return (
                                            <React.Fragment key={opId}>
                                              {idx > 0 && (
                                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                                                  and
                                                </span>
                                              )}
                                              <PersonChip
                                                name={op.name}
                                                onRemove={() => removeOperatorFromPairing(rule.id, opId)}
                                                isDark={isDark}
                                              />
                                            </React.Fragment>
                                          );
                                        })}
                                      </AnimatePresence>

                                      {/* Add Person Button/Input */}
                                      <div className="relative">
                                        {rule.operatorIds.length === 0 ? (
                                          // First person - show full input
                                          <input
                                            type="text"
                                            placeholder="Add person..."
                                            value={personSearches[rule.id] || ''}
                                            onChange={(e) => {
                                              setPersonSearches(prev => ({ ...prev, [rule.id]: e.target.value }));
                                              setPersonDropdownOpen(prev => ({ ...prev, [rule.id]: true }));
                                            }}
                                            onFocus={() => setPersonDropdownOpen(prev => ({ ...prev, [rule.id]: true }))}
                                            onBlur={() => setTimeout(() => setPersonDropdownOpen(prev => ({ ...prev, [rule.id]: false })), 150)}
                                            className={`w-32 px-3 py-1.5 rounded-full text-sm outline-none transition-all ${
                                              isDark
                                                ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500 focus:bg-slate-600'
                                                : 'bg-stone-100 text-stone-700 placeholder:text-stone-400'
                                            }`}
                                          />
                                        ) : (
                                          // Additional people - show (+) button that expands to input
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setPersonDropdownOpen(prev => ({ ...prev, [rule.id]: true }))}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                              isDark
                                                ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                                                : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                            }`}
                                          >
                                            <Plus className="w-4 h-4" />
                                          </motion.button>
                                        )}

                                        {/* Dropdown */}
                                        <AnimatePresence>
                                          {personDropdownOpen[rule.id] && (
                                            <motion.div
                                              initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                              transition={springs.snappy}
                                              className={`absolute top-full left-0 mt-1 w-48 rounded-xl z-50 overflow-hidden ${
                                                isDark ? 'bg-slate-800' : 'bg-white'
                                              }`}
                                              style={{
                                                boxShadow: isDark
                                                  ? '0 4px 20px -4px rgba(0,0,0,0.5)'
                                                  : '0 4px 20px -4px rgba(0,0,0,0.15)',
                                              }}
                                            >
                                              {/* Search input for (+) button dropdown */}
                                              {rule.operatorIds.length > 0 && (
                                                <div className={`p-2 border-b ${isDark ? 'border-slate-700' : 'border-stone-100'}`}>
                                                  <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    autoFocus
                                                    value={personSearches[rule.id] || ''}
                                                    onChange={(e) => setPersonSearches(prev => ({ ...prev, [rule.id]: e.target.value }))}
                                                    onBlur={() => setTimeout(() => setPersonDropdownOpen(prev => ({ ...prev, [rule.id]: false })), 150)}
                                                    className={`w-full px-2 py-1 rounded text-sm outline-none ${
                                                      isDark
                                                        ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500'
                                                        : 'bg-stone-100 text-stone-700 placeholder:text-stone-400'
                                                    }`}
                                                  />
                                                </div>
                                              )}
                                              <div className="max-h-40 overflow-y-auto">
                                                {(() => {
                                                  const search = (personSearches[rule.id] || '').toLowerCase();
                                                  const filtered = availableOperators
                                                    .filter(op => !rule.operatorIds.includes(op.id))
                                                    .filter(op => op.name.toLowerCase().includes(search));

                                                  if (filtered.length === 0) {
                                                    return (
                                                      <div className={`px-3 py-2 text-xs ${
                                                        isDark ? 'text-slate-500' : 'text-stone-400'
                                                      }`}>
                                                        No matches
                                                      </div>
                                                    );
                                                  }

                                                  return filtered.map(op => (
                                                    <button
                                                      key={op.id}
                                                      onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        addOperatorToPairing(rule.id, op.id);
                                                      }}
                                                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                                        isDark
                                                          ? 'text-slate-300 hover:bg-purple-500/20 hover:text-purple-300'
                                                          : 'text-stone-600 hover:bg-purple-100 hover:text-purple-700'
                                                      }`}
                                                    >
                                                      {op.name}
                                                    </button>
                                                  ));
                                                })()}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </div>

                                    {/* Contextual text based on operator count and preference */}
                                    {rule.operatorIds.length === 1 && (
                                      <>
                                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                                          to do
                                        </span>
                                        <TaskSelector
                                          value={rule.skill}
                                          onChange={(skill) => updatePairingRule(rule.id, { skill })}
                                          isDark={isDark}
                                          availableSkills={AVAILABLE_SKILLS}
                                        />
                                      </>
                                    )}

                                    {rule.operatorIds.length > 1 && (
                                      <>
                                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                                          together
                                        </span>
                                        {/* Only show task selector for "want" with multiple operators */}
                                        {(rule.preference || 'want') === 'want' && (
                                          <>
                                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                                              on
                                            </span>
                                            <TaskSelector
                                              value={rule.skill}
                                              onChange={(skill) => updatePairingRule(rule.id, { skill })}
                                              isDark={isDark}
                                              availableSkills={AVAILABLE_SKILLS}
                                            />
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Day Timeline */}
                                <div className={`mt-5 pt-4 border-t ${
                                  isDark ? 'border-slate-700/50' : 'border-stone-100'
                                }`}>
                                  <DayTimeline
                                    selectedDays={rule.selectedDays !== undefined ? rule.selectedDays : [...ALL_WEEKDAYS]}
                                    onChange={(days) => updatePairingRule(rule.id, { selectedDays: days })}
                                    isDark={isDark}
                                  />
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Add Another Rule */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3 pt-2"
                      >
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={addNumericRule}
                          className={`flex-1 p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${
                            isDark
                              ? 'border-slate-700 text-slate-500 hover:border-blue-500/50 hover:text-blue-400'
                              : 'border-stone-200 text-stone-400 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          <span className="text-sm font-medium">Add Headcount</span>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={addPairingRule}
                          className={`flex-1 p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${
                            isDark
                              ? 'border-slate-700 text-slate-500 hover:border-purple-500/50 hover:text-purple-400'
                              : 'border-stone-200 text-stone-400 hover:border-purple-300 hover:text-purple-600'
                          }`}
                        >
                          <User className="w-4 h-4" />
                          <span className="text-sm font-medium">Add People</span>
                        </motion.button>
                      </motion.div>

                      {/* Leave Management Section */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-700/50' : 'border-stone-200'}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${
                              isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                            }`}>
                              <UserMinus className={`w-3.5 h-3.5 ${
                                isDark ? 'text-emerald-400' : 'text-emerald-600'
                              }`} />
                            </div>
                            <span className={`text-xs font-semibold uppercase tracking-wide ${
                              isDark ? 'text-slate-500' : 'text-stone-400'
                            }`}>
                              Leave Management
                            </span>
                            {exclusions.length > 0 && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {exclusions.length}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Exclusions List */}
                        <AnimatePresence>
                          {exclusions.map((exclusion, idx) => {
                            const op = availableOperators.find(o => o.id === exclusion.operatorId);
                            if (!op) return null;
                            const ExclusionIcon = ExclusionIcons[exclusion.reason];
                            const reasonConfig = EXCLUSION_REASONS[exclusion.reason];
                            const excludedDays = exclusion.excludedDays || ALL_WEEKDAYS;
                            const isFullWeek = !exclusion.excludedDays || exclusion.excludedDays.length === 5;

                            return (
                              <motion.div
                                key={exclusion.operatorId}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`mb-3 p-4 rounded-xl ${
                                  isDark ? 'bg-slate-800/60' : 'bg-stone-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    {/* Operator Avatar */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                      isDark ? 'bg-slate-700 text-slate-300' : 'bg-stone-200 text-stone-600'
                                    }`}>
                                      {op.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-stone-700'}`}>
                                      {op.name}
                                    </span>
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => removeExclusion(exclusion.operatorId)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isDark
                                        ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
                                        : 'text-stone-300 hover:text-red-500 hover:bg-red-50'
                                    }`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                </div>

                                {/* Reason Selector */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                  {(Object.keys(EXCLUSION_REASONS) as ExclusionReason[]).map((reason) => {
                                    const config = EXCLUSION_REASONS[reason];
                                    const Icon = ExclusionIcons[reason];
                                    const isSelected = exclusion.reason === reason;
                                    return (
                                      <motion.button
                                        key={reason}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => updateExclusionReason(exclusion.operatorId, reason)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                          isSelected
                                            ? isDark
                                              ? `bg-${config.color}-500/25 text-${config.color}-400 ring-1 ring-${config.color}-500/30`
                                              : `bg-${config.color}-100 text-${config.color}-700 ring-1 ring-${config.color}-300`
                                            : isDark
                                              ? 'bg-slate-700/50 text-slate-500 hover:text-slate-300'
                                              : 'bg-stone-100 text-stone-400 hover:text-stone-600'
                                        }`}
                                        style={isSelected ? {
                                          backgroundColor: isDark
                                            ? `rgba(var(--${config.color}-500), 0.25)`
                                            : undefined,
                                        } : undefined}
                                      >
                                        <Icon className="w-3.5 h-3.5" />
                                        {config.label}
                                      </motion.button>
                                    );
                                  })}
                                </div>

                                {/* Day Selection */}
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-stone-400'}`}>
                                    Days:
                                  </span>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => updateExclusionDays(exclusion.operatorId, isFullWeek ? [] : [...ALL_WEEKDAYS])}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                      isFullWeek
                                        ? isDark
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-emerald-100 text-emerald-700'
                                        : isDark
                                          ? 'bg-slate-700 text-slate-500 hover:text-slate-400'
                                          : 'bg-stone-100 text-stone-400 hover:text-stone-600'
                                    }`}
                                  >
                                    {isFullWeek ? 'All Week' : 'Custom'}
                                  </motion.button>
                                  <div className="flex items-center gap-1">
                                    {DAYS.map(day => {
                                      const isExcluded = excludedDays.includes(day.key);
                                      return (
                                        <motion.button
                                          key={day.key}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => toggleExclusionDay(exclusion.operatorId, day.key)}
                                          className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-all ${
                                            isExcluded
                                              ? isDark
                                                ? 'bg-red-500/25 text-red-400'
                                                : 'bg-red-100 text-red-600'
                                              : isDark
                                                ? 'bg-slate-700/50 text-slate-600 hover:text-slate-400'
                                                : 'bg-stone-100 text-stone-300 hover:text-stone-500'
                                          }`}
                                        >
                                          {day.fullLabel}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {/* Add Exclusion Button/Search */}
                        <div className="relative">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setExclusionDropdownOpen(!exclusionDropdownOpen)}
                            className={`w-full p-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${
                              isDark
                                ? 'border-slate-700 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400'
                                : 'border-stone-200 text-stone-400 hover:border-emerald-300 hover:text-emerald-600'
                            }`}
                          >
                            <UserMinus className="w-4 h-4" />
                            <span className="text-sm font-medium">Add Operator on Leave</span>
                          </motion.button>

                          {/* Dropdown */}
                          <AnimatePresence>
                            {exclusionDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                                transition={springs.snappy}
                                className={`absolute bottom-full left-0 right-0 mb-2 rounded-xl z-50 overflow-hidden ${
                                  isDark ? 'bg-slate-800' : 'bg-white'
                                }`}
                                style={{
                                  boxShadow: isDark
                                    ? '0 -4px 20px -4px rgba(0,0,0,0.5)'
                                    : '0 -4px 20px -4px rgba(0,0,0,0.15)',
                                }}
                              >
                                <div className={`p-2 border-b ${isDark ? 'border-slate-700' : 'border-stone-100'}`}>
                                  <input
                                    type="text"
                                    placeholder="Search operators..."
                                    autoFocus
                                    value={exclusionSearch}
                                    onChange={(e) => setExclusionSearch(e.target.value)}
                                    onBlur={() => setTimeout(() => setExclusionDropdownOpen(false), 150)}
                                    className={`w-full px-3 py-2 rounded-lg text-sm outline-none ${
                                      isDark
                                        ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500'
                                        : 'bg-stone-100 text-stone-700 placeholder:text-stone-400'
                                    }`}
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {(() => {
                                    const search = exclusionSearch.toLowerCase();
                                    const filtered = availableOperators
                                      .filter(op => !exclusions.some(e => e.operatorId === op.id))
                                      .filter(op => op.name.toLowerCase().includes(search));

                                    if (filtered.length === 0) {
                                      return (
                                        <div className={`px-3 py-4 text-center text-sm ${
                                          isDark ? 'text-slate-500' : 'text-stone-400'
                                        }`}>
                                          {exclusionSearch ? 'No matches found' : 'All operators already added'}
                                        </div>
                                      );
                                    }

                                    return filtered.map(op => (
                                      <button
                                        key={op.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          addExclusion(op.id, 'vacation');
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                                          isDark
                                            ? 'text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300'
                                            : 'text-stone-600 hover:bg-emerald-100 hover:text-emerald-700'
                                        }`}
                                      >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                          isDark ? 'bg-slate-700 text-slate-400' : 'bg-stone-200 text-stone-500'
                                        }`}>
                                          {op.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        {op.name}
                                      </button>
                                    ));
                                  })()}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right: Live Preview */}
              <div className="w-72 p-6 overflow-y-auto">
                <LivePreview rules={rules} exclusions={exclusions} operators={availableOperators} isDark={isDark} />
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${
              isDark ? 'border-slate-800' : 'border-stone-100'
            }`}>
              <div className="flex items-center justify-between">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
                    isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleApply}
                  disabled={(rules.filter(r => r.enabled).length === 0 && exclusions.length === 0 && (!existingExclusions || existingExclusions.exclusions.length === 0)) || isApplying}
                  className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                    (rules.filter(r => r.enabled).length === 0 && exclusions.length === 0 && (!existingExclusions || existingExclusions.exclusions.length === 0))
                      ? isDark
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                      : isDark
                        ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Apply Plan
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={(e) => e.target === e.currentTarget && setShowSaveTemplateModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`w-full max-w-md rounded-2xl shadow-2xl ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}
          >
            <div className={`px-6 py-4 border-b ${
              isDark ? 'border-slate-800' : 'border-stone-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'
                }`}>
                  <Save className={`w-5 h-5 ${
                    isDark ? 'text-emerald-400' : 'text-emerald-600'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${
                    isDark ? 'text-white' : 'text-stone-800'
                  }`}>
                    Save Template
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>
                    Save current configuration for reuse
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-stone-700'
                }`}>
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Week, Holiday Coverage"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none ring-1 transition-all focus:ring-2 ${
                    isDark
                      ? 'bg-slate-800 text-white placeholder:text-slate-500 ring-slate-700 focus:ring-emerald-500'
                      : 'bg-white text-stone-800 placeholder:text-stone-400 ring-stone-200 focus:ring-emerald-500'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-stone-700'
                }`}>
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Add notes about when to use this template..."
                  rows={3}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none ring-1 transition-all focus:ring-2 resize-none ${
                    isDark
                      ? 'bg-slate-800 text-white placeholder:text-slate-500 ring-slate-700 focus:ring-emerald-500'
                      : 'bg-white text-stone-800 placeholder:text-stone-400 ring-stone-200 focus:ring-emerald-500'
                  }`}
                />
              </div>

              <div className={`p-3 rounded-xl ${
                isDark ? 'bg-slate-800/50' : 'bg-stone-50'
              }`}>
                <p className={`text-xs font-medium ${
                  isDark ? 'text-slate-400' : 'text-stone-500'
                }`}>
                  Template will include:
                </p>
                <div className={`mt-2 flex flex-wrap gap-2 text-xs ${
                  isDark ? 'text-slate-500' : 'text-stone-400'
                }`}>
                  {rules.length > 0 && (
                    <span className={`px-2 py-1 rounded-lg ${
                      isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
                    </span>
                  )}
                  {exclusions.length > 0 && (
                    <span className={`px-2 py-1 rounded-lg ${
                      isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {exclusions.length} leave {exclusions.length === 1 ? 'entry' : 'entries'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${
              isDark ? 'border-slate-800' : 'border-stone-100'
            }`}>
              <button
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || isSavingTemplate}
                className={`px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                  !templateName.trim()
                    ? isDark
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : isDark
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {isSavingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Template
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlanningModal;
