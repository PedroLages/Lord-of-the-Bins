import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, X, Users, Calendar, Settings, LayoutDashboard,
  Sparkles, FileDown, User, Zap, ArrowRight, Command
} from 'lucide-react';
import { Operator, TaskType } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  operators: Operator[];
  tasks: TaskType[];
  onNavigate: (tab: string) => void;
  onSelectOperator: (operator: Operator) => void;
  onGenerateSchedule: () => void;
  onExport: () => void;
}

type CommandCategory = 'operators' | 'navigation' | 'actions';

interface CommandItem {
  id: string;
  category: CommandCategory;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  theme,
  operators,
  tasks,
  onNavigate,
  onSelectOperator,
  onGenerateSchedule,
  onExport,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'Midnight';

  // Build command items
  const allCommands: CommandItem[] = useMemo(() => {
    const commands: CommandItem[] = [];

    // Navigation commands
    commands.push(
      {
        id: 'nav-schedule',
        category: 'navigation',
        label: 'Go to Schedule',
        description: 'View weekly assignments',
        icon: Calendar,
        action: () => { onNavigate('schedule'); onClose(); },
        keywords: ['schedule', 'weekly', 'assignments', 'calendar'],
      },
      {
        id: 'nav-team',
        category: 'navigation',
        label: 'Go to Team',
        description: 'Manage operators',
        icon: Users,
        action: () => { onNavigate('team'); onClose(); },
        keywords: ['team', 'operators', 'workforce', 'members'],
      },
      {
        id: 'nav-dashboard',
        category: 'navigation',
        label: 'Go to Dashboard',
        description: 'View statistics',
        icon: LayoutDashboard,
        action: () => { onNavigate('dashboard'); onClose(); },
        keywords: ['dashboard', 'stats', 'overview', 'analytics'],
      },
      {
        id: 'nav-settings',
        category: 'navigation',
        label: 'Go to Settings',
        description: 'Configure tasks & rules',
        icon: Settings,
        action: () => { onNavigate('settings'); onClose(); },
        keywords: ['settings', 'config', 'tasks', 'rules'],
      },
    );

    // Action commands
    commands.push(
      {
        id: 'action-generate',
        category: 'actions',
        label: 'Generate Schedule',
        description: 'Auto-fill assignments',
        icon: Sparkles,
        action: () => { onGenerateSchedule(); onClose(); },
        keywords: ['generate', 'auto', 'fill', 'create', 'schedule'],
      },
      {
        id: 'action-export',
        category: 'actions',
        label: 'Export Schedule',
        description: 'PNG, PDF, or WhatsApp',
        icon: FileDown,
        action: () => { onExport(); onClose(); },
        keywords: ['export', 'download', 'pdf', 'png', 'share', 'whatsapp'],
      },
    );

    // Operator commands
    operators.forEach(op => {
      commands.push({
        id: `op-${op.id}`,
        category: 'operators',
        label: op.name,
        description: `${op.type} - ${op.skills.slice(0, 3).join(', ')}${op.skills.length > 3 ? '...' : ''}`,
        icon: User,
        action: () => { onSelectOperator(op); onClose(); },
        keywords: [op.name.toLowerCase(), op.type.toLowerCase(), ...op.skills.map(s => s.toLowerCase())],
      });
    });

    return commands;
  }, [operators, onNavigate, onSelectOperator, onGenerateSchedule, onExport, onClose]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show navigation and actions first, then a few operators
      return [
        ...allCommands.filter(c => c.category === 'navigation'),
        ...allCommands.filter(c => c.category === 'actions'),
        ...allCommands.filter(c => c.category === 'operators').slice(0, 3),
      ];
    }

    const q = query.toLowerCase();
    return allCommands.filter(cmd => {
      if (cmd.label.toLowerCase().includes(q)) return true;
      if (cmd.description?.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some(k => k.includes(q))) return true;
      return false;
    });
  }, [query, allCommands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getCategoryLabel = (category: CommandCategory) => {
    switch (category) {
      case 'navigation': return 'Navigation';
      case 'actions': return 'Quick Actions';
      case 'operators': return 'Team Members';
    }
  };

  // Group filtered commands by category
  const groupedCommands: Record<CommandCategory, CommandItem[]> = {
    navigation: filteredCommands.filter(c => c.category === 'navigation'),
    actions: filteredCommands.filter(c => c.category === 'actions'),
    operators: filteredCommands.filter(c => c.category === 'operators'),
  };

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-xl mx-4 rounded-2xl shadow-2xl overflow-hidden border ${
          isDark
            ? 'bg-slate-900 border-slate-700'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Search Input */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${
          isDark ? 'border-slate-800' : 'border-gray-100'
        }`}>
          <Search className={`h-5 w-5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, team members..."
            className={`flex-1 bg-transparent outline-none text-base ${
              isDark ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400'
            }`}
          />
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
            isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'
          }`}>
            <Command className="h-3 w-3" />K
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className={`px-4 py-8 text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
              No results found for "{query}"
            </div>
          ) : (
            (['navigation', 'actions', 'operators'] as CommandCategory[]).map(category => {
              const items = groupedCommands[category];
              if (items.length === 0) return null;

              return (
                <div key={category}>
                  <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
                    isDark ? 'text-slate-500 bg-slate-800/50' : 'text-gray-500 bg-gray-50'
                  }`}>
                    {getCategoryLabel(category)}
                  </div>
                  {items.map(cmd => {
                    globalIndex++;
                    const idx = globalIndex;
                    const isSelected = idx === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        data-index={idx}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? (isDark ? 'bg-indigo-600/20 text-indigo-300' : 'bg-blue-50 text-blue-700')
                            : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-50')
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          isSelected
                            ? (isDark ? 'bg-indigo-600/30' : 'bg-blue-100')
                            : (isDark ? 'bg-slate-800' : 'bg-gray-100')
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{cmd.label}</div>
                          {cmd.description && (
                            <div className={`text-xs truncate ${
                              isDark ? 'text-slate-500' : 'text-gray-500'
                            }`}>
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight className={`h-4 w-4 ${isDark ? 'text-indigo-400' : 'text-blue-500'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2 border-t flex items-center justify-between text-xs ${
          isDark ? 'border-slate-800 text-slate-500' : 'border-gray-100 text-gray-400'
        }`}>
          <div className="flex items-center gap-4">
            <span><kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>↑↓</kbd> navigate</span>
            <span><kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>↵</kbd> select</span>
            <span><kbd className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
