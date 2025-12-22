/**
 * Invite Accept Page Component
 *
 * Allows new users to create an account using an invite link.
 */

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Loader2,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Shield,
  Crown,
} from 'lucide-react';
import {
  validateInviteToken,
  acceptInvite,
  type InviteToken,
  type CloudUser,
} from '../services/supabase/authService';

interface InviteAcceptPageProps {
  token: string;
  onSuccess: (user: CloudUser) => void;
  onCancel: () => void;
  theme: string;
}

export default function InviteAcceptPage({
  token,
  onSuccess,
  onCancel,
  theme,
}: InviteAcceptPageProps) {
  const [inviteToken, setInviteToken] = useState<InviteToken | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [userCode, setUserCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const validatedToken = await validateInviteToken(token);
      setInviteToken(validatedToken);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid invite link');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate inputs
    if (!userCode.trim()) {
      setSubmitError('User code is required');
      return;
    }

    if (!displayName.trim()) {
      setSubmitError('Display name is required');
      return;
    }

    if (password.length < 4) {
      setSubmitError('Password must be at least 4 characters');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await acceptInvite(token, userCode, displayName, password);
      onSuccess(user);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = {
    text: theme === 'Midnight' ? 'text-white' : 'text-slate-800',
    muted: theme === 'Midnight' ? 'text-slate-400' : 'text-slate-500',
    card: theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  };

  // Loading state
  if (isValidating) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'Midnight' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <Loader2 className={`h-12 w-12 animate-spin mx-auto mb-4 ${styles.muted}`} />
          <p className={`text-sm ${styles.muted}`}>Validating invite link...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (validationError || !inviteToken) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'Midnight' ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className={`w-full max-w-md p-8 rounded-2xl border ${styles.card}`}>
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className={`text-xl font-bold mb-2 ${styles.text}`}>Invalid Invite Link</h2>
            <p className={`text-sm mb-6 ${styles.muted}`}>
              {validationError || 'This invite link is not valid. Please contact your Team Leader for a new invite.'}
            </p>
            <button
              onClick={onCancel}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
                theme === 'Midnight'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signup form
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'Midnight' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className={`w-full max-w-md p-8 rounded-2xl border ${styles.card}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            inviteToken.role === 'Team Leader'
              ? 'bg-amber-500/20'
              : 'bg-emerald-500/20'
          }`}>
            {inviteToken.role === 'Team Leader' ? (
              <Crown className="w-8 h-8 text-amber-500" />
            ) : (
              <Shield className="w-8 h-8 text-emerald-500" />
            )}
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${styles.text}`}>
            Join {inviteToken.shiftName}
          </h1>
          <p className={`text-sm ${styles.muted}`}>
            You've been invited to join as a <strong>{inviteToken.role}</strong>
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Code */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              User Code
            </label>
            <input
              type="text"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              placeholder="EMP001"
              maxLength={20}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
              autoFocus
            />
            <p className={`text-xs mt-1 ${styles.muted}`}>
              Your unique employee code (e.g., EMP001)
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              maxLength={50}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${styles.muted}`}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className={`text-xs mt-1 ${styles.muted}`}>
              Minimum 4 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !userCode || !displayName || !password || !confirmPassword}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'Midnight'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Create Account
              </>
            )}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={`w-full px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
              theme === 'Midnight'
                ? 'text-slate-400 hover:bg-slate-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Cancel
          </button>
        </form>

        {/* Invite Details */}
        <div className={`mt-6 p-4 rounded-xl ${theme === 'Midnight' ? 'bg-slate-700/20' : 'bg-gray-100'}`}>
          <p className={`text-xs ${styles.muted}`}>
            <strong>Invited by:</strong> {inviteToken.createdByName}<br />
            <strong>Shift:</strong> {inviteToken.shiftName}<br />
            <strong>Role:</strong> {inviteToken.role}
          </p>
        </div>
      </div>
    </div>
  );
}
