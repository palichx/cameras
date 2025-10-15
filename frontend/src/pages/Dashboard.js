import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Activity, Video, FileVideo, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const [cameras, setCameras] = useState([]);
  const [camerasStatus, setCamerasStatus] = useState({});
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
      const [camerasRes, recordingsRes, eventsRes, statusRes] = await Promise.all([
        axios.get(`${API}/cameras`, { timeout: 10000 }),
        axios.get(`${API}/recordings?limit=1000`, { timeout: 10000 }),
        axios.get(`${API}/motion-events?limit=1000`, { timeout: 10000 }),
        axios.get(`${API}/cameras/status/all`, { timeout: 10000 }),
      ]);

      const camerasList = camerasRes.data;
      setCameras(camerasList);

      // Create status map for quick lookup
      const statusMap = {};
      statusRes.data.forEach(status => {
        statusMap[status.id] = status;
      });
      setCamerasStatus(statusMap);

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
              <CameraCard 
                key={camera.id} 
                camera={camera} 
                status={camerasStatus[camera.id]}
              />
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

const CameraCard = ({ camera, status }) => {
  const [isLive, setIsLive] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const isRecording = status?.is_recording || false;
  const isMotionDetected = status?.is_motion_detected || false;

  const openInNewWindow = () => {
    const width = 1280;
    const height = 720;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const newWindow = window.open(
      '',
      `camera_${camera.id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );
    
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${camera.name} - Live View</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: #000;
                overflow: hidden;
                font-family: Arial, sans-serif;
              }
              #container {
                width: 100vw;
                height: 100vh;
                display: flex;
                flex-direction: column;
              }
              #header {
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              #video-container {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
              }
              #video {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                transition: transform 0.3s;
                display: none;
              }
              #video.loaded {
                display: block;
              }
              #loading {
                position: absolute;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
                color: white;
              }
              #loading.hidden {
                display: none;
              }
              .spinner {
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255,255,255,0.2);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              }
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              #controls {
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 15px;
                display: flex;
                gap: 10px;
                justify-content: center;
              }
              button {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s;
              }
              button:hover {
                background: rgba(255,255,255,0.3);
              }
              .active {
                background: rgba(59, 130, 246, 0.8) !important;
              }
            </style>
          </head>
          <body>
            <div id="container">
              <div id="header">
                <h2 style="margin: 0;">${camera.name}</h2>
                <button onclick="window.close()">✕ Закрыть</button>
              </div>
              <div id="video-container">
                <div id="loading">
                  <div class="spinner"></div>
                  <div>Подключение к камере...</div>
                </div>
                <img id="video" alt="${camera.name}" />
              </div>
              <div id="controls">
                <button onclick="zoom(1)">100%</button>
                <button onclick="zoom(1.5)">150%</button>
                <button onclick="zoom(2)">200%</button>
                <button onclick="zoom(3)">300%</button>
                <button onclick="resetZoom()">Сбросить</button>
              </div>
            </div>
            <script>
              const video = document.getElementById('video');
              const loading = document.getElementById('loading');
              let currentZoom = 1;
              let firstFrameLoaded = false;
              
              // Start loading video after DOM is ready
              video.onload = function() {
                if (!firstFrameLoaded) {
                  firstFrameLoaded = true;
                  loading.classList.add('hidden');
                  video.classList.add('loaded');
                }
              };
              
              video.onerror = function() {
                loading.innerHTML = '<div class="spinner"></div><div>Ошибка подключения к камере</div>';
              };
              
              // Set src after handlers are attached
              setTimeout(() => {
                video.src = '${API}/stream/${camera.id}?t=' + Date.now();
              }, 100);
              
              function zoom(scale) {
                currentZoom = scale;
                video.style.transform = 'scale(' + scale + ')';
                updateActiveButton(scale);
              }
              
              function resetZoom() {
                zoom(1);
              }
              
              function updateActiveButton(scale) {
                const buttons = document.querySelectorAll('#controls button');
                buttons.forEach(btn => btn.classList.remove('active'));
                const activeBtn = Array.from(buttons).find(btn => btn.textContent.includes(Math.round(scale * 100) + '%'));
                if (activeBtn) activeBtn.classList.add('active');
              }
              
              // Initialize
              updateActiveButton(1);
            </script>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };
              </div>
              <div id="controls">
                <button onclick="zoom(1)">100%</button>
                <button onclick="zoom(1.5)">150%</button>
                <button onclick="zoom(2)">200%</button>
                <button onclick="zoom(3)">300%</button>
                <button onclick="resetZoom()">Сбросить</button>
              </div>
            </div>
            <script>
              const video = document.getElementById('video');
              let currentZoom = 1;
              
              function zoom(scale) {
                currentZoom = scale;
                video.style.transform = 'scale(' + scale + ')';
                updateActiveButton(scale);
              }
              
              function resetZoom() {
                zoom(1);
              }
              
              function updateActiveButton(scale) {
                const buttons = document.querySelectorAll('#controls button');
                buttons.forEach(btn => btn.classList.remove('active'));
                const activeBtn = Array.from(buttons).find(btn => btn.textContent.includes(Math.round(scale * 100) + '%'));
                if (activeBtn) activeBtn.classList.add('active');
              }
              
              // Keyboard shortcuts
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') window.close();
                if (e.key === '1') zoom(1);
                if (e.key === '2') zoom(1.5);
                if (e.key === '3') zoom(2);
                if (e.key === '4') zoom(3);
                if (e.key === '0') resetZoom();
              });
              
              // Error handling
              video.onerror = () => {
                video.style.display = 'none';
                document.getElementById('video-container').innerHTML = '<p style="color: white;">Ошибка загрузки видео</p>';
              };
              
              updateActiveButton(1);
            </script>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`camera-card-${camera.id}`}>
      <div className="video-container bg-slate-900 relative group">
        {isLive ? (
          <>
            <img
              src={`${API}/stream/${camera.id}`}
              alt={camera.name}
              className="w-full h-full object-cover"
              onError={() => setIsLive(false)}
            />
            {/* Recording indicator - top left */}
            {isRecording && (
              <div className="absolute top-2 left-2 z-10 flex items-center space-x-1 bg-red-600/90 backdrop-blur-sm px-2 py-1 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-white text-xs font-medium">REC</span>
              </div>
            )}
            {/* Motion indicator - top right */}
            {isMotionDetected && (
              <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-orange-600/90 backdrop-blur-sm px-2 py-1 rounded-full">
                <Activity className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-medium">ДВИЖЕНИЕ</span>
              </div>
            )}
            {/* Overlay controls */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                onClick={() => setIsLive(false)}
                data-testid={`stop-camera-${camera.id}`}
                className="w-12 h-12 rounded-full bg-red-500/80 backdrop-blur-sm flex items-center justify-center hover:bg-red-600/80 transition-colors"
                title="Остановить"
              >
                <div className="w-4 h-4 bg-white rounded-sm"></div>
              </button>
              <button
                onClick={openInNewWindow}
                data-testid={`open-window-${camera.id}`}
                className="w-12 h-12 rounded-full bg-blue-500/80 backdrop-blur-sm flex items-center justify-center hover:bg-blue-600/80 transition-colors"
                title="Открыть в окне"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Recording indicator when not live */}
            {isRecording && (
              <div className="absolute top-2 left-2 z-10 flex items-center space-x-1 bg-red-600/90 backdrop-blur-sm px-2 py-1 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-white text-xs font-medium">REC</span>
              </div>
            )}
            {/* Motion indicator when not live */}
            {isMotionDetected && (
              <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-orange-600/90 backdrop-blur-sm px-2 py-1 rounded-full">
                <Activity className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-medium">ДВИЖЕНИЕ</span>
              </div>
            )}
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
