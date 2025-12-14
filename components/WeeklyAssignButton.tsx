import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Zap, CalendarPlus, AlertCircle } from 'lucide-react';
import { Operator, TaskType } from '../types';

interface WeeklyAssignButtonProps {
  operator: Operator;
  tasks: TaskType[];
  onAssign: (operatorId: string, taskId: string) => void;
  onEditOperator?: (operator: Operator) => void;
  disabled?: boolean;
  theme: 'Modern' | 'Midnight';
  isCompactView?: boolean;
}

export const WeeklyAssignButton: React.FC<WeeklyAssignButtonProps> = ({
  operator,
  tasks,
  onAssign,
  onEditOperator,
  disabled = false,
  theme,
  isCompactView = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [menuSide, setMenuSide] = useState<'right' | 'left' | 'bottom'>('right');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'Midnight';

  // Filter tasks by operator's skills
  const availableTasks = tasks.filter(task =>
    operator.skills.includes(task.requiredSkill)
  );

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = Math.min(availableTasks.length * 40 + 60, 320);
      const padding = 8;

      // Determine best side for menu
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      const spaceBottom = window.innerHeight - rect.bottom;

      let side: 'right' | 'left' | 'bottom' = 'right';
      let x = rect.right + padding;
      let y = rect.top;

      if (spaceRight < menuWidth + padding && spaceLeft > menuWidth + padding) {
        // Open to the left
        side = 'left';
        x = rect.left - menuWidth - padding;
      } else if (spaceRight < menuWidth + padding && spaceLeft < menuWidth + padding) {
        // Open below
        side = 'bottom';
        x = rect.left;
        y = rect.bottom + padding;
      }

      // Keep within viewport vertically
      if (y + menuHeight > window.innerHeight - padding) {
        y = window.innerHeight - menuHeight - padding;
      }
      if (y < padding) {
        y = padding;
      }

      setMenuSide(side);
      setCoords({ x, y });
    }
  }, [isOpen, availableTasks.length]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleTaskClick = (taskId: string) => {
    onAssign(operator.id, taskId);
    setIsOpen(false);
  };

  // Don't render in compact view
  if (isCompactView) return null;

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-in fade-in duration-150"
      style={{
        left: coords.x,
        top: coords.y,
        ...(menuSide === 'right' && { animationName: 'slideInFromLeft' }),
        ...(menuSide === 'left' && { animationName: 'slideInFromRight' }),
        ...(menuSide === 'bottom' && { animationName: 'slideInFromTop' }),
      }}
    >
      {/* Arrow pointer */}
      <div
        className={`absolute w-3 h-3 transform rotate-45 ${
          isDark ? 'bg-slate-800' : 'bg-white'
        } ${
          isDark ? 'border-slate-700' : 'border-gray-200'
        } ${
          menuSide === 'right' ? 'left-[-6px] top-4 border-l border-b' :
          menuSide === 'left' ? 'right-[-6px] top-4 border-r border-t' :
          'top-[-6px] left-4 border-l border-t'
        }`}
      />

      <div
        className={`min-w-[200px] max-w-[260px] rounded-xl shadow-2xl border overflow-hidden ${
          isDark
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Header */}
        <div
          className={`px-3 py-2.5 border-b ${
            isDark
              ? 'border-slate-700 bg-slate-900/50'
              : 'border-gray-100 bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarPlus
              className={`h-4 w-4 ${
                isDark ? 'text-indigo-400' : 'text-blue-600'
              }`}
            />
            <span
              className={`text-sm font-medium truncate ${
                isDark ? 'text-slate-200' : 'text-gray-800'
              }`}
            >
              Assign {operator.name}
            </span>
          </div>
          <span
            className={`text-[11px] ${
              isDark ? 'text-slate-500' : 'text-gray-400'
            }`}
          >
            For entire week (Mon-Fri)
          </span>
        </div>

        {/* Task List */}
        {availableTasks.length > 0 ? (
          <div className="py-1 max-h-[260px] overflow-y-auto">
            {availableTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task.id)}
                className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-all ${
                  isDark
                    ? 'hover:bg-indigo-500/20 text-slate-200 active:bg-indigo-500/30'
                    : 'hover:bg-blue-50 text-gray-700 active:bg-blue-100'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-md shrink-0 shadow-sm"
                  style={{ backgroundColor: task.color }}
                />
                <span className="text-sm truncate">{task.name}</span>
              </button>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="px-4 py-6 text-center">
            <AlertCircle
              className={`h-8 w-8 mx-auto mb-2 ${
                isDark ? 'text-slate-600' : 'text-gray-300'
              }`}
            />
            <p
              className={`text-sm font-medium mb-1 ${
                isDark ? 'text-slate-400' : 'text-gray-500'
              }`}
            >
              No available tasks
            </p>
            <p
              className={`text-xs mb-3 ${
                isDark ? 'text-slate-500' : 'text-gray-400'
              }`}
            >
              Operator has no assigned skills
            </p>
            {onEditOperator && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onEditOperator(operator);
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isDark
                    ? 'text-indigo-400 hover:bg-indigo-500/20'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                Edit operator skills
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={`Assign task to ${operator.name} for entire week`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`
          flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
          transition-all duration-150 shrink-0
          ${disabled
            ? isDark
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-gray-300 cursor-not-allowed'
            : isOpen
              ? isDark
                ? 'bg-indigo-500/30 text-indigo-300'
                : 'bg-blue-100 text-blue-700'
              : isDark
                ? 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
          }
        `}
        title={disabled ? 'Schedule is locked' : 'Assign task for entire week'}
      >
        <Zap className="h-3.5 w-3.5" />
        <span>Week</span>
      </button>

      {menu && createPortal(menu, document.body)}

      {/* CSS animations */}
      <style>{`
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default WeeklyAssignButton;
