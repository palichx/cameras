# Docker Build Troubleshooting Guide

## Проблема: libgl1-mesa-glx not found

### Решение 1: Использовать обновленный Dockerfile (Рекомендуется)

Основной `Dockerfile` уже обновлен для использования `libgl1` вместо устаревшего `libgl1-mesa-glx`.

Попробуйте пересобрать:
```bash
make clean
make build
```

### Решение 2: Использовать Ubuntu-based образ

Если проблема сохраняется, используйте Dockerfile на базе Ubuntu:

```bash
# В backend/Dockerfile измените первую строку на:
FROM ubuntu:22.04
```

Или используйте готовый Ubuntu Dockerfile:
```bash
cd backend
cp Dockerfile Dockerfile.backup
cp Dockerfile.ubuntu Dockerfile
cd ..
make build
```

### Решение 3: Использовать минимальный образ

Для быстрой сборки без дополнительных зависимостей:

```bash
cd backend
cp Dockerfile.minimal Dockerfile
cd ..
make build
```

## Проблема: OpenCV не работает в контейнере

### Решение: Установить дополнительные зависимости

Добавьте в Dockerfile после установки основных пакетов:

```dockerfile
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    python3-opencv
```

## Проблема: Медленная сборка Docker образа

### Решение 1: Использовать Docker BuildKit

```bash
# Включить BuildKit
export DOCKER_BUILDKIT=1

# Собрать с кэшированием
docker-compose build --parallel
```

### Решение 2: Многоступенчатый кэш

В `docker-compose.yml` добавьте:

```yaml
services:
  backend:
    build:
      cache_from:
        - videoguard-backend:latest
```

### Решение 3: Предварительно скачать базовый образ

```bash
docker pull python:3.11-slim
make build
```

## Проблема: "No space left on device"

### Решение: Очистить Docker ресурсы

```bash
# Удалить неиспользуемые образы
docker image prune -a

# Удалить неиспользуемые volumes
docker volume prune

# Полная очистка
docker system prune -a --volumes

# Освободить место в VideoGuard
make clean
```

## Проблема: Ошибка при установке Python пакетов

### Решение 1: Обновить pip

В Dockerfile добавьте перед установкой requirements:

```dockerfile
RUN pip install --upgrade pip setuptools wheel
```

### Решение 2: Установить build зависимости

```dockerfile
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3-dev \
    build-essential
```

### Решение 3: Использовать wheels

```bash
# Создать wheels локально
pip wheel -r requirements.txt -w wheels/

# В Dockerfile
COPY wheels/ /wheels/
RUN pip install --no-index --find-links=/wheels/ -r requirements.txt
```

## Проблема: Architecture mismatch (ARM vs x86)

### Решение: Указать платформу

```bash
# Для Apple Silicon (M1/M2)
docker build --platform linux/amd64 -t videoguard-backend backend/

# Или в docker-compose.yml
services:
  backend:
    platform: linux/amd64
```

## Проблема: Frontend не собирается (Node.js ошибки)

### Решение 1: Увеличить память Node.js

В `frontend/Dockerfile`:

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

### Решение 2: Использовать другую версию Node

```dockerfile
FROM node:18-alpine AS build
# вместо
FROM node:20-alpine AS build
```

### Решение 3: Очистить npm cache

```bash
cd frontend
rm -rf node_modules package-lock.json
docker-compose build frontend --no-cache
```

## Проблема: MongoDB не запускается

### Решение 1: Проверить права доступа к volumes

```bash
# Создать директории с правильными правами
sudo mkdir -p /opt/videoguard/mongodb/data
sudo chown -R 999:999 /opt/videoguard/mongodb/data
```

### Решение 2: Удалить старый volume

```bash
docker volume rm videoguard_mongodb_data
make up
```

### Решение 3: Использовать другую версию MongoDB

В `docker-compose.yml`:

```yaml
mongodb:
  image: mongo:6.0  # вместо mongo:7.0
```

