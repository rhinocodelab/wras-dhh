import React, { useState } from 'react';
import { Train, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export default function Login({ onLogin, isLoading, error }: LoginProps) {
  const [username, setUsername] = useState('administrator');
  const [password, setPassword] = useState('admin@123');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-[#337ab7] flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4">
              <Train className="h-8 w-8 text-[#337ab7]" />
            </div>
            <h2 className="text-3xl font-bold text-white">WRAS-DHH</h2>
            <p className="mt-2 text-[#e1e9f2]">Western Railway Announcement System</p>
            <p className="text-[#c3d4e5] text-sm">for Deaf and Hard of Hearing</p>
          </div>

          <div className="bg-white rounded-xl shadow-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent transition-all duration-200"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-none focus:ring-2 focus:ring-[#337ab7] focus:border-transparent transition-all duration-200 pr-12"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#337ab7] hover:bg-[#2e6da4] disabled:bg-[#5a8bc7] text-white font-semibold py-2 px-3 rounded-none transition-colors duration-200 focus:ring-2 focus:ring-[#337ab7] focus:ring-offset-2 text-sm"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-[#f0f4f8] rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                Default Credentials: administrator / admin@123
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transparent Footer */}
      <footer className="py-4 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-white/80">
            © 2025 Sundyne Technologies. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}