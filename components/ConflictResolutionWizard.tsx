import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, ArrowRight, Lightbulb, ChevronRight } from 'lucide-react';
import type { ScheduleConflict, ConflictResolution, Operator, TaskType, WeekDay, ScheduleAssignment } from '../types';

interface ConflictResolutionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ScheduleConflict[];
  resolutions: ConflictResolution[];
  operators: Operator[];
  tasks: TaskType[];
  onApplyResolution: (resolution: ConflictResolution) => void;
  theme: 'Modern' | 'Midnight';
}

const ConflictResolutionWizard: React.FC<ConflictResolutionWizardProps> = ({
  isOpen,
  onClose,
  conflicts,
  resolutions,
  operators,
  tasks,
  onApplyResolution,
  theme,
}) => {
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);
  const [appliedResolutions, setAppliedResolutions] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const currentConflict = conflicts[selectedConflictIndex];
  const availableResolutions = currentConflict
    ? resolutions.filter(r => r.conflictId === currentConflict.id)
    : [];

  const handleApplyResolution = (resolution: ConflictResolution) => {
    onApplyResolution(resolution);
    setAppliedResolutions(prev => new Set([...prev, currentConflict.id]));

    // Move to next conflict if available
    if (selectedConflictIndex < conflicts.length - 1) {
      setSelectedConflictIndex(selectedConflictIndex + 1);
    }
  };

  const handleSkipConflict = () => {
    if (selectedConflictIndex < conflicts.length - 1) {
      setSelectedConflictIndex(selectedConflictIndex + 1);
    }
  };

  const getConflictIcon = (type: ScheduleConflict['type']) => {
    switch (type) {
      case 'skill-mismatch':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'availability':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'double-assignment':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'understaffed':
        return <AlertTriangle className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-emerald-600';
    if (confidence >= 75) return 'text-blue-600';
    return 'text-amber-600';
  };

  const styles = {
    bg: theme === 'Midnight' ? 'bg-slate-900' : 'bg-white',
    text: theme === 'Midnight' ? 'text-slate-100' : 'text-gray-900',
    textMuted: theme === 'Midnight' ? 'text-slate-400' : 'text-gray-600',
    border: theme === 'Midnight' ? 'border-slate-700' : 'border-gray-200',
    hover: theme === 'Midnight' ? 'hover:bg-slate-800' : 'hover:bg-gray-50',
    selected: theme === 'Midnight' ? 'bg-slate-800 border-blue-500' : 'bg-blue-50 border-blue-500',
    btn: theme === 'Midnight'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-blue-500 hover:bg-blue-600 text-white',
    btnSecondary: theme === 'Midnight'
      ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  };

  if (conflicts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className={`${styles.bg} rounded-lg shadow-xl p-8 max-w-md w-full mx-4`}>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <h2 className={`text-xl font-bold ${styles.text}`}>No Conflicts Found</h2>
          </div>
          <p className={styles.textMuted}>Your schedule has no conflicts. Everything looks good!</p>
          <button
            onClick={onClose}
            className={`mt-6 w-full px-4 py-2 rounded-md ${styles.btn} transition-colors`}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`${styles.bg} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${styles.border}`}>
          <div>
            <h2 className={`text-2xl font-bold ${styles.text}`}>Conflict Resolution Wizard</h2>
            <p className={styles.textMuted}>
              Resolve {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} in your schedule
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-md ${styles.hover} transition-colors`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-medium ${styles.text}`}>
              Progress: {appliedResolutions.size} / {conflicts.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(appliedResolutions.size / conflicts.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Conflict List (Sidebar) */}
        <div className="flex flex-1 overflow-hidden">
          <div className={`w-64 border-r ${styles.border} overflow-y-auto`}>
            <div className="p-4 space-y-2">
              {conflicts.map((conflict, index) => (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflictIndex(index)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedConflictIndex === index ? styles.selected : styles.hover
                  } ${styles.border}`}
                >
                  <div className="flex items-start gap-2">
                    {appliedResolutions.has(conflict.id) ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      getConflictIcon(conflict.type)
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${styles.text} truncate`}>
                        {conflict.day}
                      </p>
                      <p className={`text-xs ${styles.textMuted} truncate`}>
                        {conflict.operatorName || conflict.taskName}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {currentConflict && (
              <div className="space-y-6">
                {/* Current Conflict */}
                <div className={`p-4 rounded-lg border ${styles.border} ${styles.bg}`}>
                  <div className="flex items-start gap-3 mb-3">
                    {getConflictIcon(currentConflict.type)}
                    <div className="flex-1">
                      <h3 className={`font-semibold ${styles.text}`}>{currentConflict.message}</h3>
                      <p className={`text-sm ${styles.textMuted} mt-1`}>
                        {currentConflict.day} • {currentConflict.type.replace('-', ' ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className={`h-5 w-5 ${styles.textMuted}`} />
                    <h4 className={`font-semibold ${styles.text}`}>Suggested Solutions</h4>
                  </div>

                  {availableResolutions.length === 0 ? (
                    <p className={styles.textMuted}>No automatic solutions available for this conflict.</p>
                  ) : (
                    <div className="space-y-3">
                      {availableResolutions.map((resolution, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${styles.border} ${styles.hover} cursor-pointer transition-all`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              {resolution.actions.map((action, actionIdx) => (
                                <p key={actionIdx} className={`${styles.text} mb-2`}>
                                  {action.description}
                                </p>
                              ))}

                              {resolution.introduces.length > 0 && (
                                <p className="text-sm text-amber-600 mt-2">
                                  ⚠ {resolution.introduces.join(', ')}
                                </p>
                              )}

                              <div className="flex items-center gap-4 mt-3">
                                <span className={`text-sm font-medium ${getConfidenceColor(resolution.confidence)}`}>
                                  {resolution.confidence}% confidence
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleApplyResolution(resolution)}
                              className={`px-4 py-2 rounded-md ${styles.btn} flex items-center gap-2 transition-colors whitespace-nowrap`}
                            >
                              Apply
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <button
                    onClick={handleSkipConflict}
                    disabled={selectedConflictIndex >= conflicts.length - 1}
                    className={`px-4 py-2 rounded-md ${styles.btnSecondary} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Skip
                  </button>

                  {selectedConflictIndex < conflicts.length - 1 && (
                    <button
                      onClick={() => setSelectedConflictIndex(selectedConflictIndex + 1)}
                      className={`px-4 py-2 rounded-md ${styles.btnSecondary} flex items-center gap-2 transition-colors`}
                    >
                      Next Conflict
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className={`ml-auto px-4 py-2 rounded-md ${styles.btnSecondary} transition-colors`}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionWizard;
