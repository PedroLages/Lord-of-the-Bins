import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Users, UserCheck } from 'lucide-react';
import type { TaskType, TaskRequirement, OperatorTypeRequirement, OperatorTypeOption, WeekDay } from '../types';
import { getTotalFromRequirements, getRequirementsForDay } from '../types';

interface TaskRequirementsSettingsProps {
  tasks: TaskType[];
  requirements: TaskRequirement[];
  onSaveRequirement: (requirement: TaskRequirement) => void;
  onDeleteRequirement: (taskId: string) => void;
  theme: 'Modern' | 'Midnight';
}

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const OPERATOR_TYPES: OperatorTypeOption[] = ['Any', 'Regular', 'Flex', 'Coordinator'];

const TYPE_COLORS = {
  Any: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  Regular: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  Flex: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  Coordinator: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
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
    defaultRequirements: [{ type: 'Any', count: 1 }],
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
        { type: 'Any', count: 1 },
      ],
    });
  };

  // Remove an operator type requirement
  const handleRemoveType = (index: number) => {
    if (!editingRequirement) return;
    const newReqs = editingRequirement.defaultRequirements.filter((_, i) => i !== index);
    setEditingRequirement({
      ...editingRequirement,
      defaultRequirements: newReqs.length > 0 ? newReqs : [{ type: 'Any', count: 1 }],
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

  // Format requirement for display
  const formatRequirement = (req: TaskRequirement): string => {
    const parts = req.defaultRequirements
      .filter(r => r.count > 0)
      .map(r => `${r.count} ${r.type}`);
    return parts.join(' + ') || 'Not configured';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
          Staffing Requirements
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          Configure how many operators of each type are needed per task.
          Smart Fill will use these requirements when generating schedules.
        </p>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.map((task) => {
          const requirement = getRequirement(task.id);
          const isExpanded = expandedTask === task.id;
          const total = requirement ? getTotal(requirement.defaultRequirements) : (task.requiredOperators as number || 1);

          return (
            <div
              key={task.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                isDark
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Task Row Header */}
              <button
                onClick={() => handleToggleExpand(task.id)}
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                  isDark
                    ? 'hover:bg-slate-700/50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Task Color */}
                  <div
                    className="w-4 h-4 rounded-full shadow-sm"
                    style={{ backgroundColor: task.color }}
                  />
                  <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                    {task.name}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Current Requirement Display */}
                  <div className="flex items-center gap-2">
                    {requirement ? (
                      <div className="flex items-center gap-1">
                        {requirement.defaultRequirements.map((r, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              TYPE_COLORS[r.type].bg
                            } ${TYPE_COLORS[r.type].text}`}
                          >
                            {r.count} {r.type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {total} (default)
                      </span>
                    )}
                  </div>

                  {/* Expand Icon */}
                  {isExpanded ? (
                    <ChevronUp className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                  ) : (
                    <ChevronDown className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} />
                  )}
                </div>
              </button>

              {/* Expanded Configuration */}
              {isExpanded && editingRequirement && (
                <div className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-gray-100 bg-gray-50'}`}>
                  {/* Operator Type Requirements */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        <Users className="inline h-3 w-3 mr-1" />
                        Required Operators by Type
                      </label>
                      <button
                        onClick={handleAddType}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          isDark
                            ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        <Plus className="h-3 w-3" />
                        Add Type
                      </button>
                    </div>

                    {/* Type Entries */}
                    <div className="space-y-2">
                      {editingRequirement.defaultRequirements.map((req, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            isDark ? 'bg-slate-800' : 'bg-white'
                          }`}
                        >
                          {/* Type Selector */}
                          <select
                            value={req.type}
                            onChange={(e) => handleUpdateType(index, 'type', e.target.value)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border outline-none transition-colors ${
                              isDark
                                ? 'bg-slate-700 border-slate-600 text-slate-200'
                                : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                          >
                            {OPERATOR_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>

                          {/* Count Control */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateType(index, 'count', req.count - 1)}
                              className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm ${
                                isDark
                                  ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              -
                            </button>
                            <span className={`w-8 text-center font-bold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                              {req.count}
                            </span>
                            <button
                              onClick={() => handleUpdateType(index, 'count', req.count + 1)}
                              className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm ${
                                isDark
                                  ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              +
                            </button>
                          </div>

                          {/* Remove Button */}
                          {editingRequirement.defaultRequirements.length > 1 && (
                            <button
                              onClick={() => handleRemoveType(index)}
                              className={`p-1.5 rounded transition-colors ${
                                isDark
                                  ? 'text-red-400 hover:bg-red-500/20'
                                  : 'text-red-500 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Total Display */}
                    <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                      <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        Total Required:
                      </span>
                      <span className={`text-lg font-bold ${isDark ? 'text-indigo-400' : 'text-blue-600'}`}>
                        {getTotal(editingRequirement.defaultRequirements)} operator{getTotal(editingRequirement.defaultRequirements) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-dashed ${isDark ? 'border-slate-700' : 'border-gray-200'}">
                    {requirement && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isDark
                            ? 'text-red-400 hover:bg-red-500/20'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        Reset to Default
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setExpandedTask(null);
                        setEditingRequirement(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isDark
                          ? 'text-slate-400 hover:bg-slate-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        isDark
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Save Requirements
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Text */}
      <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-blue-50 border border-blue-100'}`}>
        <h3 className={`font-bold text-sm mb-2 ${isDark ? 'text-slate-300' : 'text-blue-800'}`}>
          How Requirements Work
        </h3>
        <ul className={`text-xs space-y-1 ${isDark ? 'text-slate-400' : 'text-blue-700'}`}>
          <li><strong>Any:</strong> Any operator type can fill this slot</li>
          <li><strong>Regular:</strong> Must be a Regular (full-time) operator</li>
          <li><strong>Flex:</strong> Must be a Flex (part-time) operator</li>
          <li><strong>Coordinator:</strong> Must be a Team Coordinator (TC)</li>
          <li className="pt-1">
            <strong>Example:</strong> "2 Flex + 1 Regular" means 2 Flex operators and 1 Regular operator required
          </li>
        </ul>
      </div>
    </div>
  );
};

export default TaskRequirementsSettings;
