/**
 * User Management Settings Component
 *
 * Allows Team Leaders to view and manage team members in their shift.
 * Features:
 * - View all team members
 * - See user details (role, user code, join date)
 * - Deactivate/reactivate TC accounts
 * - Search and filter users
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Crown,
  Shield,
  UserMinus,
  UserPlus,
  Calendar,
  Hash,
  Loader2,
  AlertCircle,
  Key,
  Copy,
  X,
} from 'lucide-react';
import { getTeamMembers, deactivateUser, reactivateUser, generateTemporaryPassword } from '../services/supabase/authService';
import type { CloudUser } from '../services/supabase/authService';
import { getInitials } from '../types';

interface UserManagementSettingsProps {
  currentUser: CloudUser;
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

/**
 * Validates that a profile picture URL is a safe image data URL
 * Prevents XSS attacks via malicious data URLs
 */
function isValidImageDataUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Only allow data URLs with safe image MIME types
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(url);
}

export default function UserManagementSettings({
  currentUser,
  theme,
  styles,
  toast,
}: UserManagementSettingsProps) {
  const [teamMembers, setTeamMembers] = useState<CloudUser[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<CloudUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'Team Leader' | 'TC'>('all');
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    show: boolean;
    userCode: string;
    userName: string;
    temporaryPassword: string;
  } | null>(null);

  // Load team members on mount
  useEffect(() => {
    loadTeamMembers();
  }, []);

  // Filter members when search or filters change
  useEffect(() => {
    let filtered = teamMembers;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (member) =>
          member.displayName.toLowerCase().includes(term) ||
          member.userCode.toLowerCase().includes(term) ||
          member.email?.toLowerCase().includes(term)
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter((member) => member.role === filterRole);
    }

    // Deactivated filter
    if (!showDeactivated) {
      filtered = filtered.filter((member) => !member.preferences?.deactivated);
    }

    setFilteredMembers(filtered);
  }, [teamMembers, searchTerm, filterRole, showDeactivated]);

  const loadTeamMembers = async () => {
    setIsLoading(true);
    try {
      const members = await getTeamMembers();
      setTeamMembers(members);
    } catch (error) {
      console.error('[UserManagement] Failed to load team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}? They will not be able to log in.`)) {
      return;
    }

    setActioningUserId(userId);
    try {
      await deactivateUser(userId);
      toast.success(`${userName} has been deactivated`);
      await loadTeamMembers();
    } catch (error) {
      console.error('[UserManagement] Failed to deactivate user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to deactivate user');
    } finally {
      setActioningUserId(null);
    }
  };

  const handleReactivate = async (userId: string, userName: string) => {
    setActioningUserId(userId);
    try {
      await reactivateUser(userId);
      toast.success(`${userName} has been reactivated`);
      await loadTeamMembers();
    } catch (error) {
      console.error('[UserManagement] Failed to reactivate user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate user');
    } finally {
      setActioningUserId(null);
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`Reset password for ${userName}?\n\nA temporary password will be generated. You'll need to write it down and give it to them in person.`)) {
      return;
    }

    setActioningUserId(userId);
    try {
      const { temporaryPassword, userCode } = await generateTemporaryPassword(userId);

      // Show modal with temporary password
      setResetPasswordModal({
        show: true,
        userCode,
        userName,
        temporaryPassword,
      });

      toast.success(`Temporary password generated for ${userName}`);
    } catch (error) {
      console.error('[UserManagement] Failed to reset password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setActioningUserId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isTeamLeader = currentUser.role === 'Team Leader';
  const activeMembersCount = teamMembers.filter((m) => !m.preferences?.deactivated).length;
  const deactivatedCount = teamMembers.filter((m) => m.preferences?.deactivated).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${styles.text}`}>Team Management</h2>
        <p className={`text-sm ${styles.muted}`}>
          View and manage members of {currentUser.shiftName}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-xl border ${
            theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                theme === 'Midnight' ? 'bg-indigo-500/20' : 'bg-blue-100'
              }`}
            >
              <Users
                className={`w-5 h-5 ${theme === 'Midnight' ? 'text-indigo-400' : 'text-blue-600'}`}
              />
            </div>
            <div>
              <p className={`text-2xl font-bold ${styles.text}`}>{activeMembersCount}</p>
              <p className={`text-xs ${styles.muted}`}>Active Members</p>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                theme === 'Midnight' ? 'bg-amber-500/20' : 'bg-amber-100'
              }`}
            >
              <Crown
                className={`w-5 h-5 ${theme === 'Midnight' ? 'text-amber-400' : 'text-amber-600'}`}
              />
            </div>
            <div>
              <p className={`text-2xl font-bold ${styles.text}`}>
                {teamMembers.filter((m) => m.role === 'Team Leader' && !m.preferences?.deactivated).length}
              </p>
              <p className={`text-xs ${styles.muted}`}>Team Leaders</p>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                theme === 'Midnight' ? 'bg-emerald-500/20' : 'bg-emerald-100'
              }`}
            >
              <Shield
                className={`w-5 h-5 ${
                  theme === 'Midnight' ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              />
            </div>
            <div>
              <p className={`text-2xl font-bold ${styles.text}`}>
                {teamMembers.filter((m) => m.role === 'TC' && !m.preferences?.deactivated).length}
              </p>
              <p className={`text-xs ${styles.muted}`}>Team Coordinators</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`p-4 rounded-xl border ${
          theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${styles.muted}`}
            />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as 'all' | 'Team Leader' | 'TC')}
            className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
              theme === 'Midnight'
                ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
            }`}
          >
            <option value="all">All Roles</option>
            <option value="Team Leader">Team Leaders</option>
            <option value="TC">Team Coordinators</option>
          </select>

          {/* Show Deactivated Toggle */}
          {deactivatedCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeactivated}
                onChange={(e) => setShowDeactivated(e.target.checked)}
                className="rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className={`text-sm ${styles.text}`}>
                Show deactivated ({deactivatedCount})
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Team Members List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className={`w-8 h-8 animate-spin ${styles.muted}`} />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div
          className={`p-8 rounded-xl border text-center ${
            theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${styles.muted}`} />
          <p className={`${styles.muted}`}>
            {searchTerm || filterRole !== 'all' ? 'No members match your filters' : 'No team members found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const isDeactivated = member.preferences?.deactivated;
            const isCurrentUser = member.id === currentUser.id;
            const canDeactivate = isTeamLeader && !isCurrentUser && member.role !== 'Team Leader';

            return (
              <div
                key={member.id}
                className={`p-4 rounded-xl border ${
                  theme === 'Midnight'
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-gray-200'
                } ${isDeactivated ? 'opacity-60' : ''}`}
              >
                {/* Avatar & Name */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar - with XSS protection */}
                  {isValidImageDataUrl(member.preferences?.profilePicture) ? (
                    <img
                      src={member.preferences.profilePicture}
                      alt={member.displayName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/30"
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                        member.role === 'Team Leader'
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                          : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
                      }`}
                    >
                      {getInitials(member.displayName)}
                    </div>
                  )}

                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold truncate ${styles.text}`}>
                        {member.displayName}
                      </h3>
                      {isCurrentUser && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            theme === 'Midnight' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {member.role === 'Team Leader' ? (
                        <Crown className="w-3 h-3 text-amber-500" />
                      ) : (
                        <Shield className="w-3 h-3 text-emerald-500" />
                      )}
                      <span
                        className={`text-xs ${
                          member.role === 'Team Leader' ? 'text-amber-500' : 'text-emerald-500'
                        }`}
                      >
                        {member.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Hash className={`w-3 h-3 ${styles.muted}`} />
                    <span className={`text-xs ${styles.muted}`}>
                      {member.userCode}
                    </span>
                  </div>
                  {member.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-3 h-3 ${styles.muted}`} />
                      <span className={`text-xs ${styles.muted}`}>
                        Joined {formatDate(member.createdAt)}
                      </span>
                    </div>
                  )}
                  {isDeactivated && (
                    <div className="flex items-center gap-2">
                      <UserMinus className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-red-500">Deactivated</span>
                    </div>
                  )}
                </div>

                {/* Actions (Team Leaders only) */}
                {canDeactivate && (
                  <div className="pt-3 border-t border-gray-200 dark:border-slate-700 space-y-2">
                    {isDeactivated ? (
                      <button
                        onClick={() => handleReactivate(member.id, member.displayName)}
                        disabled={actioningUserId === member.id}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          theme === 'Midnight'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {actioningUserId === member.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Reactivating...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            Reactivate
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleResetPassword(member.id, member.displayName)}
                          disabled={actioningUserId === member.id}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            theme === 'Midnight'
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {actioningUserId === member.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            <>
                              <Key className="w-3 h-3" />
                              Reset Password
                            </>
                          )}
                        </button>

                        {/* Deactivate Button */}
                        <button
                          onClick={() => handleDeactivate(member.id, member.displayName)}
                          disabled={actioningUserId === member.id}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            theme === 'Midnight'
                              ? 'bg-red-600 hover:bg-red-500 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {actioningUserId === member.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Deactivating...
                            </>
                          ) : (
                            <>
                              <UserMinus className="w-3 h-3" />
                              Deactivate
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Password Reset Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`max-w-md w-full rounded-xl border shadow-2xl ${
              theme === 'Midnight'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    theme === 'Midnight' ? 'bg-amber-500/20' : 'bg-amber-100'
                  }`}
                >
                  <Key
                    className={`w-5 h-5 ${
                      theme === 'Midnight' ? 'text-amber-400' : 'text-amber-600'
                    }`}
                  />
                </div>
                <h3 className={`text-lg font-bold ${styles.text}`}>
                  Temporary Password Generated
                </h3>
              </div>
              <button
                onClick={() => setResetPasswordModal(null)}
                className={`p-1 rounded-lg transition-colors ${
                  theme === 'Midnight'
                    ? 'hover:bg-slate-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* User Info */}
              <div
                className={`p-4 rounded-lg ${
                  theme === 'Midnight' ? 'bg-slate-700/50' : 'bg-gray-50'
                }`}
              >
                <p className={`text-sm ${styles.muted} mb-1`}>Password reset for:</p>
                <p className={`font-semibold ${styles.text}`}>
                  {resetPasswordModal.userName}
                </p>
                <p className={`text-sm ${styles.muted}`}>
                  User Code: {resetPasswordModal.userCode}
                </p>
              </div>

              {/* Temporary Password */}
              <div>
                <label className={`block text-sm font-medium ${styles.text} mb-2`}>
                  Temporary Password
                </label>
                <div className="flex gap-2">
                  <div
                    className={`flex-1 p-4 rounded-lg border-2 font-mono text-2xl tracking-wider text-center ${
                      theme === 'Midnight'
                        ? 'bg-slate-900 border-amber-500/50 text-amber-400'
                        : 'bg-amber-50 border-amber-500 text-amber-900'
                    }`}
                  >
                    {resetPasswordModal.temporaryPassword}
                  </div>
                  <button
                    onClick={() => copyToClipboard(resetPasswordModal.temporaryPassword)}
                    className={`px-4 rounded-lg border-2 transition-colors ${
                      theme === 'Midnight'
                        ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-gray-300'
                        : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700'
                    }`}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div
                className={`p-4 rounded-lg border ${
                  theme === 'Midnight'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <p className={`text-sm font-medium mb-2 ${styles.text}`}>
                  Important Instructions:
                </p>
                <ul className={`text-sm space-y-1 ${styles.muted}`}>
                  <li>• Write down this password (it won't be shown again)</li>
                  <li>• Give it to the user in person</li>
                  <li>• They must change it on their next login</li>
                  <li>• The old password will no longer work</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setResetPasswordModal(null)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'Midnight'
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
