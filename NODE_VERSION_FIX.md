# Исправление ошибки "node engine is incompatible"

## Проблема

```
error react-router-dom@7.9.4: The engine "node" is incompatible with this module. 
Expected version ">=20.0.0". Got "18.20.8"
```

## Причина

React Router v7 требует Node.js версии 20 или выше, а в Dockerfile использовалась версия 18.

## Решение

### Все Dockerfile обновлены с Node 18 → Node 20

**Изменено:**
- `frontend/Dockerfile`: `FROM node:20-alpine`
- `frontend/Dockerfile.npm`: `FROM node:20-alpine`
- `frontend/Dockerfile.simple`: `FROM node:20-alpine`
- `frontend/Dockerfile.flexible`: `FROM node:20-alpine`
- `docker-compose.dev.yml`: `image: node:20-alpine`

### Быстрое решение

```bash
# Пересобрать с обновленными Dockerfile
make clean
make build
```

## Проверка версии Node.js

### В Docker контейнере
```bash
docker run --rm node:20-alpine node --version
# Должно вывести: v20.x.x
```

### Локально (если нужно)
```bash
node --version
# Если < 20, обновить через:
# - nvm: nvm install 20 && nvm use 20
# - Скачать с nodejs.org
```

## Совместимость версий

| Пакет | Минимальная версия Node |
|-------|------------------------|
| React 19 | Node 18+ |
| React Router 7 | Node 20+ ✅ |
| Create React App | Node 18+ |

## Альтернативные решения

### Вариант 1: Даунгрейд React Router

Если нужна Node 18:

```bash
cd frontend

# Установить предыдущую версию
yarn add react-router-dom@6

# Обновить код если нужно (API изменился)
```

**Не рекомендуется** - лучше обновить Node.js.

### Вариант 2: Использовать Node 20 без Alpine

```dockerfile
FROM node:20-slim AS build
```

Или полный образ:
```dockerfile
FROM node:20 AS build
```

### Вариант 3: Указать конкретную версию

```dockerfile
FROM node:20.18.0-alpine AS build
```

## Обновление локальной разработки

Если разрабатываете локально (без Docker):

### С помощью nvm (рекомендуется)

```bash
# Установить nvm если нет
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Установить Node 20
nvm install 20

# Использовать Node 20
nvm use 20

# Проверить
node --version

# Переустановить зависимости
cd frontend
rm -rf node_modules
yarn install
```

### Без nvm

1. Скачать Node 20 с https://nodejs.org/
2. Установить
3. Проверить: `node --version`
4. Переустановить зависимости

## Создание .nvmrc файла

Для автоматического переключения версии:

```bash
# Создать .nvmrc в корне проекта
echo "20" > .nvmrc

# Теперь команда nvm use автоматически использует Node 20
cd /path/to/project
nvm use
```

## Docker Compose с разными версиями Node

Если нужны разные версии для разных сервисов:

```yaml
services:
  frontend:
    image: node:20-alpine  # React Router 7
    
  some-old-service:
    image: node:18-alpine  # Старые зависимости
```

## Проверка после обновления

```bash
# 1. Локальная проверка
cd frontend
node --version  # Должно быть >= 20
yarn install    # Не должно быть ошибок
yarn build      # Успешная сборка

# 2. Docker проверка
cd ..
make clean
make build      # Успешная сборка

# 3. Запуск
make dev-up
# Открыть http://localhost:3000
```

## Возможные проблемы после обновления

### Проблема 1: Другие зависимости несовместимы с Node 20

**Решение:**
```bash
cd frontend
yarn install
# Если есть ошибки - обновить проблемные пакеты
yarn upgrade-interactive --latest
```

### Проблема 2: Локальный Node старше 20

**Решение:**
```bash
# Использовать Docker для разработки
make dev-up

# Или обновить локальный Node
nvm install 20
nvm use 20
```

### Проблема 3: CI/CD использует старую версию

**Обновить .github/workflows/build.yml:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'  # Было: '18'
```

**Обновить .gitlab-ci.yml:**
```yaml
image: node:20-alpine  # Было: node:18-alpine
```

## package.json engines

Добавить в `frontend/package.json` для явного указания:

```json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0",
    "yarn": ">=1.22.0"
  }
}
```

Это предупредит пользователей о требуемой версии.

## Миграция с Node 18 на Node 20

### Что изменилось в Node 20:

1. **Fetch API** теперь встроенный (не нужен polyfill)
2. **Test Runner** встроенный (`node:test`)
3. **Performance** улучшена
4. **Security** обновления

### Breaking changes (маловероятно повлияют):

- Удалены устаревшие API
- Изменены некоторые модули crypto

### Проверка совместимости:

```bash
cd frontend

# Запустить тесты
yarn test

# Проверить сборку
yarn build

# Если есть проблемы - посмотреть логи
```

## Dockerfile best practices для Node

### ✅ ХОРОШО:

```dockerfile
# Использовать alpine для меньшего размера
FROM node:20-alpine AS build

# Указать рабочую директорию
WORKDIR /app

# Копировать зависимости отдельно для кэширования
COPY package.json yarn.lock ./
RUN yarn install

# Копировать код
COPY . .
RUN yarn build
```

### ⚠️ Можно лучше:

```dockerfile
# Multi-stage с конкретной версией
FROM node:20.18.0-alpine AS build
# ... сборка

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
```

## Команды для быстрого исправления

```bash
# Обновить все Dockerfile на Node 20
find . -name "Dockerfile*" -type f -exec sed -i 's/node:18/node:20/g' {} \;

# Обновить docker-compose файлы
find . -name "docker-compose*.yml" -type f -exec sed -i 's/node:18/node:20/g' {} \;

# Пересобрать
make clean
make build
```

## Заключение

Обновление Node.js с 18 на 20:
- ✅ Решает проблему с React Router 7
- ✅ Дает улучшенную производительность
- ✅ Получает последние security обновления
- ✅ Обратно совместимо с большинством пакетов

**Все Dockerfile обновлены и готовы к работе!**
