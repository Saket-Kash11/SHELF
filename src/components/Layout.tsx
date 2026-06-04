import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Search, Library, BookOpen, Settings, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<any>;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/shelf', label: 'Shelf', icon: Library },
  { to: '/discover', label: 'Discover', icon: Sparkles },
  { to: '/reader', label: 'Reader', icon: BookOpen },
];

export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-primary font-sans md:flex-row flex-col">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border p-6 justify-between shrink-0">
        <div>
          {/* Logo / Header */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <span className="text-2xl font-serif font-bold text-primary tracking-wide">Shelf</span>
          </div>

          {/* Nav List */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/30'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicatorDesktop"
                        className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer / Settings */}
        <div className="pt-4 border-t border-border">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `relative flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/30'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Settings className="h-5 w-5" />
                <span>Settings</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicatorDesktop"
                    className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative bg-bg pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border flex items-center justify-around z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-5 w-5 mb-1" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicatorMobile"
                    className="absolute bottom-0 left-1/4 right-1/4 h-[3px] bg-primary rounded-t"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
