# VideoGuard - Быстрый старт с Docker

## 🚀 Запуск за 3 команды

### Для разработки

```bash
# 1. Клонируйте репозиторий (если еще не сделали)
git clone <your-repo-url>
cd videoguard

# 2. Запустите приложение
make dev-up

# 3. Откройте в браузере
# http://localhost:3000
```

### Для production

```bash
# 1. Соберите образы
make build

# 2. Запустите
make up

# 3. Приложение доступно
# Frontend: http://localhost:3000
# Backend:  http://localhost:8001
```

## 📋 Предварительные требования

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM
- 20GB свободного места

## 🛠️ Основные команды

| Команда | Описание |
|---------|----------|
| `make dev-up` | Запустить dev окружение |
| `make dev-down` | Остановить dev окружение |
| `make up` | Запустить production |
| `make down` | Остановить production |
| `make logs` | Посмотреть логи |
| `make clean` | Очистить всё |

## 📝 Что происходит при запуске?

1. **MongoDB** запускается на порту 27017
2. **Backend** (FastAPI) запускается на порту 8001
3. **Frontend** (React) запускается на порту 3000

Все сервисы автоматически соединяются через Docker network.

## ✅ Проверка работоспособности

```bash
# Проверить статус всех сервисов
make health

# Или вручную:
curl http://localhost:8001/api/          # Backend
curl http://localhost:3000/health         # Frontend
```

## 🎥 Добавление первой камеры

1. Откройте http://localhost:3000
2. Перейдите в "Камеры"
3. Нажмите "Добавить камеру"
4. Выберите тип камеры (RTSP/HTTP MJPEG/HTTP Snapshot)
5. Заполните данные камеры

### Пример RTSP камеры:
```
Название: Входная дверь
Тип: RTSP
URL: rtsp://192.168.1.100:554/stream1
Пользователь: admin
Пароль: 12345
```

### Пример HTTP MJPEG:
```
Название: Гараж
Тип: HTTP MJPEG
URL: http://192.168.1.50:8080/video
Пользователь: admin
Пароль: admin123
```

## 🔧 Настройка

### Изменение портов

Отредактируйте `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Изменить 3000 на 8080
```

### Изменение учетных данных MongoDB

Отредактируйте `docker-compose.yml`:

```yaml
mongodb:
  environment:
    MONGO_INITDB_ROOT_USERNAME: your_user
    MONGO_INITDB_ROOT_PASSWORD: your_password

backend:
  environment:
    - MONGO_URL=mongodb://your_user:your_password@mongodb:27017
```

## 📦 Backup и восстановление

### Создать backup
```bash
make db-backup
# Backup сохранён в ./backups/
```

### Восстановить из backup
```bash
make db-restore
# Введите имя директории backup
```

## 🐛 Решение проблем

### Порт уже занят
```bash
# Найти процесс
sudo lsof -i :3000
sudo lsof -i :8001

# Остановить процесс или изменить порт
```

### Недостаточно места
```bash
# Очистить неиспользуемые ресурсы
make prune

# Очистить записи с камер
docker exec videoguard-backend rm -rf /app/recordings/*
```

### Контейнеры не запускаются
```bash
# Полная пересборка
make clean
make build
make up
```

### MongoDB не подключается
```bash
# Проверить логи
make db-logs

# Пересоздать volume
docker volume rm videoguard_mongodb_data
make up
```

## 📊 Мониторинг

### Посмотреть использование ресурсов
```bash
docker stats
```

### Логи конкретного сервиса
```bash
make backend-logs   # Логи backend
make frontend-logs  # Логи frontend
make db-logs        # Логи MongoDB
```

## 🔒 Production рекомендации

1. **Измените пароли MongoDB** в `docker-compose.yml`
2. **Настройте CORS** - укажите свой домен вместо `*`
3. **Добавьте SSL сертификат** для HTTPS
4. **Настройте backup** - автоматический backup БД
5. **Включите мониторинг** - добавьте Prometheus/Grafana

## 📚 Дополнительные ресурсы

- [Полная документация Docker](./DOCKER_README.md)
- [Руководство по HTTP камерам](./HTTP_CAMERAS_GUIDE.md)
- [Makefile команды](./Makefile)

## 💬 Поддержка

При возникновении проблем:

1. Проверьте логи: `make logs`
2. Проверьте статус: `docker-compose ps`
3. Проверьте health: `make health`
4. Посмотрите [DOCKER_README.md](./DOCKER_README.md) раздел Troubleshooting

## 🎉 Готово!

Ваша система видеонаблюдения запущена и готова к работе!

Следующие шаги:
- Добавьте камеры
- Настройте детекцию движения
- Проверьте запись видео
- Изучите архив событий
