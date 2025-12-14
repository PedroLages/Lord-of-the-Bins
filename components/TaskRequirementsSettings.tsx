import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Users, UserCheck, AlertCircle, Sparkles, TrendingUp, Calendar } from 'lucide-react';
import type { TaskType, TaskRequirement, OperatorTypeRequirement, OperatorTypeOption, WeekDay } from '../types';
import { getTotalFromRequirements, getRequirementsForDay, TC_SKILLS } from '../types';

interface TaskRequirementsSettingsProps {
  tasks: TaskType[];
  requirements: TaskRequirement[];
  onSaveRequirement: (requirement: TaskRequirement) => void;
  onDeleteRequirement: (taskId: string) => void;
  theme: 'Modern' | 'Midnight';
}

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const OPERATOR_TYPES: OperatorTypeOption[] = ['Regular', 'Flex', 'Coordinator'];

// Display names for operator types (Regular -> Ceva)
const OPERATOR_TYPE_DISPLAY: Record<OperatorTypeOption, string> = {
  'Regular': 'Ceva',
  'Flex': 'Flex',
  'Coordinator': 'Coordinator',
};

// Enhanced color system with gradients and modern styling
const TYPE_COLORS: Record<string, {
  bg: string;
  bgDark: string;
  text: string;
  textDark: string;
  border: string;
  borderDark: string;
  accent: string;
  icon: string;
  iconDark: string;
}> = {
  Regular: {
    bg: 'bg-gradient-to-br from-blue-100 to-blue-200',
    bgDark: 'bg-gradient-to-br from-blue-900/30 to-blue-800/30',
    text: 'text-blue-700',
    textDark: 'text-blue-300',
    border: 'border-blue-300',
    borderDark: 'border-blue-700',
    accent: 'text-blue-600',
    icon: 'bg-blue-200 text-blue-700',
    iconDark: 'bg-blue-900/50 text-blue-400',
  },
  Flex: {
    bg: 'bg-gradient-to-br from-amber-100 to-amber-200',
    bgDark: 'bg-gradient-to-br from-amber-900/30 to-amber-800/30',
    text: 'text-amber-700',
    textDark: 'text-amber-300',
    border: 'border-amber-300',
    borderDark: 'border-amber-700',
    accent: 'text-amber-600',
    icon: 'bg-amber-200 text-amber-700',
    iconDark: 'bg-amber-900/50 text-amber-400',
  },
  Coordinator: {
    bg: 'bg-gradient-to-br from-emerald-100 to-emerald-200',
    bgDark: 'bg-gradient-to-br from-emerald-900/30 to-emerald-800/30',
    text: 'text-emerald-700',
    textDark: 'text-emerald-300',
    border: 'border-emerald-300',
    borderDark: 'border-emerald-700',
    accent: 'text-emerald-600',
    icon: 'bg-emerald-200 text-emerald-700',
    iconDark: 'bg-emerald-900/50 text-emerald-400',
  },
};

// Helper to safely get colors, falling back to Regular for unknown types (legacy data)
const getTypeColors = (type: string) => TYPE_COLORS[type] || TYPE_COLORS.Regular;

// Helper to safely get display name, falling back to Ceva for unknown types (legacy data)
const getTypeDisplayName = (type: string) => OPERATOR_TYPE_DISPLAY[type as OperatorTypeOption] || 'Ceva';

// Helper to normalize legacy operator types to valid ones
const normalizeOperatorType = (type: string): OperatorTypeOption => {
  if (OPERATOR_TYPES.includes(type as OperatorTypeOption)) {
    return type as OperatorTypeOption;
  }
  // Legacy 'Any' or other unknown types become 'Regular'
  return 'Regular';
};

