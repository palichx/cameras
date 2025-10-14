# VideoGuard - Docker Deployment Guide

## Требования

- Docker Engine 20.10+
- Docker Compose 2.0+
- Минимум 4GB RAM
- Минимум 20GB свободного места на диске

## Быстрый старт

### Разработка

```bash
# Запуск среды разработки
make dev-up

# Просмотр логов
make dev-logs

# Остановка
make dev-down
```

Приложение будет доступно по адресам:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- MongoDB: mongodb://admin:admin123@localhost:27017

### Production

```bash
# Сборка образов
make build

# Запуск production окружения
make up

# Просмотр логов
make logs

# Остановка
make down
```

## Структура проекта

```
.
├── backend/
│   ├── Dockerfile          # Production образ
│   ├── Dockerfile.dev      # Development образ
│   ├── requirements.txt
│   └── server.py
├── frontend/
│   ├── Dockerfile          # Production образ (multi-stage)
│   ├── nginx.conf          # Nginx конфигурация
│   └── ...
├── docker-compose.yml      # Production compose
├── docker-compose.dev.yml  # Development compose
└── Makefile                # Команды управления
```

## Доступные команды

### Development

- `make dev-up` - Запустить среду разработки
- `make dev-down` - Остановить среду разработки
- `make dev-logs` - Просмотр логов разработки

### Production

- `make build` - Собрать production образы
- `make up` - Запустить production окружение
- `make down` - Остановить production окружение
- `make restart` - Перезапустить production окружение

### Логи

- `make logs` - Все логи
- `make backend-logs` - Логи backend
- `make frontend-logs` - Логи frontend
- `make db-logs` - Логи MongoDB

### Обслуживание

- `make clean` - Удалить контейнеры, volumes и образы
- `make prune` - Очистить неиспользуемые Docker ресурсы
- `make health` - Проверить состояние сервисов

### База данных

- `make db-shell` - Открыть MongoDB shell
- `make db-backup` - Создать backup БД
- `make db-restore` - Восстановить БД из backup

## Конфигурация

### Переменные окружения

#### Backend (.env)
```env
MONGO_URL=mongodb://admin:admin123@mongodb:27017
DB_NAME=videoguard
CORS_ORIGINS=*
```

#### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Порты

| Сервис   | Порт  | Описание               |
|----------|-------|------------------------|
| Frontend | 3000  | React приложение       |
| Backend  | 8001  | FastAPI сервер         |
| MongoDB  | 27017 | База данных            |

## Volumes

### Production
- `mongodb_data` - Данные MongoDB
- `mongodb_config` - Конфигурация MongoDB
- `recordings_data` - Видеозаписи с камер

### Development
- `mongodb_data_dev` - Данные MongoDB (dev)
- `recordings_data_dev` - Видеозаписи (dev)

## Особенности

### Hot Reload в Development

- **Backend**: Автоматическая перезагрузка при изменении Python файлов
- **Frontend**: Автоматическая перезагрузка при изменении React файлов

### Production Optimization

- **Frontend**: Multi-stage build с Nginx
- **Backend**: Оптимизированный Python образ
- **Nginx**: Gzip сжатие и кэширование статики
- **Health checks**: Автоматические проверки здоровья сервисов

## Мониторинг

### Проверка статуса
```bash
docker-compose ps
```

### Использование ресурсов
```bash
docker stats
```

### Логи конкретного контейнера
```bash
docker logs -f videoguard-backend
docker logs -f videoguard-frontend
docker logs -f videoguard-mongodb
```

## Backup и восстановление

### Создание backup
```bash
make db-backup
```

Backup будет сохранен в `./backups/backup-YYYYMMDD-HHMMSS/`

### Восстановление из backup
```bash
make db-restore
# Введите имя директории backup когда будет запрошено
```

## Troubleshooting

### Контейнеры не запускаются

1. Проверьте логи:
   ```bash
   make logs
   ```

2. Проверьте доступность портов:
   ```bash
   netstat -tulpn | grep -E '3000|8001|27017'
   ```

3. Пересоберите образы:
   ```bash
   make clean
   make build
   make up
   ```

### MongoDB не подключается

1. Проверьте логи MongoDB:
   ```bash
   make db-logs
   ```

2. Убедитесь что volume не поврежден:
   ```bash
   docker volume inspect videoguard_mongodb_data
   ```

### Frontend не может подключиться к Backend

1. Проверьте переменную `REACT_APP_BACKEND_URL`
2. Убедитесь что Backend запущен:
   ```bash
   curl http://localhost:8001/api/
   ```

### Нехватка места на диске

```bash
# Очистка старых образов и volumes
make prune

# Очистка записей с камер
docker exec videoguard-backend rm -rf /app/recordings/*
```

## Production Deployment

### С доменным именем

1. Обновите `nginx.conf`:
   ```nginx
   server_name yourdomain.com;
   ```

2. Добавьте SSL сертификат

3. Обновите `REACT_APP_BACKEND_URL` в frontend

### С обратным прокси

Если используется внешний Nginx/Apache:

```nginx
location / {
    proxy_pass http://localhost:3000;
}

location /api/ {
    proxy_pass http://localhost:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
}
```

## Масштабирование

### Увеличение ресурсов для backend

В `docker-compose.yml` добавьте:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '1'
        memory: 2G
```

### Запуск нескольких backend инстансов

```bash
docker-compose up -d --scale backend=3
```

## Безопасность

### Рекомендации для production

1. Измените пароли MongoDB
2. Используйте SSL/TLS сертификаты
3. Ограничьте CORS origins
4. Используйте Docker secrets для паролей
5. Регулярно обновляйте образы

### Docker secrets

```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt

services:
  backend:
    secrets:
      - db_password
```

## Дополнительная информация

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [VideoGuard HTTP Cameras Guide](./HTTP_CAMERAS_GUIDE.md)