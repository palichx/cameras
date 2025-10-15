import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
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
import { Activity, Image as ImageIcon, Trash2, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';

const MotionEvents = () => {
  const [events, setEvents] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mass management states
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [showDateRangeDialog, setShowDateRangeDialog] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAction, setDeleteAction] = useState(null);

  useEffect(() => {
    fetchCameras();
    fetchEvents();
    
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [selectedCamera]);

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${API}/cameras`);
      setCameras(response.data);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      let url = `${API}/motion-events?limit=100`;
      if (selectedCamera !== 'all') {
        url += `&camera_id=${selectedCamera}`;
      }

      const response = await axios.get(url);
      setEvents(response.data);
      setSelectedEvents([]); // Clear selection on new fetch
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Ошибка загрузки событий');
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getRelativeTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ч. назад`;
    return `${Math.floor(diffMins / 1440)} дн. назад`;
  };

  // Mass management functions
  const toggleSelectAll = () => {
    if (selectedEvents.length === events.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(events.map(e => e.id));
    }
  };

  const toggleSelectEvent = (eventId) => {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter(id => id !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.length === 0) {
      toast.error('Выберите события для удаления');
      return;
    }

    setDeleteAction({
      type: 'bulk',
      count: selectedEvents.length,
      message: `Вы уверены, что хотите удалить ${selectedEvents.length} событий движения?`
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
      message: `Удалить все события движения с ${startDate} по ${endDate}?`
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
    const count = events.length;

    setDeleteAction({
      type: 'camera',
      cameraId: selectedCamera,
      count: count,
      message: `Удалить все ${count} событий движения с камеры "${cameraName}"?`
    });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      let response;

      switch (deleteAction.type) {
        case 'bulk':
          response = await axios.post(`${API}/motion-events/bulk-delete`, {
            ids: selectedEvents
          });
          toast.success(`Удалено ${response.data.deleted} событий`);
          break;

        case 'date-range':
          response = await axios.post(`${API}/motion-events/delete-by-date`, {
            start_date: deleteAction.startDate,
            end_date: deleteAction.endDate,
            camera_id: deleteAction.cameraId
          });
          toast.success(`Удалено ${response.data.deleted} событий`);
          break;

        case 'camera':
          response = await axios.post(`${API}/motion-events/delete-by-camera?camera_id=${deleteAction.cameraId}`);
          toast.success(`Удалено ${response.data.deleted} событий`);
          break;

        default:
          break;
      }

      setSelectedEvents([]);
      fetchEvents();
    } catch (error) {
      console.error('Error during bulk delete:', error);
      toast.error('Ошибка при удалении событий');
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
    <div className="space-y-6" data-testid="motion-events-page">
      <div>
        <h1 className="text-4xl font-bold text-slate-800 mb-2">События движения</h1>
        <p className="text-slate-600">История обнаружения движения</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
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
      </Card>

      {/* Bulk Actions */}
      {events.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all-events"
                checked={selectedEvents.length === events.length && events.length > 0}
                onCheckedChange={toggleSelectAll}
                data-testid="select-all-checkbox"
              />
              <label htmlFor="select-all-events" className="text-sm font-medium text-slate-700 cursor-pointer">
                Выбрать все ({events.length})
              </label>
            </div>

            {selectedEvents.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                Выбрано: {selectedEvents.length}
              </Badge>
            )}

            <div className="flex-1"></div>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedEvents.length === 0}
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

      {/* Events List */}
      {events.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600">События движения не найдены</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Card
              key={event.id}
              className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setSelectedEvent(event)}
              data-testid={`motion-event-${event.id}`}
            >
              <div className="relative aspect-video bg-slate-900">
                {event.snapshot_path ? (
                  <img
                    src={`${API}/motion-events/${event.id}/snapshot`}
                    alt="Motion snapshot"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-slate-600" />
                  </div>
                )}

                <div className="absolute top-2 right-2">
                  <Badge className="bg-orange-500">
                    <Activity className="w-3 h-3 mr-1" />
                    Движение
                  </Badge>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-slate-800 mb-1">{event.camera_name}</h3>
                <div className="text-sm text-slate-600">
                  <div>{formatDate(event.timestamp)}</div>
                  <div className="text-xs mt-1 text-slate-500">{getRelativeTime(event.timestamp)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-3xl" data-testid="event-detail-dialog">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{selectedEvent.camera_name}</h2>
                <p className="text-slate-600">{formatDate(selectedEvent.timestamp)}</p>
              </div>

              {selectedEvent.snapshot_path && (
                <div className="rounded-lg overflow-hidden bg-slate-900">
                  <img
                    src={`${API}/motion-events/${selectedEvent.id}/snapshot`}
                    alt="Motion snapshot"
                    className="w-full"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Badge className="bg-orange-500">
                  <Activity className="w-3 h-3 mr-1" />
                  Обнаружено движение
                </Badge>
                <span className="text-sm text-slate-600">{getRelativeTime(selectedEvent.timestamp)}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default MotionEvents;
