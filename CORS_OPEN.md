# CORS Отключен - Принимаются соединения с любого домена

## ✅ CORS полностью открыт

API VideoGuard принимает запросы с **любого домена** без ограничений.

## Конфигурация

```python
# backend/server.py
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],      # ✅ Все домены
    allow_methods=["*"],      # ✅ Все методы
    allow_headers=["*"],      # ✅ Все заголовки
)
```

## Проверка

```bash
# Тест с любого домена
curl -H "Origin: http://any-domain.com" \
     http://localhost:8001/api/cameras

# Должен вернуть данные без ошибок CORS
```

## Рестарт

```bash
# После изменений перезапустить:
docker-compose restart backend

# Или
make dev-down && make dev-up
```

## Что работает

- ✅ `http://localhost:3000` → API
- ✅ `https://yourdomain.com` → API
- ✅ `http://example.com` → API
- ✅ Любой другой домен → API

## Важно

⚠️ `allow_credentials=False` - это обязательно при `allow_origins=["*"]`

Если нужны credentials (cookies), ограничьте домены:
```python
allow_credentials=True,
allow_origins=["https://yourdomain.com"]
```

---

См. [CORS_CONFIGURATION.md](./CORS_CONFIGURATION.md) для подробностей.
