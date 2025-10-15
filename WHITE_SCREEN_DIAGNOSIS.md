# Диагностика проблемы "белого экрана"

## Текущее состояние (2025-10-15 09:23)

### ✅ Что работает:

1. **Backend API (локально)**
   ```bash
   curl http://localhost:8001/api/cameras
   # Результат: JSON массив камер ✅
   ```

2. **Frontend (локально)**
   ```bash
   curl http://localhost:3000
   # Результат: HTML страница ✅
   ```

3. **Nginx reverse proxy**
   ```bash
   sudo supervisorctl status nginx_app
   # Результат: RUNNING ✅
   
   curl http://localhost:80/api/cameras
   # Результат: JSON массив камер ✅
   ```

4. **CORS настройки**
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # ✅ Все источники
       allow_methods=["*"],  # ✅ Все методы
       allow_headers=["*"],  # ✅ Все заголовки
   )
   ```

### ❌ Что НЕ работает:

**Внешний URL через Kubernetes ingress:**
```bash
curl https://videosecureai.preview.emergentagent.com/api/cameras
# Результат: 404 page not found ❌
```

## Root Cause

**Проблема:** Kubernetes ingress не маршрутизирует `/api/*` запросы к backend сервису.

**Подтверждение:**
- Локальные запросы работают ✅
- Через nginx (порт 80) работает ✅
- Через внешний URL НЕ работает ❌

## История проблемы

1. **Первое появление:** 14 октября, после начальной настройки
2. **Причина:** Kubernetes ingress не настроен для маршрутизации `/api/*`
3. **Попытки решения:**
   - ✅ Настроили nginx на порту 80 с reverse proxy
   - ✅ Проверили CORS настройки
   - ✅ Обновили frontend для использования прокси
   - ❌ Kubernetes ingress остался не настроенным

## Почему CORS не причина

**CORS настройки корректны:**
```python
allow_origins=["*"]  # Разрешены все источники
allow_methods=["*"]  # Разрешены все методы
allow_headers=["*"]  # Разрешены все заголовки
allow_credentials=False  # Корректно для wildcard origins
```

**CORS проверяется ПОСЛЕ успешного запроса:**
1. Клиент отправляет запрос → Ingress → Backend
2. Backend обрабатывает запрос
3. Backend добавляет CORS заголовки
4. Клиент получает ответ с CORS заголовками

**Если ingress возвращает 404:**
- Запрос не достигает backend
- CORS заголовки не добавляются
- Это проблема инфраструктуры, не CORS

## Проверка состояния

### 1. Backend доступен локально
```bash
curl http://localhost:8001/api/cameras
curl http://localhost:8001/api/recordings
curl http://localhost:8001/api/settings
```
**Ожидаемый результат:** JSON ответы ✅

### 2. Frontend доступен локально
```bash
curl http://localhost:3000
```
**Ожидаемый результат:** HTML с React app ✅

### 3. Nginx работает
```bash
sudo supervisorctl status nginx_app
curl http://localhost:80/api/cameras
```
**Ожидаемый результат:** RUNNING + JSON ✅

### 4. Внешний URL (через ingress)
```bash
curl https://videosecureai.preview.emergentagent.com/
# Должно: HTML страница ✅

curl https://videosecureai.preview.emergentagent.com/api/cameras
# Должно: JSON ❌ Получаем: 404
```

## Решение

### Вариант 1: Настройка Kubernetes Ingress (рекомендуется)

**Необходимо обратиться в поддержку Emergent:**

**Контакты:**
- Discord: https://discord.gg/VzKfwzCXC4A
- Email: support@emergent.sh

**Информация для поддержки:**
```
Приложение: smart-cam-system
URL: https://videosecureai.preview.emergentagent.com
Проблема: Ingress не маршрутизирует /api/* к backend

Детали:
- Frontend (порт 3000): работает ✅
- Backend (порт 8001): работает локально ✅
- Nginx (порт 80): настроен для прокси ✅
- Ingress: НЕ маршрутизирует /api/* ❌

Требуется:
Настроить Kubernetes ingress для маршрутизации:
- / → frontend (порт 3000)
- /api/* → backend (порт 8001 или 80)
```

### Вариант 2: Временный workaround (не рекомендуется)

Использовать только frontend в development режиме с прокси:
- Удалить production build
- Использовать только dev server с setupProxy.js

**Минусы:**
- Не работает production сборка
- Больше ресурсов
- Медленнее работает

## Что НЕ поможет

❌ **Изменение CORS настроек** - они уже правильные
❌ **Перезапуск сервисов** - они работают
❌ **Изменение nginx** - он работает
❌ **Изменение frontend кода** - проблема на уровне ingress

## Workaround для локальной разработки

Если нужно работать с приложением сейчас:

### Вариант A: Port forwarding (если доступен)
```bash
# Forward local port to remote backend
ssh -L 8001:localhost:8001 user@smart-cam-system
```

### Вариант B: Изменить REACT_APP_BACKEND_URL
```bash
# В frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001
```
Затем открыть http://localhost:3000

### Вариант C: Использовать прямой IP
Если известен IP контейнера в Kubernetes.

## Проверка после исправления ingress

После того как поддержка настроит ingress:

```bash
# 1. Проверить API
curl https://videosecureai.preview.emergentagent.com/api/cameras
# Должно вернуть JSON массив камер

# 2. Проверить frontend
curl https://videosecureai.preview.emergentagent.com/
# Должно вернуть HTML

# 3. Открыть в браузере
https://videosecureai.preview.emergentagent.com
# Должна загрузиться Dashboard с данными
```

## Мониторинг

### Логи backend:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "INFO|ERROR"
```

### Логи frontend:
```bash
tail -f /var/log/supervisor/frontend.out.log | grep -E "Compiled|Error"
```

### Логи nginx:
```bash
tail -f /var/log/nginx/app_access.log
tail -f /var/log/nginx/app_error.log
```

### Проверка доступности:
```bash
# Каждые 5 секунд проверять API
watch -n 5 'curl -s https://videosecureai.preview.emergentagent.com/api/cameras | head -c 100'
```

## Заключение

**Проблема:** Kubernetes ingress configuration
**Статус:** Требует помощи Emergent support
**CORS:** ✅ Настроены правильно, не причина проблемы
**Backend:** ✅ Работает корректно
**Frontend:** ✅ Работает корректно
**Nginx:** ✅ Настроен корректно

**Решение:** Ожидание настройки ingress от поддержки Emergent
