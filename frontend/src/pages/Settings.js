import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Save, Send } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/settings`, settings);
      toast.success('Настройки сохранены');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      const response = await axios.post(`${API}/settings/test-telegram`);
      if (response.data.success) {
        toast.success('Тестовое сообщение отправлено!');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error('Error testing Telegram:', error);
      toast.error(error.response?.data?.detail || 'Ошибка отправки');
    }
  };

  const updateFFmpegSetting = (key, value) => {
    setSettings({
      ...settings,
      ffmpeg: {
        ...settings.ffmpeg,
        [key]: value
      }
    });
  };

  const updateTelegramSetting = (key, value) => {
    setSettings({
      ...settings,
      telegram: {
        ...settings.telegram,
        [key]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="settings-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-800">Настройки системы</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          data-testid="save-settings-button"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>

      {/* FFmpeg Settings */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          🎬 Настройки FFmpeg
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Включить H.264 конвертацию</Label>
              <p className="text-sm text-slate-500">
                Автоматическая конвертация записей для просмотра в браузере
              </p>
            </div>
            <Switch
              checked={settings.ffmpeg.enabled}
              onCheckedChange={(checked) => updateFFmpegSetting('enabled', checked)}
              data-testid="ffmpeg-enabled-switch"
            />
          </div>

          {settings.ffmpeg.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preset">Preset (скорость кодирования)</Label>
                  <Select
                    value={settings.ffmpeg.preset}
                    onValueChange={(value) => updateFFmpegSetting('preset', value)}
                  >
                    <SelectTrigger id="preset" data-testid="preset-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultrafast">ultrafast (самый быстрый, 10x)</SelectItem>
                      <SelectItem value="superfast">superfast (очень быстрый, 6x)</SelectItem>
                      <SelectItem value="veryfast">veryfast (быстрый, 4x)</SelectItem>
                      <SelectItem value="faster">faster (быстрее, 3x)</SelectItem>
                      <SelectItem value="fast">fast (стандартный, 2x)</SelectItem>
                      <SelectItem value="medium">medium (медленный, 1x)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Быстрее = меньше CPU, но больше файл
                  </p>
                </div>

                <div>
                  <Label htmlFor="crf">CRF (качество)</Label>
                  <Select
                    value={settings.ffmpeg.crf.toString()}
                    onValueChange={(value) => updateFFmpegSetting('crf', parseInt(value))}
                  >
                    <SelectTrigger id="crf" data-testid="crf-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18">18 (отличное качество)</SelectItem>
                      <SelectItem value="23">23 (высокое качество)</SelectItem>
                      <SelectItem value="28">28 (хорошее качество)</SelectItem>
                      <SelectItem value="30">30 (среднее, для surveillance)</SelectItem>
                      <SelectItem value="32">32 (низкое качество)</SelectItem>
                      <SelectItem value="35">35 (очень низкое)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Меньше = лучше качество, но больше файл
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="resolution">Максимальное разрешение</Label>
                  <Select
                    value={settings.ffmpeg.max_resolution}
                    onValueChange={(value) => updateFFmpegSetting('max_resolution', value)}
                  >
                    <SelectTrigger id="resolution" data-testid="resolution-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p (854×480)</SelectItem>
                      <SelectItem value="720p">720p (1280×720, рекомендуется)</SelectItem>
                      <SelectItem value="1080p">1080p (1920×1080)</SelectItem>
                      <SelectItem value="original">Оригинальное</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fps">Целевой FPS</Label>
                  <Select
                    value={settings.ffmpeg.target_fps.toString()}
                    onValueChange={(value) => updateFFmpegSetting('target_fps', parseInt(value))}
                  >
                    <SelectTrigger id="fps" data-testid="fps-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 fps (экономия CPU)</SelectItem>
                      <SelectItem value="15">15 fps (рекомендуется)</SelectItem>
                      <SelectItem value="20">20 fps (плавное видео)</SelectItem>
                      <SelectItem value="30">30 fps (высокая плавность)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="audio-bitrate">Audio Bitrate</Label>
                  <Select
                    value={settings.ffmpeg.audio_bitrate}
                    onValueChange={(value) => updateFFmpegSetting('audio_bitrate', value)}
                  >
                    <SelectTrigger id="audio-bitrate" data-testid="audio-bitrate-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="32k">32 kbps (низкое)</SelectItem>
                      <SelectItem value="64k">64 kbps (среднее)</SelectItem>
                      <SelectItem value="128k">128 kbps (высокое)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="threads">CPU Threads</Label>
                  <Select
                    value={settings.ffmpeg.threads.toString()}
                    onValueChange={(value) => updateFFmpegSetting('threads', parseInt(value))}
                  >
                    <SelectTrigger id="threads" data-testid="threads-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 thread (минимум CPU)</SelectItem>
                      <SelectItem value="2">2 threads (рекомендуется)</SelectItem>
                      <SelectItem value="4">4 threads (быстрее)</SelectItem>
                      <SelectItem value="0">auto (автоматически)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Telegram Settings */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          📱 Настройки Telegram
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Включить уведомления Telegram</Label>
              <p className="text-sm text-slate-500">
                Отправка уведомлений о событиях в Telegram
              </p>
            </div>
            <Switch
              checked={settings.telegram.enabled}
              onCheckedChange={(checked) => updateTelegramSetting('enabled', checked)}
              data-testid="telegram-enabled-switch"
            />
          </div>

          {settings.telegram.enabled && (
            <>
              <div>
                <Label htmlFor="bot-token">Bot Token</Label>
                <Input
                  id="bot-token"
                  type="text"
                  value={settings.telegram.bot_token || ''}
                  onChange={(e) => updateTelegramSetting('bot_token', e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  data-testid="bot-token-input"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Получите токен у <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600">@BotFather</a>
                </p>
              </div>

              <div>
                <Label htmlFor="chat-id">Chat ID</Label>
                <Input
                  id="chat-id"
                  type="text"
                  value={settings.telegram.chat_id || ''}
                  onChange={(e) => updateTelegramSetting('chat_id', e.target.value)}
                  placeholder="-1001234567890"
                  data-testid="chat-id-input"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Получите ID у <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-600">@userinfobot</a>
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Уведомления о движении</Label>
                <Switch
                  checked={settings.telegram.send_motion_alerts}
                  onCheckedChange={(checked) => updateTelegramSetting('send_motion_alerts', checked)}
                  data-testid="motion-alerts-switch"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Уведомления об ошибках</Label>
                <Switch
                  checked={settings.telegram.send_error_alerts}
                  onCheckedChange={(checked) => updateTelegramSetting('send_error_alerts', checked)}
                  data-testid="error-alerts-switch"
                />
              </div>

              <Button
                onClick={handleTestTelegram}
                variant="outline"
                data-testid="test-telegram-button"
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Отправить тестовое сообщение
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Settings;