## Проблема: Permission denied при сборке

### Решение 1: Проверить права на файлы

```bash
# Сделать скрипты исполняемыми
chmod +x backend/*.sh
chmod +x *.sh
```

### Решение 2: Добавить пользователя в группу docker

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Решение 3: Использовать sudo (временно)

```bash
sudo make build
sudo make up
```

## Проблема: Network errors during build

### Решение 1: Использовать другие зеркала

В `Dockerfile`:

```dockerfile
# Для Debian/Ubuntu
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

# Для Python packages
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```

### Решение 2: Использовать HTTP прокси

```bash
docker build --build-arg HTTP_PROXY=http://proxy.example.com:8080 .
```

### Решение 3: Увеличить timeout

```bash
export DOCKER_CLIENT_TIMEOUT=120
export COMPOSE_HTTP_TIMEOUT=120
make build
```

## Проблема: "manifest unknown" ошибка

### Решение: Очистить Docker и пересобрать

```bash
# Удалить dangling образы
docker rmi $(docker images -f "dangling=true" -q)

# Пересобрать без кэша
docker-compose build --no-cache

# Или через make
make clean
make build
```

## Альтернативные Dockerfile варианты

### Вариант 1: Python 3.10 (более стабильный)

```dockerfile
FROM python:3.10-slim
# ... остальное без изменений
```

### Вариант 2: Alpine Linux (самый легкий)

```dockerfile
FROM python:3.11-alpine

RUN apk add --no-cache \
    gcc \
    g++ \
    make \
    linux-headers \
    ffmpeg \
    libstdc++

# ... остальное
```

### Вариант 3: Debian Bullseye

```dockerfile
FROM python:3.11-slim-bullseye
# ... остальное
```

## Полезные команды для отладки

```bash
# Посмотреть логи сборки
docker-compose build 2>&1 | tee build.log

# Собрать с подробным выводом
docker-compose build --progress=plain

# Зайти в контейнер для отладки
docker run -it --rm videoguard-backend bash

# Проверить установленные пакеты
docker run --rm videoguard-backend dpkg -l | grep libgl

# Посмотреть размеры слоев
docker history videoguard-backend

# Проверить образ на уязвимости
docker scan videoguard-backend
```

## Оптимизация размера образа

### Советы:

1. **Используйте .dockerignore**
   ```
   __pycache__
   *.pyc
   .git
   node_modules
   build
   ```

2. **Объединяйте RUN команды**
   ```dockerfile
   RUN apt-get update \
       && apt-get install -y package1 package2 \
       && apt-get clean \
       && rm -rf /var/lib/apt/lists/*
   ```

3. **Используйте multi-stage builds**
   ```dockerfile
   FROM python:3.11 AS builder
   # ... сборка
   
   FROM python:3.11-slim
   COPY --from=builder /app /app
   ```

4. **Удаляйте временные файлы**
   ```dockerfile
   RUN pip install -r requirements.txt \
       && pip cache purge
   ```

## Получение помощи

Если проблема не решена:

1. Проверьте логи: `make logs`
2. Создайте issue с логами сборки
3. Укажите:
   - Версию Docker: `docker --version`
   - ОС: `uname -a`
   - Архитектуру: `uname -m`
   - Полный вывод ошибки

## Быстрые фиксы по типам ошибок

| Ошибка | Быстрый фикс |
|--------|-------------|
| libgl1-mesa-glx | `apt-get install libgl1` |
| E: Package not found | Обновить Dockerfile на Ubuntu-based |
| Out of memory | Увеличить Docker memory limit |
| Network timeout | Добавить прокси или использовать зеркала |
| Permission denied | `chmod +x *.sh` |
| Platform mismatch | `--platform linux/amd64` |

## Рекомендуемая конфигурация Docker

В `~/.docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
```

Перезапустить Docker после изменений:
```bash
sudo systemctl restart docker
```
