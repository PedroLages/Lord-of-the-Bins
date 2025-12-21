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
} from 'lucide-react';
import { login } from '../services/authService';
import type { DemoUser } from '../types';

interface LoginPageProps {
  onLogin: (user: DemoUser) => void;
  onSwitchToSetup?: () => void;
}

export default function LoginPage({ onLogin, onSwitchToSetup }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError('Please enter batch number and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoading(false);
    }
  };

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

          {/* Stats or features */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="text-2xl font-bold text-indigo-400">99.2%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Scheduling accuracy</div>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="text-2xl font-bold text-indigo-400">24</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Active operators</div>
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
            {/* Batch Number Field */}
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
                    const value = e.target.value.replace(/\D/g, '');
                    setUsername(value);
                    setError(null);
                  }}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="12345"
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
    </div>
  );
}
