/**
 * Login Page - Matches app's Midnight theme
 *
 * Design philosophy:
 * - Uses app's Midnight theme colors (indigo accent, #0f172a background)
 * - Warehouse-inspired visuals with character
 * - Playful but professional
 */

import React, { useState } from 'react';
import {
  Box,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Package,
  Boxes,
  Key,
  CheckCircle,
} from 'lucide-react';
import { signIn, type CloudUser } from '../services/supabase/authService';
import { isSupabaseConfigured } from '../services/supabase/client';
import { requireSupabaseClient } from '../services/supabase/client';

interface LoginPageProps {
  onLogin: (user: CloudUser) => void;
  onSwitchToSetup?: () => void;
}

export default function LoginPage({ onLogin, onSwitchToSetup }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Password change state
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<CloudUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Input validation helper
  const isValidInput = (input: string): boolean => {
    const userCodePattern = /^EMP\d{3}$/i;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return userCodePattern.test(input) || emailPattern.test(input);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setPasswordChangeError('Please enter and confirm your new password');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordChangeError('Password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    setPasswordChangeError(null);

    try {
      const supabase = requireSupabaseClient();

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Clear temporary password and flag from user preferences
      const { error: prefError } = await (supabase.from('users').update as any)({
        preferences: {
          ...(loggedInUser?.preferences || {}),
          temporaryPassword: null,
          passwordResetBy: null,
          passwordResetAt: null,
          mustChangePassword: false,
        },
      }).eq('id', loggedInUser?.id);

      if (prefError) {
        console.error('Failed to update preferences:', prefError);
        // Continue anyway since password was changed
      }

      // Update local user object and proceed with login
      if (loggedInUser) {
        const updatedUser = {
          ...loggedInUser,
          preferences: {
            ...loggedInUser.preferences,
            temporaryPassword: null,
            passwordResetBy: null,
            passwordResetAt: null,
            mustChangePassword: false,
          },
        };
        onLogin(updatedUser);
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordChangeError(err instanceof Error ? err.message : 'Failed to change password');
      setIsChangingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError('Please enter user code/email and password');
      return;
    }

    // Validate input format
    if (!isValidInput(username.trim())) {
      setError('Please enter a valid user code (e.g., EMP001) or email address');
      return;
    }

    // Check if user is locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Too many failed attempts. Please try again in ${remainingSeconds} seconds.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await signIn(username, password);
      // Reset failed attempts on success
      setFailedAttempts(0);
      setLockoutUntil(null);

      // Check if user needs to change password
      if (user.preferences?.mustChangePassword) {
        setLoggedInUser(user);
        setShowPasswordChangeModal(true);
        setIsLoading(false);
      } else {
        onLogin(user);
      }
    } catch (err) {
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);

      // Implement exponential backoff: 5s, 15s, 30s, 60s, 120s
      if (newFailedAttempts >= 3) {
        const lockoutDuration = Math.min(5 * Math.pow(3, newFailedAttempts - 3), 120) * 1000;
        setLockoutUntil(Date.now() + lockoutDuration);
        setError(`Too many failed attempts. Locked out for ${lockoutDuration / 1000} seconds.`);
      } else {
        // Provide specific error messages
        const errorMessage = err instanceof Error ? err.message : 'Login failed';
        if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('Invalid')) {
          setError('Invalid user code/email or password. Please try again.');
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          setError('Network error. Please check your internet connection.');
        } else if (errorMessage.includes('Supabase') || errorMessage.includes('configured')) {
          setError('Authentication service not available. Please contact support.');
        } else {
          setError(errorMessage);
        }
      }

      setIsLoading(false);
    }
  };

  // Check if Supabase is configured
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Configuration Required</h2>
          </div>
          <p className="text-slate-400 mb-4">
            Supabase is not configured. Please set the following environment variables in your <code className="text-indigo-400 bg-slate-800 px-2 py-1 rounded">.env</code> file:
          </p>
          <ul className="list-disc list-inside text-slate-400 space-y-2 mb-4">
            <li><code className="text-indigo-400">VITE_SUPABASE_URL</code></li>
            <li><code className="text-indigo-400">VITE_SUPABASE_ANON_KEY</code></li>
          </ul>
          <p className="text-sm text-slate-500">
            See <code className="text-indigo-400 bg-slate-800 px-2 py-1 rounded">.env.example</code> for instructions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex overflow-hidden">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-500/10 via-[#0f172a] to-[#0f172a] p-12 flex-col justify-between">
        {/* Floating bins decoration */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large bin icon */}
          <div className="absolute top-20 left-20 opacity-[0.03]">
            <Boxes className="w-96 h-96 text-indigo-500" strokeWidth={0.5} />
          </div>
          {/* Scattered package icons */}
          <Package className="absolute top-1/4 right-1/4 w-8 h-8 text-indigo-500/20 rotate-12" />
          <Box className="absolute top-1/3 left-1/3 w-6 h-6 text-indigo-500/15 -rotate-6" />
          <Package className="absolute bottom-1/4 right-1/3 w-10 h-10 text-indigo-500/10 rotate-45" />
          <Box className="absolute bottom-1/3 left-1/4 w-5 h-5 text-indigo-500/20 rotate-12" />
          <Boxes className="absolute top-2/3 right-1/4 w-12 h-12 text-indigo-500/15 -rotate-12" />

          {/* Geometric lines */}
          <div className="absolute top-0 left-1/3 w-px h-full bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent" />
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Box className="w-5 h-5 text-white" />
            </div>
            <span className="text-indigo-400 font-mono text-sm tracking-wider">DECANTING DEPT</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Lord of<br />
            <span className="text-indigo-400">the Bins</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Where chaos meets order, and every pallet finds its destiny.
          </p>

          {/* Key features */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <span className="text-sm">Smart constraint-based scheduling</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <span className="text-sm">Role-based access control</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <span className="text-sm">Real-time shift management</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-slate-600 text-xs">
          "One schedule to rule them all"
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Box className="w-5 h-5 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Lord of the Bins</h1>
            <p className="text-slate-500 text-sm mt-1">Decanting Department</p>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-slate-500">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* User Code or Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                User Code or Email
              </label>
              <div className="relative">
                <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r transition-colors ${
                  focusedField === 'username'
                    ? 'border-indigo-500/30 bg-indigo-500/5'
                    : 'border-slate-700 bg-slate-800/50'
                } rounded-l-lg`}>
                  <span className={`text-sm font-mono transition-colors ${
                    focusedField === 'username' ? 'text-indigo-400' : 'text-slate-500'
                  }`}>#</span>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="EMP001 or your@email.com"
                  autoComplete="username"
                  autoFocus
                  className={`w-full pl-14 pr-4 py-3.5 bg-slate-900 border rounded-lg text-white placeholder-slate-600 focus:outline-none transition-all ${
                    focusedField === 'username'
                      ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r transition-colors ${
                  focusedField === 'password'
                    ? 'border-indigo-500/30 bg-indigo-500/5'
                    : 'border-slate-700 bg-slate-800/50'
                } rounded-l-lg`}>
                  <Lock className={`w-4 h-4 transition-colors ${
                    focusedField === 'password' ? 'text-indigo-400' : 'text-slate-500'
                  }`} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full pl-14 pr-12 py-3.5 bg-slate-900 border rounded-lg text-white placeholder-slate-600 focus:outline-none transition-all ${
                    focusedField === 'password'
                      ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-slate-800">
            {onSwitchToSetup && (
              <p className="text-center mb-4">
                <button
                  type="button"
                  onClick={onSwitchToSetup}
                  className="text-sm text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  First time here? <span className="text-indigo-400 font-medium">Set up your account</span>
                </button>
              </p>
            )}
            <p className="text-center text-slate-600 text-xs">
              Jedi scheduling accuracy · v1.0
            </p>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordChangeModal && loggedInUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Key className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Password Change Required
                </h3>
              </div>
              <p className="text-sm text-slate-400">
                Your Team Leader reset your password. Please choose a new password to continue.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {/* User Info */}
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Logged in as:</p>
                <p className="text-sm font-semibold text-white">
                  {loggedInUser.displayName}
                </p>
                <p className="text-xs text-slate-500">
                  {loggedInUser.userCode}
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-slate-700 bg-slate-800/50 rounded-l-lg">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordChangeError(null);
                    }}
                    placeholder="Enter new password"
                    autoFocus
                    className="w-full pl-14 pr-12 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-slate-700 bg-slate-800/50 rounded-l-lg">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordChangeError(null);
                    }}
                    placeholder="Confirm new password"
                    className="w-full pl-14 pr-12 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                <p className="text-xs text-indigo-400">
                  Password must be at least 4 characters long
                </p>
              </div>

              {/* Error Message */}
              {passwordChangeError && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{passwordChangeError}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Update Password & Continue</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
