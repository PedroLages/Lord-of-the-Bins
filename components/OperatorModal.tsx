import React, { useState, useEffect } from 'react';
import { X, Check, CalendarDays, Activity, Heart } from 'lucide-react';
import { Operator, INITIAL_SKILLS, TC_SKILLS, WeekDay, MOCK_TASKS } from '../types';

interface OperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (operator: Operator) => void;
  operator?: Operator | null;
  skills?: string[]; // Custom skills, defaults to INITIAL_SKILLS if not provided
}

const OperatorModal: React.FC<OperatorModalProps> = ({ isOpen, onClose, onSave, operator, skills: customSkills }) => {
  // Use provided skills or fall back to INITIAL_SKILLS
  const availableSkills = customSkills || INITIAL_SKILLS;
  const [name, setName] = useState('');
  const [type, setType] = useState<Operator['type']>('Regular');
  const [status, setStatus] = useState<Operator['status']>('Active');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [preferredTasks, setPreferredTasks] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Record<WeekDay, boolean>>({
    Mon: true, Tue: true, Wed: true, Thu: true, Fri: true
  });
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setAnimateIn(true), 10);
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

  useEffect(() => {
    if (operator) {
      setName(operator.name);
      setType(operator.type);
      setStatus(operator.status);
      setSelectedSkills(operator.skills);
      setPreferredTasks(operator.preferredTasks || []);
      setAvailability(operator.availability || { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true });
    } else {
      setName('');
      setType('Regular');
      setStatus('Active');
      setSelectedSkills([]);
      setPreferredTasks([]);
      setAvailability({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true });
    }
  }, [operator, isOpen]);

  if (!isOpen) return null;

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handlePreferredTaskToggle = (taskName: string) => {
    setPreferredTasks(prev =>
      prev.includes(taskName)
        ? prev.filter(t => t !== taskName)
        : [...prev, taskName]
    );
  };

  const handleAvailabilityToggle = (day: WeekDay) => {
    setAvailability(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: operator?.id || crypto.randomUUID(),
      name,
      type,
      status,
      skills: selectedSkills,
      preferredTasks,
      availability
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-all duration-300 transform ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{operator ? 'Edit Profile' : 'New Team Member'}</h2>
            <p className="text-sm text-gray-500 mt-1">Manage operator details and qualifications.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200/50 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Name & Role */}
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-gray-800 placeholder-gray-400"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Role Type</label>
              <div className="grid grid-cols-3 gap-3">
                {['Regular', 'Flex', 'Coordinator'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setType(role as any)}
                    className={`flex items-center justify-center py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      type === role
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status & Availability Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-gray-100">
             {/* Status */}
             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <Activity className="h-3 w-3" /> Current Status
                </label>
                <div className="space-y-2">
                   {[
                     { id: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
                     { id: 'Sick', color: 'bg-red-100 text-red-700 border-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
                     { id: 'Leave', color: 'bg-amber-100 text-amber-700 border-amber-200', activeColor: 'bg-amber-500 text-white border-amber-500' }
                   ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStatus(s.id as any)}
                        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                           status === s.id ? s.activeColor : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                         <span>{s.id}</span>
                         {status === s.id && <Check className="h-4 w-4" />}
                      </button>
                   ))}
                </div>
             </div>

             {/* Availability */}
             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <CalendarDays className="h-3 w-3" /> Availability Pattern
                </label>

                {/* Quick Pattern Presets */}
                <div className="flex flex-wrap gap-2 mb-3">
                   {[
                     { label: 'Full Week', pattern: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
                     { label: 'Early Week', pattern: { Mon: true, Tue: true, Wed: true, Thu: false, Fri: false } },
                     { label: 'Late Week', pattern: { Mon: false, Tue: false, Wed: true, Thu: true, Fri: true } },
                     { label: '4 Days', pattern: { Mon: true, Tue: true, Wed: false, Thu: true, Fri: true } },
                     { label: 'None', pattern: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false } },
                   ].map((preset) => {
                      const isActive = Object.keys(preset.pattern).every(
                        day => availability[day as WeekDay] === preset.pattern[day as WeekDay]
                      );
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setAvailability(preset.pattern)}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full border transition-all ${
                            isActive
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                   })}
                </div>

                {/* Day-by-day Toggle */}
                <div className="grid grid-cols-5 gap-2">
                   {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as WeekDay[]).map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleAvailabilityToggle(day)}
                        className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${
                           availability[day]
                             ? 'bg-blue-50 border-blue-200 text-blue-700'
                             : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}
                      >
                         <span className="text-[10px] font-bold uppercase">{day}</span>
                         <div className={`w-2 h-2 rounded-full mt-1 ${availability[day] ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      </button>
                   ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                   Set the recurring weekly availability pattern for this operator.
                </p>
             </div>
          </div>

          {/* Skills Section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Skills & Certifications</label>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{selectedSkills.length} Selected</span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {/* Filter skills based on operator type:
                  - Coordinators: only TC skills (Process, People, Off Process, Process/AD)
                  - Regular/Flex: all skills EXCEPT TC skills */}
              {(type === 'Coordinator'
                ? availableSkills.filter(skill => TC_SKILLS.includes(skill))
                : availableSkills.filter(skill => !TC_SKILLS.includes(skill))
              ).map(skill => {
                 const isSelected = selectedSkills.includes(skill);
                 return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleSkillToggle(skill)}
                    className={`group relative pl-3 pr-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Tasks Section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Preferred Tasks (Optional)</label>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">{preferredTasks.length} Selected</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Select tasks this operator prefers. They'll get priority for these assignments.</p>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {/* Only show tasks that match the operator's selected skills */}
              {MOCK_TASKS.filter(task => selectedSkills.includes(task.requiredSkill)).map(task => {
                const isPreferred = preferredTasks.includes(task.name);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handlePreferredTaskToggle(task.name)}
                    className={`group relative pl-3 pr-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                      isPreferred
                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isPreferred ? 'bg-purple-500 border-purple-500' : 'border-gray-300 bg-white'}`}>
                      {isPreferred && <Heart className="w-2.5 h-2.5 text-white fill-white" />}
                    </div>
                    {task.name}
                  </button>
                );
              })}
              {MOCK_TASKS.filter(task => selectedSkills.includes(task.requiredSkill)).length === 0 && (
                <p className="text-xs text-gray-400 italic">Select skills first to see available tasks</p>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OperatorModal;
