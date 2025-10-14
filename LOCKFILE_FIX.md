# Решение ошибки "lockfile needs to be updated"

## Ошибка

```
error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.
```

## Причина

Эта ошибка возникает когда:
- `package.json` был изменен после создания `yarn.lock`
- Версии зависимостей не совпадают
- `yarn.lock` устарел

## Быстрое решение

### Вариант 1: Обновить yarn.lock (РЕКОМЕНДУЕТСЯ)

```bash
# Обновить yarn.lock
make update-yarn-lock

# Или вручную
cd frontend
yarn install

# Добавить в git
git add yarn.lock
git commit -m "Update yarn.lock"

# Собрать заново
cd ..
make build
```

### Вариант 2: Использовать гибкий Dockerfile

```bash
# Dockerfile с fallback на обычный install
make build-frontend-flexible
```

### Вариант 3: Использовать упрощенный Dockerfile

```bash
# Копирует все файлы сразу и гибко устанавливает зависимости
make build-frontend-simple
```

## Детальное решение

### Шаг 1: Понять проблему

```bash
cd frontend

# Проверить текущее состояние
yarn install --check-files

# Посмотреть что изменилось
git diff yarn.lock
```

### Шаг 2: Обновить lockfile

```bash
# Удалить старый lockfile и node_modules
rm -rf node_modules yarn.lock

# Создать новый lockfile
yarn install

# Проверить что всё работает
yarn build
```

### Шаг 3: Зафиксировать изменения

```bash
# Добавить обновленный lockfile
git add yarn.lock

# Коммит
git commit -m "Update yarn.lock to match package.json"

# Вернуться в корень
cd ..
```

### Шаг 4: Собрать Docker образ

```bash
# Очистить кэш Docker
make clean

# Собрать заново
make build
```

## Предотвращение проблемы

### В Dockerfile используйте fallback

```dockerfile
# ✅ ХОРОШО: С fallback
RUN yarn install --frozen-lockfile || yarn install

# ❌ ПЛОХО: Только frozen
RUN yarn install --frozen-lockfile
```

### Pre-commit hook

Создайте `.git/hooks/pre-commit`:

```bash
#!/bin/bash

if git diff --cached --name-only | grep -q "frontend/package.json"; then
    if ! git diff --cached --name-only | grep -q "frontend/yarn.lock"; then
        echo "⚠️  package.json changed but yarn.lock not updated!"
        echo "Run: cd frontend && yarn install"
        exit 1
    fi
fi

exit 0
```

Сделайте исполняемым:
```bash
chmod +x .git/hooks/pre-commit
```

## Альтернативные подходы

### Подход 1: Не использовать --frozen-lockfile в development

**docker-compose.dev.yml:**
```yaml
frontend:
  command: sh -c "yarn install && yarn start"
```

### Подход 2: Использовать npm вместо yarn

```bash
cd frontend

# Удалить yarn файлы
rm yarn.lock

# Создать package-lock.json
npm install

# Обновить Dockerfile
make build-frontend-npm
```

### Подход 3: Использовать pnpm

**package.json:**
```json
{
  "engines": {
    "pnpm": ">=8.0.0"
  }
}
```

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS build
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
```

## Проверка после исправления

### 1. Локальная сборка работает
```bash
cd frontend
yarn install
yarn build
```

### 2. Docker сборка работает
```bash
cd ..
docker-compose build frontend
```

### 3. Нет warning'ов
```bash
cd frontend
yarn check
```

## Обновленные Dockerfile

### Основной Dockerfile (с fallback)

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile || yarn install
COPY . .
RUN yarn build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
```

### Dockerfile.flexible (без frozen-lockfile)

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install
COPY . .
RUN yarn build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
```

### Dockerfile.simple (все сразу)

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
```

## Makefile команды

```bash
# Обновить yarn.lock
make update-yarn-lock

# Собрать с гибким Dockerfile
make build-frontend-flexible

# Собрать с упрощенным Dockerfile
make build-frontend-simple

# Использовать npm вместо yarn
make build-frontend-npm
```

## Частые вопросы

### Q: Нужно ли коммитить yarn.lock?
**A:** ДА! Всегда коммитьте yarn.lock. Это гарантирует одинаковые версии зависимостей.

### Q: Что делать если yarn.lock постоянно меняется?
**A:** 
1. Проверьте версии в package.json (используйте точные версии)
2. Используйте `yarn install --frozen-lockfile` локально
3. Не запускайте `yarn add` без необходимости

### Q: Можно ли игнорировать yarn.lock?
**A:** НЕТ! Это приведет к несовместимостям версий.

### Q: --frozen-lockfile vs без него?
**A:** 
- `--frozen-lockfile`: Строгая проверка, ошибка если не совпадает
- Без флага: Обновит lockfile если нужно

## Best Practices

### ✅ DO:

1. **Всегда коммитить yarn.lock**
```bash
git add yarn.lock
git commit -m "Update dependencies"
```

2. **Использовать fallback в Dockerfile**
```dockerfile
RUN yarn install --frozen-lockfile || yarn install
```

3. **Обновлять yarn.lock при изменении package.json**
```bash
yarn install
```

4. **Использовать точные версии в package.json**
```json
{
  "dependencies": {
    "react": "19.0.0"  // ✅ Точная версия
  }
}
```

### ❌ DON'T:

1. **Не игнорировать yarn.lock**
```gitignore
# ❌ НЕПРАВИЛЬНО
yarn.lock
```

2. **Не использовать только --frozen-lockfile без fallback**
```dockerfile
# ❌ НЕПРАВИЛЬНО
RUN yarn install --frozen-lockfile
```

3. **Не удалять yarn.lock вручную**
```bash
# ❌ НЕПРАВИЛЬНО (без причины)
rm yarn.lock
```

4. **Не использовать плавающие версии без необходимости**
```json
{
  "dependencies": {
    "react": "^19.0.0"  // ⚠️ Может обновиться
  }
}
```

## Миграция с yarn на npm

Если хотите полностью перейти на npm:

```bash
cd frontend

# Удалить yarn файлы
rm yarn.lock
rm -rf node_modules

# Создать npm lockfile
npm install

# Обновить scripts если нужно
# package.json остается тем же

# Обновить Dockerfile
cd ..
make build-frontend-npm

# Коммит
git add frontend/package-lock.json
git rm frontend/yarn.lock
git commit -m "Migrate from yarn to npm"
```

## Заключение

Ошибка `lockfile needs to be updated` решается просто:

1. **Короткий путь:** `make update-yarn-lock && make build`
2. **Альтернатива:** `make build-frontend-flexible`
3. **Долгосрочное решение:** Добавить fallback в Dockerfile

После обновления yarn.lock обязательно закоммитьте изменения!
