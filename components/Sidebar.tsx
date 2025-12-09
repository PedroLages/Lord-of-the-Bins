import React from 'react';
import { Calendar, Users, Settings, LayoutDashboard, Menu, LogOut, ChevronRight, Package, Box } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  theme: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, toggleSidebar, theme }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'schedule', label: 'Roster & Shift', icon: Calendar },
    { id: 'team', label: 'Workforce', icon: Users },
    { id: 'settings', label: 'Configuration', icon: Settings },
  ];

  const getThemeStyles = () => {
    if (theme === 'Midnight') {
      return {
        bg: 'bg-[#0f172a] border-r border-slate-800',
        text: 'text-slate-400',
        activeBg: 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500',
        hoverBg: 'hover:bg-slate-800 hover:text-slate-200',
        heading: 'text-slate-500',
        accent: 'bg-indigo-500',
        footer: 'bg-[#0f172a] border-t border-slate-800'
      };
    }
    // Modern (default)
    return {
      bg: 'bg-[#0f172a]',
      text: 'text-slate-400',
      activeBg: 'bg-blue-600/10 text-blue-400',
      hoverBg: 'hover:bg-slate-800/50 hover:text-slate-100',
      heading: 'text-slate-500',
      accent: 'bg-blue-500',
      footer: 'border-t border-slate-800/50'
    };
  };

  const styles = getThemeStyles();

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-all duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-2xl lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${styles.bg}`}>
        
        {/* Brand Header */}
        <div className="h-20 flex items-center px-8 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-lg bg-blue-600 text-white">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none text-white">Lord of the Bins</h1>
              <span className={`text-[10px] font-medium uppercase tracking-wider ${styles.heading}`}>Decanting Dept</span>
            </div>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden ml-auto text-slate-400">
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
          <div className="mb-6 px-4">
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${styles.heading}`}>Main Menu</h3>
          </div>
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
                className={`group relative flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive ? styles.activeBg : styles.text + ' ' + styles.hoverBg
                }`}
              >
                {!isActive && theme !== 'Midnight' && (
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 transition-all group-hover:h-8 rounded-r-full ${styles.accent}`} />
                )}
                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
              </button>
            );
          })}
        </nav>
        
        {/* Footer / Context */}
        <div className={`p-4 ${styles.footer}`}>
          <div className={`rounded-lg p-4 border ${theme === 'Midnight' ? 'bg-slate-900 border-slate-800' : 'bg-slate-800/50 border-slate-700/50'}`}>
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-400/10 text-blue-400">Current Cycle</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
             </div>
             <p className="text-xl font-bold tracking-tight text-white">Week 50</p>
             <p className={`text-xs font-medium mt-0.5 ${styles.heading}`}>Dec 8 - Dec 12, 2024</p>
          </div>

          <button className="flex items-center gap-3 px-4 py-3 mt-2 text-sm font-medium w-full transition-colors rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;