import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, Settings, LayoutDashboard, Menu, LogOut, ChevronRight, Box, MessageSquarePlus, Crown, Shield, ChevronsLeft, ChevronsRight, Cloud, CloudOff, AlertCircle, CheckCircle2, RefreshCw, ChevronUp, UserCircle } from 'lucide-react';
import { getInitials } from '../types';
import type { CloudUser } from '../services/supabase/authService';
import { hybridStorage } from '../services/storage';
import type { SyncState } from '../services/sync/syncQueue';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setSettingsTab?: (tab: 'appearance' | 'task-management' | 'requirements' | 'automation' | 'skills' | 'integrations' | 'data' | 'feedback' | 'profile' | 'team' | 'invites' | 'shifts') => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  theme: string;
  onOpenFeedback?: () => void;
  user?: CloudUser | null;
  onSignOut?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentWeekLabel?: string; // e.g., "Week 51"
  currentWeekRange?: string; // e.g., "Dec 16-20, 2024"
}

// Shared User Dropdown Menu Component
const UserDropdownMenu: React.FC<{
  theme: string;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  setSettingsTab?: (tab: 'appearance' | 'task-management' | 'requirements' | 'automation' | 'skills' | 'integrations' | 'data' | 'feedback' | 'profile' | 'team' | 'invites' | 'shifts') => void;
  onOpenFeedback?: () => void;
  onSignOut?: () => void;
  isCollapsed?: boolean;
}> = ({ theme, onClose, setActiveTab, setSettingsTab, onOpenFeedback, onSignOut, isCollapsed = false }) => {
  const baseClasses = `rounded-lg border shadow-2xl overflow-hidden z-50 opacity-100 ${
    theme === 'Midnight'
      ? 'bg-slate-900 border-slate-700'
      : 'bg-slate-800 border-slate-700'
  }`;

  const positionClasses = isCollapsed
    ? 'absolute left-full ml-2 bottom-0 w-56'
    : 'absolute bottom-full left-0 right-0 mb-2';

  return (
    <div className={`${baseClasses} ${positionClasses}`} style={isCollapsed ? { minWidth: '224px' } : undefined}>
      {/* My Profile */}
      <button
        onClick={() => {
          setActiveTab('settings');
          setSettingsTab?.('profile');
          onClose();
        }}
        className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-left transition-colors text-slate-300 hover:bg-slate-700/50"
      >
        <UserCircle className="h-4 w-4" />
        <span>My Profile</span>
      </button>

      {/* Settings */}
      <button
        onClick={() => {
          setActiveTab('settings');
          onClose();
        }}
        className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-left transition-colors text-slate-300 hover:bg-slate-700/50"
      >
        <Settings className="h-4 w-4" />
        <span>Settings</span>
      </button>

      {/* Divider */}
      <div className="border-t border-slate-700/50" />

      {/* Send Feedback */}
      {onOpenFeedback && (
        <button
          onClick={() => {
            onOpenFeedback();
            onClose();
          }}
          className={`flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-left transition-colors ${
            theme === 'Midnight'
              ? 'text-indigo-400 hover:bg-indigo-500/10'
              : 'text-blue-400 hover:bg-blue-500/10'
          }`}
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>Send Feedback</span>
        </button>
      )}

      {/* Divider */}
      <div className="border-t border-slate-700/50" />

      {/* Sign Out */}
      {onSignOut && (
        <button
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-left transition-colors text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  setSettingsTab,
  isOpen,
  toggleSidebar,
  theme,
  onOpenFeedback,
  user,
  onSignOut,
  isCollapsed = false,
  onToggleCollapse,
  currentWeekLabel = 'Week 51', // Default fallback
  currentWeekRange = 'Dec 16-20, 2025' // Default fallback
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Sync status state
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  });

  // User dropdown state
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const expandedDropdownRef = useRef<HTMLDivElement>(null);
  const collapsedDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the currently active dropdown
      const activeDropdownRef = isCollapsed ? collapsedDropdownRef : expandedDropdownRef;

      if (activeDropdownRef.current && !activeDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserDropdownOpen, isCollapsed]);

  // Subscribe to sync state changes
  useEffect(() => {
    if (!hybridStorage.isCloudEnabled()) return;

    const unsubscribe = hybridStorage.subscribeSyncState((state) => {
      setSyncState(state);
    });

    return () => unsubscribe();
  }, []);

  // Get sync status display
  const getSyncStatus = () => {
    if (!hybridStorage.isCloudEnabled()) {
      return { icon: CloudOff, text: 'Offline', color: 'text-slate-500' };
    }

    switch (syncState.status) {
      case 'syncing':
        return { icon: RefreshCw, text: `Syncing ${syncState.pendingCount}...`, color: 'text-yellow-400', spin: true };
      case 'error':
        return { icon: AlertCircle, text: 'Sync Error', color: 'text-red-400' };
      case 'offline':
        return { icon: CloudOff, text: 'Offline', color: 'text-slate-500' };
      default:
        return { icon: CheckCircle2, text: 'Synced', color: 'text-emerald-400' };
    }
  };

  const syncStatus = getSyncStatus();

  const getThemeStyles = () => {
    if (theme === 'Midnight') {
      return {
        bg: 'bg-[#0f172a] border-r border-slate-800',
        text: 'text-slate-400',
        activeBg: 'bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 text-indigo-300 shadow-lg shadow-indigo-500/10',
        hoverBg: 'hover:bg-slate-800/70 hover:text-white hover:translate-x-0.5 transition-all duration-200',
        heading: 'text-slate-500',
        accent: 'bg-gradient-to-b from-indigo-400 to-indigo-600',
        footer: 'bg-[#0f172a] border-t border-slate-800',
        cycleBg: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/30',
        collapseBtn: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-400 hover:text-indigo-300',
        collapseBtnShadow: 'shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20'
      };
    }
    // Modern (default)
    return {
      bg: 'bg-[#0f172a]',
      text: 'text-slate-400',
      activeBg: 'bg-gradient-to-r from-blue-500/20 to-blue-500/5 text-blue-300 shadow-lg shadow-blue-500/10',
      hoverBg: 'hover:bg-slate-800/70 hover:text-white hover:translate-x-0.5 transition-all duration-200',
      heading: 'text-slate-500',
      accent: 'bg-gradient-to-b from-blue-400 to-blue-600',
      footer: 'border-t border-slate-800/50',
      cycleBg: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-blue-500/30',
      collapseBtn: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400 hover:text-blue-300',
      collapseBtnShadow: 'shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20'
    };
  };

  const styles = getThemeStyles();

  // Collapsed width for icons only
  const sidebarWidth = isCollapsed ? 'w-20' : 'w-72';

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-40 ${sidebarWidth} transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-2xl lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${styles.bg}`}>

        {/* Brand Header */}
        <div className={`flex flex-col ${isCollapsed ? 'px-2' : 'px-4'} pt-4 pb-3 border-b border-slate-800/50`}>
          {/* Logo Row */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} flex-1`}>
              <div className={`${isCollapsed ? 'h-10 w-10' : 'h-9 w-9'} rounded-xl flex items-center justify-center shadow-lg ${theme === 'Midnight' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-blue-500 to-blue-700'} text-white`}>
                <Box className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'}`} />
              </div>
              {!isCollapsed && (
                <>
                  <div className="flex-1">
                    <h1 className="font-bold text-base tracking-tight leading-none text-white">Lord of the Bins</h1>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${styles.heading}`}>Decanting Dept</span>
                  </div>
                  {/* Hamburger collapse button (Desktop only, when expanded) */}
                  {onToggleCollapse && (
                    <button
                      onClick={onToggleCollapse}
                      className="hidden lg:block p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                      aria-label="Collapse sidebar"
                      title="Collapse sidebar"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
            </div>
            {!isCollapsed && (
              <button onClick={toggleSidebar} className="lg:hidden ml-auto text-slate-400 hover:text-white transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Toggle ON/OFF Button - Only when collapsed (Desktop only) */}
          {onToggleCollapse && isCollapsed && (
            <div className="hidden lg:block mt-3">
              <button
                onClick={onToggleCollapse}
                className="group relative w-full flex items-center justify-center px-2 py-3 transition-all duration-300 hover:bg-slate-800/30 rounded-xl"
                aria-label="Expand sidebar"
                aria-expanded={false}
                title="Expand sidebar"
              >
                {/* Toggle Switch Icon */}
                <div className={`relative w-9 h-5 rounded-full transition-all duration-300 ${
                  theme === 'Midnight'
                    ? 'bg-slate-700 group-hover:bg-slate-600'
                    : 'bg-slate-600 group-hover:bg-slate-500'
                }`}>
                  {/* Switch Thumb */}
                  <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-all duration-300 ${
                    theme === 'Midnight'
                      ? 'bg-slate-400 group-hover:bg-slate-300'
                      : 'bg-slate-300 group-hover:bg-slate-200'
                  }`} />
                </div>
              </button>
            </div>
          )}

          {/* Current Cycle - Prominent Position */}
          {!isCollapsed && (
            <div className={`mt-4 mx-2 rounded-xl p-3 border backdrop-blur-sm ${styles.cycleBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'Midnight' ? 'text-indigo-400' : 'text-blue-400'}`}>Current Cycle</span>
                  <p className="text-lg font-bold tracking-tight text-white mt-0.5">{currentWeekLabel}</p>
                  <p className={`text-xs font-medium ${styles.heading}`}>{currentWeekRange}</p>
                </div>
                <div className="flex flex-col items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] text-emerald-400 mt-1">Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed Current Cycle indicator */}
          {isCollapsed && (
            <div className={`mt-3 mx-auto px-2 py-1.5 rounded-lg text-center ${styles.cycleBg}`} title={`${currentWeekLabel} - ${currentWeekRange}`}>
              <span className={`text-xs font-bold ${theme === 'Midnight' ? 'text-indigo-300' : 'text-blue-300'}`}>{currentWeekLabel.replace('Week ', 'W')}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-6 ${isCollapsed ? 'px-2' : 'px-3'} space-y-1.5 overflow-y-auto overflow-x-hidden`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) toggleSidebar();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex w-full items-center ${isCollapsed ? 'justify-center' : ''} gap-3 ${isCollapsed ? 'px-3 py-3.5' : 'px-4 py-3.5'} rounded-xl transition-all duration-200 ${
                  isActive ? styles.activeBg : styles.text + ' ' + styles.hoverBg
                }`}
              >
                {/* Animated accent bar for active/hover */}
                {!isCollapsed && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-300 ${
                    isActive
                      ? `h-8 ${styles.accent}`
                      : `h-0 group-hover:h-6 ${styles.accent}`
                  }`} />
                )}
                <Icon className={`h-5 w-5 flex-shrink-0 transition-all duration-200 ${isActive ? 'opacity-100 scale-110' : 'opacity-70 group-hover:opacity-100 group-hover:scale-105'}`} />
                {!isCollapsed && (
                  <>
                    <span className="font-medium text-sm">{item.label}</span>
                    <ChevronRight className={`ml-auto h-4 w-4 transition-all duration-200 ${isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-40'}`} />
                  </>
                )}
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-50 shadow-lg">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / Context */}
        <div className={`${isCollapsed ? 'p-2' : 'p-4'} ${styles.footer}`}>
          {/* Divider */}
          {user && <div className="border-t border-slate-700/50 mb-5" />}

          {/* User Profile Dropdown */}
          {user && !isCollapsed && (
            <div ref={expandedDropdownRef} className="relative mb-3">
              {/* User Profile Button */}
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className={`w-full rounded-lg p-3 border transition-all ${
                  isUserDropdownOpen
                    ? theme === 'Midnight'
                      ? 'bg-slate-900 border-indigo-500/50 ring-2 ring-indigo-500/20'
                      : 'bg-slate-800/70 border-blue-500/50 ring-2 ring-blue-500/20'
                    : theme === 'Midnight'
                    ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/30'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-blue-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {user.preferences?.profilePicture ? (
                    <img
                      src={user.preferences.profilePicture}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/30"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      user.role === 'Team Leader'
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                        : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
                    }`}>
                      {getInitials(user.displayName)}
                    </div>
                  )}
                  {/* Name & Role */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-white truncate">{user.displayName}</p>
                    <div className="flex items-center gap-1">
                      {user.role === 'Team Leader' ? (
                        <Crown className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Shield className="w-3 h-3 text-emerald-400" />
                      )}
                      <span className={`text-xs ${user.role === 'Team Leader' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {user.role} • {user.shiftName}
                      </span>
                    </div>
                  </div>
                  {/* Dropdown Indicator */}
                  <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isUserDropdownOpen && (
                <UserDropdownMenu
                  theme={theme}
                  onClose={() => setIsUserDropdownOpen(false)}
                  setActiveTab={setActiveTab}
                  setSettingsTab={setSettingsTab}
                  onOpenFeedback={onOpenFeedback}
                  onSignOut={onSignOut}
                  isCollapsed={false}
                />
              )}
            </div>
          )}

          {/* Collapsed user avatar */}
          {user && isCollapsed && (
            <div ref={collapsedDropdownRef} className="relative flex justify-center mb-3">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="relative group"
                title={user.displayName}
              >
                {user.preferences?.profilePicture ? (
                  <img
                    src={user.preferences.profilePicture}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-colors"
                  />
                ) : (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      user.role === 'Team Leader'
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white group-hover:from-amber-300 group-hover:to-amber-500'
                        : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white group-hover:from-emerald-400 group-hover:to-emerald-600'
                    }`}
                  >
                    {getInitials(user.displayName)}
                  </div>
                )}
              </button>

              {/* Dropdown Menu - positioned to the right */}
              {isUserDropdownOpen && (
                <UserDropdownMenu
                  theme={theme}
                  onClose={() => setIsUserDropdownOpen(false)}
                  setActiveTab={setActiveTab}
                  setSettingsTab={setSettingsTab}
                  onOpenFeedback={onOpenFeedback}
                  onSignOut={onSignOut}
                  isCollapsed={true}
                />
              )}
            </div>
          )}

          {/* Sync Status Indicator */}
          {!isCollapsed && (
            <div className="px-4 py-2 mb-2">
              <div className="flex items-center gap-2 text-xs">
                <syncStatus.icon
                  className={`h-3.5 w-3.5 ${syncStatus.color} ${syncStatus.spin ? 'animate-spin' : ''}`}
                />
                <span className={syncStatus.color}>{syncStatus.text}</span>
                {syncState.lastSyncAt && syncState.status === 'idle' && (
                  <span className="text-slate-600 text-[10px]">
                    {new Date(syncState.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Collapsed sync status */}
          {isCollapsed && (
            <div className="flex justify-center mb-2" title={syncStatus.text}>
              <syncStatus.icon
                className={`h-4 w-4 ${syncStatus.color} ${syncStatus.spin ? 'animate-spin' : ''}`}
              />
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Sidebar;
