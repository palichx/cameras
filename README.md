# VideoGuard - Система видеонаблюдения

<div align="center">

![VideoGuard Logo](https://img.shields.io/badge/VideoGuard-Video%20Surveillance-blue?style=for-the-badge)

**Профессиональная система видеонаблюдения с поддержкой RTSP и HTTP камер**

[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.1-green)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0.0-blue)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green)](https://www.mongodb.com/)

</div>

## 🎯 Основные возможности

- ✅ **Поддержка множества камер** - более 10 камер одновременно
- ✅ **3 типа подключения** - RTSP, HTTP MJPEG, HTTP Snapshot
- ✅ **Live просмотр** - видео в реальном времени
- ✅ **Умная запись** - непрерывная и по детекции движения
- ✅ **Детекция движения** - с настраиваемой чувствительностью и зонами
- ✅ **Архив записей** - с фильтрацией и поиском
- ✅ **История событий** - все детекции движения с снимками
- ✅ **Управление хранилищем** - автоматическая ротация записей
- ✅ **Современный UI** - адаптивный интерфейс на React
- ✅ **REST API** - полный API для интеграций

## 🚀 Быстрый старт с Docker

### Минимальные требования
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM
- 20GB свободного места

### Запуск

```bash
# Клонировать репозиторий
git clone <repository-url>
cd videoguard

# Запустить приложение
make dev-up

# Открыть в браузере
# http://localhost:3000
```

**Готово!** Система запущена и готова к работе.

### Остановка

```bash
make dev-down
```

📖 [Полное руководство по Docker](./DOCKER_README.md)  
⚡ [Краткое руководство](./QUICKSTART.md)

## 🎥 Поддерживаемые типы камер

### RTSP (Real Time Streaming Protocol)
Классический протокол для IP-камер с лучшей производительностью.
```
rtsp://192.168.1.100:554/stream1
```

### HTTP MJPEG (Motion JPEG)
Видеопоток через HTTP для камер с веб-сервером.
```
http://192.168.1.100:8080/video
```

### HTTP Snapshot
Периодические снимки для экономии трафика.
```
http://192.168.1.100/snapshot.jpg
```

📖 [Подробное руководство по HTTP камерам](./HTTP_CAMERAS_GUIDE.md)

## 🏗️ Архитектура

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  React Frontend │◄────────│  FastAPI        │◄────────│  MongoDB        │
│  (Port 3000)    │         │  Backend        │         │  Database       │
│                 │         │  (Port 8001)    │         │  (Port 27017)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │
         │                           │
         └───────────┬───────────────┘
                     ▼
              ┌──────────────┐
              │   IP Cameras │
              │ RTSP / HTTP  │
              └──────────────┘
```

## 📦 Структура проекта

```
videoguard/
├── backend/                    # FastAPI приложение
│   ├── server.py              # Основной сервер
│   ├── requirements.txt       # Python зависимости
│   ├── Dockerfile            # Production образ
│   └── Dockerfile.dev        # Development образ
├── frontend/                  # React приложение
│   ├── src/
│   │   ├── App.js           # Главный компонент
│   │   └── pages/           # Страницы приложения
│   ├── Dockerfile           # Production образ
│   └── nginx.conf           # Nginx конфигурация
├── docker-compose.yml        # Production compose
├── docker-compose.dev.yml    # Development compose
├── Makefile                  # Команды управления
├── DOCKER_README.md         # Docker документация
├── QUICKSTART.md            # Быстрый старт
└── HTTP_CAMERAS_GUIDE.md    # Руководство по камерам
```

## 🛠️ Технологии

### Backend
- **FastAPI** - современный асинхронный Python веб-фреймворк
- **OpenCV** - обработка видео и детекция движения
- **PyAV** - работа с аудио/видео потоками
- **Motor** - асинхронный драйвер MongoDB
- **Uvicorn** - ASGI сервер

### Frontend
- **React 19** - UI библиотека
- **TailwindCSS** - утилитарный CSS фреймворк
- **Shadcn/UI** - красивые компоненты
- **Axios** - HTTP клиент
- **React Router** - маршрутизация

### Database
- **MongoDB** - NoSQL база данных

### Infrastructure
- **Docker** - контейнеризация
- **Docker Compose** - оркестрация
- **Nginx** - веб-сервер и reverse proxy

## 📋 Доступные команды

### Development
```bash
make dev-up          # Запустить dev окружение
make dev-down        # Остановить dev окружение
make dev-logs        # Логи dev окружения
```

### Production
```bash
make build           # Собрать production образы
make up              # Запустить production
make down            # Остановить production
make restart         # Перезапустить production
```

### Логи
```bash
make logs            # Все логи
make backend-logs    # Логи backend
make frontend-logs   # Логи frontend
make db-logs         # Логи MongoDB
```

### Обслуживание
```bash
make clean           # Удалить контейнеры и volumes
make prune           # Очистить Docker ресурсы
make health          # Проверить здоровье сервисов
make db-backup       # Backup базы данных
make db-restore      # Восстановить из backup
```

## 🔌 API Endpoints

### Камеры
- `GET /api/cameras` - Список всех камер
- `POST /api/cameras` - Добавить камеру
- `GET /api/cameras/{id}` - Получить камеру
- `PUT /api/cameras/{id}` - Обновить камеру
- `DELETE /api/cameras/{id}` - Удалить камеру
- `POST /api/cameras/{id}/start` - Запустить камеру
- `POST /api/cameras/{id}/stop` - Остановить камеру
- `GET /api/stream/{id}` - Live видеопоток

### Записи
- `GET /api/recordings` - Список записей
- `GET /api/recordings/{id}` - Скачать запись
- `DELETE /api/recordings/{id}` - Удалить запись

### События движения
- `GET /api/motion-events` - История событий
- `GET /api/motion-events/{id}/snapshot` - Снимок события

### Хранилище
- `GET /api/storage/stats` - Статистика хранилища
- `POST /api/storage/cleanup` - Очистить старые записи

## 🎨 Скриншоты

### Панель управления
Обзор системы с live просмотром всех камер

### Управление камерами
Добавление, настройка и управление камерами

### Архив записей
Просмотр, фильтрация и скачивание записей

### События движения
История детекций с визуальными превью

## 🔧 Конфигурация

### Backend (.env)
```env
MONGO_URL=mongodb://admin:password@mongodb:27017
DB_NAME=videoguard
CORS_ORIGINS=*
MAX_STORAGE_GB=50
RETENTION_DAYS=30
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 📊 Производительность

- **Поддержка**: 10+ камер одновременно
- **FPS**: До 30 FPS на камеру (зависит от источника)
- **Разрешение**: До 4K (зависит от камеры)
- **Детекция движения**: < 100ms задержка
- **Хранение**: Автоматическая ротация по размеру/времени

## 🔒 Безопасность

- ✅ HTTP Basic Authentication для камер
- ✅ Изолированная сеть Docker
- ✅ Настраиваемый CORS
- ✅ MongoDB аутентификация
- ✅ Безопасное хранение паролей

## 🐛 Устранение неполадок

### Контейнеры не запускаются
```bash
make logs          # Проверить логи
make clean         # Полная очистка
make build && make up  # Пересборка
```

### Камера не подключается
1. Проверьте доступность URL: `curl <camera-url>`
2. Проверьте учетные данные
3. Проверьте логи backend: `make backend-logs`

### Нехватка места
```bash
make prune         # Очистить Docker
make db-backup     # Backup БД
# Удалить старые записи через интерфейс
```

📖 [Полное руководство по troubleshooting](./DOCKER_README.md#troubleshooting)

## 📚 Документация

- [📘 Docker Deployment Guide](./DOCKER_README.md)
- [⚡ Quick Start Guide](./QUICKSTART.md)
- [🎥 HTTP Cameras Guide](./HTTP_CAMERAS_GUIDE.md)
- [🛠️ Makefile Commands](./Makefile)
- [🐛 Docker Troubleshooting](./DOCKER_TROUBLESHOOTING.md)
- [📋 Git Configuration Guide](./GIT_GUIDE.md)

## 🤝 Вклад в проект

Приветствуются pull request'ы! Для крупных изменений сначала откройте issue.

## 📝 Лицензия

[MIT License](./LICENSE)

## 🌟 Возможности

Планируемые улучшения:
- [ ] Поддержка WebRTC для low-latency стриминга
- [ ] ML детекция объектов (люди, машины, животные)
- [ ] Мобильное приложение
- [ ] Push уведомления
- [ ] Двусторонняя аудиосвязь
- [ ] PTZ управление камерами
- [ ] Экспорт в облако (S3, Google Drive)
- [ ] Multi-user поддержка с ролями
- [ ] API webhooks для интеграций

## 📞 Контакты

- GitHub Issues: [github.com/yourorg/videoguard/issues](https://github.com/yourorg/videoguard/issues)
- Документация: [docs.videoguard.com](https://docs.videoguard.com)

---

<div align="center">

**Создано с ❤️ для безопасности вашего дома и бизнеса**

[⬆ Наверх](#videoguard---система-видеонаблюдения)

</div>
