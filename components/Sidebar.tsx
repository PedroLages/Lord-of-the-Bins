import React from 'react';
import { Calendar, Users, Settings, LayoutDashboard, Menu, LogOut, ChevronRight, Box, MessageSquarePlus, Crown, Shield, PanelLeftClose, PanelLeft } from 'lucide-react';
import { getInitials, getRoleDisplayText, type DemoUser } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  theme: string;
  onOpenFeedback?: () => void;
  user?: DemoUser | null;
  onSignOut?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentWeekLabel?: string; // e.g., "Week 51"
  currentWeekRange?: string; // e.g., "Dec 16-20, 2024"
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
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
        cycleBg: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border-indigo-500/30'
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
      cycleBg: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-blue-500/30'
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
      <div className={`fixed inset-y-0 left-0 z-40 ${sidebarWidth} transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-2xl lg:shadow-none overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${styles.bg}`}>

        {/* Brand Header */}
        <div className={`flex flex-col ${isCollapsed ? 'px-2' : 'px-4'} pt-4 pb-3 border-b border-slate-800/50`}>
          {/* Logo Row */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div className={`${isCollapsed ? 'h-10 w-10' : 'h-9 w-9'} rounded-xl flex items-center justify-center shadow-lg ${theme === 'Midnight' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-blue-500 to-blue-700'} text-white`}>
                <Box className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'}`} />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="font-bold text-base tracking-tight leading-none text-white">Lord of the Bins</h1>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${styles.heading}`}>Decanting Dept</span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button onClick={toggleSidebar} className="lg:hidden ml-auto text-slate-400 hover:text-white transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            )}
          </div>

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
        <nav className={`flex-1 py-6 ${isCollapsed ? 'px-2' : 'px-3'} space-y-1.5 overflow-y-auto`}>
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
          {/* User Profile Card */}
          {user && !isCollapsed && (
            <div className={`rounded-lg p-3 border mb-3 ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-slate-800/50 border-slate-700/50'}`}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/30"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    user.role === 'team-leader'
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                      : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
                  }`}>
                    {getInitials(user.displayName)}
                  </div>
                )}
                {/* Name & Role */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.displayName}</p>
                  <div className="flex items-center gap-1">
                    {user.role === 'team-leader' ? (
                      <Crown className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Shield className="w-3 h-3 text-emerald-400" />
                    )}
                    <span className={`text-xs ${user.role === 'team-leader' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {getRoleDisplayText(user.role)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed user avatar */}
          {user && isCollapsed && (
            <div className="flex justify-center mb-3">
              {user.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/30"
                  title={user.displayName}
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    user.role === 'team-leader'
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                      : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
                  }`}
                  title={user.displayName}
                >
                  {getInitials(user.displayName)}
                </div>
              )}
            </div>
          )}

          {/* Feedback Button */}
          {onOpenFeedback && !isCollapsed && (
            <button
              onClick={onOpenFeedback}
              className={`flex items-center gap-3 px-4 py-3 mt-2 text-sm font-medium w-full transition-colors rounded-lg ${
                theme === 'Midnight'
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/30'
                  : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30'
              }`}
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>Send Feedback</span>
            </button>
          )}

          {/* Collapsed feedback icon */}
          {onOpenFeedback && isCollapsed && (
            <button
              onClick={onOpenFeedback}
              title="Send Feedback"
              className={`flex items-center justify-center p-3 w-full transition-colors rounded-lg ${
                theme === 'Midnight'
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                  : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
              }`}
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          )}

          {/* Sign Out Button */}
          {onSignOut && !isCollapsed && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-3 px-4 py-3 mt-2 text-sm font-medium w-full transition-colors rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          )}

          {/* Collapsed sign out icon */}
          {onSignOut && isCollapsed && (
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="flex items-center justify-center p-3 w-full transition-colors rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}

          {/* Collapse Toggle Button - Desktop only */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`hidden lg:flex items-center justify-center p-2.5 mt-3 w-full transition-colors rounded-lg ${
                theme === 'Midnight'
                  ? 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/50'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/50'
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeft className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
