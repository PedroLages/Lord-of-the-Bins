import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Users,
  Wand2,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Copy,
  Layers,
  AlertCircle,
} from 'lucide-react';
import type {
  TaskType,
  OperatorTypeOption,
  OperatorTypeRequirement,
  StaffingConfiguration,
  TaskPlanningRequirement,
  WeeklyStaffingPlan,
  TaskRequirement,
} from '../types';
import {
  getTotalFromConfiguration,
  getMinTotalFromAlternatives,
  createEmptyConfiguration,
  createEmptyTaskPlanningRequirement,
} from '../types';

interface PlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (plan: WeeklyStaffingPlan) => void;
  tasks: TaskType[];
  weekNumber: number;
  year: number;
  theme: 'Modern' | 'Midnight';
  // Existing task requirements from Settings (for pre-populating)
  existingRequirements?: TaskRequirement[];
}

const OPERATOR_TYPES: OperatorTypeOption[] = ['Any', 'Regular', 'Flex', 'Coordinator'];

const TYPE_COLORS: Record<OperatorTypeOption, { bg: string; text: string; border: string }> = {
  Any: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  Regular: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  Flex: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  Coordinator: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
};

const PlanningModal: React.FC<PlanningModalProps> = ({
  isOpen,
  onClose,
  onApply,
  tasks,
  weekNumber,
  year,
  theme,
  existingRequirements = [],
}) => {
  const isDark = theme === 'Midnight';

  // State for the planning requirements
  const [requirements, setRequirements] = useState<TaskPlanningRequirement[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Initialize requirements from tasks and existing settings
  useEffect(() => {
    if (isOpen) {
      const initialRequirements: TaskPlanningRequirement[] = tasks.map((task) => {
        // Check if there's an existing requirement from Settings
        const existing = existingRequirements.find(r => r.taskId === task.id);

        if (existing) {
          // Convert existing TaskRequirement to TaskPlanningRequirement
          return {
            taskId: task.id,
            alternatives: [{
              id: crypto.randomUUID(),
              requirements: [...existing.defaultRequirements],
            }],
            enabled: true,
          };
        }

        // Use task's requiredOperators as default
        const count = typeof task.requiredOperators === 'number'
          ? task.requiredOperators
          : 1;

        return {
          taskId: task.id,
          alternatives: [{
            id: crypto.randomUUID(),
            requirements: [{ type: 'Any' as OperatorTypeOption, count }],
          }],
          enabled: true,
        };
      });

      setRequirements(initialRequirements);
      // Expand all tasks by default for better UX
      setExpandedTasks(new Set(tasks.map(t => t.id)));
    }
  }, [isOpen, tasks, existingRequirements]);

  // Toggle task expansion
  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Toggle task enabled/disabled
  const toggleTaskEnabled = (taskId: string) => {
    setRequirements(prev => prev.map(req =>
      req.taskId === taskId ? { ...req, enabled: !req.enabled } : req
    ));
  };

  // Add new alternative (OR)
  const addAlternative = (taskId: string) => {
    setRequirements(prev => prev.map(req => {
      if (req.taskId !== taskId) return req;
      return {
        ...req,
        alternatives: [...req.alternatives, createEmptyConfiguration()],
      };
    }));
  };

  // Remove alternative
  const removeAlternative = (taskId: string, configId: string) => {
    setRequirements(prev => prev.map(req => {
      if (req.taskId !== taskId) return req;
      const filtered = req.alternatives.filter(a => a.id !== configId);
      return {
        ...req,
        alternatives: filtered.length > 0 ? filtered : [createEmptyConfiguration()],
      };
    }));
  };

  // Duplicate alternative
  const duplicateAlternative = (taskId: string, configId: string) => {
    setRequirements(prev => prev.map(req => {
      if (req.taskId !== taskId) return req;
      const configToCopy = req.alternatives.find(a => a.id === configId);
      if (!configToCopy) return req;
      return {
        ...req,
        alternatives: [...req.alternatives, {
          id: crypto.randomUUID(),
          requirements: [...configToCopy.requirements.map(r => ({ ...r }))],
        }],
      };
    }));
  };

  // Add requirement to configuration (AND)
  const addRequirement = (taskId: string, configId: string) => {
    setRequirements(prev => prev.map(req => {
      if (req.taskId !== taskId) return req;
      return {
        ...req,
        alternatives: req.alternatives.map(alt => {
          if (alt.id !== configId) return alt;
          return {
            ...alt,
            requirements: [...alt.requirements, { type: 'Any' as OperatorTypeOption, count: 1 }],
          };
        }),
      };
    }));
  };

  // Remove requirement from configuration
  const removeRequirement = (taskId: string, configId: string, reqIndex: number) => {
    setRequirements(prev => prev.map(req => {
      if (req.taskId !== taskId) return req;
      return {
        ...req,
        alternatives: req.alternatives.map(alt => {
          if (alt.id !== configId) return alt;
          const filtered = alt.requirements.filter((_, i) => i !== reqIndex);
          return {
            ...alt,
            requirements: filtered.length > 0 ? filtered : [{ type: 'Any' as OperatorTypeOption, count: 1 }],
          };
        }),
      };
    }));
  };

  // Update requirement
  const updateRequirement = (
    taskId: string,
    configId: string,
    reqIndex: number,
    field: 'type' | 'count',
    value: OperatorTypeOption | number
  ) => {
    setRequirements(prev => prev.map(req => {
      if (req.taskId !== taskId) return req;
      return {
        ...req,
        alternatives: req.alternatives.map(alt => {
          if (alt.id !== configId) return alt;
          return {
            ...alt,
            requirements: alt.requirements.map((r, i) => {
              if (i !== reqIndex) return r;
              return field === 'type'
                ? { ...r, type: value as OperatorTypeOption }
                : { ...r, count: Math.max(0, value as number) };
            }),
          };
        }),
      };
    }));
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    const enabledReqs = requirements.filter(r => r.enabled);
    const taskCount = enabledReqs.length;

    // Calculate minimum operators needed (using OR logic - pick smallest alternative)
    const minOperators = enabledReqs.reduce((sum, req) => {
      return sum + getMinTotalFromAlternatives(req.alternatives);
    }, 0);

    // Calculate max operators (if all biggest alternatives are chosen)
    const maxOperators = enabledReqs.reduce((sum, req) => {
      if (req.alternatives.length === 0) return sum;
      return sum + Math.max(...req.alternatives.map(getTotalFromConfiguration));
    }, 0);

    // Count unique operator types needed
    const typeNeeds: Record<OperatorTypeOption, number> = {
      Any: 0,
      Regular: 0,
      Flex: 0,
      Coordinator: 0,
    };

    enabledReqs.forEach(req => {
      // Use first alternative for type summary
      if (req.alternatives.length > 0) {
        req.alternatives[0].requirements.forEach(r => {
          typeNeeds[r.type] += r.count;
        });
      }
    });

    return { taskCount, minOperators, maxOperators, typeNeeds };
  }, [requirements]);

  // Handle apply
  const handleApply = () => {
    const plan: WeeklyStaffingPlan = {
      id: crypto.randomUUID(),
      weekNumber,
      year,
      requirements: requirements.filter(r => r.enabled),
      createdAt: new Date().toISOString(),
    };
    onApply(plan);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          isDark ? 'bg-slate-900' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-indigo-500/20' : 'bg-blue-100'}`}>
              <Wand2 className={`h-5 w-5 ${isDark ? 'text-indigo-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                Plan Requirements
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                Week {weekNumber}, {year} - Configure staffing needs before Smart Fill
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Banner */}
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
            isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-blue-50 border border-blue-100'
          }`}>
            <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              isDark ? 'text-indigo-400' : 'text-blue-600'
            }`} />
            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              <p className="font-medium mb-1">AND/OR Logic Explained:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>AND (within card):</strong> All requirements in a card must be met together</li>
                <li><strong>OR (between cards):</strong> Any one of the alternative cards can satisfy the task</li>
              </ul>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {requirements.map((req) => {
              const task = tasks.find(t => t.id === req.taskId);
              if (!task) return null;

              const isExpanded = expandedTasks.has(req.taskId);
              const minTotal = getMinTotalFromAlternatives(req.alternatives);

              return (
                <div
                  key={req.taskId}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    req.enabled
                      ? isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-white border-gray-200'
                      : isDark
                        ? 'bg-slate-800/50 border-slate-700/50 opacity-60'
                        : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Task Header */}
                  <div className={`flex items-center gap-3 p-4 ${
                    isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'
                  }`}>
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() => toggleTaskEnabled(req.taskId)}
                      className={`transition-colors ${
                        req.enabled
                          ? isDark ? 'text-indigo-400' : 'text-blue-600'
                          : isDark ? 'text-slate-600' : 'text-gray-400'
                      }`}
                    >
                      {req.enabled ? (
                        <ToggleRight className="h-6 w-6" />
                      ) : (
                        <ToggleLeft className="h-6 w-6" />
                      )}
                    </button>

                    {/* Task Color & Name */}
                    <button
                      onClick={() => toggleTaskExpansion(req.taskId)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div
                        className="w-4 h-4 rounded-full shadow-sm flex-shrink-0"
                        style={{ backgroundColor: task.color }}
                      />
                      <span className={`font-medium ${
                        isDark ? 'text-slate-200' : 'text-gray-900'
                      }`}>
                        {task.name}
                      </span>
                    </button>

                    {/* Quick Summary */}
                    <div className="flex items-center gap-2">
                      {req.alternatives.length > 1 && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {req.alternatives.length} options
                        </span>
                      )}
                      <span className={`text-sm font-medium ${
                        isDark ? 'text-slate-400' : 'text-gray-500'
                      }`}>
                        {minTotal} {minTotal === 1 ? 'operator' : 'operators'}
                      </span>
                      <button
                        onClick={() => toggleTaskExpansion(req.taskId)}
                        className={`p-1 rounded ${
                          isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                        }`}
                      >
                        {isExpanded ? (
                          <ChevronUp className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                        ) : (
                          <ChevronDown className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Configuration */}
                  {isExpanded && req.enabled && (
                    <div className={`px-4 pb-4 space-y-3 ${
                      isDark ? 'border-t border-slate-700/50' : 'border-t border-gray-100'
                    }`}>
                      {/* Alternative Cards */}
                      <div className="pt-4 space-y-3">
                        {req.alternatives.map((config, altIndex) => (
                          <div key={config.id} className="relative">
                            {/* OR Divider (between alternatives) */}
                            {altIndex > 0 && (
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  isDark
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-purple-100 text-purple-700 border border-purple-200'
                                }`}>
                                  OR
                                </span>
                                <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
                              </div>
                            )}

                            {/* Configuration Card */}
                            <div className={`p-4 rounded-xl ${
                              isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'
                            }`}>
                              {/* Card Header */}
                              <div className="flex items-center justify-between mb-3">
                                <span className={`text-xs font-semibold uppercase tracking-wider ${
                                  isDark ? 'text-slate-500' : 'text-gray-400'
                                }`}>
                                  Option {altIndex + 1}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => duplicateAlternative(req.taskId, config.id)}
                                    className={`p-1.5 rounded transition-colors ${
                                      isDark
                                        ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title="Duplicate option"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  {req.alternatives.length > 1 && (
                                    <button
                                      onClick={() => removeAlternative(req.taskId, config.id)}
                                      className={`p-1.5 rounded transition-colors ${
                                        isDark
                                          ? 'text-red-400 hover:bg-red-500/20'
                                          : 'text-red-500 hover:bg-red-50'
                                      }`}
                                      title="Remove option"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Requirements (AND logic) */}
                              <div className="space-y-2">
                                {config.requirements.map((r, reqIndex) => (
                                  <div key={reqIndex} className="flex items-center gap-2">
                                    {/* AND label for subsequent requirements */}
                                    {reqIndex > 0 && (
                                      <span className={`w-12 text-center text-xs font-bold ${
                                        isDark ? 'text-indigo-400' : 'text-blue-600'
                                      }`}>
                                        AND
                                      </span>
                                    )}
                                    {reqIndex === 0 && <div className="w-12" />}

                                    {/* Count Control */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => updateRequirement(req.taskId, config.id, reqIndex, 'count', r.count - 1)}
                                        className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm ${
                                          isDark
                                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                      >
                                        -
                                      </button>
                                      <span className={`w-8 text-center font-bold ${
                                        isDark ? 'text-slate-200' : 'text-gray-700'
                                      }`}>
                                        {r.count}
                                      </span>
                                      <button
                                        onClick={() => updateRequirement(req.taskId, config.id, reqIndex, 'count', r.count + 1)}
                                        className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm ${
                                          isDark
                                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                      >
                                        +
                                      </button>
                                    </div>

                                    {/* Type Selector */}
                                    <select
                                      value={r.type}
                                      onChange={(e) => updateRequirement(req.taskId, config.id, reqIndex, 'type', e.target.value as OperatorTypeOption)}
                                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border outline-none transition-colors ${
                                        isDark
                                          ? 'bg-slate-700 border-slate-600 text-slate-200'
                                          : `${TYPE_COLORS[r.type].bg} ${TYPE_COLORS[r.type].border} ${TYPE_COLORS[r.type].text}`
                                      }`}
                                    >
                                      {OPERATOR_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                          {type}
                                        </option>
                                      ))}
                                    </select>

                                    {/* Remove Requirement */}
                                    {config.requirements.length > 1 && (
                                      <button
                                        onClick={() => removeRequirement(req.taskId, config.id, reqIndex)}
                                        className={`p-1.5 rounded transition-colors ${
                                          isDark
                                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/20'
                                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                        }`}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Add Requirement Button */}
                              <button
                                onClick={() => addRequirement(req.taskId, config.id)}
                                className={`mt-3 w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                                  isDark
                                    ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-dashed border-slate-600'
                                    : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-dashed border-gray-300'
                                }`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add AND requirement
                              </button>

                              {/* Total for this option */}
                              <div className={`mt-3 pt-3 border-t flex justify-end ${
                                isDark ? 'border-slate-700' : 'border-gray-200'
                              }`}>
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                  Total: <strong className={isDark ? 'text-slate-200' : 'text-gray-700'}>
                                    {getTotalFromConfiguration(config)}
                                  </strong> operators
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Alternative (OR) Button */}
                      <button
                        onClick={() => addAlternative(req.taskId)}
                        className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                          isDark
                            ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-dashed border-purple-500/30'
                            : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-dashed border-purple-200'
                        }`}
                      >
                        <Layers className="h-4 w-4" />
                        Add OR alternative
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${
          isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'
        }`}>
          {/* Summary */}
          <div className={`mb-4 p-4 rounded-xl ${
            isDark ? 'bg-slate-900/50' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className={`h-5 w-5 ${isDark ? 'text-indigo-400' : 'text-blue-600'}`} />
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Staffing Summary
                  </p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {summary.taskCount} tasks enabled
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${isDark ? 'text-indigo-400' : 'text-blue-600'}`}>
                  {summary.minOperators === summary.maxOperators
                    ? summary.minOperators
                    : `${summary.minOperators}-${summary.maxOperators}`}
                </p>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  operators needed
                </p>
              </div>
            </div>

            {/* Type Breakdown */}
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2" style={{
              borderColor: isDark ? 'rgb(51 65 85)' : 'rgb(229 231 235)'
            }}>
              {(Object.entries(summary.typeNeeds) as [OperatorTypeOption, number][])
                .filter(([_, count]) => count > 0)
                .map(([type, count]) => (
                  <span
                    key={type}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      TYPE_COLORS[type].bg
                    } ${TYPE_COLORS[type].text}`}
                  >
                    {count} {type}
                  </span>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'text-slate-400 hover:bg-slate-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                isDark
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              Apply & Run Smart Fill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanningModal;
