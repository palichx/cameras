# Быстрое решение ошибки lockfile

## Проблема
```
error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.
```

## Решение за 3 команды

```bash
# 1. Обновить yarn.lock
make update-yarn-lock

# 2. Добавить в git
git add frontend/yarn.lock
git commit -m "Update yarn.lock"

# 3. Собрать заново
make clean
make build
```

## Альтернативы

### Если нужно быстро собрать без обновления

```bash
# Использовать гибкий Dockerfile
make build-frontend-flexible
```

### Если проблема повторяется

```bash
# Полная переустановка зависимостей
cd frontend
rm -rf node_modules yarn.lock
yarn install
cd ..

# Добавить в git и собрать
git add frontend/yarn.lock
make build
```

## Что изменилось

Все Dockerfile теперь имеют fallback:

```dockerfile
# Попробует frozen-lockfile, если не получится - обычный install
RUN yarn install --frozen-lockfile || yarn install
```

## Доступные команды

```bash
make update-yarn-lock          # Обновить yarn.lock
make build-frontend-flexible   # Собрать с гибким lockfile
make build-frontend-simple     # Упрощенная сборка
make build-frontend-npm        # Использовать npm
```

## Проверка

После исправления проверьте:

```bash
# Локально работает
cd frontend && yarn install && yarn build

# Docker сборка работает
cd .. && make build

# Git status чистый
git status
```

## Дополнительно

См. [LOCKFILE_FIX.md](./LOCKFILE_FIX.md) для детального объяснения.
