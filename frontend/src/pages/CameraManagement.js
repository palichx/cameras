import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Plus, Trash2, Settings, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';

const CameraManagement = () => {
  const [cameras, setCameras] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${API}/cameras`);
      setCameras(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      toast.error('Ошибка загрузки камер');
      setLoading(false);
    }
  };

  const handleAddCamera = () => {
    setShowAddDialog(true);
  };

  const handleEditCamera = (camera) => {
    setSelectedCamera(camera);
    setShowEditDialog(true);
  };

  const handleDeleteCamera = async (cameraId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту камеру?')) {
      return;
    }

    try {
      await axios.delete(`${API}/cameras/${cameraId}`);
      toast.success('Камера удалена');
      fetchCameras();
    } catch (error) {
      console.error('Error deleting camera:', error);
      toast.error('Ошибка удаления камеры');
    }
  };

  const handleToggleCamera = async (cameraId, isActive) => {
    try {
      if (isActive) {
        await axios.post(`${API}/cameras/${cameraId}/stop`);
        toast.success('Камера остановлена');
      } else {
        await axios.post(`${API}/cameras/${cameraId}/start`);
        toast.success('Камера запущена');
      }
      fetchCameras();
    } catch (error) {
      console.error('Error toggling camera:', error);
      toast.error('Ошибка управления камерой');
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
    <div className="space-y-6" data-testid="camera-management-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Управление камерами</h1>
          <p className="text-slate-600">Добавляйте и настраивайте камеры</p>
        </div>
        <Button
          onClick={handleAddCamera}
          data-testid="add-camera-button"
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить камеру
        </Button>
      </div>

      {cameras.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-600 mb-4">Камеры не найдены</p>
          <Button onClick={handleAddCamera} data-testid="add-first-camera">
            <Plus className="w-4 h-4 mr-2" />
            Добавить первую камеру
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cameras.map((camera) => (
            <Card key={camera.id} className="p-6 hover:shadow-lg transition-shadow" data-testid={`camera-item-${camera.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{camera.name}</h3>
                  <p className="text-sm text-slate-600 break-all">{camera.rtsp_url}</p>
                </div>
                <Badge
                  variant={camera.status === 'active' ? 'default' : 'secondary'}
                  className={camera.status === 'active' ? 'bg-green-500' : ''}
                  data-testid={`status-badge-${camera.id}`}
                >
                  {camera.status === 'active' ? 'Активна' : 'Неактивна'}
                </Badge>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Тип:</span>
                  <span className="font-medium text-slate-800">
                    {camera.stream_type === 'rtsp' ? 'RTSP' : camera.stream_type === 'http-mjpeg' ? 'HTTP MJPEG' : 'HTTP Snapshot'}
                  </span>
                </div>
                {camera.stream_type === 'rtsp' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Протокол:</span>
                    <span className="font-medium text-slate-800">{camera.protocol.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Непрерывная запись:</span>
                  <span className="font-medium text-slate-800">{camera.continuous_recording ? 'Да' : 'Нет'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Детекция движения:</span>
                  <span className="font-medium text-slate-800">{camera.motion_detection ? 'Да' : 'Нет'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Чувствительность:</span>
                  <span className="font-medium text-slate-800">{Math.round(camera.motion_sensitivity * 100)}%</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleCamera(camera.id, camera.status === 'active')}
                  data-testid={`toggle-camera-${camera.id}`}
                  className="flex-1"
                >
                  {camera.status === 'active' ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Остановить
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Запустить
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditCamera(camera)}
                  data-testid={`edit-camera-${camera.id}`}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteCamera(camera.id)}
                  data-testid={`delete-camera-${camera.id}`}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAddDialog && (
        <CameraDialog
          isOpen={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={fetchCameras}
        />
      )}

      {showEditDialog && selectedCamera && (
        <CameraDialog
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedCamera(null);
          }}
          onSuccess={fetchCameras}
          camera={selectedCamera}
        />
      )}
    </div>
  );
};

