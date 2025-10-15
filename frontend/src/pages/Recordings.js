import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '../components/ui/alert-dialog';
import { Download, Trash2, Play, FileVideo, X, CheckSquare, Square, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const Recordings = () => {
  const [recordings, setRecordings] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [playingRecording, setPlayingRecording] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  // Mass management states
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAction, setDeleteAction] = useState(null);

  useEffect(() => {
    fetchCameras();
    fetchRecordings();
  }, [selectedCamera, selectedType]);

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${API}/cameras`);
      setCameras(response.data);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    }
  };

  const fetchRecordings = async () => {
    try {
      let url = `${API}/recordings?limit=100`;
      if (selectedCamera !== 'all') {
        url += `&camera_id=${selectedCamera}`;
      }
      if (selectedType !== 'all') {
        url += `&recording_type=${selectedType}`;
      }

      const response = await axios.get(url);
      setRecordings(response.data);
      setSelectedRecordings([]); // Clear selection on new fetch
      setLoading(false);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast.error('Ошибка загрузки записей');
      setLoading(false);
    }
  };

  const handleDelete = async (recordingId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту запись?')) {
      return;
    }

    try {
      await axios.delete(`${API}/recordings/${recordingId}`);
      toast.success('Запись удалена');
      fetchRecordings();
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast.error('Ошибка удаления записи');
    }
  };

  const handlePlay = (recording) => {
    setPlayingRecording(recording);
    setShowPlayer(true);
  };

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setPlayingRecording(null);
  };

  const handleDownload = async (recordingId, cameraName, startTime) => {
    try {
      const response = await axios.get(`${API}/recordings/${recordingId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cameraName}_${startTime}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Загрузка начата');
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast.error('Ошибка загрузки записи');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Mass management functions
  const toggleSelectAll = () => {
    if (selectedRecordings.length === recordings.length) {
      setSelectedRecordings([]);
    } else {
      setSelectedRecordings(recordings.map(r => r.id));
    }
  };

  const toggleSelectRecording = (recordingId) => {
    if (selectedRecordings.includes(recordingId)) {
      setSelectedRecordings(selectedRecordings.filter(id => id !== recordingId));
    } else {
      setSelectedRecordings([...selectedRecordings, recordingId]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecordings.length === 0) {
      toast.error('Выберите записи для удаления');
      return;
    }

    setDeleteAction({
      type: 'bulk',
      count: selectedRecordings.length,
      message: `Вы уверены, что хотите удалить ${selectedRecordings.length} записей?`
    });
    setShowDeleteConfirm(true);
  };

  const handleDeleteByDateRange = () => {
    if (!startDate || !endDate) {
      toast.error('Укажите дату начала и конца периода');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      toast.error('Дата начала не может быть позже даты окончания');
      return;
    }

    setDeleteAction({
      type: 'date-range',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      cameraId: selectedCamera !== 'all' ? selectedCamera : null,
      message: `Удалить все записи с ${startDate} по ${endDate}?`
    });
    setShowDateRangeDialog(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteByCamera = () => {
    if (selectedCamera === 'all') {
      toast.error('Выберите конкретную камеру');
      return;
    }

    const cameraName = cameras.find(c => c.id === selectedCamera)?.name || selectedCamera;
    const count = recordings.length;

    setDeleteAction({
      type: 'camera',
      cameraId: selectedCamera,
      count: count,
      message: `Удалить все ${count} записей с камеры "${cameraName}"?`
    });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      let response;

      switch (deleteAction.type) {
        case 'bulk':
          response = await axios.post(`${API}/recordings/bulk-delete`, {
            ids: selectedRecordings
          });
          toast.success(`Удалено ${response.data.deleted} записей`);
          break;

        case 'date-range':
          response = await axios.post(`${API}/recordings/delete-by-date`, {
            start_date: deleteAction.startDate,
            end_date: deleteAction.endDate,
            camera_id: deleteAction.cameraId
          });
          toast.success(`Удалено ${response.data.deleted} записей`);
          break;

        case 'camera':
          response = await axios.post(`${API}/recordings/delete-by-camera?camera_id=${deleteAction.cameraId}`);
          toast.success(`Удалено ${response.data.deleted} записей`);
          break;

        default:
          break;
      }

      setSelectedRecordings([]);
      fetchRecordings();
    } catch (error) {
      console.error('Error during bulk delete:', error);
      toast.error('Ошибка при удалении записей');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteAction(null);
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
    <div className="space-y-6" data-testid="recordings-page">
      <div>
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Записи</h1>
        <p className="text-slate-600">Просматривайте и управляйте записями</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Камера</label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger data-testid="filter-camera-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все камеры</SelectItem>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Тип записи</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="filter-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="continuous">Непрерывная</SelectItem>
                <SelectItem value="motion">Движение</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {recordings.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedRecordings.length === recordings.length && recordings.length > 0}
                onCheckedChange={toggleSelectAll}
                data-testid="select-all-checkbox"
              />
              <label htmlFor="select-all" className="text-sm font-medium text-slate-700 cursor-pointer">
                Выбрать все ({recordings.length})
              </label>
            </div>

            {selectedRecordings.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                Выбрано: {selectedRecordings.length}
              </Badge>
            )}

            <div className="flex-1"></div>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedRecordings.length === 0}
              data-testid="bulk-delete-button"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить выбранные
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDateRangeDialog(true)}
              data-testid="delete-by-date-button"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Удалить по дате
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteByCamera}
              disabled={selectedCamera === 'all'}
              data-testid="delete-by-camera-button"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить все с камеры
            </Button>
          </div>
        </Card>
      )}

      {/* Recordings List */}
      {recordings.length === 0 ? (
        <Card className="p-12 text-center">
          <FileVideo className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600">Записи не найдены</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {recordings.map((recording) => (
            <Card 
              key={recording.id} 
              className={`p-4 transition-all ${
                selectedRecordings.includes(recording.id) 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:shadow-lg'
              }`}
              data-testid={`recording-item-${recording.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <Checkbox
                    checked={selectedRecordings.includes(recording.id)}
                    onCheckedChange={() => toggleSelectRecording(recording.id)}
                    data-testid={`checkbox-recording-${recording.id}`}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-slate-800">{recording.camera_name}</h3>
                      <Badge
                        variant="outline"
                        className={recording.recording_type === 'motion' ? 'border-orange-500 text-orange-700' : ''}
                        data-testid={`recording-type-${recording.id}`}
                      >
                        {recording.recording_type === 'continuous' ? 'Непрерывная' : 'Движение'}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-6 text-sm text-slate-600">
                      <div>📅 {formatDate(recording.start_time)}</div>
                      <div>⏱️ {formatDuration(recording.duration)}</div>
                      <div>💾 {formatFileSize(recording.file_size)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handlePlay(recording)}
                    data-testid={`play-recording-${recording.id}`}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDownload(
                        recording.id,
                        recording.camera_name,
                        recording.start_time
                      )
                    }
                    data-testid={`download-recording-${recording.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(recording.id)}
                    data-testid={`delete-recording-${recording.id}`}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={showPlayer} onOpenChange={handleClosePlayer}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                <span>{playingRecording?.camera_name}</span>
                <Badge 
                  variant="outline" 
                  className="ml-3"
                >
                  {playingRecording?.recording_type === 'continuous' ? 'Непрерывная' : 'Движение'}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClosePlayer}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {playingRecording && (
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  key={playingRecording.id}
                  controls
                  autoPlay
                  className="w-full"
                  style={{ maxHeight: '70vh' }}
                >
                  <source 
                    src={`${API}/recordings/${playingRecording.id}`} 
                    type="video/mp4" 
                  />
                  Ваш браузер не поддерживает воспроизведение видео.
                </video>
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-600 px-2">
                <div className="space-y-1">
                  <div>📅 {formatDate(playingRecording.start_time)}</div>
                  <div>⏱️ Длительность: {formatDuration(playingRecording.duration)}</div>
                </div>
                <div className="space-y-1 text-right">
                  <div>💾 Размер: {formatFileSize(playingRecording.file_size)}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(
                      playingRecording.id,
                      playingRecording.camera_name,
                      playingRecording.start_time
                    )}
                    className="mt-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Скачать
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Date Range Delete Dialog */}
      <Dialog open={showDateRangeDialog} onOpenChange={setShowDateRangeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удаление записей по дате</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Дата начала
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="start-date-input"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Дата окончания
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="end-date-input"
              />
            </div>

            <div className="text-sm text-slate-600">
              {selectedCamera !== 'all' && (
                <p>Будут удалены записи только с выбранной камеры</p>
              )}
              {selectedCamera === 'all' && (
                <p>Будут удалены записи со всех камер в указанном диапазоне</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDateRangeDialog(false)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteByDateRange}
              data-testid="confirm-date-delete"
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAction?.message}
              <br />
              <span className="text-red-600 font-medium">
                Это действие необратимо!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Recordings;
