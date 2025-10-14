# Руководство по поддержке HTTP камер

Система видеонаблюдения VideoGuard поддерживает три типа камер:

## Типы поддерживаемых камер

### 1. RTSP Камеры
Классический протокол для IP-камер с поддержкой TCP/UDP транспорта.

**Пример URL:**
```
rtsp://192.168.1.100:554/stream1
rtsp://username:password@192.168.1.100:554/stream1
```

**Параметры:**
- `stream_url`: RTSP URL камеры
- `stream_type`: `"rtsp"`
- `protocol`: `"tcp"` или `"udp"`
- `username`, `password`: опционально для авторизации

### 2. HTTP MJPEG (Motion JPEG)
Видеопоток передается как последовательность JPEG изображений через HTTP.

**Пример URL:**
```
http://192.168.1.100:8080/video
http://192.168.1.100/mjpeg
http://192.168.1.100/video.cgi
```

**Параметры:**
- `stream_url`: HTTP URL MJPEG потока
- `stream_type`: `"http-mjpeg"`
- `username`, `password`: опционально для HTTP Basic Auth

**Когда использовать:**
- Камеры с встроенным веб-сервером
- IP-камеры с MJPEG стримингом
- USB-камеры с MJPEG-streamer

### 3. HTTP Snapshot
Получение отдельных снимков с камеры через HTTP с заданным интервалом.

**Пример URL:**
```
http://192.168.1.100/snapshot.jpg
http://192.168.1.100/cgi-bin/snapshot.cgi
http://192.168.1.100/image.jpg
```

**Параметры:**
- `stream_url`: HTTP URL для получения снимка
- `stream_type`: `"http-snapshot"`
- `snapshot_interval`: интервал в секундах (0.1 - 10.0)
- `username`, `password`: опционально для HTTP Basic Auth

**Когда использовать:**
- Камеры без постоянного потока
- Ограниченная пропускная способность сети
- Камеры с API для снимков

## Примеры добавления камер

### Через API

#### RTSP камера:
```bash
curl -X POST "http://localhost:8001/api/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Front Door Camera",
    "stream_url": "rtsp://192.168.1.100:554/stream1",
    "stream_type": "rtsp",
    "username": "admin",
    "password": "12345",
    "protocol": "tcp",
    "continuous_recording": true,
    "motion_detection": true,
    "motion_sensitivity": 0.5
  }'
```

#### HTTP MJPEG камера:
```bash
curl -X POST "http://localhost:8001/api/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Garage Camera",
    "stream_url": "http://192.168.1.50:8080/video",
    "stream_type": "http-mjpeg",
    "username": "admin",
    "password": "admin123",
    "continuous_recording": true,
    "motion_detection": true,
    "motion_sensitivity": 0.6
  }'
```

#### HTTP Snapshot камера:
```bash
curl -X POST "http://localhost:8001/api/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backyard Camera",
    "stream_url": "http://192.168.1.60/snapshot.cgi",
    "stream_type": "http-snapshot",
    "username": "camera",
    "password": "pass123",
    "snapshot_interval": 1.0,
    "continuous_recording": true,
    "motion_detection": true,
    "motion_sensitivity": 0.7
  }'
```

## Особенности работы

### Запись видео
- **RTSP**: Непрерывная запись с оригинальным FPS камеры
- **HTTP MJPEG**: Запись с FPS ~20 (по умолчанию)
- **HTTP Snapshot**: Запись с FPS = 1/snapshot_interval

### Детекция движения
Работает одинаково для всех типов камер:
- Базовая детекция через сравнение кадров
- Настраиваемая чувствительность (0.0 - 1.0)
- Поддержка зон детекции

### Live-просмотр
Все типы камер поддерживают live-просмотр через endpoint `/api/stream/{camera_id}`

### Производительность
- **RTSP**: Лучшая производительность и качество
- **HTTP MJPEG**: Средняя производительность, хорошее качество
- **HTTP Snapshot**: Низкая нагрузка, подходит для медленных каналов

## Рекомендации

1. **Используйте RTSP** когда:
   - Камера поддерживает RTSP
   - Нужна лучшая производительность
   - Требуется высокий FPS

2. **Используйте HTTP MJPEG** когда:
   - RTSP недоступен
   - Камера имеет встроенный MJPEG стрим
   - Нужен баланс между качеством и совместимостью

3. **Используйте HTTP Snapshot** когда:
   - Ограничена пропускная способность
   - Достаточно низкого FPS
   - Камера предоставляет только API для снимков

## Устранение неполадок

### Камера не подключается
1. Проверьте доступность URL (ping, curl)
2. Убедитесь в правильности учетных данных
3. Проверьте firewall и сетевые настройки

### Низкое качество видео
1. Для RTSP: попробуйте изменить протокол (TCP ↔ UDP)
2. Для HTTP Snapshot: увеличьте snapshot_interval
3. Проверьте пропускную способность сети

### Высокая нагрузка на CPU
1. Уменьшите количество активных камер
2. Отключите continuous_recording для некоторых камер
3. Увеличьте snapshot_interval для HTTP Snapshot камер

## Совместимость

Протестировано с:
- Hikvision (RTSP, HTTP)
- Dahua (RTSP, HTTP)
- Axis (RTSP, HTTP MJPEG)
- Generic IP cameras (HTTP)
- USB cameras с mjpeg-streamer (HTTP MJPEG)