const CameraDialog = ({ isOpen, onClose, onSuccess, camera = null }) => {
  const isEdit = !!camera;
  const [formData, setFormData] = useState({
    name: camera?.name || '',
    stream_url: camera?.stream_url || camera?.rtsp_url || '',
    stream_type: camera?.stream_type || 'rtsp',
    username: camera?.username || '',
    password: camera?.password || '',
    protocol: camera?.protocol || 'tcp',
    snapshot_interval: camera?.snapshot_interval || 1.0,
    continuous_recording: camera?.continuous_recording ?? true,
    motion_detection: camera?.motion_detection ?? true,
    motion_sensitivity: camera?.motion_sensitivity ?? 0.5,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEdit) {
        await axios.put(`${API}/cameras/${camera.id}`, formData);
        toast.success('Камера обновлена');
      } else {
        await axios.post(`${API}/cameras`, formData);
        toast.success('Камера добавлена');
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving camera:', error);
      toast.error('Ошибка сохранения камеры');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="camera-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать камеру' : 'Добавить камеру'}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? 'Измените параметры камеры и сохраните изменения'
              : 'Заполните форму для добавления новой RTSP камеры в систему'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Название камеры</Label>
            <Input
              id="name"
              data-testid="camera-name-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Например: Камера 1"
              required
            />
          </div>

          <div>
            <Label htmlFor="stream_type">Тип потока</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="flex items-center justify-center space-x-2 cursor-pointer border rounded-lg p-3 transition-colors hover:bg-slate-50" style={{ borderColor: formData.stream_type === 'rtsp' ? '#3b82f6' : '#e2e8f0', backgroundColor: formData.stream_type === 'rtsp' ? '#eff6ff' : 'white' }}>
                <input
                  type="radio"
                  name="stream_type"
                  value="rtsp"
                  checked={formData.stream_type === 'rtsp'}
                  onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                  data-testid="stream-type-rtsp"
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">RTSP</span>
              </label>
              <label className="flex items-center justify-center space-x-2 cursor-pointer border rounded-lg p-3 transition-colors hover:bg-slate-50" style={{ borderColor: formData.stream_type === 'http-mjpeg' ? '#3b82f6' : '#e2e8f0', backgroundColor: formData.stream_type === 'http-mjpeg' ? '#eff6ff' : 'white' }}>
                <input
                  type="radio"
                  name="stream_type"
                  value="http-mjpeg"
                  checked={formData.stream_type === 'http-mjpeg'}
                  onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                  data-testid="stream-type-http-mjpeg"
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">HTTP MJPEG</span>
              </label>
              <label className="flex items-center justify-center space-x-2 cursor-pointer border rounded-lg p-3 transition-colors hover:bg-slate-50" style={{ borderColor: formData.stream_type === 'http-snapshot' ? '#3b82f6' : '#e2e8f0', backgroundColor: formData.stream_type === 'http-snapshot' ? '#eff6ff' : 'white' }}>
                <input
                  type="radio"
                  name="stream_type"
                  value="http-snapshot"
                  checked={formData.stream_type === 'http-snapshot'}
                  onChange={(e) => setFormData({ ...formData, stream_type: e.target.value })}
                  data-testid="stream-type-http-snapshot"
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">HTTP Snapshot</span>
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="stream_url">
              {formData.stream_type === 'rtsp' ? 'RTSP URL' : 'HTTP URL'}
            </Label>
            <Input
              id="stream_url"
              data-testid="camera-stream-url-input"
              value={formData.stream_url}
              onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
              placeholder={
                formData.stream_type === 'rtsp' 
                  ? 'rtsp://192.168.1.100:554/stream'
                  : formData.stream_type === 'http-mjpeg'
                  ? 'http://192.168.1.100/mjpeg'
                  : 'http://192.168.1.100/snapshot.jpg'
              }
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {formData.stream_type === 'rtsp' && 'Пример: rtsp://192.168.1.100:554/stream1'}
              {formData.stream_type === 'http-mjpeg' && 'Пример: http://192.168.1.100:8080/video'}
              {formData.stream_type === 'http-snapshot' && 'Пример: http://192.168.1.100/cgi-bin/snapshot.cgi'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Имя пользователя (опционально)</Label>
              <Input
                id="username"
                data-testid="camera-username-input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="admin"
              />
            </div>
            <div>
              <Label htmlFor="password">Пароль (опционально)</Label>
              <Input
                id="password"
                data-testid="camera-password-input"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>

          {formData.stream_type === 'rtsp' && (
            <div>
              <Label htmlFor="protocol">Протокол RTSP</Label>
              <div className="mt-2 flex space-x-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="protocol"
                    value="tcp"
                    checked={formData.protocol === 'tcp'}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                    data-testid="camera-protocol-tcp"
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">TCP</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="protocol"
                    value="udp"
                    checked={formData.protocol === 'udp'}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                    data-testid="camera-protocol-udp"
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">UDP</span>
                </label>
              </div>
            </div>
          )}

          {formData.stream_type === 'http-snapshot' && (
            <div>
              <Label htmlFor="snapshot_interval">Интервал снимков (секунды)</Label>
              <Input
                id="snapshot_interval"
                data-testid="camera-snapshot-interval-input"
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={formData.snapshot_interval}
                onChange={(e) => setFormData({ ...formData, snapshot_interval: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Как часто получать снимки с камеры (0.1 - 10 секунд)
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="continuous_recording">Непрерывная запись</Label>
            <Switch
              id="continuous_recording"
              data-testid="camera-continuous-recording-switch"
              checked={formData.continuous_recording}
              onCheckedChange={(checked) => setFormData({ ...formData, continuous_recording: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="motion_detection">Детекция движения</Label>
            <Switch
              id="motion_detection"
              data-testid="camera-motion-detection-switch"
              checked={formData.motion_detection}
              onCheckedChange={(checked) => setFormData({ ...formData, motion_detection: checked })}
            />
          </div>

          {formData.motion_detection && (
            <div>
              <Label htmlFor="motion_sensitivity">
                Чувствительность движения: {Math.round(formData.motion_sensitivity * 100)}%
              </Label>
              <Slider
                id="motion_sensitivity"
                data-testid="camera-sensitivity-slider"
                value={[formData.motion_sensitivity]}
                onValueChange={([value]) => setFormData({ ...formData, motion_sensitivity: value })}
                min={0}
                max={1}
                step={0.1}
                className="mt-2"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="camera-dialog-cancel">
              Отмена
            </Button>
            <Button type="submit" disabled={saving} data-testid="camera-dialog-submit">
              {saving ? 'Сохранение...' : isEdit ? 'Обновить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CameraManagement;
