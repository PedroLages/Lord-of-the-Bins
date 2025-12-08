
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import {
  Users, Calendar, Sparkles, AlertCircle, Save, Download,
  Trash2, Plus, Edit2, Search, Settings, Filter, MoreHorizontal,
  ChevronDown, ChevronLeft, ChevronRight, BarChart3, Clock, CheckCircle2, Palette, Monitor,
  Layout, Moon, Grid, LayoutDashboard, LogOut, Menu, Box, Zap,
  TrendingUp, Activity, PieChart, Bell, Globe, Lock, Unlock, AlertTriangle,
  ArrowRight, Briefcase, Award, UserCheck, Sliders, Puzzle, Shield,
  Check, Layers, GitBranch, Cpu, Send, List, Table2, Grid3X3
} from 'lucide-react';
import {
  Operator, TaskType, WeeklySchedule, ScheduleAssignment, MOCK_OPERATORS, MOCK_TASKS, WeekDay, INITIAL_SKILLS, getRequiredOperatorsForDay
} from './types';
import OperatorModal from './components/OperatorModal';
import ExportModal from './components/ExportModal';
import CommandPalette from './components/CommandPalette';
import { generateSmartSchedule, validateSchedule, ScheduleWarning, DEFAULT_RULES, SchedulingRules } from './services/schedulingService';
import { createEmptyWeek, getWeekRangeString, getWeekLabel, isCurrentWeek, getAdjacentWeek } from './services/weekUtils';
import {
  ActivityLogEntry,
  loadActivityLog,
  logScheduleGenerated,
  logSchedulePublished,
  logScheduleUnpublished,
  logScheduleLockToggle,
  logAssignmentChange,
  logOperatorAdded,
  logOperatorUpdated,
  getRelativeTime
} from './services/activityLogService';

// --- Theme Configuration ---

type Theme = 'Modern' | 'Executive' | 'Midnight' | 'Minimal';

const THEME_STYLES = {
  Modern: {
    bg: 'bg-[#f8fafc]',
    text: 'text-slate-800',
    muted: 'text-slate-500',
    sidebar: 'modern',
    layout: 'sidebar',
    card: 'bg-white rounded-2xl shadow-sm border border-gray-200',
    cardHeader: 'border-b border-gray-100 bg-gray-50/50',
    gridHeader: 'bg-gray-50/95 border-b border-gray-100',
    cell: 'border-r border-gray-50',
    primaryBtn: 'bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700',
    secondaryBtn: 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl',
    accent: 'blue',
  },
  Executive: {
    bg: 'bg-gray-100',
    text: 'text-gray-900',
    muted: 'text-gray-600',
    sidebar: 'hidden',
    layout: 'topbar',
    card: 'bg-white rounded-none shadow-sm border border-gray-300',
    cardHeader: 'border-b border-gray-300 bg-gray-100',
    gridHeader: 'bg-gray-200 text-gray-800 font-bold text-xs uppercase border-b border-gray-300',
    cell: 'border-r border-b border-gray-200',
    primaryBtn: 'bg-slate-800 text-white rounded-sm hover:bg-slate-900',
    secondaryBtn: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-sm',
    accent: 'slate',
  },
  Midnight: { // Formerly Neon
    bg: 'bg-[#0f172a]',
    text: 'text-slate-200',
    muted: 'text-slate-500',
    sidebar: 'midnight',
    layout: 'sidebar',
    card: 'bg-slate-900 rounded-xl border border-slate-800',
    cardHeader: 'border-b border-slate-800 bg-slate-900',
    gridHeader: 'bg-slate-900 border-b border-slate-800 text-slate-400',
    cell: 'border-r border-slate-800',
    primaryBtn: 'bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors',
    secondaryBtn: 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 rounded-lg',
    accent: 'indigo',
  },
  Minimal: {
    bg: 'bg-[#fdfbf7]', // Warm stone
    text: 'text-stone-800',
    muted: 'text-stone-500',
    sidebar: 'minimal',
    layout: 'sidebar',
    card: 'bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0',
    cardHeader: 'border-b border-stone-100 bg-transparent',
    gridHeader: 'bg-transparent text-stone-500 font-medium border-b border-stone-100',
    cell: 'border-r-0 border-b border-stone-50', // No vertical lines
    primaryBtn: 'bg-stone-800 text-white rounded-full hover:bg-stone-700 px-6',
    secondaryBtn: 'bg-transparent text-stone-600 hover:bg-stone-100 rounded-full',
    accent: 'stone',
  }
};

