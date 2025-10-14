# Исправление ошибки "No such file or directory: recordings"

## Проблема

```
FileNotFoundError: [Errno 2] No such file or directory: '/app/backend/recordings'
```

## Причина

Несоответствие путей:
- **Код (server.py):** `STORAGE_PATH = Path("/app/backend/recordings")`
- **Dockerfile:** Создавал `/app/recordings`
- **docker-compose volumes:** Монтировал на `/app/recordings`

## Решение

Все пути теперь унифицированы на `/app/backend/recordings`

### Обновлено:

**1. Все Dockerfile:**
```dockerfile
# Теперь создают правильный путь
RUN mkdir -p /app/backend/recordings
```

**2. docker-compose.yml:**
```yaml
volumes:
  - recordings_data:/app/backend/recordings  # Было: /app/recordings
```

**3. docker-compose.dev.yml:**
```yaml
volumes:
  - recordings_data_dev:/app/backend/recordings
```

**4. docker-compose.prod.yml:**
```yaml
volumes:
  - recordings_data_prod:/app/backend/recordings
```

**5. entrypoint.sh:**
```bash
mkdir -p /app/backend/recordings
```

**6. Создан .gitkeep:**
```
backend/recordings/.gitkeep
```
Чтобы пустая директория сохранялась в Git.

## Быстрое решение

```bash
# Создать директорию локально
mkdir -p backend/recordings

# Пересобрать контейнеры
make clean
make up

# Или для development
make dev-up
```

## Структура директорий

```
backend/
├── server.py              # STORAGE_PATH = Path("/app/backend/recordings")
├── recordings/            # Директория для записей
│   ├── .gitkeep          # Сохраняет директорию в Git
│   ├── camera_id_1/      # Записи камеры 1
│   │   ├── continuous_*.mp4
│   │   └── motion_*.mp4
│   └── camera_id_2/      # Записи камеры 2
└── ...
```

## Проверка после исправления

```bash
# 1. Директория существует в контейнере
docker exec videoguard-backend ls -la /app/backend/recordings
# Должно показать директорию

# 2. Права доступа корректны
docker exec videoguard-backend ls -ld /app/backend/recordings
# drwxr-xr-x

# 3. Backend запускается без ошибок
docker logs videoguard-backend
# Не должно быть FileNotFoundError

# 4. API работает
curl http://localhost:8001/api/
# {"message":"Video Surveillance System API"}
```

## Volume монтирование

### Production
```yaml
volumes:
  recordings_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/videoguard/recordings  # Внешнее хранилище
```

### Development
```yaml
volumes:
  recordings_data_dev:
    driver: local  # Docker управляет volume
```

## Альтернативное решение

Если хотите использовать `/app/recordings` вместо `/app/backend/recordings`:

**1. Изменить server.py:**
```python
STORAGE_PATH = Path("/app/recordings")  # Вместо /app/backend/recordings
```

**2. Обновить Dockerfile:**
```dockerfile
RUN mkdir -p /app/recordings
```

**3. Обновить docker-compose.yml:**
```yaml
volumes:
  - recordings_data:/app/recordings
```

**Но текущий вариант (`/app/backend/recordings`) лучше:**
- ✅ Изоляция backend файлов
- ✅ Понятная структура
- ✅ Меньше путаницы

## Permissions проблемы

Если возникают ошибки прав доступа:

```bash
# В Dockerfile добавить
RUN mkdir -p /app/backend/recordings && \
    chmod 777 /app/backend/recordings

# Или в entrypoint.sh
chmod 777 /app/backend/recordings
```

Или использовать конкретного пользователя:

```dockerfile
# Создать пользователя
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/backend/recordings && \
    chown -R appuser:appuser /app

USER appuser
```

## Backup recordings

```bash
# Создать backup
docker run --rm \
  -v videoguard_recordings_data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/recordings-$(date +%Y%m%d).tar.gz /data

# Восстановить backup
docker run --rm \
  -v videoguard_recordings_data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/recordings-20241014.tar.gz -C /
```

## Monitoring размера

```bash
# Проверить размер volume
docker system df -v | grep recordings

# Проверить размер в контейнере
docker exec videoguard-backend du -sh /app/backend/recordings

# Очистить старые записи через API
curl -X POST http://localhost:8001/api/storage/cleanup
```

## .gitignore для recordings

```gitignore
# Игнорировать видео файлы
backend/recordings/**/*.mp4
backend/recordings/**/*.avi

# Но сохранять структуру
!backend/recordings/.gitkeep
```

## Docker volume inspect

```bash
# Посмотреть детали volume
docker volume inspect videoguard_recordings_data

# Где физически хранятся данные
docker volume inspect videoguard_recordings_data | grep Mountpoint

# Размер volume
docker system df -v | grep recordings
```

## Troubleshooting

### Ошибка: Permission denied

```bash
# Добавить в Dockerfile
RUN chmod -R 777 /app/backend/recordings
```

### Ошибка: Volume is read-only

```yaml
# Проверить docker-compose.yml
volumes:
  - recordings_data:/app/backend/recordings:rw  # :rw = read-write
```

### Ошибка: No space left on device

```bash
# Проверить место
df -h

# Очистить старые записи
make clean
docker system prune -af --volumes

# Или через API
curl -X POST http://localhost:8001/api/storage/cleanup
```

## Best Practices

### ✅ DO:

1. **Использовать volumes для recordings**
```yaml
volumes:
  - recordings_data:/app/backend/recordings
```

2. **Создавать .gitkeep**
```bash
touch backend/recordings/.gitkeep
```

3. **Проверять при старте**
```bash
mkdir -p /app/backend/recordings
```

4. **Мониторить размер**
```python
MAX_STORAGE_GB = 50
```

### ❌ DON'T:

1. **Не хранить в Git**
```gitignore
backend/recordings/*.mp4  # ✅
```

2. **Не использовать абсолютные пути в коде**
```python
# ❌ ПЛОХО
STORAGE_PATH = "/opt/recordings"

# ✅ ХОРОШО
STORAGE_PATH = Path(__file__).parent / "recordings"
```

3. **Не забывать создавать директорию**
```dockerfile
RUN mkdir -p /app/backend/recordings  # ✅
```

## Заключение

После исправления:
- ✅ Все пути унифицированы на `/app/backend/recordings`
- ✅ Директория создается автоматически
- ✅ Volume правильно монтируется
- ✅ Backend запускается без ошибок
- ✅ Записи сохраняются корректно
