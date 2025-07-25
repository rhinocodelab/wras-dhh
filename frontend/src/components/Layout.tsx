import React from 'react';
import { BarChart3, MapPin, Route, LogOut, Menu, X, Train, FileText, Volume2, Hand, Mic, Type } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export default function Layout({ children, user, activeTab, onTabChange, onLogout }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'stations', label: 'Stations', icon: MapPin },
    { id: 'routes', label: 'Train Routes', icon: Route },
    { id: 'templates', label: 'Announcement Templates', icon: FileText },
    { id: 'announcement-audios', label: 'Announcement Segments', icon: Volume2 },
    { id: 'audio-files', label: 'Audio Files', icon: Volume2 },
    { id: 'isl-dictionary', label: 'ISL Dictionary', icon: Hand },
    { id: 'speech-to-isl', label: 'Speech to ISL', icon: Mic },
    { id: 'text-to-isl', label: 'Text to ISL', icon: Type },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-[#337ab7] rounded-none flex items-center justify-center">
                  <Train className="h-5 w-5 text-white" />
                </div>
                <div>
                                      <h1 className="text-xl font-bold text-gray-900">WRAS-DHH</h1>
                  <p className="text-xs text-gray-500">Western Railway Announcement System for Deaf and Hard of Hearing</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6">
              <span className="text-sm text-gray-600">Welcome, {user.username}</span>
              <button
                onClick={onLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1 rounded-md text-gray-600 hover:text-gray-900"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-2 space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-md text-left transition-colors text-sm ${
                  activeTab === item.id
                    ? 'bg-[#f0f4f8] text-[#2e6da4] border-r-2 border-[#2e6da4]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            ))}
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={onLogout}
                className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-md text-left text-gray-600 hover:bg-gray-50 text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <nav className="space-y-1">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded-none text-left transition-all duration-200 text-sm ${
                    activeTab === item.id
                      ? 'bg-[#f0f4f8] text-[#2e6da4] border-r-4 border-[#2e6da4] shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 pb-16">
            {children}
          </main>
        </div>
      </div>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-gray-600">
            © 2025 Sundyne Technologies. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}