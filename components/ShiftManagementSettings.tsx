/**
 * Shift Management Settings Component
 *
 * Allows Team Leaders to customize shift names.
 */

import React, { useState, useEffect } from 'react';
import { Repeat, Save, Loader2, Check, AlertCircle, Crown } from 'lucide-react';
import { getShifts, updateShiftName } from '../services/supabase/authService';
import type { CloudUser } from '../services/supabase/authService';

interface ShiftManagementSettingsProps {
  user: CloudUser;
  theme: string;
  styles: {
    text: string;
    muted: string;
    card: string;
    [key: string]: string;
  };
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

interface Shift {
  id: string;
  name: string;
}

export default function ShiftManagementSettings({
  user,
  theme,
  styles,
  toast,
}: ShiftManagementSettingsProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is Team Leader
  const isTeamLeader = user.role === 'Team Leader';

  // Load shifts on mount
  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const shiftsData = await getShifts();
      setShifts(shiftsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts');
      toast.error('Failed to load shifts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShiftId(shift.id);
    setEditValue(shift.name);
  };

  const handleCancel = () => {
    setEditingShiftId(null);
    setEditValue('');
  };

  const handleSave = async (shiftId: string) => {
    if (!editValue.trim()) {
      toast.error('Shift name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateShiftName(shiftId, editValue);

      // Update local state
      setShifts(prev => prev.map(s =>
        s.id === shiftId ? { ...s, name: editValue } : s
      ));

      setEditingShiftId(null);
      setEditValue('');
      toast.success('Shift name updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update shift name');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`h-8 w-8 animate-spin ${styles.muted}`} />
      </div>
    );
  }

  if (!isTeamLeader) {
    return (
      <div className="space-y-8">
        <div className="mb-6">
          <h2 className={`text-xl font-bold ${styles.text}`}>Shift Management</h2>
          <p className={`text-sm ${styles.muted}`}>View shift information.</p>
        </div>

        <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-center gap-2 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl text-sm text-blue-400 mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Only Team Leaders can customize shift names</span>
          </div>

          <div className="space-y-3">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className={`p-4 rounded-xl border ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/30 border-slate-600'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Repeat className={`w-5 h-5 ${styles.muted}`} />
                  <div>
                    <div className={`font-medium ${styles.text}`}>{shift.name}</div>
                    <div className={`text-xs ${styles.muted}`}>
                      {shift.id === user.shiftId && '(Your shift)'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${styles.text}`}>Shift Management</h2>
        <p className={`text-sm ${styles.muted}`}>Customize shift names for your organization.</p>
      </div>

      <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-6">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className={`text-sm font-bold uppercase tracking-wide ${styles.text}`}>
            Team Leader Settings
          </h3>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-400 mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className={`p-4 rounded-xl border ${
                theme === 'Midnight'
                  ? 'bg-slate-700/30 border-slate-600'
                  : 'bg-white border-gray-200'
              }`}
            >
              {editingShiftId === shift.id ? (
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
                      Shift Name
                    </label>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      maxLength={50}
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                        theme === 'Midnight'
                          ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="Enter shift name"
                      autoFocus
                    />
                    <p className={`text-xs mt-1 ${styles.muted}`}>
                      {editValue.length}/50 characters
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(shift.id)}
                      disabled={isSaving || !editValue.trim()}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        theme === 'Midnight'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        theme === 'Midnight'
                          ? 'text-slate-400 hover:bg-slate-700/50'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Repeat className={`w-5 h-5 ${styles.muted}`} />
                    <div>
                      <div className={`font-medium ${styles.text}`}>{shift.name}</div>
                      <div className={`text-xs ${styles.muted}`}>
                        {shift.id === user.shiftId && '(Your shift)'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(shift)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      theme === 'Midnight'
                        ? 'text-indigo-400 hover:bg-slate-700/50'
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    Rename
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`mt-6 p-4 rounded-xl ${theme === 'Midnight' ? 'bg-slate-700/20' : 'bg-gray-100'}`}>
          <p className={`text-sm ${styles.muted}`}>
            <strong>Note:</strong> Changing shift names will update them across the entire application for all users.
            Choose meaningful names that reflect your organization's structure (e.g., "Day Shift", "Night Shift", "Morning Team", etc.).
          </p>
        </div>
      </div>
    </div>
  );
}