function App() {
  const [theme, setTheme] = useState<Theme>('Modern');
  const [activeTab, setActiveTab] = useState('schedule');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // App State
  const [operators, setOperators] = useState<Operator[]>(MOCK_OPERATORS);
  const [tasks, setTasks] = useState<TaskType[]>(MOCK_TASKS);

  // Week Navigation State - Initialize with current week dynamically
  const [currentWeek, setCurrentWeek] = useState<WeeklySchedule>(() => createEmptyWeek(new Date()));
  const [scheduleHistory, setScheduleHistory] = useState<Record<string, WeeklySchedule>>({});

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishWithLock, setPublishWithLock] = useState(false);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const scheduleGridRef = useRef<HTMLDivElement>(null);

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Activity Log State
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Load activity log on mount
  useEffect(() => {
    setActivityLog(loadActivityLog());
  }, []);

  // Close operator menu when clicking outside
  useEffect(() => {
    if (!openOperatorMenu) return;

    const handleClickOutside = () => setOpenOperatorMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openOperatorMenu]);

  // Settings State
  const [settingsTab, setSettingsTab] = useState<'tasks' | 'automation' | 'integrations'>('tasks');

  // Team Filter State
  const [teamFilter, setTeamFilter] = useState<'All' | 'Regular' | 'Flex' | 'Coordinator'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Sick' | 'Leave'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamViewMode, setTeamViewMode] = useState<'cards' | 'table' | 'matrix'>('cards');
  const [openOperatorMenu, setOpenOperatorMenu] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const styles = THEME_STYLES[theme];

  // Scheduling State
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{opId: string, dayIndex: number} | null>(null);

  // Modal State
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  useEffect(() => {
    // Add 'dark' class to body for Midnight theme
    if (theme === 'Midnight') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  // Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows) to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scheduling State (moved before stats useMemo to avoid reference error)
  const [schedulingRules, setSchedulingRules] = useState<SchedulingRules>(DEFAULT_RULES);
  const [scheduleWarnings, setScheduleWarnings] = useState<ScheduleWarning[]>([]);

  // --- Statistics ---
  const stats = useMemo(() => {
    // Count operators by status
    const activeOperators = operators.filter(o => o.status === 'Active');
    const sickOperators = operators.filter(o => o.status === 'Sick');
    const leaveOperators = operators.filter(o => o.status === 'Leave');

    // Count by type
    const regularOperators = operators.filter(o => o.type === 'Regular');
    const flexOperators = operators.filter(o => o.type === 'Flex');
    const coordinators = operators.filter(o => o.type === 'Coordinator');

    // Calculate coverage - only count active regular and flex operators
    const availableOperators = operators.filter(o => o.status === 'Active' && o.type !== 'Coordinator');
    const totalSlots = currentWeek.days.length * availableOperators.length;

    let filledSlots = 0;
    let exceptionsCount = 0;

    currentWeek.days.forEach(d => {
      Object.entries(d.assignments).forEach(([opId, assignment]) => {
        const a = assignment as ScheduleAssignment;
        if (a.taskId) {
          filledSlots++;
          // Count exceptions assignments
          const task = tasks.find(t => t.id === a.taskId);
          if (task?.name === 'Exceptions') {
            exceptionsCount++;
          }
        }
      });
    });

    const coverage = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    // Skill distribution
    const skillCounts: Record<string, number> = {};
    operators.forEach(op => {
      op.skills.forEach(skill => {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      });
    });

    // Count warnings/exceptions
    const warningCount = scheduleWarnings.length;

    return {
      totalOperators: operators.length,
      activeCount: activeOperators.length,
      sickCount: sickOperators.length,
      leaveCount: leaveOperators.length,
      regularCount: regularOperators.length,
      flexCount: flexOperators.length,
      coordinatorCount: coordinators.length,
      coverage,
      openSlots: totalSlots - filledSlots,
      totalSlots,
      filledSlots,
      exceptionsCount,
      warningCount,
      skillCounts
    };
  }, [currentWeek, operators, tasks, scheduleWarnings]);

  // --- Handlers ---

  const handleSaveOperator = (op: Operator) => {
    const existingOp = operators.find(o => o.id === op.id);
    if (existingOp) {
      // Track what changed
      const changes: string[] = [];
      if (existingOp.status !== op.status) {
        changes.push(`status → ${op.status}`);
      }
      if (existingOp.type !== op.type) {
        changes.push(`type → ${op.type}`);
      }
      if (existingOp.skills.length !== op.skills.length) {
        changes.push(`skills updated`);
      }

      setOperators(prev => prev.map(o => o.id === op.id ? op : o));

      if (changes.length > 0) {
        const entry = logOperatorUpdated(op.name, changes.join(', '));
        setActivityLog(prev => [entry, ...prev]);
      }
    } else {
      setOperators(prev => [...prev, op]);
      const entry = logOperatorAdded(op.name);
      setActivityLog(prev => [entry, ...prev]);
    }
  };

  const handleAddNewTask = () => {
    const newTaskId = `t${Date.now()}`;
    const newTask: TaskType = {
      id: newTaskId,
      name: 'New Task',
      color: '#6366f1', // Default indigo color
      textColor: '#ffffff',
      requiredSkill: INITIAL_SKILLS[0],
      requiredOperators: 1,
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleUpdateTaskRequiredOperators = (taskId: string, count: number) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, requiredOperators: Math.max(1, Math.min(5, count)) }
        : t
    ));
  };

  const handleAssignmentChange = (dayIndex: number, opId: string, taskId: string | null) => {
    // Don't allow changes if schedule is locked
    if (currentWeek.locked) return;

    const newSchedule = { ...currentWeek };
    const day = newSchedule.days[dayIndex];

    // Get old task for logging
    const oldTaskId = day.assignments[opId]?.taskId || null;
    const oldTaskName = oldTaskId ? tasks.find(t => t.id === oldTaskId)?.name || null : null;
    const newTaskName = taskId ? tasks.find(t => t.id === taskId)?.name || null : null;

    if (!day.assignments[opId]) {
      day.assignments[opId] = { taskId: null, locked: false };
    }

    day.assignments[opId] = {
      ...day.assignments[opId],
      taskId: taskId,
      locked: true
    };

    setCurrentWeek(newSchedule);
    setSelectedCell(null);

    // Log the assignment change
    const operator = operators.find(o => o.id === opId);
    if (operator && (oldTaskName !== newTaskName)) {
      const entry = logAssignmentChange(operator.name, day.dayOfWeek, oldTaskName, newTaskName);
      setActivityLog(prev => [entry, ...prev]);
    }

    // Run validation after assignment change
    const daysList: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const assignmentsMap: Record<string, Record<string, { taskId: string | null; locked: boolean }>> = {};
    newSchedule.days.forEach((d, idx) => {
      assignmentsMap[idx] = d.assignments;
    });
    const warnings = validateSchedule(assignmentsMap, operators, tasks, daysList);
    setScheduleWarnings(warnings);
  };

  // --- Week Navigation Handlers ---

  const handleWeekNavigation = (direction: 'prev' | 'next') => {
    // Save current week to history before navigating
    setScheduleHistory(prev => ({
      ...prev,
      [currentWeek.id]: currentWeek
    }));

    // Check if we have this week in history
    const newWeekTemplate = getAdjacentWeek(currentWeek, direction);
    const existingWeek = scheduleHistory[newWeekTemplate.id];

    if (existingWeek) {
      setCurrentWeek(existingWeek);
    } else {
      setCurrentWeek(newWeekTemplate);
    }

    // Clear warnings when navigating
    setScheduleWarnings([]);
  };

  const handleGoToCurrentWeek = () => {
    // Save current week to history
    setScheduleHistory(prev => ({
      ...prev,
      [currentWeek.id]: currentWeek
    }));

    const todayWeek = createEmptyWeek(new Date());
    const existingWeek = scheduleHistory[todayWeek.id];

    if (existingWeek) {
      setCurrentWeek(existingWeek);
    } else {
      setCurrentWeek(todayWeek);
    }

    setScheduleWarnings([]);
  };

  // --- Publish Handlers ---

  const handlePublishSchedule = () => {
    const publishedWeek: WeeklySchedule = {
      ...currentWeek,
      status: 'Published',
      locked: publishWithLock
    };

    setCurrentWeek(publishedWeek);
    setScheduleHistory(prev => ({
      ...prev,
      [publishedWeek.id]: publishedWeek
    }));

    // Log the activity
    const entry = logSchedulePublished(getWeekLabel(publishedWeek), publishWithLock);
    setActivityLog(prev => [entry, ...prev]);

    setShowPublishModal(false);
    setPublishWithLock(false);
  };

  const handleUnpublishSchedule = () => {
    const draftWeek: WeeklySchedule = {
      ...currentWeek,
      status: 'Draft',
      locked: false
    };

    setCurrentWeek(draftWeek);
    setScheduleHistory(prev => ({
      ...prev,
      [draftWeek.id]: draftWeek
    }));

    // Log the activity
    const entry = logScheduleUnpublished(getWeekLabel(draftWeek));
    setActivityLog(prev => [entry, ...prev]);
  };

  const handleToggleLock = () => {
    const updatedWeek: WeeklySchedule = {
      ...currentWeek,
      locked: !currentWeek.locked
    };

    setCurrentWeek(updatedWeek);
    setScheduleHistory(prev => ({
      ...prev,
      [updatedWeek.id]: updatedWeek
    }));

    // Log the activity
    const entry = logScheduleLockToggle(getWeekLabel(updatedWeek), updatedWeek.locked);
    setActivityLog(prev => [entry, ...prev]);
  };

  // Check if editing is allowed
  const canEdit = !currentWeek.locked;

  const handleAutoSchedule = () => {
    setIsGenerating(true);
    try {
      const daysList: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

      // Build current assignments map for the algorithm
      const currentAssignmentsMap: Record<string, Record<string, { taskId: string | null; locked: boolean }>> = {};
      currentWeek.days.forEach((day, idx) => {
        currentAssignmentsMap[idx] = day.assignments;
      });

      const result = generateSmartSchedule({
        operators,
        tasks,
        days: daysList,
        currentAssignments: currentAssignmentsMap,
        rules: schedulingRules
      });

      if (result && result.assignments) {
        const newSchedule = { ...currentWeek };
        let assignmentCount = 0;

        result.assignments.forEach((assignment) => {
          const dayIndex = daysList.indexOf(assignment.day as WeekDay);
          if (dayIndex === -1) return;

          const currentAssignment = newSchedule.days[dayIndex].assignments[assignment.operatorId];
          if (currentAssignment && currentAssignment.locked) return;

          const task = tasks.find(t => t.id === assignment.taskId);
          if (task) {
            newSchedule.days[dayIndex].assignments[assignment.operatorId] = {
              taskId: task.id,
              locked: false
            };
            assignmentCount++;
          }
        });
        setCurrentWeek(newSchedule);
        setScheduleWarnings(result.warnings);

        // Log the activity
        if (assignmentCount > 0) {
          const entry = logScheduleGenerated(getWeekLabel(newSchedule), assignmentCount);
          setActivityLog(prev => [entry, ...prev]);
        }
      }
    } catch (e) {
      console.error("Scheduling error:", e);
      alert("Failed to generate schedule. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Render Helpers ---

  const getTaskStyle = (taskId: string | null) => {
    if (!taskId) return {};
    const task = tasks.find(t => t.id === taskId);
    if (!task) return {};

    if (theme === 'Midnight') {
      return {
        backgroundColor: 'transparent',
        color: task.textColor === '#000000' ? '#e2e8f0' : task.color, // Adjust dark text
        border: `1px solid ${task.color}50`,
        borderRadius: '6px'
      };
    }

    if (theme === 'Minimal') {
       return {
         backgroundColor: task.color + '20', // Low opacity
         color: task.color === '#ffffff' ? '#333' : '#000', // Ensure readability
         borderLeft: `4px solid ${task.color}`,
         borderRadius: '4px'
       }
    }

    if (theme === 'Executive') {
      return {
        backgroundColor: task.color,
        color: task.textColor,
        borderRadius: '2px',
        fontSize: '11px',
        fontWeight: '600'
      }
    }

    // Modern (Default)
    return {
      backgroundColor: task.color,
      color: task.textColor,
      boxShadow: `0 2px 4px ${task.color}40`,
      border: `1px solid ${task.color}20`
    };
  };

  const getTaskName = (taskId: string | null) => {
    if (!taskId) return '';
    return tasks.find(t => t.id === taskId)?.name || '';
  };

  // --- Components ---

  const TopNavigation = () => (
    <div className="bg-slate-900 text-white h-14 flex items-center px-6 shadow-md z-30 justify-between shrink-0">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-blue-500 rounded-sm flex items-center justify-center font-bold text-xs">
              <Box className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">Lord of the Bins <span className="text-slate-400 font-normal">| Enterprise</span></span>
        </div>
        <nav className="flex items-center h-14 hidden md:flex">
           {['dashboard', 'schedule', 'team', 'settings'].map(tab => (
             <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-full px-4 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab 
                  ? 'border-blue-500 text-white bg-slate-800' 
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
             >
               {tab}
             </button>
           ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-400">
         <span className="hidden sm:inline">Week 50</span>
         <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
         <span className="flex items-center gap-2">
           <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">A</div>
           <span className="hidden sm:inline">Admin</span>
         </span>
      </div>
    </div>
  );

  const ThemeSwitcher = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {isOpen && (
          <div className={`mb-2 p-2 rounded-xl shadow-xl border flex flex-col gap-1 min-w-[160px] animate-in slide-in-from-bottom-5 duration-200 ${theme === 'Midnight' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>Select Theme</span>
             {[
               { id: 'Modern', icon: Layout, label: 'Modern UI' },
               { id: 'Executive', icon: Monitor, label: 'Executive' },
               { id: 'Midnight', icon: Moon, label: 'Dark Mode' },
               { id: 'Minimal', icon: Grid, label: 'Minimal' }
             ].map((t) => (
               <button
                 key={t.id}
                 onClick={() => { setTheme(t.id as Theme); setIsOpen(false); }}
                 className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                   theme === t.id 
                     ? (theme === 'Midnight' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-50 text-blue-600')
                     : (theme === 'Midnight' ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-50')
                 }`}
               >
                 <t.icon className="h-4 w-4" />
                 {t.label}
               </button>
             ))}
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 ${
             theme === 'Midnight' 
               ? 'bg-slate-800 text-white border border-slate-700' 
               : 'bg-slate-900 text-white'
          }`}
        >
          <Palette className="h-5 w-5" />
        </button>
      </div>
    )
  }

  // --- Views ---

  const renderDashboardView = () => (
    <div className="max-w-7xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Hero / Ops Center Header */}
      <div className={`rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-end md:items-center gap-6 ${theme === 'Midnight' ? 'bg-slate-900 border border-slate-800' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl'}`}>
         
         {/* Background Decoration */}
         <div className={`absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>
         
         <div className="relative z-10">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${theme === 'Midnight' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-white/20 text-white border border-white/20'}`}>
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               Live Operations
            </div>
            <h1 className={`text-4xl font-extrabold tracking-tight mb-2 ${theme === 'Midnight' ? 'text-white' : 'text-white'}`}>
              {(() => {
                const hour = new Date().getHours();
                const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
                // TODO: Replace with actual logged-in user name when auth is implemented
                return `${greeting}, Natalia`;
              })()}
            </h1>
            <p className={`max-w-xl text-lg ${theme === 'Midnight' ? 'text-slate-400' : 'text-blue-100'}`}>
              {stats.sickCount + stats.leaveCount > 0 ? (
                <>You have <span className="font-bold">{stats.sickCount + stats.leaveCount} staff unavailable</span> and </>
              ) : null}
              <span className="font-bold">{stats.openSlots} open slots</span> for {getWeekLabel(currentWeek)}.
            </p>
         </div>

         <div className="relative z-10 flex gap-3">
             <button className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-transform active:scale-95 ${theme === 'Midnight' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white text-blue-600 shadow-lg'}`} onClick={() => setActiveTab('schedule')}>
                <Calendar className="h-5 w-5" />
                View Schedule
             </button>
             <button className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 backdrop-blur-sm transition-colors ${theme === 'Midnight' ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-blue-700/50 text-white hover:bg-blue-700/70'}`}>
                <Plus className="h-5 w-5" />
                Quick Add
             </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* 2. Main Stats Column */}
         <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               {[
                 { label: 'Active Staff', val: stats.activeCount, icon: Users, color: 'text-blue-500' },
                 { label: 'Fill Rate', val: `${stats.coverage}%`, icon: Activity, color: 'text-green-500' },
                 { label: 'Open Slots', val: stats.openSlots, icon: AlertCircle, color: 'text-amber-500' },
                 { label: 'On Leave/Sick', val: stats.sickCount + stats.leaveCount, icon: AlertTriangle, color: 'text-red-500' },
               ].map((stat, i) => (
                 <div key={i} className={`p-5 flex flex-col justify-between h-32 ${styles.card}`}>
                    <div className="flex justify-between items-start">
                       <p className={`text-xs font-bold uppercase tracking-wider ${styles.muted}`}>{stat.label}</p>
                       <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <p className={`text-3xl font-bold ${styles.text}`}>{stat.val}</p>
                 </div>
               ))}
            </div>

            {/* Visual Charts */}
            <div className={`p-8 ${styles.card}`}>
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className={`text-lg font-bold ${styles.text}`}>Workforce Composition</h3>
                    <p className={`text-sm ${styles.muted}`}>Breakdown of current operational roles.</p>
                  </div>
                  <button className={`p-2 rounded-lg ${theme === 'Midnight' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}>
                     <MoreHorizontal className="h-5 w-5 text-gray-400" />
                  </button>
               </div>

               {(() => {
                  const regularPct = stats.totalOperators > 0 ? Math.round((stats.regularCount / stats.totalOperators) * 100) : 0;
                  const flexPct = stats.totalOperators > 0 ? Math.round((stats.flexCount / stats.totalOperators) * 100) : 0;
                  const coordPct = stats.totalOperators > 0 ? Math.round((stats.coordinatorCount / stats.totalOperators) * 100) : 0;
                  const regularEnd = regularPct;
                  const flexEnd = regularEnd + flexPct;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                      {/* CSS Donut Chart */}
                      <div className="flex justify-center relative">
                         <div className={`w-48 h-48 rounded-full border-[16px] relative flex items-center justify-center ${theme === 'Midnight' ? 'border-slate-800' : 'border-gray-100'}`}
                              style={{
                                background: `conic-gradient(
                                  ${theme === 'Midnight' ? '#6366f1' : '#3b82f6'} 0% ${regularEnd}%,
                                  ${theme === 'Midnight' ? '#a855f7' : '#a855f7'} ${regularEnd}% ${flexEnd}%,
                                  ${theme === 'Midnight' ? '#10b981' : '#10b981'} ${flexEnd}% 100%
                                )`
                              }}
                         >
                            <div className={`absolute inset-2 rounded-full flex flex-col items-center justify-center ${theme === 'Midnight' ? 'bg-slate-900' : 'bg-white'}`}>
                               <span className={`text-3xl font-bold ${styles.text}`}>{stats.totalOperators}</span>
                               <span className="text-xs text-gray-400 uppercase tracking-widest">Staff</span>
                            </div>
                         </div>
                      </div>

                      {/* Legend */}
                      <div className="space-y-4">
                         {[
                           { label: 'Regular', count: stats.regularCount, pct: `${regularPct}%`, color: theme === 'Midnight' ? 'bg-indigo-500' : 'bg-blue-500', val: regularPct },
                           { label: 'Flex', count: stats.flexCount, pct: `${flexPct}%`, color: 'bg-purple-500', val: flexPct },
                           { label: 'Coordinators', count: stats.coordinatorCount, pct: `${coordPct}%`, color: 'bg-emerald-500', val: coordPct },
                         ].map((item, i) => (
                           <div key={i}>
                              <div className="flex justify-between text-sm mb-1 font-medium">
                                 <span className={`flex items-center gap-2 ${styles.text}`}>
                                   <span className={`w-3 h-3 rounded-full ${item.color}`}></span>
                                   {item.label} ({item.count})
                                 </span>
                                 <span className={styles.muted}>{item.pct}</span>
                              </div>
                              <div className={`h-2 w-full rounded-full ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-100'}`}>
                                 <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.val}%` }}></div>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  );
               })()}
            </div>
         </div>

         {/* 3. Feed / Notifications Column */}
         <div className="space-y-6">
            <div className={`h-full flex flex-col ${styles.card}`}>
               <div className={`p-6 ${styles.cardHeader}`}>
                  <h3 className={`font-bold ${styles.text}`}>Recent Activity</h3>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[400px]">
                  {activityLog.length === 0 ? (
                    <div className={`text-center py-8 ${styles.muted}`}>
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No recent activity</p>
                      <p className="text-xs mt-1">Actions will appear here as you work</p>
                    </div>
                  ) : (
                    activityLog.slice(0, 10).map((entry, i) => {
                      // Map activity types to icons
                      const getIcon = () => {
                        switch (entry.type) {
                          case 'schedule_generated': return Sparkles;
                          case 'schedule_published':
                          case 'schedule_unpublished': return Send;
                          case 'schedule_locked':
                          case 'schedule_unlocked': return Lock;
                          case 'assignment_changed': return ArrowRight;
                          case 'operator_added':
                          case 'operator_updated':
                          case 'operator_status_changed': return UserCheck;
                          default: return Bell;
                        }
                      };
                      const Icon = getIcon();

                      return (
                        <div key={entry.id} className="flex gap-4 relative">
                           {i !== Math.min(activityLog.length - 1, 9) && (
                             <div className={`absolute left-4 top-8 bottom-[-24px] w-0.5 ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-100'}`}></div>
                           )}
                           <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 ${theme === 'Midnight' ? 'bg-slate-800 text-indigo-400' : 'bg-blue-50 text-blue-600'}`}>
                              <Icon className="h-4 w-4" />
                           </div>
                           <div>
                              <p className={`text-sm ${styles.text}`}>
                                {entry.description}
                              </p>
                              <span className="text-xs text-gray-400 mt-1 block">{getRelativeTime(entry.timestamp)}</span>
                           </div>
                        </div>
                      );
                    })
                  )}
               </div>
               {activityLog.length > 10 && (
                 <div className="p-4 border-t border-gray-100/10">
                    <button className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${styles.secondaryBtn}`}>
                       View All ({activityLog.length} entries)
                    </button>
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );

  const renderTeamView = () => {
    // Filter Logic with Search
    const filteredOperators = operators.filter(op => {
      const matchRole = teamFilter === 'All' || op.type === teamFilter;
      const matchStatus = statusFilter === 'All' || op.status === statusFilter;

      // Search filter - matches name, skills, or current assignments
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchName = op.name.toLowerCase().includes(query);
        const matchSkills = op.skills.some(skill => skill.toLowerCase().includes(query));
        const matchType = op.type.toLowerCase().includes(query);
        const matchStatus2 = op.status.toLowerCase().includes(query);

        // Check if operator has any assignment matching the query in current week
        const matchAssignment = currentWeek.days.some(day => {
          const assignment = day.assignments[op.id];
          if (assignment?.taskId) {
            const task = tasks.find(t => t.id === assignment.taskId);
            return task?.name.toLowerCase().includes(query);
          }
          return false;
        });

        if (!matchName && !matchSkills && !matchType && !matchStatus2 && !matchAssignment) {
          return false;
        }
      }

      return matchRole && matchStatus;
    });

    return (
      <div className="max-w-7xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
         
         {/* 1. Stats Ribbon */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Headcount', val: operators.length, sub: 'Active', icon: Users, color: 'text-blue-500' },
              { label: 'Certified Trainers', val: operators.filter(o => o.skills.includes('Trainer')).length, sub: 'Available', icon: Award, color: 'text-amber-500' },
              { label: 'Flex Ratio', val: '24%', sub: 'Target: 20%', icon: TrendingUp, color: 'text-purple-500' },
              { label: 'On Leave', val: operators.filter(o => o.status === 'Leave').length, sub: 'This Week', icon: Calendar, color: 'text-red-500' },
            ].map((stat, i) => (
              <div key={i} className={`p-4 flex items-center gap-4 ${styles.card}`}>
                 <div className={`p-3 rounded-xl ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-50'}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                 </div>
                 <div>
                    <p className={`text-2xl font-bold ${styles.text}`}>{stat.val}</p>
                    <p className={`text-xs uppercase font-bold tracking-wider ${styles.muted}`}>{stat.label}</p>
                 </div>
              </div>
            ))}
         </div>

         {/* 2. Controls Toolbar */}
         <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
               <div className={`flex p-1 rounded-xl border ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  {['All', 'Regular', 'Flex', 'Coordinator'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setTeamFilter(f as any)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        teamFilter === f 
                          ? (theme === 'Midnight' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-white shadow-md')
                          : (theme === 'Midnight' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-slate-900')
                      }`}
                    >
                      {f}
                    </button>
                  ))}
               </div>
               
               {/* Status Filter */}
               <div className={`flex items-center gap-2 p-1 rounded-xl border px-3 ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <span className={`text-xs font-bold uppercase tracking-wide mr-1 ${styles.muted}`}>Status:</span>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className={`bg-transparent text-sm font-semibold outline-none ${styles.text}`}
                  >
                     <option value="All">All Statuses</option>
                     <option value="Active">Active</option>
                     <option value="Sick">Sick</option>
                     <option value="Leave">On Leave</option>
                  </select>
               </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
               {/* View Toggle */}
               <div className={`flex p-1 rounded-xl border ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  {[
                    { id: 'cards', icon: Grid, title: 'Card View' },
                    { id: 'table', icon: List, title: 'Table View' },
                    { id: 'matrix', icon: Grid3X3, title: 'Skills Matrix' },
                  ].map(view => (
                    <button
                      key={view.id}
                      onClick={() => setTeamViewMode(view.id as any)}
                      title={view.title}
                      className={`p-2 rounded-lg transition-all ${
                        teamViewMode === view.id
                          ? (theme === 'Midnight' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white')
                          : (theme === 'Midnight' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50')
                      }`}
                    >
                      <view.icon className="h-4 w-4" />
                    </button>
                  ))}
               </div>

               <div className="relative flex-1 md:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                   <input
                     ref={searchInputRef}
                     type="text"
                     placeholder="Search... (⌘K)"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm outline-none transition-all ${theme === 'Midnight' ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'}`}
                   />
                   {searchQuery && (
                     <button
                       onClick={() => setSearchQuery('')}
                       className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}
                     >
                       ×
                     </button>
                   )}
               </div>
               <button 
                onClick={() => {
                  setEditingOperator(null);
                  setIsOperatorModalOpen(true);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 font-bold transition-all active:scale-95 ${styles.primaryBtn}`}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Member</span>
              </button>
            </div>
         </div>

         {/* Search Results Info */}
         {searchQuery && (
           <div className={`flex items-center gap-2 text-sm ${styles.muted}`}>
             <Search className="h-4 w-4" />
             <span>
               {filteredOperators.length === 0
                 ? `No results for "${searchQuery}"`
                 : `${filteredOperators.length} result${filteredOperators.length !== 1 ? 's' : ''} for "${searchQuery}"`
               }
             </span>
             <button
               onClick={() => setSearchQuery('')}
               className={`ml-2 text-xs px-2 py-1 rounded-lg ${theme === 'Midnight' ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
             >
               Clear
             </button>
           </div>
         )}

         {/* 3. The Views */}
         {filteredOperators.length === 0 ? (
           <div className={`text-center py-16 ${styles.card}`}>
             <Users className={`h-12 w-12 mx-auto mb-4 ${styles.muted} opacity-30`} />
             <h3 className={`text-lg font-semibold mb-2 ${styles.text}`}>No team members found</h3>
             <p className={`text-sm ${styles.muted}`}>
               {searchQuery
                 ? `Try adjusting your search or filters`
                 : `No operators match the current filters`
               }
             </p>
           </div>
         ) : teamViewMode === 'cards' ? (
           /* CARD VIEW */
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredOperators.map((op) => (
              <div key={op.id} className={`group relative flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden ${styles.card}`}>
                 {/* Top Status Bar */}
                 <div className={`h-1.5 w-full ${op.status === 'Active' ? 'bg-emerald-500' : op.status === 'Sick' ? 'bg-red-500' : 'bg-amber-500'}`} />

                 <div className="p-5 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                          <div className={`relative h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm ${
                            theme === 'Midnight' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white border border-gray-100 text-gray-700 shadow-inner'
                          }`}>
                             {op.name.charAt(0)}
                             {/* Status Dot */}
                             <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${theme === 'Midnight' ? 'border-slate-900' : 'border-white'} ${op.status === 'Active' ? 'bg-emerald-500' : op.status === 'Sick' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                          </div>
                          <div>
                             <h3 className={`font-bold text-lg leading-tight ${styles.text}`}>{op.name}</h3>
                             <p className={`text-xs font-medium uppercase tracking-wide mt-1 ${op.type === 'Coordinator' ? 'text-emerald-500' : op.type === 'Flex' ? 'text-purple-500' : styles.muted}`}>
                               {op.type}
                             </p>
                          </div>
                       </div>
                       <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenOperatorMenu(openOperatorMenu === op.id ? null : op.id);
                            }}
                            title="More actions"
                            className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'Midnight' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-400'}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {/* Dropdown Menu */}
                          {openOperatorMenu === op.id && (
                            <div
                              className={`absolute right-0 top-full mt-1 w-44 z-50 rounded-xl shadow-xl border overflow-hidden ${
                                theme === 'Midnight'
                                  ? 'bg-slate-900 border-slate-700'
                                  : 'bg-white border-gray-200'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setEditingOperator(op);
                                  setIsOperatorModalOpen(true);
                                  setOpenOperatorMenu(null);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                  theme === 'Midnight'
                                    ? 'text-slate-300 hover:bg-slate-800'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <Edit2 className="h-4 w-4" />
                                Edit Profile
                              </button>
                              <div className={`border-t ${theme === 'Midnight' ? 'border-slate-800' : 'border-gray-100'}`}>
                                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>
                                  Set Status
                                </div>
                                {(['Active', 'Sick', 'Leave'] as const).map(status => (
                                  <button
                                    key={status}
                                    onClick={() => {
                                      setOperators(prev => prev.map(o =>
                                        o.id === op.id ? { ...o, status } : o
                                      ));
                                      setOpenOperatorMenu(null);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                      theme === 'Midnight'
                                        ? 'text-slate-300 hover:bg-slate-800'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${
                                      status === 'Active' ? 'bg-emerald-500' :
                                      status === 'Sick' ? 'bg-red-500' : 'bg-amber-500'
                                    }`} />
                                    {status}
                                    {op.status === status && (
                                      <Check className="h-3 w-3 ml-auto text-emerald-500" />
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className={`border-t ${theme === 'Midnight' ? 'border-slate-800' : 'border-gray-100'}`}>
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete ${op.name}? This cannot be undone.`)) {
                                      setOperators(prev => prev.filter(o => o.id !== op.id));
                                    }
                                    setOpenOperatorMenu(null);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                    theme === 'Midnight'
                                      ? 'text-red-400 hover:bg-red-500/10'
                                      : 'text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete Operator
                                </button>
                              </div>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Quick Availability Viz */}
                    <div className="mb-4">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Availability</span>
                       </div>
                       <div className="flex gap-1">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => {
                             const isAvailable = op.availability && op.availability[d as WeekDay];
                             return (
                             <div key={d} className={`h-1.5 flex-1 rounded-full ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-100'}`}>
                                <div className={`h-full rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: '100%' }}></div>
                             </div>
                          )})}
                       </div>
                    </div>

                    {/* Skills Tags */}
                    <div className="flex-1 content-start">
                       <div className="flex flex-wrap gap-1.5">
                          {op.skills.slice(0, 5).map(skill => (
                             <span key={skill} className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border ${
                               theme === 'Midnight'
                                 ? 'bg-slate-900 border-slate-700 text-slate-400'
                                 : 'bg-white border-gray-200 text-gray-600'
                             }`}>
                                {skill}
                             </span>
                          ))}
                          {op.skills.length > 5 && (
                             <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${theme === 'Midnight' ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-500'}`}>
                               +{op.skills.length - 5}
                             </span>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Footer */}
                 <div className={`px-5 py-3 border-t flex items-center justify-between ${styles.cardHeader}`}>
                    <span className={`text-xs font-medium ${styles.muted}`}>ID: #{op.id.substring(0,4)}</span>
                    <span className={`text-xs font-medium ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>
                       {op.skills.length} skill{op.skills.length !== 1 ? 's' : ''}
                    </span>
                 </div>
              </div>
            ))}
           </div>
         ) : teamViewMode === 'table' ? (
           /* TABLE VIEW */
           <div className={`overflow-hidden ${styles.card}`}>
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead>
                   <tr className={theme === 'Midnight' ? 'bg-slate-800/50' : 'bg-gray-50'}>
                     <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${styles.muted}`}>Name</th>
                     <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${styles.muted}`}>Type</th>
                     <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${styles.muted}`}>Status</th>
                     <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${styles.muted}`}>Availability</th>
                     <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${styles.muted}`}>Skills</th>
                     <th className={`px-4 py-3 text-right text-xs font-bold uppercase tracking-wider ${styles.muted}`}>Actions</th>
                   </tr>
                 </thead>
                 <tbody className={`divide-y ${theme === 'Midnight' ? 'divide-slate-800' : 'divide-gray-100'}`}>
                   {filteredOperators.map((op) => (
                     <tr key={op.id} className={`group transition-colors ${theme === 'Midnight' ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50'}`}>
                       <td className="px-4 py-3">
                         <div className="flex items-center gap-3">
                           <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                             theme === 'Midnight' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700'
                           }`}>
                             {op.name.charAt(0)}
                           </div>
                           <span className={`font-semibold ${styles.text}`}>{op.name}</span>
                         </div>
                       </td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                           op.type === 'Coordinator' ? 'bg-emerald-100 text-emerald-700' :
                           op.type === 'Flex' ? 'bg-purple-100 text-purple-700' :
                           theme === 'Midnight' ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                         }`}>
                           {op.type}
                         </span>
                       </td>
                       <td className="px-4 py-3">
                         <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded-md ${
                           op.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                           op.status === 'Sick' ? 'bg-red-100 text-red-700' :
                           'bg-amber-100 text-amber-700'
                         }`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${
                             op.status === 'Active' ? 'bg-emerald-500' :
                             op.status === 'Sick' ? 'bg-red-500' : 'bg-amber-500'
                           }`} />
                           {op.status}
                         </span>
                       </td>
                       <td className="px-4 py-3">
                         <div className="flex gap-1">
                           {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
                             <div
                               key={d}
                               title={d}
                               className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                                 op.availability?.[d as WeekDay]
                                   ? 'bg-emerald-100 text-emerald-700'
                                   : theme === 'Midnight' ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-400'
                               }`}
                             >
                               {d.charAt(0)}
                             </div>
                           ))}
                         </div>
                       </td>
                       <td className="px-4 py-3">
                         <div className="flex flex-wrap gap-1 max-w-xs">
                           {op.skills.slice(0, 3).map(skill => (
                             <span key={skill} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                               theme === 'Midnight' ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-600'
                             }`}>
                               {skill}
                             </span>
                           ))}
                           {op.skills.length > 3 && (
                             <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                               theme === 'Midnight' ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-500'
                             }`}>
                               +{op.skills.length - 3}
                             </span>
                           )}
                         </div>
                       </td>
                       <td className="px-4 py-3 text-right">
                         <div className="relative inline-block">
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               setOpenOperatorMenu(openOperatorMenu === `table-${op.id}` ? null : `table-${op.id}`);
                             }}
                             className={`p-2 rounded-lg transition-colors ${
                               theme === 'Midnight'
                                 ? 'hover:bg-slate-800 text-slate-400'
                                 : 'hover:bg-gray-100 text-gray-400'
                             }`}
                           >
                             <MoreHorizontal className="h-4 w-4" />
                           </button>
                           {openOperatorMenu === `table-${op.id}` && (
                             <div
                               className={`absolute right-0 top-full mt-1 w-44 z-50 rounded-xl shadow-xl border overflow-hidden ${
                                 theme === 'Midnight'
                                   ? 'bg-slate-900 border-slate-700'
                                   : 'bg-white border-gray-200'
                               }`}
                               onClick={(e) => e.stopPropagation()}
                             >
                               <button
                                 onClick={() => {
                                   setEditingOperator(op);
                                   setIsOperatorModalOpen(true);
                                   setOpenOperatorMenu(null);
                                 }}
                                 className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                   theme === 'Midnight'
                                     ? 'text-slate-300 hover:bg-slate-800'
                                     : 'text-gray-700 hover:bg-gray-50'
                                 }`}
                               >
                                 <Edit2 className="h-4 w-4" />
                                 Edit Profile
                               </button>
                               <div className={`border-t ${theme === 'Midnight' ? 'border-slate-800' : 'border-gray-100'}`}>
                                 <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>
                                   Set Status
                                 </div>
                                 {(['Active', 'Sick', 'Leave'] as const).map(status => (
                                   <button
                                     key={status}
                                     onClick={() => {
                                       setOperators(prev => prev.map(o =>
                                         o.id === op.id ? { ...o, status } : o
                                       ));
                                       setOpenOperatorMenu(null);
                                     }}
                                     className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                       theme === 'Midnight'
                                         ? 'text-slate-300 hover:bg-slate-800'
                                         : 'text-gray-700 hover:bg-gray-50'
                                     }`}
                                   >
                                     <div className={`w-2 h-2 rounded-full ${
                                       status === 'Active' ? 'bg-emerald-500' :
                                       status === 'Sick' ? 'bg-red-500' : 'bg-amber-500'
                                     }`} />
                                     {status}
                                     {op.status === status && (
                                       <Check className="h-3 w-3 ml-auto text-emerald-500" />
                                     )}
                                   </button>
                                 ))}
                               </div>
                               <div className={`border-t ${theme === 'Midnight' ? 'border-slate-800' : 'border-gray-100'}`}>
                                 <button
                                   onClick={() => {
                                     if (confirm(`Delete ${op.name}? This cannot be undone.`)) {
                                       setOperators(prev => prev.filter(o => o.id !== op.id));
                                     }
                                     setOpenOperatorMenu(null);
                                   }}
                                   className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                                     theme === 'Midnight'
                                       ? 'text-red-400 hover:bg-red-500/10'
                                       : 'text-red-600 hover:bg-red-50'
                                   }`}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                   Delete Operator
                                 </button>
                               </div>
                             </div>
                           )}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
         ) : (
           /* SKILLS MATRIX VIEW */
           <div className={`overflow-hidden ${styles.card}`}>
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead>
                   <tr className={theme === 'Midnight' ? 'bg-slate-800/50' : 'bg-gray-50'}>
                     <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider sticky left-0 z-10 ${
                       theme === 'Midnight' ? 'bg-slate-800/90' : 'bg-gray-50'
                     } ${styles.muted}`}>
                       Operator
                     </th>
                     {INITIAL_SKILLS.filter(s => !['Process', 'People', 'Off Process', 'Process/AD'].includes(s)).map(skill => (
                       <th key={skill} className={`px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${styles.muted}`}>
                         <div className="writing-mode-vertical transform -rotate-45 origin-bottom-left whitespace-nowrap h-20 flex items-end">
                           {skill}
                         </div>
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className={`divide-y ${theme === 'Midnight' ? 'divide-slate-800' : 'divide-gray-100'}`}>
                   {filteredOperators.filter(op => op.type !== 'Coordinator').map((op) => (
                     <tr key={op.id} className={`group transition-colors ${theme === 'Midnight' ? 'hover:bg-slate-800/30' : 'hover:bg-gray-50'}`}>
                       <td className={`px-4 py-2 sticky left-0 z-10 ${
                         theme === 'Midnight' ? 'bg-slate-900/95' : 'bg-white/95'
                       }`}>
                         <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${
                             op.status === 'Active' ? 'bg-emerald-500' :
                             op.status === 'Sick' ? 'bg-red-500' : 'bg-amber-500'
                           }`} />
                           <span className={`font-medium text-sm ${styles.text}`}>{op.name}</span>
                           <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                             op.type === 'Flex' ? 'bg-purple-100 text-purple-700' :
                             theme === 'Midnight' ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'
                           }`}>
                             {op.type}
                           </span>
                         </div>
                       </td>
                       {INITIAL_SKILLS.filter(s => !['Process', 'People', 'Off Process', 'Process/AD'].includes(s)).map(skill => {
                         const hasSkill = op.skills.includes(skill);
                         return (
                           <td key={skill} className="px-2 py-2 text-center">
                             {hasSkill ? (
                               <div className="w-6 h-6 mx-auto rounded-md bg-emerald-500 flex items-center justify-center">
                                 <Check className="h-3.5 w-3.5 text-white" />
                               </div>
                             ) : (
                               <div className={`w-6 h-6 mx-auto rounded-md ${
                                 theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-100'
                               }`} />
                             )}
                           </td>
                         );
                       })}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             {/* Skills Coverage Summary */}
             <div className={`px-4 py-3 border-t ${theme === 'Midnight' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-100 bg-gray-50'}`}>
               <div className="flex flex-wrap gap-4">
                 {INITIAL_SKILLS.filter(s => !['Process', 'People', 'Off Process', 'Process/AD'].includes(s)).map(skill => {
                   const count = filteredOperators.filter(op => op.type !== 'Coordinator' && op.skills.includes(skill)).length;
                   const total = filteredOperators.filter(op => op.type !== 'Coordinator').length;
                   const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                   return (
                     <div key={skill} className="text-xs">
                       <span className={styles.muted}>{skill}:</span>
                       <span className={`ml-1 font-bold ${
                         percentage >= 50 ? 'text-emerald-500' :
                         percentage >= 25 ? 'text-amber-500' : 'text-red-500'
                       }`}>
                         {count}/{total}
                       </span>
                     </div>
                   );
                 })}
               </div>
             </div>
           </div>
         )}
      </div>
    );
  };

  const renderSettingsView = () => (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-in fade-in duration-500">
      
      <div className="mb-6">
        <h1 className={`text-3xl font-extrabold tracking-tight ${styles.text}`}>Settings</h1>
        <p className={`text-sm mt-2 ${theme === 'Midnight' ? 'text-slate-400' : 'text-gray-500'}`}>
          System configuration and AI behavioral tuning.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Settings Sidebar */}
        <div className={`w-full lg:w-64 shrink-0 rounded-2xl p-2 border flex flex-col gap-1 ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
           {[
             { id: 'tasks', label: 'Task Definitions', icon: Sliders },
             { id: 'automation', label: 'Scheduling Rules', icon: Sliders },
             { id: 'integrations', label: 'Integrations', icon: Puzzle },
           ].map((item) => (
             <button
               key={item.id}
               onClick={() => setSettingsTab(item.id as any)}
               className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                 settingsTab === item.id
                   ? (theme === 'Midnight' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-blue-600 text-white shadow-md')
                   : (theme === 'Midnight' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')
               }`}
             >
               <item.icon className="h-4 w-4" />
               {item.label}
             </button>
           ))}
        </div>

        {/* Settings Content Panel */}
        <div className={`flex-1 w-full rounded-3xl p-6 lg:p-10 border min-h-[600px] ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm'}`}>
           
           {settingsTab === 'tasks' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center mb-6">
                     <div>
                       <h2 className={`text-xl font-bold ${styles.text}`}>Task Configuration</h2>
                       <p className={`text-sm ${styles.muted}`}>Define tasks, skills, and visual coding.</p>
                     </div>
                     <button
                        onClick={handleAddNewTask}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${theme === 'Midnight' ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                     >
                        <Plus className="h-4 w-4" /> New Task
                     </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => (
                       <div key={task.id} className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                          {/* Preview Pill */}
                          <div className="shrink-0 flex flex-col items-center gap-2">
                             <span className="text-[10px] uppercase font-bold text-gray-400">Preview</span>
                             <div 
                                className="w-16 h-12 rounded-lg flex items-center justify-center text-[10px] font-bold text-center p-1 shadow-sm"
                                style={getTaskStyle(task.id)}
                             >
                                {task.name}
                             </div>
                          </div>

                          {/* Controls */}
                          <div className="flex-1 space-y-3">
                             <div className="flex items-center gap-2">
                                <div className="relative overflow-hidden w-6 h-6 rounded-full shadow-inner ring-1 ring-black/5 cursor-pointer hover:scale-110 transition-transform">
                                   <input 
                                      type="color" 
                                      value={task.color} 
                                      onChange={(e) => setTasks(tasks.map(t => t.id === task.id ? {...t, color: e.target.value} : t))}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                   />
                                   <div className="w-full h-full" style={{ backgroundColor: task.color }} />
                                </div>
                                <input 
                                   type="text" 
                                   value={task.name}
                                   onChange={(e) => setTasks(tasks.map(t => t.id === task.id ? {...t, name: e.target.value} : t))}
                                   className={`flex-1 bg-transparent text-sm font-bold outline-none border-b border-transparent focus:border-indigo-500 ${styles.text}`}
                                />
                             </div>
                             
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase">Req. Skill:</span>
                                <select
                                   value={task.requiredSkill}
                                   onChange={(e) => setTasks(tasks.map(t => t.id === task.id ? {...t, requiredSkill: e.target.value} : t))}
                                   className={`text-xs font-medium bg-transparent outline-none cursor-pointer hover:underline ${theme === 'Midnight' ? 'text-indigo-400' : 'text-blue-600'}`}
                                >
                                   {INITIAL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                             </div>

                             {/* Required Operators Control */}
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase">Operators:</span>
                                <div className="flex items-center gap-1">
                                   <button
                                      onClick={() => handleUpdateTaskRequiredOperators(task.id, (typeof task.requiredOperators === 'number' ? task.requiredOperators : 1) - 1)}
                                      className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${theme === 'Midnight' ? 'bg-slate-900 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                   >-</button>
                                   <span className={`w-5 text-center text-xs font-bold ${theme === 'Midnight' ? 'text-indigo-400' : 'text-blue-600'}`}>
                                      {typeof task.requiredOperators === 'number' ? task.requiredOperators : 1}
                                   </span>
                                   <button
                                      onClick={() => handleUpdateTaskRequiredOperators(task.id, (typeof task.requiredOperators === 'number' ? task.requiredOperators : 1) + 1)}
                                      className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${theme === 'Midnight' ? 'bg-slate-900 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                   >+</button>
                                </div>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}
           
           {settingsTab === 'automation' && (
             <div className="max-w-2xl">
                <div className="mb-8 border-b pb-6 border-gray-100/10">
                   <h2 className={`text-xl font-bold mb-2 ${styles.text}`}>Scheduling Rules</h2>
                   <p className={`text-sm ${styles.muted}`}>
                     Control how the scheduling algorithm prioritizes and assigns shifts.
                   </p>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'autoAssignCoordinators', title: 'Auto-assign Team Coordinators (TC)', desc: 'Include coordinators in Smart Fill for Process, People, and Off-Process tasks.' },
                    { key: 'allowConsecutiveHeavyShifts', title: 'Allow consecutive "Heavy" shifts', desc: 'Operators can be assigned hard tasks (e.g. Troubleshooter, Exceptions) 2 days in a row.' },
                    { key: 'prioritizeFlexForExceptions', title: 'Prioritize Flex staff for "Exceptions"', desc: 'Fill Exceptions role with Flex staff first before assigning Regular staff.' },
                    { key: 'respectPreferredStations', title: 'Respect "Preferred" Stations', desc: 'Try to assign operators to their favorite spots based on historical data.' },
                    { key: 'strictSkillMatching', title: 'Strict Skill Matching', desc: 'Never assign a task if operator is missing the required skill.' },
                    { key: 'fairDistribution', title: 'Fair Distribution', desc: 'Spread heavy tasks (Troubleshooter, Exceptions) evenly across team members.' },
                    { key: 'balanceWorkload', title: 'Balance Workload', desc: 'Ensure similar shift counts per operator per week.' },
                  ].map((rule) => (
                     <div key={rule.key} className={`flex items-start justify-between p-5 rounded-2xl border transition-all ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="pr-8">
                           <h3 className={`font-bold text-base ${styles.text}`}>{rule.title}</h3>
                           <p className="text-sm text-gray-500 mt-1">{rule.desc}</p>
                        </div>
                        <div className="relative flex items-center shrink-0">
                           <input
                              type="checkbox"
                              checked={schedulingRules[rule.key as keyof SchedulingRules] as boolean}
                              onChange={(e) => setSchedulingRules(prev => ({ ...prev, [rule.key]: e.target.checked }))}
                              className="peer sr-only"
                              id={`rule-${rule.key}`}
                           />
                           <label
                              htmlFor={`rule-${rule.key}`}
                              className={`block w-14 h-8 rounded-full cursor-pointer transition-colors ${theme === 'Midnight' ? 'bg-slate-950 peer-checked:bg-indigo-500' : 'bg-gray-300 peer-checked:bg-blue-600'}`}
                           >
                              <span className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all peer-checked:left-7"></span>
                           </label>
                        </div>
                     </div>
                  ))}

                  {/* Max consecutive days setting */}
                  <div className={`flex items-start justify-between p-5 rounded-2xl border transition-all ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                     <div className="pr-8">
                        <h3 className={`font-bold text-base ${styles.text}`}>Max Consecutive Days on Same Task</h3>
                        <p className="text-sm text-gray-500 mt-1">Limit how many days in a row an operator can be assigned to the same task.</p>
                     </div>
                     <div className="flex items-center gap-2 shrink-0">
                        <button
                           onClick={() => setSchedulingRules(prev => ({ ...prev, maxConsecutiveDaysOnSameTask: Math.max(1, prev.maxConsecutiveDaysOnSameTask - 1) }))}
                           className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${theme === 'Midnight' ? 'bg-slate-900 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >-</button>
                        <span className={`w-8 text-center font-bold ${styles.text}`}>{schedulingRules.maxConsecutiveDaysOnSameTask}</span>
                        <button
                           onClick={() => setSchedulingRules(prev => ({ ...prev, maxConsecutiveDaysOnSameTask: Math.min(5, prev.maxConsecutiveDaysOnSameTask + 1) }))}
                           className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${theme === 'Midnight' ? 'bg-slate-900 text-slate-400 hover:bg-slate-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >+</button>
                     </div>
                  </div>
               </div>
             </div>
           )}

           {settingsTab === 'integrations' && (
              <div className="space-y-6">
                  <div className="mb-6">
                       <h2 className={`text-xl font-bold ${styles.text}`}>Connected Services</h2>
                       <p className={`text-sm ${styles.muted}`}>Manage third-party data synchronization.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { name: 'Slack', status: 'Connected', desc: 'Send daily roster updates to #warehouse-ops', icon: 'M4.3 0C1.9 0 0 1.9 0 4.3c0 2.4 1.9 4.3 4.3 4.3h4.3V4.3C8.6 1.9 6.7 0 4.3 0zm0 11.8C1.9 11.8 0 13.7 0 16.1s1.9 4.3 4.3 4.3h11.8v-4.3c0-2.4-1.9-4.3-4.3-4.3H4.3zm16.1 12.9c-2.4 0-4.3 1.9-4.3 4.3s1.9 4.3 4.3 4.3 4.3-1.9 4.3-4.3-1.9-4.3-4.3-4.3z' },
                        { name: 'Workday', status: 'Sync Error', desc: 'Import leave requests automatically', icon: 'M12 0L24 24H0L12 0Z' },
                      ].map((app, i) => (
                        <div key={i} className={`p-6 rounded-2xl border flex flex-col gap-4 ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                           <div className="flex justify-between items-start">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'Midnight' ? 'bg-slate-900' : 'bg-white shadow-sm'}`}>
                                 <Box className="h-6 w-6" /> 
                              </div>
                              <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                                 app.status === 'Connected' ? 'bg-emerald-500/10 text-emerald-500' :
                                 'bg-red-500/10 text-red-500'
                              }`}>{app.status}</span>
                           </div>
                           <div>
                              <h3 className={`font-bold text-lg ${styles.text}`}>{app.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{app.desc}</p>
                           </div>
                           <button className={`w-full py-3 rounded-xl text-xs font-bold border transition-colors ${theme === 'Midnight' ? 'border-slate-600 hover:bg-slate-700' : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm'}`}>
                              Manage Connection
                           </button>
                        </div>
                      ))}
                  </div>
              </div>
           )}

        </div>
      </div>
    </div>
  );

  const renderScheduleView = () => (
    <div className="flex flex-col h-full space-y-4 pb-20">
      
      {/* KPI Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        {[
          { icon: Users, label: 'Workforce', value: stats.totalOperators, color: theme === 'Midnight' ? 'text-indigo-400' : 'text-blue-600', bg: theme === 'Midnight' ? 'bg-indigo-500/10' : 'bg-blue-50' },
          { icon: CheckCircle2, label: 'Shift Coverage', value: `${stats.coverage}%`, color: theme === 'Midnight' ? 'text-emerald-400' : 'text-emerald-600', bg: theme === 'Midnight' ? 'bg-emerald-500/10' : 'bg-emerald-50' },
          { icon: Sparkles, label: 'Auto-Assigned', value: currentWeek.days.reduce((acc, d) => acc + (Object.values(d.assignments) as ScheduleAssignment[]).filter(a => !a.locked && a.taskId).length, 0), color: theme === 'Midnight' ? 'text-purple-400' : 'text-purple-600', bg: theme === 'Midnight' ? 'bg-purple-500/10' : 'bg-purple-50' }
        ].map((kpi, idx) => (
           <div key={idx} className={`${styles.card} p-4 flex items-center gap-4`}>
              <div className={`p-3 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="h-6 w-6" />
              </div>
              <div>
                <p className={`text-xs font-medium uppercase tracking-wide ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-500'}`}>{kpi.label}</p>
                <p className={`text-2xl font-bold ${styles.text}`}>{kpi.value}</p>
              </div>
           </div>
        ))}

        <div className={`p-4 rounded-xl shadow-lg flex flex-col justify-between text-white ${
          currentWeek.status === 'Published'
            ? (currentWeek.locked ? 'bg-gradient-to-br from-emerald-600 to-teal-600' : 'bg-gradient-to-br from-blue-600 to-cyan-600')
            : (theme === 'Midnight' ? 'bg-slate-800 border border-slate-700' : theme === 'Minimal' ? 'bg-stone-800' : 'bg-gradient-to-br from-indigo-600 to-blue-600')
        }`}>
          <div>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide mb-1">Schedule Status</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{currentWeek.status}</span>
              {currentWeek.locked && <Lock className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {currentWeek.status === 'Draft' ? (
              <button
                onClick={() => setShowPublishModal(true)}
                className="flex-1 py-1.5 px-3 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Send className="h-3 w-3" />
                Publish
              </button>
            ) : (
              <>
                <button
                  onClick={handleToggleLock}
                  className="flex-1 py-1.5 px-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  {currentWeek.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {currentWeek.locked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  onClick={handleUnpublishSchedule}
                  className="flex-1 py-1.5 px-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                >
                  Unpublish
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Conflict Warnings Panel */}
      {scheduleWarnings.length > 0 && (
        <div className={`rounded-xl border p-4 no-print ${theme === 'Midnight' ? 'bg-amber-900/20 border-amber-900/50' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`h-5 w-5 ${theme === 'Midnight' ? 'text-amber-400' : 'text-amber-600'}`} />
            <h3 className={`font-bold ${theme === 'Midnight' ? 'text-amber-400' : 'text-amber-800'}`}>
              Schedule Warnings ({scheduleWarnings.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {scheduleWarnings.map((warning, idx) => (
              <div key={idx} className={`flex items-start gap-2 text-sm ${theme === 'Midnight' ? 'text-amber-200' : 'text-amber-700'}`}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${
                  warning.type === 'skill_mismatch' ? 'bg-red-500/20 text-red-500' :
                  warning.type === 'availability_conflict' ? 'bg-orange-500/20 text-orange-500' :
                  warning.type === 'double_assignment' ? 'bg-purple-500/20 text-purple-500' :
                  warning.type === 'understaffed' ? 'bg-blue-500/20 text-blue-500' :
                  'bg-amber-500/20 text-amber-500'
                }`}>
                  {warning.type === 'skill_mismatch' ? '!' :
                   warning.type === 'availability_conflict' ? '⏰' :
                   warning.type === 'double_assignment' ? '2x' :
                   warning.type === 'understaffed' ? '-' : '⚠'}
                </span>
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid Card */}
      <div ref={scheduleGridRef} id="schedule-grid" className={`flex-1 flex flex-col ${styles.card} overflow-hidden`}>

        {/* Toolbar */}
        <div className={`px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print z-20 ${theme === 'Minimal' ? 'border-b border-stone-100' : theme === 'Midnight' ? 'border-b border-slate-800' : 'border-b border-gray-100'}`}>
           <div className="flex items-center gap-4">
             <h2 className={`font-bold text-lg ${styles.text}`}>Weekly Assignment</h2>
             <div className={`hidden sm:block h-4 w-px ${theme === 'Midnight' ? 'bg-slate-700' : 'bg-gray-300'}`}></div>

             {/* Week Navigation */}
             <div className="flex items-center gap-2">
               <button
                 onClick={() => handleWeekNavigation('prev')}
                 className={`p-1.5 rounded-lg transition-colors ${theme === 'Midnight' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
               >
                 <ChevronLeft className="h-5 w-5" />
               </button>

               <div className={`flex flex-col items-center min-w-[120px] ${theme === 'Midnight' ? 'text-slate-300' : 'text-gray-700'}`}>
                 <span className="text-sm font-bold">{getWeekLabel(currentWeek)}</span>
                 <span className={`text-xs ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>
                   {getWeekRangeString(new Date(currentWeek.days[0].date))}
                 </span>
               </div>

               <button
                 onClick={() => handleWeekNavigation('next')}
                 className={`p-1.5 rounded-lg transition-colors ${theme === 'Midnight' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
               >
                 <ChevronRight className="h-5 w-5" />
               </button>

               {!isCurrentWeek(currentWeek) && (
                 <button
                   onClick={handleGoToCurrentWeek}
                   className={`ml-2 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                     theme === 'Midnight'
                       ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                       : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                   }`}
                 >
                   Today
                 </button>
               )}
             </div>

             {/* Lock indicator */}
             {currentWeek.locked && (
               <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                 theme === 'Midnight' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
               }`}>
                 <Lock className="h-3 w-3" />
                 Locked
               </div>
             )}
           </div>

           <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleAutoSchedule}
                disabled={isGenerating || currentWeek.locked}
                className={`group relative flex items-center justify-center gap-2 px-5 py-2.5 transition-all shadow-md hover:shadow-lg disabled:shadow-none overflow-hidden flex-1 sm:flex-initial ${styles.primaryBtn} disabled:opacity-50 disabled:cursor-not-allowed`}
                title={currentWeek.locked ? 'Unlock schedule to edit' : 'Auto-fill schedule'}
              >
                {isGenerating ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 opacity-90" />
                )}
                <span className="font-medium text-sm whitespace-nowrap">Smart Fill</span>
              </button>
              
              <button className={`p-2.5 transition-colors ${styles.secondaryBtn}`}>
                 <Filter className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className={`p-2.5 transition-colors ${styles.secondaryBtn}`}
                title="Export schedule"
              >
                 <Download className="h-5 w-5" />
              </button>
           </div>
        </div>

        {/* The Grid - Mobile Optimized */}
        <div className="flex-1 overflow-auto schedule-grid relative custom-scrollbar">
          {/* Mobile Scroll Hint */}
          <div className="lg:hidden absolute top-2 right-2 z-50 pointer-events-none opacity-50 bg-black/80 text-white px-2 py-1 text-[10px] rounded-full">
            Scroll →
          </div>

          <table className="w-full border-collapse min-w-[1000px]">
            <thead className={`sticky top-0 z-30 backdrop-blur-sm ${styles.gridHeader}`}>
              <tr>
                <th className={`p-4 text-left ${styles.cell} w-48 sm:w-64 sticky left-0 z-40 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${theme === 'Midnight' ? 'bg-slate-900/95' : theme === 'Minimal' ? 'bg-[#fffefb]/95' : 'bg-gray-50/95'}`}>
                  <div className="flex items-center gap-2">
                    <span>Operator</span>
                    <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${theme === 'Midnight' ? 'bg-slate-800 text-slate-400' : 'bg-gray-200/50 text-gray-400'}`}>{operators.length}</span>
                  </div>
                </th>
                {currentWeek.days.map((day, idx) => (
                  <th key={idx} className={`p-3 text-left min-w-[140px] ${styles.cell}`}>
                     <div className="flex flex-col">
                       <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>{day.dayOfWeek}</span>
                       <span className={`text-sm font-semibold ${styles.text}`}>{day.date.slice(5)}</span>
                     </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'Midnight' ? 'divide-slate-800' : 'divide-gray-50'}`}>
              {/* Regular Operators */}
              {operators.filter(op => op.type === 'Regular').map(op => (
                <tr key={op.id} className={`transition-colors group ${theme === 'Midnight' ? 'hover:bg-slate-800/30' : 'hover:bg-blue-50/30'}`}>
                  <td className={`p-3 sticky left-0 z-20 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${styles.cell} ${theme === 'Midnight' ? 'bg-slate-900 group-hover:bg-slate-800/50' : 'bg-white group-hover:bg-blue-50/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center border shadow-inner shrink-0 ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-200 text-gray-600'}`}>
                         <span className="text-sm font-bold">{op.name.charAt(0)}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-medium leading-none truncate ${styles.text}`}>{op.name}</span>
                        <span className={`text-[10px] mt-1 ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>{op.skills.length} skills</span>
                      </div>
                    </div>
                  </td>
                  {currentWeek.days.map((day, dayIdx) => {
                    const assignment = day.assignments[op.id];
                    const taskId = assignment?.taskId || null;
                    const isSelected = selectedCell?.opId === op.id && selectedCell?.dayIndex === dayIdx;
                    
                    return (
                      <td key={dayIdx} className={`p-2 relative h-16 align-top ${styles.cell}`}>
                        {isSelected ? (
                          // Popover Menu
                          <div className={`absolute top-2 left-2 z-50 shadow-xl ring-1 rounded-xl p-3 w-64 animate-in fade-in zoom-in-95 duration-100 origin-top-left ${theme === 'Midnight' ? 'bg-slate-800 ring-slate-700' : 'bg-white ring-black/5'}`}>
                             <div className={`flex justify-between items-center mb-2 pb-2 border-b ${theme === 'Midnight' ? 'border-slate-700' : 'border-gray-100'}`}>
                               <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Assign Task</span>
                               <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600">
                                 <MoreHorizontal className="h-4 w-4" />
                               </button>
                             </div>
                             
                             <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                               <button
                                  onClick={() => handleAssignmentChange(dayIdx, op.id, null)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-500 transition-colors flex items-center gap-2 group"
                               >
                                 <div className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-red-400" />
                                 Unassigned (Off)
                               </button>

                               {/* Available Tasks - operator has the skill */}
                               {(() => {
                                 const availableTasks = tasks.filter(t => op.skills.includes(t.requiredSkill));
                                 const unavailableTasks = tasks.filter(t => !op.skills.includes(t.requiredSkill));

                                 return (
                                   <>
                                     {availableTasks.length > 0 && (
                                       <>
                                         <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'Midnight' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                           Available ({availableTasks.length})
                                         </div>
                                         {availableTasks.map(task => (
                                           <button
                                             key={task.id}
                                             onClick={() => handleAssignmentChange(dayIdx, op.id, task.id)}
                                             className={`w-full flex items-center gap-3 text-left px-3 py-2 text-sm rounded-lg transition-all ${
                                               theme === 'Midnight' ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-50 text-gray-700'
                                             }`}
                                           >
                                             <div
                                              className="w-2.5 h-2.5 rounded-full shadow-sm"
                                              style={{ backgroundColor: task.color }}
                                             />
                                             <span className="font-medium truncate">{task.name}</span>
                                             <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto opacity-50" />
                                           </button>
                                         ))}
                                       </>
                                     )}

                                     {unavailableTasks.length > 0 && (
                                       <>
                                         <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider mt-2 ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>
                                           Missing Skill ({unavailableTasks.length})
                                         </div>
                                         {unavailableTasks.map(task => (
                                           <button
                                             key={task.id}
                                             onClick={() => handleAssignmentChange(dayIdx, op.id, task.id)}
                                             disabled
                                             className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm rounded-lg transition-all opacity-40 cursor-not-allowed grayscale"
                                           >
                                             <div
                                              className="w-2.5 h-2.5 rounded-full shadow-sm"
                                              style={{ backgroundColor: task.color }}
                                             />
                                             <span className="font-medium truncate">{task.name}</span>
                                             <AlertCircle className="w-3.5 h-3.5 text-red-400 ml-auto" />
                                           </button>
                                         ))}
                                       </>
                                     )}
                                   </>
                                 );
                               })()}
                             </div>
                          </div>
                        ) : (
                          // Task Pill
                          <button
                            onClick={() => setSelectedCell({ opId: op.id, dayIndex: dayIdx })}
                            style={getTaskStyle(taskId)}
                            className={`w-full h-full min-h-[44px] rounded-lg flex flex-col items-center justify-center p-1 transition-all duration-200 border ${
                              !taskId 
                                ? (theme === 'Midnight' 
                                   ? 'bg-transparent border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/30' 
                                   : 'bg-white border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30')
                                : 'hover:brightness-95 hover:shadow-md'
                            }`}
                          >
                            {taskId ? (
                              <span className="text-xs font-bold text-center leading-tight line-clamp-2">{getTaskName(taskId)}</span>
                            ) : (
                              <Plus className={`w-4 h-4 ${theme === 'Midnight' ? 'text-slate-700' : 'text-gray-300'}`} />
                            )}
                          </button>
                        )}
                        {isSelected && (
                          <div 
                            className="fixed inset-0 z-40 bg-transparent" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCell(null);
                            }}
                          ></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Flex Separator */}
              {operators.some(op => op.type === 'Flex') && (
                <tr>
                   <td colSpan={6} className={`py-3 px-4 sticky left-0 z-10 backdrop-blur-sm border-t border-b ${theme === 'Midnight' ? 'bg-slate-900/80 border-slate-800' : theme === 'Minimal' ? 'bg-[#fffefb]/80 border-stone-100' : 'bg-gray-50/80 border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                         <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${theme === 'Midnight' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>Flex Operators</span>
                         <div className={`h-px flex-1 ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                      </div>
                   </td>
                </tr>
              )}

              {/* Flex Operators */}
              {operators.filter(op => op.type === 'Flex').map(op => (
                <tr key={op.id} className={`transition-colors group ${theme === 'Midnight' ? 'hover:bg-purple-900/10' : 'hover:bg-purple-50/30'}`}>
                  <td className={`p-3 sticky left-0 z-20 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${styles.cell} ${theme === 'Midnight' ? 'bg-slate-900 group-hover:bg-purple-900/10' : 'bg-white group-hover:bg-purple-50/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center border shadow-inner shrink-0 ${theme === 'Midnight' ? 'bg-purple-900/30 border-purple-800 text-purple-300' : 'bg-purple-100 border-purple-200 text-purple-600'}`}>
                         <span className="text-sm font-bold">{op.name.charAt(0)}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-medium leading-none truncate ${styles.text}`}>{op.name}</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Flex</span>
                          <span className={`text-[10px] ${theme === 'Midnight' ? 'text-slate-500' : 'text-gray-400'}`}>{op.skills.length} skills</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  {currentWeek.days.map((day, dayIdx) => {
                    const assignment = day.assignments[op.id];
                    const taskId = assignment?.taskId || null;
                    const task = taskId ? tasks.find(t => t.id === taskId) : null;
                    const isSelected = selectedCell?.opId === op.id && selectedCell?.dayIndex === dayIdx;

                    return (
                      <td key={dayIdx} className={`p-2 relative h-16 align-top ${styles.cell}`}>
                        {isSelected ? (
                          // Simplified Popover for Flex - only shows their available tasks
                          <div className={`absolute top-2 left-2 z-50 shadow-xl ring-1 rounded-xl p-3 w-56 animate-in fade-in zoom-in-95 duration-100 origin-top-left ${theme === 'Midnight' ? 'bg-slate-800 ring-slate-700' : 'bg-white ring-black/5'}`}>
                             <div className={`flex justify-between items-center mb-2 pb-2 border-b ${theme === 'Midnight' ? 'border-slate-700' : 'border-gray-100'}`}>
                               <span className="text-xs font-bold text-purple-500 uppercase tracking-wide">Flex Task</span>
                               <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600">
                                 <MoreHorizontal className="h-4 w-4" />
                               </button>
                             </div>

                             <div className="space-y-1">
                               <button
                                  onClick={() => handleAssignmentChange(dayIdx, op.id, null)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-500 transition-colors flex items-center gap-2 group"
                               >
                                 <div className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-red-400" />
                                 Unassigned
                               </button>

                               {/* Only show tasks matching Flex skills */}
                               {tasks.filter(t => op.skills.includes(t.requiredSkill)).map(flexTask => (
                                 <button
                                   key={flexTask.id}
                                   onClick={() => handleAssignmentChange(dayIdx, op.id, flexTask.id)}
                                   className={`w-full flex items-center gap-3 text-left px-3 py-2 text-sm rounded-lg transition-all ${
                                     theme === 'Midnight' ? 'hover:bg-purple-900/30 text-slate-200' : 'hover:bg-purple-50 text-gray-700'
                                   }`}
                                 >
                                   <div
                                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                                    style={{ backgroundColor: flexTask.color }}
                                   />
                                   <span className="font-medium truncate">{flexTask.name}</span>
                                   <Check className="w-3.5 h-3.5 text-purple-500 ml-auto opacity-50" />
                                 </button>
                               ))}
                             </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => !currentWeek.locked && setSelectedCell({ opId: op.id, dayIndex: dayIdx })}
                            disabled={currentWeek.locked}
                            className={`w-full h-full min-h-[44px] rounded-lg border-2 border-dashed flex items-center justify-center text-xs font-medium transition-all ${
                              task
                                ? 'border-transparent'
                                : theme === 'Midnight'
                                ? 'border-slate-800 hover:border-slate-700 text-slate-600'
                                : 'border-gray-200 hover:border-gray-300 text-gray-400'
                            } ${currentWeek.locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            style={task ? { backgroundColor: task.color, color: task.textColor } : {}}
                          >
                            {task ? task.name : '-'}
                          </button>
                        )}
                        {isSelected && (
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCell(null);
                            }}
                          ></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Coordinator Separator */}
              <tr>
                 <td colSpan={6} className={`py-3 px-4 sticky left-0 z-10 backdrop-blur-sm border-t border-b ${theme === 'Midnight' ? 'bg-slate-900/80 border-slate-800' : theme === 'Minimal' ? 'bg-[#fffefb]/80 border-stone-100' : 'bg-gray-50/80 border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                       <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${theme === 'Midnight' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>Coordinators</span>
                       <div className={`h-px flex-1 ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                    </div>
                 </td>
              </tr>

              {/* Coordinator Operators */}
              {operators.filter(op => op.type === 'Coordinator').map(op => (
                <tr key={op.id} className={`transition-colors group ${theme === 'Midnight' ? 'hover:bg-emerald-900/10' : 'hover:bg-emerald-50/30'}`}>
                  <td className={`p-3 sticky left-0 z-20 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${styles.cell} ${theme === 'Midnight' ? 'bg-slate-900 group-hover:bg-emerald-900/10' : 'bg-white group-hover:bg-emerald-50/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center border font-bold shadow-sm shrink-0 ${theme === 'Midnight' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                         {op.name.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-bold truncate ${styles.text}`}>{op.name}</span>
                        <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Coordinator</span>
                      </div>
                    </div>
                  </td>
                  {currentWeek.days.map((day, dayIdx) => {
                    const assignment = day.assignments[op.id];
                    const taskId = assignment?.taskId || null;
                    const task = taskId ? tasks.find(t => t.id === taskId) : null;
                    const isSelected = selectedCell?.opId === op.id && selectedCell?.dayIndex === dayIdx;

                    return (
                      <td key={dayIdx} className={`p-2 relative h-16 align-top ${styles.cell}`}>
                        {isSelected ? (
                          // Popover for Coordinator - only shows coordinator tasks
                          <div className={`absolute top-2 left-2 z-50 shadow-xl ring-1 rounded-xl p-3 w-56 animate-in fade-in zoom-in-95 duration-100 origin-top-left ${theme === 'Midnight' ? 'bg-slate-800 ring-slate-700' : 'bg-white ring-black/5'}`}>
                             <div className={`flex justify-between items-center mb-2 pb-2 border-b ${theme === 'Midnight' ? 'border-slate-700' : 'border-gray-100'}`}>
                               <span className="text-xs font-bold text-emerald-500 uppercase tracking-wide">TC Task</span>
                               <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600">
                                 <MoreHorizontal className="h-4 w-4" />
                               </button>
                             </div>

                             <div className="space-y-1">
                               <button
                                  onClick={() => handleAssignmentChange(dayIdx, op.id, null)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-500 transition-colors flex items-center gap-2 group"
                               >
                                 <div className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-red-400" />
                                 Unassigned
                               </button>

                               {/* Only show coordinator tasks (Process, People, Off process, Process/AD) */}
                               {tasks.filter(t => op.skills.includes(t.requiredSkill)).map(coordTask => (
                                 <button
                                   key={coordTask.id}
                                   onClick={() => handleAssignmentChange(dayIdx, op.id, coordTask.id)}
                                   className={`w-full flex items-center gap-3 text-left px-3 py-2 text-sm rounded-lg transition-all ${
                                     theme === 'Midnight' ? 'hover:bg-emerald-900/30 text-slate-200' : 'hover:bg-emerald-50 text-gray-700'
                                   }`}
                                 >
                                   <div
                                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                                    style={{ backgroundColor: coordTask.color }}
                                   />
                                   <span className="font-medium truncate">{coordTask.name}</span>
                                   <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto opacity-50" />
                                 </button>
                               ))}
                             </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => !currentWeek.locked && setSelectedCell({ opId: op.id, dayIndex: dayIdx })}
                            disabled={currentWeek.locked}
                            className={`w-full h-full min-h-[44px] rounded-lg border-2 border-dashed flex items-center justify-center text-xs font-medium transition-all ${
                              task
                                ? 'border-transparent'
                                : theme === 'Midnight'
                                ? 'border-slate-800 hover:border-emerald-700 text-slate-600'
                                : 'border-gray-200 hover:border-emerald-300 text-gray-400'
                            } ${currentWeek.locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            style={task ? { backgroundColor: task.color, color: task.textColor } : {}}
                          >
                            {task ? task.name : '-'}
                          </button>
                        )}
                        {isSelected && (
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCell(null);
                            }}
                          ></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen w-full font-sans selection:bg-blue-100 transition-colors duration-300 ${styles.bg}`}>
      
      {styles.layout === 'sidebar' && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isOpen={sidebarOpen}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          theme={theme}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full relative">
        {styles.layout === 'topbar' && <TopNavigation />}

        <header className={`flex lg:hidden items-center justify-between p-4 border-b z-10 sticky top-0 ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-gray-200 text-slate-800'}`}>
           <span className="font-bold text-lg flex items-center gap-2">
             <div className="h-6 w-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs">
               <Box className="h-4 w-4" />
             </div>
             Lord of the Bins
           </span>
           <button onClick={() => setSidebarOpen(true)} className="p-2 opacity-60">
             <Menu className="h-6 w-6" />
           </button>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 relative">
          {activeTab === 'schedule' && renderScheduleView()}
          {activeTab === 'team' && renderTeamView()}
          {activeTab === 'dashboard' && renderDashboardView()}
          {activeTab === 'settings' && renderSettingsView()}
        </div>
        
        <ThemeSwitcher />
      </main>

      <OperatorModal
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
        onSave={handleSaveOperator}
        operator={editingOperator}
      />

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPublishModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl p-6 shadow-2xl ${theme === 'Midnight' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h3 className={`text-xl font-bold mb-2 ${styles.text}`}>Publish Schedule</h3>
            <p className={`text-sm mb-6 ${styles.muted}`}>
              {getWeekLabel(currentWeek)} ({getWeekRangeString(new Date(currentWeek.days[0].date))})
            </p>

            <div className={`p-4 rounded-xl mb-6 ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-50'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishWithLock}
                  onChange={(e) => setPublishWithLock(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className={`font-medium ${styles.text}`}>Lock after publishing</span>
                  <p className={`text-xs mt-0.5 ${styles.muted}`}>
                    Prevent changes until manually unlocked
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishModal(false)}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${styles.secondaryBtn}`}
              >
                Cancel
              </button>
              <button
                onClick={handlePublishSchedule}
                className={`flex-1 py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${styles.primaryBtn}`}
              >
                <Send className="h-4 w-4" />
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        week={currentWeek}
        scheduleRef={scheduleGridRef}
        theme={theme}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        theme={theme}
        operators={operators}
        tasks={tasks}
        onNavigate={(tab) => setActiveTab(tab)}
        onSelectOperator={(op) => {
          setEditingOperator(op);
          setIsOperatorModalOpen(true);
        }}
        onGenerateSchedule={handleAutoSchedule}
        onExport={() => setShowExportModal(true)}
      />
    </div>
  );
}

export default App;
