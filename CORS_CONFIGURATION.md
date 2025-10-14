# CORS Configuration - Allow All Origins

## Текущая конфигурация

CORS (Cross-Origin Resource Sharing) настроен для **приема соединений с любого домена**.

## Настройки

### Backend (server.py)

```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,  # Должно быть False при allow_origins=["*"]
    allow_origins=["*"],      # Принимать запросы с любого домена
    allow_methods=["*"],      # Все HTTP методы (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],      # Все заголовки
)
```

### Docker Compose

**Development (`docker-compose.dev.yml`):**
```yaml
environment:
  - CORS_ORIGINS=*
```

**Production (`docker-compose.yml`):**
```yaml
environment:
  - CORS_ORIGINS=*
```

## Что это означает

- ✅ Любой сайт может делать запросы к API
- ✅ Работает с `http://localhost:3000`
- ✅ Работает с `https://yourdomain.com`
- ✅ Работает с любым другим доменом
- ⚠️ `allow_credentials=False` - cookies не передаются (безопаснее)

## Проверка CORS

### Тест 1: cURL с разных доменов

```bash
# Запрос с localhost
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8001/api/cameras -v

# Должен вернуть:
# Access-Control-Allow-Origin: *
```

### Тест 2: Браузер

```javascript
// Откройте консоль браузера на любом сайте
fetch('http://localhost:8001/api/cameras')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));

// Не должно быть CORS ошибок
```

### Тест 3: Проверка заголовков

```bash
curl -I http://localhost:8001/api/cameras

# Должно содержать:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: *
# Access-Control-Allow-Headers: *
```

## Важные заметки

### allow_credentials vs allow_origins

**Нельзя использовать вместе:**
```python
# ❌ ОШИБКА: Не работает
allow_credentials=True,
allow_origins=["*"]

# ✅ ПРАВИЛЬНО: Вариант 1 - Любые домены без credentials
allow_credentials=False,
allow_origins=["*"]

# ✅ ПРАВИЛЬНО: Вариант 2 - Конкретные домены с credentials
allow_credentials=True,
allow_origins=["https://yourdomain.com", "https://app.example.com"]
```

### Безопасность

**Текущая конфигурация (allow_origins=["*"]):**

**Плюсы:**
- ✅ Максимальная совместимость
- ✅ Работает везде
- ✅ Легко тестировать

**Минусы:**
- ⚠️ Любой сайт может делать запросы
- ⚠️ Нужна другая защита (API keys, authentication)

**Рекомендации для production:**

Если нужна повышенная безопасность, ограничьте домены:

```python
allow_origins=[
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "https://app.yourdomain.com"
]
```

## Ограничение доменов (опционально)

Если в будущем захотите ограничить:

### Через переменную окружения

**.env:**
```env
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**server.py:**
```python
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True if cors_origins != ['*'] else False,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Динамическая проверка

```python
from starlette.middleware.cors import CORSMiddleware

# Список разрешенных доменов
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://yourdomain.com",
    "https://*.yourdomain.com"  # Wildcard поддомены
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Отладка CORS проблем

### Проблема: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Решение:**
```python
# Убедитесь что middleware добавлен
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# Проверьте порядок middleware (должно быть перед другими)
```

### Проблема: "The value of the 'Access-Control-Allow-Credentials' header"

**Решение:**
```python
# Если origins="*", то credentials должно быть False
allow_credentials=False,
allow_origins=["*"]
```

### Проблема: Preflight requests fail

```python
# Убедитесь что OPTIONS метод разрешен
allow_methods=["*"]  # Включает OPTIONS
```

## Альтернативные конфигурации

### Вариант 1: Только локальная разработка

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Вариант 2: Regex patterns

```python
from starlette.middleware.cors import CORSMiddleware
import re

class CustomCORSMiddleware:
    def __init__(self, app):
        self.app = app
        self.allowed_patterns = [
            re.compile(r"https://.*\.yourdomain\.com"),
            re.compile(r"http://localhost:\d+")
        ]
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            origin = dict(scope["headers"]).get(b"origin", b"").decode()
            if any(p.match(origin) for p in self.allowed_patterns):
                # Allow
                pass
        return await self.app(scope, receive, send)
```

### Вариант 3: Environment-based

```python
import os

if os.environ.get('ENV') == 'development':
    cors_origins = ["*"]
    cors_credentials = False
else:
    cors_origins = os.environ.get('CORS_ORIGINS', '').split(',')
    cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_credentials=cors_credentials,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Nginx CORS (альтернатива)

Если используете Nginx, можно настроить CORS там:

**nginx.conf:**
```nginx
location /api/ {
    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    
    # Preflight requests
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    
    proxy_pass http://backend:8001;
}
```

## Проверка текущей конфигурации

```bash
# 1. Проверить backend код
grep -A 5 "CORSMiddleware" backend/server.py

# 2. Проверить переменные окружения
docker exec videoguard-backend env | grep CORS

# 3. Тестовый запрос
curl -H "Origin: http://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8001/api/cameras -v
```

## Резюме

### Текущая конфигурация:

```python
allow_credentials=False  # ✅
allow_origins=["*"]      # ✅ Все домены
allow_methods=["*"]      # ✅ Все методы
allow_headers=["*"]      # ✅ Все заголовки
```

**Результат:** API принимает соединения с любого домена без ограничений.

### Рестарт после изменений:

```bash
# Development
make dev-down
make dev-up

# Production
docker-compose restart backend
```

### Проверка работы:

```bash
# Должно работать с любого домена
curl http://localhost:8001/api/
# {"message":"Video Surveillance System API"}
```

## Дополнительная защита

Так как CORS открыт для всех, рекомендуется:

1. **Rate limiting** - ограничить количество запросов
2. **API keys** - требовать ключ для критических операций
3. **Authentication** - требовать авторизацию
4. **IP whitelisting** - ограничить по IP (опционально)

Пример rate limiting:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/cameras")
@limiter.limit("10/minute")
async def get_cameras():
    ...
```
