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

      {/* Recordings List */}
      {recordings.length === 0 ? (
        <Card className="p-12 text-center">
          <FileVideo className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600">Записи не найдены</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {recordings.map((recording) => (
            <Card key={recording.id} className="p-4 hover:shadow-lg transition-shadow" data-testid={`recording-item-${recording.id}`}>
              <div className="flex items-center justify-between">
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
    </div>
  );
};

export default Recordings;
