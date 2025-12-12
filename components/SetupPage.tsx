/**
 * Setup Page - First-run wizard for creating initial user account
 *
 * Design philosophy:
 * - Uses app's Midnight theme colors (indigo accent, #0f172a background)
 * - Split-screen layout with decorative left panel
 * - Playful but professional
 */

import React, { useState } from 'react';
import {
  Box,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Package,
  Boxes,
  Sparkles,
  Shield,
} from 'lucide-react';
import { createUser } from '../services/authService';
import { getInitials, type UserRole } from '../types';

interface SetupPageProps {
  onComplete: () => void;
  onSwitchToLogin?: () => void;
}

export default function SetupPage({ onComplete, onSwitchToLogin }: SetupPageProps) {
  // Form state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('team-coordinator');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Validation
  const isUsernameValid = username.length >= 3 && /^[0-9]+$/.test(username);
  const isDisplayNameValid = displayName.trim().length >= 2;
  const isPasswordValid = password.length >= 4;
  const doPasswordsMatch = password === confirmPassword;

  const canProceedStep1 = isUsernameValid && isDisplayNameValid;
  const canProceedStep2 = isPasswordValid && doPasswordsMatch;
  const canSubmit = canProceedStep1 && canProceedStep2;

  // Handle form submission
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createUser(username, displayName, password, role);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setIsSubmitting(false);
    }
  };

  const stepTitles = [
    { title: 'Profile', subtitle: 'Tell us who you are' },
    { title: 'Security', subtitle: 'Protect your realm' },
    { title: 'Confirm', subtitle: 'Ready to rule?' },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] flex overflow-hidden">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-500/10 via-[#0f172a] to-[#0f172a] p-12 flex-col justify-between">
        {/* Floating bins decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-20 opacity-[0.03]">
            <Boxes className="w-96 h-96 text-indigo-500" strokeWidth={0.5} />
          </div>
          <Package className="absolute top-1/4 left-1/4 w-8 h-8 text-indigo-500/20 rotate-12" />
          <Box className="absolute top-1/3 right-1/3 w-6 h-6 text-indigo-500/15 -rotate-6" />
          <Package className="absolute bottom-1/4 left-1/3 w-10 h-10 text-indigo-500/10 rotate-45" />
          <Box className="absolute bottom-1/3 right-1/4 w-5 h-5 text-indigo-500/20 rotate-12" />
          <Boxes className="absolute top-2/3 left-1/4 w-12 h-12 text-indigo-500/15 -rotate-12" />

          {/* Geometric lines */}
          <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent" />
          <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />
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
            Begin your<br />
            <span className="text-indigo-400">journey</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Every warehouse legend starts somewhere. Set up your profile and take command of the bins.
          </p>

          {/* Progress indicator */}
          <div className="space-y-3">
            {stepTitles.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                  step === i + 1
                    ? 'bg-indigo-500/10 border border-indigo-500/20'
                    : step > i + 1
                    ? 'opacity-50'
                    : 'opacity-30'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono ${
                    step > i + 1
                      ? 'bg-indigo-600 text-white'
                      : step === i + 1
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{s.title}</div>
                  <div className="text-slate-500 text-xs">{s.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-slate-600 text-xs">
          "A new keeper of the bins awakens"
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Box className="w-5 h-5 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Lord of the Bins</h1>
            <p className="text-slate-500 text-sm mt-1">Create your account</p>
          </div>

          {/* Step 1: Profile Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Create your profile</h2>
                <p className="text-slate-500">Who will be ruling these bins?</p>
              </div>

              {/* Batch Number */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Batch Number
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
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.replace(/\D/g, ''));
                      setError(null);
                    }}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="12345"
                    className={`w-full pl-14 pr-4 py-3.5 bg-slate-900 border rounded-lg text-white placeholder-slate-600 focus:outline-none transition-all ${
                      focusedField === 'username'
                        ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-600">Your employee batch number</p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Display Name
                </label>
                <div className="relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r transition-colors ${
                    focusedField === 'displayName'
                      ? 'border-indigo-500/30 bg-indigo-500/5'
                      : 'border-slate-700 bg-slate-800/50'
                  } rounded-l-lg`}>
                    <Sparkles className={`w-4 h-4 transition-colors ${
                      focusedField === 'displayName' ? 'text-indigo-400' : 'text-slate-500'
                    }`} />
                  </div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onFocus={() => setFocusedField('displayName')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="John Smith"
                    className={`w-full pl-14 pr-4 py-3.5 bg-slate-900 border rounded-lg text-white placeholder-slate-600 focus:outline-none transition-all ${
                      focusedField === 'displayName'
                        ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  Choose your role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('team-coordinator')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      role === 'team-coordinator'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                    }`}
                  >
                    <Package className={`w-5 h-5 mb-2 ${role === 'team-coordinator' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <div className={`text-sm font-medium ${role === 'team-coordinator' ? 'text-white' : 'text-slate-300'}`}>
                      Coordinator
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Manage schedules</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('team-leader')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      role === 'team-leader'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                    }`}
                  >
                    <Shield className={`w-5 h-5 mb-2 ${role === 'team-leader' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <div className={`text-sm font-medium ${role === 'team-leader' ? 'text-white' : 'text-slate-300'}`}>
                      Team Leader
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Full access</div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all group"
              >
                Continue
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Secure your realm</h2>
                <p className="text-slate-500">Choose a password to protect your account</p>
              </div>

              {/* Password */}
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
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter password"
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

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r transition-colors ${
                    focusedField === 'confirmPassword'
                      ? 'border-indigo-500/30 bg-indigo-500/5'
                      : 'border-slate-700 bg-slate-800/50'
                  } rounded-l-lg`}>
                    <Lock className={`w-4 h-4 transition-colors ${
                      focusedField === 'confirmPassword' ? 'text-indigo-400' : 'text-slate-500'
                    }`} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Confirm password"
                    className={`w-full pl-14 pr-12 py-3.5 bg-slate-900 border rounded-lg text-white placeholder-slate-600 focus:outline-none transition-all ${
                      focusedField === 'confirmPassword'
                        ? 'border-indigo-500/50 ring-1 ring-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
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
                {confirmPassword && !doPasswordsMatch && (
                  <p className="mt-2 text-xs text-red-400">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors border border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all group"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Ready to rule?</h2>
                <p className="text-slate-500">Review your details before entering the realm</p>
              </div>

              {/* Preview Card */}
              <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-800">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 flex items-center justify-center border-2 border-indigo-500/30">
                    <span className="text-xl font-bold text-indigo-400">{getInitials(displayName)}</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{displayName}</div>
                    <div className="text-sm text-slate-500 font-mono">Batch #{username}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Role</span>
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    role === 'team-leader'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  }`}>
                    {role === 'team-leader' ? 'Team Leader' : 'Team Coordinator'}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium rounded-lg transition-colors border border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-slate-800">
            {onSwitchToLogin && (
              <p className="text-center mb-4">
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-sm text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  Already have an account? <span className="text-indigo-400 font-medium">Sign in</span>
                </button>
              </p>
            )}
            <p className="text-center text-slate-600 text-xs">
              Jedi scheduling accuracy · v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
