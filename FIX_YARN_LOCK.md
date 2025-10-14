# Исправление ошибки "yarn.lock not found"

## Быстрое решение

```bash
# 1. Проверить что yarn.lock существует
ls -la frontend/yarn.lock

# 2. Проверить что он не игнорируется
git check-ignore -v frontend/yarn.lock

# 3. Если игнорируется - добавить принудительно
git add -f frontend/yarn.lock

# 4. Проверить .gitignore
cat .gitignore | grep yarn

# 5. Если есть .yarn/*, заменить на:
# .yarn/cache
# .yarn/unplugged
# !yarn.lock

# 6. Коммит
git commit -m "Fix: include yarn.lock in repository"
```

## Что было исправлено

### 1. Корневой .gitignore обновлен
**Было:**
```gitignore
.yarn/*
```

**Стало:**
```gitignore
.yarn/cache
.yarn/unplugged
!yarn.lock  # Явно включаем
```

### 2. Созданы специфичные .gitignore
- ✅ `backend/.gitignore` - для Python файлов
- ✅ `frontend/.gitignore` - проверен, в порядке

### 3. Добавлена документация
- ✅ `GIT_GUIDE.md` - полное руководство по Git
- ✅ `verify-git-setup.sh` - скрипт проверки

## Проверка

```bash
# Проверить весь Git setup
./verify-git-setup.sh

# Проверить только yarn.lock
git ls-files | grep yarn.lock
# Должно вывести: frontend/yarn.lock

# Проверить .gitignore
git check-ignore -v frontend/yarn.lock
# Должно быть пусто или "no match"
```

## Пересборка Docker после исправления

```bash
# Очистить старые образы
make clean

# Пересобрать
make build

# Или для development
make dev-up
```

## Если проблема сохраняется

### Вариант 1: Принудительное добавление
```bash
git rm --cached frontend/yarn.lock
git add -f frontend/yarn.lock
git commit -m "Force add yarn.lock"
```

### Вариант 2: Проверить Docker context
```bash
# Убедиться что .dockerignore не исключает yarn.lock
cat frontend/.dockerignore | grep yarn
# Не должно быть yarn.lock в списке
```

### Вариант 3: Использовать package-lock.json
```bash
cd frontend
rm yarn.lock
npm install  # Создаст package-lock.json
git add package-lock.json
```

## Файлы которые ОБЯЗАТЕЛЬНО нужны в Git

### Frontend
- ✅ `package.json`
- ✅ `yarn.lock` или `package-lock.json`
- ✅ `Dockerfile`
- ✅ `nginx.conf`
- ✅ Все файлы в `src/`

### Backend
- ✅ `requirements.txt`
- ✅ `Dockerfile`
- ✅ `server.py`

### Root
- ✅ `docker-compose.yml`
- ✅ `docker-compose.dev.yml`
- ✅ `Makefile`
- ✅ `.env.example` (НЕ .env!)

## Частые ошибки

### ❌ Неправильно:
```gitignore
*.lock          # Исключит ВСЕ lock файлы
.yarn/*         # Исключит yarn.lock
node_modules    # Без / будет искать везде
```

### ✅ Правильно:
```gitignore
# Исключить кэш Yarn
.yarn/cache
.yarn/unplugged

# Но включить yarn.lock
!yarn.lock

# Исключить node_modules везде
node_modules/

# Исключить логи
*.log
```

## Контрольный список

- [ ] `yarn.lock` существует в `frontend/`
- [ ] `yarn.lock` не в `.gitignore`
- [ ] `yarn.lock` не в `frontend/.dockerignore`
- [ ] `git ls-files` показывает `yarn.lock`
- [ ] `./verify-git-setup.sh` проходит без ошибок
- [ ] Docker build работает

## Получение помощи

Если ничего не помогло:

1. Запустить полную диагностику:
```bash
./verify-git-setup.sh > git-check.log 2>&1
./verify-docker-setup.sh > docker-check.log 2>&1
```

2. Проверить логи сборки:
```bash
make test-build
cat build.log
```

3. Создать issue с:
   - Содержимым `.gitignore`
   - Выводом `git ls-files | grep yarn`
   - Выводом `git check-ignore -v frontend/yarn.lock`
   - Логом Docker build

## Дополнительно

См. подробную документацию:
- [GIT_GUIDE.md](./GIT_GUIDE.md) - полное руководство по Git
- [DOCKER_TROUBLESHOOTING.md](./DOCKER_TROUBLESHOOTING.md) - решение Docker проблем
