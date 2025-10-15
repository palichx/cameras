# Решение проблем с видеоплеером

## Текущее состояние

### ✅ Что работает локально:
1. Backend API endpoint `/api/recordings/{id}` возвращает видеофайлы
2. Поддержка Range requests (статус 206) для потоковой передачи
3. Frontend компонент видеоплеера корректно реализован
4. Тестовая страница работает: `http://localhost:8001/api/test-player`

### ❌ Проблема:
Видеоплеер не работает через внешний URL (https://camguard-4.preview.emergentagent.com) из-за проблемы с Kubernetes ingress - API запросы `/api/*` не достигают backend сервиса.

## Диагностика

### Локальное тестирование (✅ Работает):

```bash
# 1. Получить список записей
curl http://localhost:8001/api/recordings

# 2. Скачать видео
curl http://localhost:8001/api/recordings/{id} -o video.mp4

# 3. Проверить Range поддержку
curl -H "Range: bytes=0-1023" http://localhost:8001/api/recordings/{id} -o test.mp4
# Должен вернуть статус 206 и Content-Range header

# 4. Открыть тестовую страницу
curl http://localhost:8001/api/test-player
# Или в браузере: http://localhost:8001/api/test-player
```

### Внешнее тестирование (❌ Не работает):

```bash
# API запросы таймаутят или возвращают 404
curl https://camguard-4.preview.emergentagent.com/api/recordings
# Ожидание... timeout или 404
```

## Реализованные улучшения

### 1. Backend: Поддержка Range Requests

```python
@api_router.get("/recordings/{recording_id}")
async def get_recording_file(recording_id: str, request: Request):
    # ... получение записи ...
    
    range_header = request.headers.get("range")
    
    if range_header:
        # Парсинг range
        start, end = parse_range(range_header, file_size)
        
        # Потоковая передача части файла
        return StreamingResponse(
            iterfile(start, end),
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
            }
        )
    
    # Полный файл
    return FileResponse(file_path, media_type="video/mp4")
```

**Почему это важно:**
- HTML5 video требует Range requests для seek (перемотки)
- Позволяет начать воспроизведение до полной загрузки
- Экономит трафик при коротких просмотрах

### 2. Frontend: Видеоплеер с Dialog

```jsx
<Dialog open={showPlayer}>
  <video key={recording.id} controls autoPlay>
    <source src={`${API}/recordings/${recording.id}`} type="video/mp4" />
  </video>
</Dialog>
```

**Особенности:**
- `key={recording.id}` - пересоздает элемент при смене видео
- `controls` - встроенные элементы управления браузера
- `autoPlay` - автоматический старт
- `maxHeight: 70vh` - адаптивный размер

### 3. Тестовая страница

Доступна по адресу `/api/test-player` для проверки функциональности:

**Возможности:**
- Автозагрузка первой записи
- Отображение метаданных
- Тест Range поддержки
- Логирование событий видео
- Удобный UI для диагностики

## Решение проблемы с Kubernetes Ingress

### Вариант 1: Nginx внутри контейнера (Реализован)

```nginx
server {
    listen 80;
    
    location /api/ {
        proxy_pass http://localhost:8001;
        # Range headers support
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
    }
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

**Статус:** Nginx настроен и работает на порту 80, но Kubernetes ingress не перенаправляет запросы.

### Вариант 2: Обратиться в поддержку Emergent

Необходимо настроить Kubernetes ingress для маршрутизации `/api/*` на порт 8001 или 80 контейнера.

**Контакты поддержки:**
- Discord: https://discord.gg/VzKfwzCXC4A  
- Email: support@emergent.sh

**Что указать в запросе:**
```
Тема: Настройка Kubernetes Ingress для backend API

Приложение: https://camguard-4.preview.emergentagent.com
Проблема: Запросы к /api/* не достигают backend сервиса

Детали:
- Frontend работает (порт 3000)
- Backend работает локально (порт 8001)
- Nginx настроен на порту 80
- Необходимо: маршрутизация /api/* к backend

Запросы для тестирования:
- GET /api/cameras (список камер)
- GET /api/recordings (список записей)
- GET /api/recordings/{id} (видеофайл, требует Range поддержку)
```

### Вариант 3: Временный workaround (альтернатива)

Если ingress нельзя настроить быстро, можно использовать прямое подключение к backend:

```javascript
// В App.js
const BACKEND_DIRECT = 'http://backend-service:8001';
export const API = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8001/api'
  : `${BACKEND_DIRECT}/api`;
```

Но это требует настройки на уровне Kubernetes Services.

## Проверка работоспособности

### Шаг 1: Проверить backend локально

```bash
# Terminal 1: Check API
curl http://localhost:8001/api/recordings

# Should return JSON array of recordings
```

### Шаг 2: Проверить тестовую страницу

```bash
# Open in browser (if you have port forwarding):
# http://localhost:8001/api/test-player

# Or test with curl:
curl http://localhost:8001/api/test-player | grep "Тест видеоплеера"
```

### Шаг 3: Проверить Range поддержку

```bash
curl -H "Range: bytes=0-1023" \
  http://localhost:8001/api/recordings/{recording_id} \
  -w "\nStatus: %{http_code}\n" \
  -o /tmp/test.mp4
  
# Expected: Status: 206
# File size should be ~1KB
ls -lh /tmp/test.mp4
```

### Шаг 4: После настройки ingress

```bash
# Test external API
curl https://camguard-4.preview.emergentagent.com/api/recordings

# Should return recordings array (not 404 or timeout)
```

## Технические детали

### Range Request Format

```
Request:
GET /api/recordings/{id}
Range: bytes=0-1023

Response:
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/21739
Content-Length: 1024
Content-Type: video/mp4

[binary data]
```

### Browser Video Events

```javascript
video.addEventListener('loadstart', ...);      // Начало загрузки
video.addEventListener('loadedmetadata', ...); // Метаданные загружены
video.addEventListener('loadeddata', ...);     // Первый кадр загружен
video.addEventListener('canplay', ...);        // Можно воспроизводить
video.addEventListener('canplaythrough', ...); // Можно проиграть до конца
video.addEventListener('error', ...);          // Ошибка загрузки
```

### Common Error Messages

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `MEDIA_ERR_SRC_NOT_SUPPORTED` | Неправильный кодек | Проверить формат видео (должен быть H.264) |
| `MEDIA_ERR_NETWORK` | Сеть недоступна | Проверить доступность API endpoint |
| `MEDIA_ERR_DECODE` | Ошибка декодирования | Файл поврежден или неполный |
| `404 Not Found` | Файл не найден | Проверить file_path в базе данных |

## Выводы

### Что сделано:
✅ Backend endpoint с Range поддержкой
✅ Frontend видеоплеер с Dialog
✅ Тестовая страница для диагностики
✅ Nginx reverse proxy на порту 80
✅ Документация и troubleshooting

### Что осталось:
❌ Настройка Kubernetes ingress для маршрутизации /api/*
❌ Это требует помощи поддержки Emergent

### Как проверить что всё работает:
1. После настройки ingress откройте: https://camguard-4.preview.emergentagent.com/recordings
2. Нажмите синюю кнопку Play на любой записи
3. Видео должно начать воспроизводиться автоматически
4. Проверьте что seek (перемотка) работает
5. Проверьте fullscreen режим

## Дополнительные ресурсы

- HTML5 Video: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
- Range Requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
- FastAPI FileResponse: https://fastapi.tiangolo.com/advanced/custom-response/#fileresponse
- FastAPI StreamingResponse: https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse
