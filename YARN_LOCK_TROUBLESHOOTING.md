# Исправление ошибки "yarn.lock not found" - Полное решение

## Диагностика проблемы

### Шаг 1: Проверка файла
```bash
# Убедиться что файл существует
ls -la frontend/yarn.lock

# Проверить права доступа
stat frontend/yarn.lock

# Проверить размер (должен быть > 0)
du -h frontend/yarn.lock
```

### Шаг 2: Проверка .dockerignore
```bash
# Убедиться что yarn.lock НЕ исключен
cat frontend/.dockerignore | grep yarn
# Не должно быть строк с yarn.lock

# Если есть - удалить
sed -i '/yarn.lock/d' frontend/.dockerignore
```

### Шаг 3: Проверка .gitignore
```bash
# Проверить что yarn.lock включен в git
git check-ignore -v frontend/yarn.lock
# Должно быть пусто

# Если игнорируется - добавить принудительно
git add -f frontend/yarn.lock
```

## Решения

### Решение 1: Использовать упрощенный Dockerfile (РЕКОМЕНДУЕТСЯ)

```bash
make build-frontend-simple
```

Этот Dockerfile копирует все файлы сразу, что исключает проблемы с путями.

### Решение 2: Использовать npm вместо yarn

```bash
# Создать package-lock.json
cd frontend
npm install

# Собрать с npm
cd ..
make build-frontend-npm
```

### Решение 3: Явно скопировать yarn.lock в Dockerfile

Обновлен основной Dockerfile с явным копированием:
```dockerfile
COPY package.json ./
COPY yarn.lock ./
RUN ls -la package.json yarn.lock  # Проверка
```

### Решение 4: Собрать вне Docker Compose

```bash
# Собрать напрямую в директории frontend
cd frontend
docker build -t videoguard-frontend .

# Если ошибка - посмотреть что копируется
docker build --progress=plain -t videoguard-frontend . 2>&1 | grep COPY
```

### Решение 5: Полная пересборка

```bash
# Удалить все кэши
docker system prune -a
rm -rf frontend/node_modules

# Пересоздать yarn.lock
cd frontend
rm yarn.lock
yarn install

# Проверить что файл создан
ls -la yarn.lock

# Добавить в git
git add yarn.lock

# Собрать заново
cd ..
make clean
make build
```

## Проверка контекста Docker

### Тест 1: Что видит Docker при сборке
```bash
cd frontend

# Создать временный Dockerfile для теста
cat > Dockerfile.test << 'EOF'
FROM alpine
WORKDIR /app
COPY . .
RUN ls -la
EOF

# Собрать и посмотреть что скопировалось
docker build -f Dockerfile.test -t test-context .
docker run --rm test-context ls -la
```

### Тест 2: Проверить .dockerignore
```bash
# Временно переименовать .dockerignore
mv frontend/.dockerignore frontend/.dockerignore.bak

# Попробовать собрать
docker-compose build frontend

# Вернуть обратно
mv frontend/.dockerignore.bak frontend/.dockerignore
```

## Частые причины проблемы

### 1. yarn.lock в .dockerignore
**Проверка:**
```bash
grep -n "yarn" frontend/.dockerignore
```

**Исправление:**
```bash
# Удалить строки с yarn.lock
sed -i '/yarn.lock/d' frontend/.dockerignore
```

### 2. yarn.lock символическая ссылка
**Проверка:**
```bash
ls -l frontend/yarn.lock
```

**Исправление:**
```bash
# Если это ссылка, заменить на реальный файл
cd frontend
rm yarn.lock
yarn install
```

### 3. Неправильный контекст в docker-compose.yml
**Проверка:**
```bash
grep -A 5 "frontend:" docker-compose.yml | grep context
```

**Должно быть:**
```yaml
build:
  context: ./frontend
  dockerfile: Dockerfile
```

### 4. yarn.lock поврежден
**Проверка:**
```bash
cd frontend
yarn check --verify-tree
```

**Исправление:**
```bash
rm yarn.lock
yarn install
```

## Альтернативные подходы

### Подход 1: Использовать volume для node_modules

В `docker-compose.dev.yml`:
```yaml
frontend:
  volumes:
    - ./frontend:/app
    - /app/node_modules  # Не монтировать node_modules с хоста
```

### Подход 2: Multi-stage build с кэшированием

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:18-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
```

### Подход 3: Собрать на хосте, скопировать в контейнер

```bash
# Собрать на хосте
cd frontend
yarn install
yarn build

# Dockerfile упрощенный
cat > Dockerfile.prebuilt << 'EOF'
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY build /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
EOF

docker build -f Dockerfile.prebuilt -t videoguard-frontend .
```

## Отладка

### Включить подробный вывод Docker
```bash
export DOCKER_BUILDKIT=0
docker-compose build --progress=plain frontend 2>&1 | tee build.log
```

### Зайти в промежуточный контейнер
```bash
# Получить ID последнего слоя
docker images -a | grep none | head -1

# Зайти в контейнер
docker run -it <IMAGE_ID> sh

# Проверить что есть внутри
ls -la
```

### Проверить buildx если используется
```bash
docker buildx ls
docker buildx use default
```

## Рабочие конфигурации

### Конфигурация 1: Yarn (текущая)
**Файлы:** `package.json` + `yarn.lock`
**Команда:** `yarn install --frozen-lockfile`
**Требуется:** yarn.lock должен быть в Git

### Конфигурация 2: NPM
**Файлы:** `package.json` + `package-lock.json`
**Команда:** `npm ci` или `npm install --legacy-peer-deps`
**Требуется:** package-lock.json должен быть в Git

### Конфигурация 3: PNPM
**Файлы:** `package.json` + `pnpm-lock.yaml`
**Команда:** `pnpm install --frozen-lockfile`
**Требуется:** pnpm-lock.yaml должен быть в Git

## Проверочный список

- [ ] `frontend/yarn.lock` существует
- [ ] `frontend/yarn.lock` НЕ в `.dockerignore`
- [ ] `frontend/yarn.lock` НЕ в `.gitignore` (или явно включен с `!yarn.lock`)
- [ ] `docker-compose.yml` имеет `context: ./frontend`
- [ ] Нет ошибок в `yarn.lock` (проверить `yarn check`)
- [ ] Docker BuildKit отключен (`export DOCKER_BUILDKIT=0`)
- [ ] Контекст сборки чистый (нет больших файлов)
- [ ] Docker имеет достаточно места

## Быстрые команды

```bash
# Быстрая диагностика
ls -la frontend/yarn.lock && \
git check-ignore frontend/yarn.lock && \
grep yarn frontend/.dockerignore

# Быстрое исправление #1 - Упрощенный Dockerfile
make build-frontend-simple

# Быстрое исправление #2 - Использовать npm
make build-frontend-npm

# Быстрое исправление #3 - Полная пересборка
make clean && rm -rf frontend/node_modules && \
cd frontend && yarn install && cd .. && \
make build
```

## Если ничего не помогает

1. **Создайте минимальный тест:**
```bash
mkdir test-frontend
cd test-frontend
echo '{"name":"test","version":"1.0.0"}' > package.json
yarn install
docker build -t test - << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
EOF
```

2. **Проверьте Docker:**
```bash
docker version
docker info | grep -i storage
docker system df
```

3. **Попросите помощь с:**
   - Вывод `ls -la frontend/`
   - Вывод `docker-compose config`
   - Полный лог сборки: `docker-compose build --progress=plain frontend 2>&1`
   - Версия Docker: `docker version`
   - OS: `uname -a`
