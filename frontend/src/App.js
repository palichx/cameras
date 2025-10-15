import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import Dashboard from './pages/Dashboard';
import CameraManagement from './pages/CameraManagement';
import Recordings from './pages/Recordings';
import MotionEvents from './pages/MotionEvents';
import Settings from './pages/Settings';
import { Toaster } from './components/ui/sonner';
import { Video, Settings as SettingsIcon, FileVideo, Activity, BarChart3 } from 'lucide-react';

// Use environment variable for backend URL, fallback to localhost for development
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const API = `${BACKEND_URL}/api`;

const Layout = ({ children }) => {
  const [storageStats, setStorageStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStorageStats();
    const interval = setInterval(fetchStorageStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStorageStats = async () => {
    try {
      const response = await axios.get(`${API}/storage/stats`);
      setStorageStats(response.data);
    } catch (error) {
      console.error('Error fetching storage stats:', error);
    }
  };

  const storagePercentage = storageStats
    ? (storageStats.used_gb / storageStats.total_gb) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-800">VideoGuard</h1>
              </div>

              <div className="hidden md:flex space-x-1">
                <NavLink to="/" icon={<BarChart3 className="w-4 h-4" />} label="Панель" />
                <NavLink to="/cameras" icon={<Settings className="w-4 h-4" />} label="Камеры" />
                <NavLink to="/recordings" icon={<FileVideo className="w-4 h-4" />} label="Записи" />
                <NavLink to="/motion-events" icon={<Activity className="w-4 h-4" />} label="Движение" />
                <NavLink to="/settings" icon={<SettingsIcon className="w-4 h-4" />} label="Настройки" />
              </div>
            </div>

            {storageStats && (
              <div className="flex items-center space-x-3" data-testid="storage-indicator">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-slate-500">Хранилище</div>
                  <div className="text-sm font-semibold text-slate-700">
                    {storageStats.used_gb.toFixed(1)} / {storageStats.total_gb.toFixed(0)} GB
                  </div>
                </div>
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      storagePercentage > 90
                        ? 'bg-red-500'
                        : storagePercentage > 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <Toaster position="top-right" />
    </div>
  );
};

const NavLink = ({ to, icon, label }) => {
  const isActive = window.location.pathname === to;

  return (
    <Link
      to={to}
      data-testid={`nav-${label.toLowerCase()}`}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all no-underline ${
        isActive
          ? 'bg-blue-100 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cameras" element={<CameraManagement />} />
            <Route path="/recordings" element={<Recordings />} />
            <Route path="/motion-events" element={<MotionEvents />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;
