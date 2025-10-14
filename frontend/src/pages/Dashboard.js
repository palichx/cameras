import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Activity, Video, FileVideo, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const [cameras, setCameras] = useState([]);
  const [stats, setStats] = useState({
    totalCameras: 0,
    activeCameras: 0,
    todayRecordings: 0,
    todayMotionEvents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [camerasRes, recordingsRes, eventsRes] = await Promise.all([
        axios.get(`${API}/cameras`, { timeout: 10000 }),
        axios.get(`${API}/recordings?limit=1000`, { timeout: 10000 }),
        axios.get(`${API}/motion-events?limit=1000`, { timeout: 10000 }),
      ]);

      const camerasList = camerasRes.data;
      setCameras(camerasList);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRecordings = recordingsRes.data.filter(
        (r) => new Date(r.start_time) >= today
      ).length;

      const todayEvents = eventsRes.data.filter(
        (e) => new Date(e.timestamp) >= today
      ).length;

      setStats({
        totalCameras: camerasList.length,
        activeCameras: camerasList.filter((c) => c.status === 'active').length,
        todayRecordings,
        todayMotionEvents: todayEvents,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Ошибка загрузки данных панели');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Панель управления</h1>
        <p className="text-slate-600">Обзор системы видеонаблюдения</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Video className="w-6 h-6" />}
          label="Всего камер"
          value={stats.totalCameras}
          color="blue"
          testId="stat-total-cameras"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Активных"
          value={stats.activeCameras}
          color="green"
          testId="stat-active-cameras"
        />
        <StatCard
          icon={<FileVideo className="w-6 h-6" />}
          label="Записей сегодня"
          value={stats.todayRecordings}
          color="purple"
          testId="stat-today-recordings"
        />
        <StatCard
          icon={<AlertCircle className="w-6 h-6" />}
          label="Движение сегодня"
          value={stats.todayMotionEvents}
          color="orange"
          testId="stat-today-motion"
        />
      </div>

      {/* Live Camera Grid */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Видео в реальном времени</h2>
        {cameras.length === 0 ? (
          <Card className="p-12 text-center">
            <Video className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 mb-2">Камеры не найдены</p>
            <p className="text-sm text-slate-500">Добавьте камеры для начала мониторинга</p>
          </Card>
        ) : (
          <div className="camera-grid">
            {cameras.map((camera) => (
              <CameraCard key={camera.id} camera={camera} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color, testId }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600 mb-1">{label}</p>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
        </div>
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white shadow-lg`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
};

const CameraCard = ({ camera }) => {
  const [isLive, setIsLive] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`camera-card-${camera.id}`}>
      <div className="video-container bg-slate-900">
        {isLive ? (
          <img
            src={`${API}/stream/${camera.id}`}
            alt={camera.name}
            className="w-full h-full object-cover"
            onError={() => setIsLive(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setIsLive(true)}
              data-testid={`play-camera-${camera.id}`}
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1"></div>
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">{camera.name}</h3>
          <Badge
            variant={camera.status === 'active' ? 'default' : 'secondary'}
            className={camera.status === 'active' ? 'bg-green-500' : ''}
            data-testid={`camera-status-${camera.id}`}
          >
            {camera.status === 'active' ? 'Активна' : 'Неактивна'}
          </Badge>
        </div>

        <div className="flex items-center space-x-4 text-xs text-slate-600">
          {camera.continuous_recording && (
            <div className="flex items-center space-x-1">
              <FileVideo className="w-3 h-3" />
              <span>Запись</span>
            </div>
          )}
          {camera.motion_detection && (
            <div className="flex items-center space-x-1">
              <Activity className="w-3 h-3" />
              <span>Детекция</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default Dashboard;
