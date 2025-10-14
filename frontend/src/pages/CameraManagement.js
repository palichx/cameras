import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
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
                  <span className="text-slate-600">Протокол:</span>
                  <span className="font-medium text-slate-800">{camera.protocol.toUpperCase()}</span>
                </div>
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
    rtsp_url: camera?.rtsp_url || '',
    username: camera?.username || '',
    password: camera?.password || '',
    protocol: camera?.protocol || 'tcp',
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
            <Label htmlFor="rtsp_url">RTSP URL</Label>
            <Input
              id="rtsp_url"
              data-testid="camera-rtsp-input"
              value={formData.rtsp_url}
              onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
              placeholder="rtsp://192.168.1.100:554/stream"
              required
            />
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

          <div>
            <Label htmlFor="protocol">Протокол</Label>
            <Select
              value={formData.protocol}
              onValueChange={(value) => setFormData({ ...formData, protocol: value })}
            >
              <SelectTrigger data-testid="camera-protocol-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
