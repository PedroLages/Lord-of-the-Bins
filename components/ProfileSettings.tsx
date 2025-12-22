/**
 * Profile Settings Component
 *
 * Allows users to update their profile picture, display name, and password.
 */

import React, { useState, useRef } from 'react';
import {
  Camera,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Crown,
  Shield,
} from 'lucide-react';
import { getInitials, getRoleDisplayText } from '../types';
import type { CloudUser } from '../services/supabase/authService';

interface ProfileSettingsProps {
  user: CloudUser;
  theme: string;
  styles: {
    text: string;
    muted: string;
    card: string;
    [key: string]: string;
  };
  onUpdateUser: (updates: { displayName?: string; email?: string; preferences?: any }) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onProcessPicture: (file: File) => Promise<string>;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export default function ProfileSettings({
  user,
  theme,
  styles,
  onUpdateUser,
  onChangePassword,
  onProcessPicture,
  toast,
}: ProfileSettingsProps) {
  // Profile state
  const [displayName, setDisplayName] = useState(user.displayName);
  const [profilePicture, setProfilePicture] = useState(user.preferences?.profilePicture || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle profile picture upload
  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      const base64 = await onProcessPicture(file);
      setProfilePicture(base64);
    } catch (err) {
      toast.error('Failed to process image');
    }
  };

  // Handle profile update
  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    setIsUpdatingProfile(true);
    setProfileSuccess(false);

    try {
      await onUpdateUser({
        displayName: displayName.trim(),
        preferences: {
          ...user.preferences,
          profilePicture: profilePicture || undefined,
        },
      });
      setProfileSuccess(true);
      toast.success('Profile updated successfully');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle password change
  const handleChangePassword = async () => {
    setPasswordError(null);

    // Validate passwords
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    setPasswordSuccess(false);

    try {
      await onChangePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const hasProfileChanges = displayName !== user.displayName || profilePicture !== (user.preferences?.profilePicture || '');

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${styles.text}`}>My Profile</h2>
        <p className={`text-sm ${styles.muted}`}>Manage your account settings and profile picture.</p>
      </div>

      {/* Profile Picture & Basic Info */}
      <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
        <h3 className={`text-sm font-bold uppercase tracking-wide mb-6 ${styles.muted}`}>Profile Information</h3>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile Picture */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={displayName}
                  className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500/30 shadow-lg"
                />
              ) : (
                <div className={`w-32 h-32 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg ${
                  user.role === 'Team Leader'
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
                }`}>
                  {getInitials(displayName || user.displayName)}
                </div>
              )}
              {/* Upload button overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`absolute bottom-0 right-0 p-2.5 rounded-full shadow-lg transition-colors ${
                  theme === 'Midnight'
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Camera className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePictureUpload}
                className="hidden"
              />
            </div>
            <p className={`text-xs ${styles.muted}`}>Click to upload photo</p>
            {profilePicture && (
              <button
                onClick={() => setProfilePicture('')}
                className={`text-xs font-medium ${theme === 'Midnight' ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Name & Info */}
          <div className="flex-1 space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
                Username
              </label>
              <div className={`px-4 py-3 rounded-xl border ${
                theme === 'Midnight'
                  ? 'bg-slate-700/30 border-slate-600 text-slate-400'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}>
                {user.userCode}
              </div>
              <p className={`text-xs mt-1 ${styles.muted}`}>User code cannot be changed</p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
                Role
              </label>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
                theme === 'Midnight'
                  ? 'bg-slate-700/30 border-slate-600'
                  : 'bg-gray-100 border-gray-200'
              }`}>
                {user.role === 'Team Leader' ? (
                  <Crown className="w-4 h-4 text-amber-500" />
                ) : (
                  <Shield className="w-4 h-4 text-emerald-500" />
                )}
                <span className={`${
                  user.role === 'Team Leader' ? 'text-amber-500' : 'text-emerald-500'
                } font-medium`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Save Profile Button */}
            <button
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile || !hasProfileChanges}
              className={`flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                profileSuccess
                  ? 'bg-emerald-500 text-white'
                  : theme === 'Midnight'
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : profileSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className={`p-6 rounded-2xl border ${theme === 'Midnight' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
        <h3 className={`text-sm font-bold uppercase tracking-wide mb-6 ${styles.muted}`}>
          <KeyRound className="inline-block h-4 w-4 mr-2" />
          Change Password
        </h3>

        <div className="max-w-md space-y-4">
          {/* Current Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError(null);
                }}
                className={`w-full px-4 py-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${styles.muted}`}
              >
                {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                }}
                className={`w-full px-4 py-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 ${
                  theme === 'Midnight'
                    ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${styles.muted}`}
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${styles.text}`}>
              Confirm New Password
            </label>
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(null);
              }}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 ${
                theme === 'Midnight'
                  ? 'bg-slate-700/50 border-slate-600 text-white focus:ring-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* Error Message */}
          {passwordError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {passwordError}
            </div>
          )}

          {/* Change Password Button */}
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
            className={`flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              passwordSuccess
                ? 'bg-emerald-500 text-white'
                : theme === 'Midnight'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : passwordSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Password Changed!
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Change Password
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
