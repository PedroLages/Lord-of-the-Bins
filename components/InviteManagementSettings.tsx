/**
 * Invite Management Settings Component
 *
 * Allows Team Leaders to generate and manage invite links for new team members.
 */

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Copy,
  Check,
  Clock,
  Ban,
  Shield,
  Crown,
  AlertCircle,
  Loader2,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import {
  generateInviteToken,
  getInviteTokens,
  revokeInviteToken,
  type InviteToken,
  type CloudUser,
} from '../services/supabase/authService';

interface InviteManagementSettingsProps {
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

export default function InviteManagementSettings({
  currentUser,
  theme,
  styles,
  toast,
}: InviteManagementSettingsProps) {
  const [inviteTokens, setInviteTokens] = useState<InviteToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'TC' | 'Team Leader'>('TC');
  const [expiresInDays, setExpiresInDays] = useState(7);

  // Check if user is Team Leader
  const isTeamLeader = currentUser.role === 'Team Leader';

  useEffect(() => {
    if (isTeamLeader) {
      loadInviteTokens();
    } else {
      setIsLoading(false);
    }
  }, [isTeamLeader]);

  const loadInviteTokens = async () => {
    setIsLoading(true);
    try {
      const tokens = await getInviteTokens();
      setInviteTokens(tokens);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load invite tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      const token = await generateInviteToken(selectedRole, expiresInDays * 24);
      await loadInviteTokens();
      toast.success(`Invite link generated for ${selectedRole}`);

      // Auto-copy the new token
      const inviteUrl = getInviteUrl(token.token);
      await copyToClipboard(inviteUrl, token.token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate invite link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeToken = async (tokenId: string, role: string) => {
    if (!confirm(`Are you sure you want to revoke this ${role} invite link? It will no longer work.`)) {
      return;
    }

    setRevokingTokenId(tokenId);
    try {
      await revokeInviteToken(tokenId);
      await loadInviteTokens();
      toast.success('Invite link revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invite link');
    } finally {
      setRevokingTokenId(null);
    }
  };

  const getInviteUrl = (token: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?invite=${token}`;
  };

  const copyToClipboard = async (url: string, tokenId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(tokenId);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopiedToken(null), 3000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getStatusColor = (status: InviteToken['status']) => {
    switch (status) {
      case 'active':
        return 'text-emerald-500 bg-emerald-500/20';
      case 'used':
        return 'text-blue-500 bg-blue-500/20';
      case 'expired':
        return 'text-amber-500 bg-amber-500/20';
      case 'revoked':
        return 'text-red-500 bg-red-500/20';
      default:
        return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: InviteToken['status']) => {
    switch (status) {
      case 'active':
        return <Check className="w-4 h-4" />;
      case 'used':
        return <Check className="w-4 h-4" />;
      case 'expired':
        return <Clock className="w-4 h-4" />;
      case 'revoked':
        return <Ban className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry > 0 && hoursUntilExpiry < 24;
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
          <h2 className={`text-xl font-bold ${styles.text}`}>Invite Management</h2>
          <p className={`text-sm ${styles.muted}`}>Manage team member invitations.</p>
        </div>

        <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-center gap-2 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl text-sm text-blue-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Only Team Leaders can manage invite links</span>
          </div>
        </div>
      </div>
    );
  }

  const activeTokens = inviteTokens.filter(t => t.status === 'active');
  const usedTokens = inviteTokens.filter(t => t.status === 'used');
  const inactiveTokens = inviteTokens.filter(t => t.status === 'expired' || t.status === 'revoked');

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${styles.text}`}>Invite Management</h2>
        <p className={`text-sm ${styles.muted}`}>Generate secure invite links for new team members.</p>
      </div>

      {/* Generate New Invite */}
      <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-6">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className={`text-sm font-bold uppercase tracking-wide ${styles.text}`}>
            Generate Invite Link
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'TC' | 'Team Leader')}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
            >
              <option value="TC">Team Coordinator (TC)</option>
              <option value="Team Leader">Team Leader</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Expires In
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerateInvite}
              disabled={isGenerating}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'Midnight'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Generate Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className={`p-4 rounded-xl ${theme === 'Midnight' ? 'bg-slate-700/20' : 'bg-gray-100'}`}>
          <p className={`text-xs ${styles.muted}`}>
            <strong>Note:</strong> The invite link will allow new users to create an account with the selected role in your shift.
            Links expire automatically after the specified time period.
          </p>
        </div>
      </div>

      {/* Active Invites */}
      {activeTokens.length > 0 && (
        <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wide mb-4 ${styles.muted}`}>
            Active Invite Links ({activeTokens.length})
          </h3>

          <div className="space-y-3">
            {activeTokens.map((token) => (
              <div
                key={token.id}
                className={`p-4 rounded-xl border ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/30 border-slate-600'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {token.role === 'Team Leader' ? (
                        <Crown className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-emerald-500" />
                      )}
                      <span className={`font-medium ${styles.text}`}>{token.role}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(token.status)}`}>
                        {token.status}
                      </span>
                    </div>

                    <div className={`text-xs ${styles.muted} space-y-1`}>
                      <div>Created by {token.createdByName} • {formatDate(token.createdAt)}</div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires {formatDate(token.expiresAt)}
                        {isExpiringSoon(token.expiresAt) && (
                          <span className="text-amber-500 font-medium">(expires soon!)</span>
                        )}
                      </div>
                    </div>

                    <div className={`mt-3 flex items-center gap-2 p-2 rounded-lg ${theme === 'Midnight' ? 'bg-slate-800' : 'bg-gray-100'}`}>
                      <LinkIcon className={`w-4 h-4 flex-shrink-0 ${styles.muted}`} />
                      <code className={`text-xs flex-1 truncate ${styles.text}`}>
                        {getInviteUrl(token.token)}
                      </code>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => copyToClipboard(getInviteUrl(token.token), token.token)}
                      className={`p-2 rounded-lg transition-colors ${
                        copiedToken === token.token
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : theme === 'Midnight'
                            ? 'hover:bg-slate-600 text-slate-400'
                            : 'hover:bg-gray-200 text-gray-600'
                      }`}
                      title="Copy link"
                    >
                      {copiedToken === token.token ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleRevokeToken(token.id, token.role)}
                      disabled={revokingTokenId === token.id}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'Midnight'
                          ? 'hover:bg-red-500/20 text-red-400'
                          : 'hover:bg-red-50 text-red-600'
                      } disabled:opacity-50`}
                      title="Revoke link"
                    >
                      {revokingTokenId === token.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Used Invites */}
      {usedTokens.length > 0 && (
        <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wide mb-4 ${styles.muted}`}>
            Used Invites ({usedTokens.length})
          </h3>

          <div className="space-y-2">
            {usedTokens.map((token) => (
              <div
                key={token.id}
                className={`p-3 rounded-xl border ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/20 border-slate-700'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {token.role === 'Team Leader' ? (
                      <Crown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Shield className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className={`text-sm ${styles.text}`}>{token.role}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(token.status)}`}>
                      used
                    </span>
                  </div>
                  <div className={`text-xs ${styles.muted}`}>
                    Used {token.usedAt ? formatDate(token.usedAt) : 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Invites */}
      {inactiveTokens.length > 0 && (
        <details className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
          <summary className={`text-sm font-bold uppercase tracking-wide cursor-pointer ${styles.muted}`}>
            Expired & Revoked Invites ({inactiveTokens.length})
          </summary>

          <div className="space-y-2 mt-4">
            {inactiveTokens.map((token) => (
              <div
                key={token.id}
                className={`p-3 rounded-xl border ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/20 border-slate-700'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {token.role === 'Team Leader' ? (
                      <Crown className="w-4 h-4 text-amber-500 opacity-50" />
                    ) : (
                      <Shield className="w-4 h-4 text-emerald-500 opacity-50" />
                    )}
                    <span className={`text-sm ${styles.muted}`}>{token.role}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(token.status)}`}>
                      {token.status}
                    </span>
                  </div>
                  <div className={`text-xs ${styles.muted}`}>
                    {token.status === 'expired' ? `Expired ${formatDate(token.expiresAt)}` : 'Revoked'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {inviteTokens.length === 0 && (
        <div className={`p-12 text-center rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
          <UserPlus className={`w-12 h-12 mx-auto mb-4 ${styles.muted}`} />
          <p className={`text-sm ${styles.muted}`}>No invite links yet. Generate your first one above!</p>
        </div>
      )}
    </div>
  );
}