const TaskRequirementsSettings: React.FC<TaskRequirementsSettingsProps> = ({
  tasks,
  requirements,
  onSaveRequirement,
  onDeleteRequirement,
  theme,
}) => {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<TaskRequirement | null>(null);

  const isDark = theme === 'Midnight';

  // Get requirement for a task (if exists)
  const getRequirement = (taskId: string): TaskRequirement | undefined => {
    return requirements.find(r => r.taskId === taskId);
  };

  // Create default requirement for a task
  const createDefaultRequirement = (taskId: string): TaskRequirement => ({
    taskId,
    defaultRequirements: [{ type: 'Regular', count: 1 }], // Default to Ceva (Regular)
    enabled: true,
  });

  // Handle expanding/collapsing a task row
  const handleToggleExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      setEditingRequirement(null);
    } else {
      setExpandedTask(taskId);
      const existing = getRequirement(taskId);
      setEditingRequirement(existing || createDefaultRequirement(taskId));
    }
  };

  // Add a new operator type requirement
  const handleAddType = () => {
    if (!editingRequirement) return;
    setEditingRequirement({
      ...editingRequirement,
      defaultRequirements: [
        ...editingRequirement.defaultRequirements,
        { type: 'Regular', count: 1 }, // Default to Ceva (Regular)
      ],
    });
  };

  // Remove an operator type requirement
  const handleRemoveType = (index: number) => {
    if (!editingRequirement) return;
    const newReqs = editingRequirement.defaultRequirements.filter((_, i) => i !== index);
    setEditingRequirement({
      ...editingRequirement,
      defaultRequirements: newReqs.length > 0 ? newReqs : [{ type: 'Regular', count: 1 }], // Default to Ceva (Regular)
    });
  };

  // Update a requirement entry
  const handleUpdateType = (index: number, field: 'type' | 'count', value: string | number) => {
    if (!editingRequirement) return;
    const newReqs = [...editingRequirement.defaultRequirements];
    if (field === 'type') {
      newReqs[index] = { ...newReqs[index], type: value as OperatorTypeOption };
    } else {
      newReqs[index] = { ...newReqs[index], count: Math.max(0, value as number) };
    }
    setEditingRequirement({
      ...editingRequirement,
      defaultRequirements: newReqs,
    });
  };

  // Save the current editing requirement
  const handleSave = () => {
    if (editingRequirement) {
      onSaveRequirement(editingRequirement);
      setExpandedTask(null);
      setEditingRequirement(null);
    }
  };

  // Delete requirement for a task
  const handleDelete = (taskId: string) => {
    onDeleteRequirement(taskId);
    if (expandedTask === taskId) {
      setExpandedTask(null);
      setEditingRequirement(null);
    }
  };

  // Get total from requirements array for display
  const getTotal = (reqs: OperatorTypeRequirement[]): number => {
    return reqs.reduce((sum, r) => sum + r.count, 0);
  };

  // Group tasks by type (TC tasks vs Regular tasks)
  const tcTasks = tasks.filter(t => TC_SKILLS.includes(t.requiredSkill));
  const regularTasks = tasks.filter(t => !TC_SKILLS.includes(t.requiredSkill));

  // Calculate summary stats
  const totalConfigured = requirements.filter(r => r.enabled).length;
  const totalOperatorsRequired = requirements.reduce((sum, r) =>
    sum + (r.enabled ? getTotal(r.defaultRequirements) : 0), 0
  );

  const renderTaskCard = (task: TaskType, isTcTask: boolean = false) => {
    const requirement = getRequirement(task.id);
    const isExpanded = expandedTask === task.id;
    const total = requirement ? getTotal(requirement.defaultRequirements) : (task.requiredOperators as number || 1);
    const hasCustomConfig = !!requirement;

    // Filter operator types - Coordinator only valid for TC tasks
    const availableOperatorTypes = isTcTask
      ? OPERATOR_TYPES
      : OPERATOR_TYPES.filter(t => t !== 'Coordinator');

    return (
      <div
        key={task.id}
        className={`group rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
          isExpanded
            ? isDark
              ? 'border-indigo-500 bg-slate-800 shadow-xl shadow-indigo-500/10'
              : 'border-blue-500 bg-white shadow-xl shadow-blue-500/10'
            : isDark
              ? 'border-slate-700 bg-slate-800 hover:border-slate-600'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }`}
      >
        {/* Task Row Header */}
        <button
          onClick={() => handleToggleExpand(task.id)}
          className={`w-full flex items-center justify-between p-5 text-left transition-all ${
            isDark
              ? 'hover:bg-slate-700/30'
              : 'hover:bg-gray-50/80'
          }`}
        >
          <div className="flex items-center gap-4 flex-1">
            {/* Task Color Badge */}
            <div className="relative">
              <div
                className="w-12 h-12 rounded-xl shadow-md flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ backgroundColor: task.color }}
              >
                <span className="text-xs font-bold" style={{ color: task.textColor }}>
                  {task.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              {hasCustomConfig && (
                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-indigo-500' : 'bg-blue-600'
                }`}>
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-bold text-base truncate ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                  {task.name}
                </h3>
                {hasCustomConfig && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isDark
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    Custom
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  Required Skill:
                </span>
                <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  {task.requiredSkill}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Requirements Display */}
          <div className="flex items-center gap-4 ml-4">
            {/* Current Requirement Pills */}
            {requirement ? (
              <div className="flex items-center gap-2">
                {requirement.defaultRequirements.map((r, i) => {
                  const colors = getTypeColors(r.type);
                  return (
                    <div
                      key={i}
                      className={`px-3 py-1.5 rounded-lg border-2 flex items-center gap-2 ${
                        isDark
                          ? `${colors.bgDark} ${colors.borderDark} ${colors.textDark}`
                          : `${colors.bg} ${colors.border} ${colors.text}`
                      }`}
                    >
                      <span className="font-bold text-lg">{r.count}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide">{getTypeDisplayName(r.type)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isDark ? 'bg-slate-700/50' : 'bg-gray-100'
              }`}>
                <Users className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
                <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  {total}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  (default)
                </span>
              </div>
            )}

            {/* Expand Icon */}
            <div className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-slate-700 group-hover:bg-slate-600'
                : 'bg-gray-100 group-hover:bg-gray-200'
            }`}>
              {isExpanded ? (
                <ChevronUp className={`h-5 w-5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
              ) : (
                <ChevronDown className={`h-5 w-5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Configuration Panel */}
        {isExpanded && editingRequirement && (
          <div className={`p-6 border-t-2 ${
            isDark
              ? 'border-slate-700 bg-slate-900/50'
              : 'border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100/50'
          }`}>
            {/* Operator Type Requirements */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    isDark
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                      Operator Requirements
                    </h4>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                      Configure operator types and counts
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAddType}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md active:scale-95 ${
                    isDark
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Add Type
                </button>
              </div>

              {/* Type Entries - Enhanced Cards */}
              <div className="space-y-3">
                {editingRequirement.defaultRequirements.map((req, index) => {
                  const colors = getTypeColors(req.type);
                  const normalizedType = normalizeOperatorType(req.type);
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                          : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Type Icon */}
                      <div className={`p-2.5 rounded-lg ${
                        isDark ? colors.iconDark : colors.icon
                      }`}>
                        {normalizedType === 'Coordinator' ? (
                          <UserCheck className="h-5 w-5" />
                        ) : (
                          <Users className="h-5 w-5" />
                        )}
                      </div>

                      {/* Type Selector */}
                      <select
                        value={normalizedType}
                        onChange={(e) => handleUpdateType(index, 'type', e.target.value)}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 outline-none transition-all cursor-pointer ${
                          isDark
                            ? 'bg-slate-700 border-slate-600 text-slate-200 hover:border-slate-500 focus:border-indigo-500'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      >
                        {availableOperatorTypes.map((type) => (
                          <option key={type} value={type}>
                            {OPERATOR_TYPE_DISPLAY[type]}
                          </option>
                        ))}
                      </select>

                      {/* Count Control - Enhanced */}
                      <div className={`flex items-center gap-2 p-2 rounded-xl ${
                        isDark ? 'bg-slate-900/50' : 'bg-gray-100'
                      }`}>
                        <button
                          onClick={() => handleUpdateType(index, 'count', req.count - 1)}
                          disabled={req.count <= 0}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg transition-all active:scale-90 ${
                            isDark
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed'
                              : 'bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm'
                          }`}
                        >
                          -
                        </button>
                        <div className={`min-w-[60px] text-center px-4 py-2 rounded-lg ${
                          isDark ? 'bg-slate-800' : 'bg-white'
                        }`}>
                          <span className={`text-2xl font-bold ${
                            isDark ? 'text-indigo-400' : 'text-blue-600'
                          }`}>
                            {req.count}
                          </span>
                        </div>
                        <button
                          onClick={() => handleUpdateType(index, 'count', req.count + 1)}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg transition-all active:scale-90 ${
                            isDark
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
                          }`}
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Button */}
                      {editingRequirement.defaultRequirements.length > 1 && (
                        <button
                          onClick={() => handleRemoveType(index)}
                          className={`p-2.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${
                            isDark
                              ? 'text-red-400 hover:bg-red-500/20'
                              : 'text-red-500 hover:bg-red-50'
                          }`}
                          title="Remove this requirement"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Display - Enhanced */}
              <div className={`flex items-center justify-between p-5 rounded-xl border-2 ${
                isDark
                  ? 'bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 border-indigo-700'
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${
                    isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-200 text-blue-700'
                  }`}>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-indigo-400' : 'text-blue-600'
                    }`}>
                      Total Required
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                      Per day (Mon-Fri)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${
                    isDark ? 'text-indigo-400' : 'text-blue-600'
                  }`}>
                    {getTotal(editingRequirement.defaultRequirements)}
                  </div>
                  <div className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    operator{getTotal(editingRequirement.defaultRequirements) !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Enhanced */}
            <div className="flex justify-between items-center gap-3 mt-6 pt-6 border-t-2 border-dashed ${isDark ? 'border-slate-700' : 'border-gray-200'}">
              {requirement && (
                <button
                  onClick={() => handleDelete(task.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 ${
                    isDark
                      ? 'text-red-400 hover:bg-red-500/20 border-2 border-red-500/30'
                      : 'text-red-600 hover:bg-red-50 border-2 border-red-200'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  Reset to Default
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => {
                    setExpandedTask(null);
                    setEditingRequirement(null);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isDark
                      ? 'text-slate-400 hover:bg-slate-800 border-2 border-slate-700'
                      : 'text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 ${
                    isDark
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  Save Requirements
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section - Enhanced */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
              Task Staffing
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
              Define operator type and count requirements for each task. Smart Fill uses these when generating schedules.
            </p>
          </div>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className={`p-5 rounded-2xl border-2 flex items-center gap-4 ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className={`p-3 rounded-xl ${
              isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-100 text-blue-600'
            }`}>
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                {totalConfigured}
              </p>
              <p className={`text-xs uppercase font-semibold tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                Custom Configs
              </p>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border-2 flex items-center gap-4 ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className={`p-3 rounded-xl ${
              isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                {totalOperatorsRequired}
              </p>
              <p className={`text-xs uppercase font-semibold tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                Daily Required
              </p>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border-2 flex items-center gap-4 ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className={`p-3 rounded-xl ${
              isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'
            }`}>
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                {tasks.length}
              </p>
              <p className={`text-xs uppercase font-semibold tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                Total Tasks
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Regular Tasks Section */}
      {regularTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`h-1 flex-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`} />
            <h3 className={`text-lg font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Regular Tasks
            </h3>
            <div className={`h-1 flex-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {regularTasks.map(task => renderTaskCard(task, false))}
          </div>
        </div>
      )}

      {/* TC (Coordinator) Tasks Section */}
      {tcTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`h-1 flex-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`} />
            <h3 className={`text-lg font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Team Coordinator Tasks
            </h3>
            <div className={`h-1 flex-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {tcTasks.map(task => renderTaskCard(task, true))}
          </div>
        </div>
      )}

      {/* Help Section - Enhanced */}
      <div className={`p-6 rounded-2xl border-2 ${
        isDark
          ? 'bg-gradient-to-br from-indigo-900/20 to-indigo-800/10 border-indigo-700/50'
          : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${
            isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-200 text-blue-700'
          }`}>
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-base mb-3 ${isDark ? 'text-indigo-300' : 'text-blue-900'}`}>
              How Requirements Work
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'Ceva', desc: 'Must be a Ceva (full-time) operator' },
                { label: 'Flex', desc: 'Must be a Flex (part-time) operator' },
                { label: 'Coordinator', desc: 'Must be a Team Coordinator (TC)' },
              ].map((type, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs ${isDark ? 'text-slate-300' : 'text-blue-800'}`}>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    isDark ? 'bg-slate-800 text-indigo-400' : 'bg-blue-200 text-blue-900'
                  }`}>
                    {type.label}:
                  </span>
                  <span>{type.desc}</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 pt-4 border-t ${isDark ? 'border-indigo-700/30' : 'border-blue-200'}`}>
              <p className={`text-xs ${isDark ? 'text-indigo-300' : 'text-blue-800'}`}>
                <strong>Example:</strong> Setting "2 Flex + 1 Ceva" means Smart Fill will assign 2 Flex operators and 1 Ceva operator to this task each day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskRequirementsSettings;
