# Как правильно загрузить VideoGuard на GitHub

## Быстрый способ (РЕКОМЕНДУЕТСЯ)

```bash
# 1. Запустить автоматический скрипт
./add-to-git.sh

# 2. Проверить что будет закоммичено
git diff --cached --name-only

# 3. Закоммитить
git commit -m "Add VideoGuard video surveillance system"

# 4. Отправить на GitHub
git push origin main
```

## Ручной способ

### Шаг 1: Проверка .gitignore

```bash
# Убедиться что yarn.lock НЕ игнорируется
git check-ignore -v frontend/yarn.lock
# Должно быть пусто или "no match"

# Если игнорируется - исправить
./verify-git-setup.sh
```

### Шаг 2: Добавить все файлы

```bash
# Добавить все файлы
git add .

# Проверить что добавилось
git status
```

### Шаг 3: Проверить критичные файлы

```bash
# Убедиться что эти файлы в списке:
git diff --cached --name-only | grep -E "(yarn.lock|package.json|requirements.txt)"

# Должно показать:
# frontend/yarn.lock
# frontend/package.json
# backend/requirements.txt
```

### Шаг 4: Коммит и Push

```bash
git commit -m "Initial commit: VideoGuard surveillance system"
git push origin main
```

## Проверка после push

```bash
# Клонировать репозиторий в новую директорию для проверки
cd /tmp
git clone https://github.com/your-username/videoguard.git test-clone
cd test-clone

# Проверить что yarn.lock есть
ls -la frontend/yarn.lock
# Должен показать файл

# Попробовать собрать
make build
```

## Что ДОЛЖНО быть в Git

### ✅ Обязательные файлы

**Root:**
- ✅ docker-compose.yml
- ✅ docker-compose.dev.yml
- ✅ Makefile
- ✅ README.md
- ✅ .gitignore
- ✅ .env.example (НЕ .env!)

**Backend:**
- ✅ requirements.txt
- ✅ server.py
- ✅ Dockerfile
- ✅ .dockerignore

**Frontend:**
- ✅ package.json
- ✅ **yarn.lock** ⭐ КРИТИЧНО!
- ✅ Dockerfile
- ✅ nginx.conf
- ✅ src/ (весь код)
- ✅ public/

### ❌ НЕ должно быть в Git

- ❌ node_modules/
- ❌ .env (содержит секреты!)
- ❌ build/, dist/
- ❌ recordings/*.mp4
- ❌ __pycache__/
- ❌ .venv/, venv/
- ❌ *.log файлы

## Решение типичных проблем

### Проблема: yarn.lock не добавляется

```bash
# Проверка 1: Файл существует?
ls -la frontend/yarn.lock

# Проверка 2: Файл игнорируется?
git check-ignore -v frontend/yarn.lock
# Должно быть пусто

# Проверка 3: Добавить принудительно
git add -f frontend/yarn.lock

# Проверка 4: Проверить статус
git status frontend/yarn.lock
```

### Проблема: .env случайно добавлен

```bash
# ОПАСНО: .env содержит секреты!

# 1. Удалить из staging
git reset HEAD .env

# 2. Добавить в .gitignore (уже есть)
grep ".env" .gitignore

# 3. Если уже закоммитили - удалить из истории
git rm --cached .env
git commit -m "Remove .env from git"

# 4. ВАЖНО: Поменять все пароли/ключи!
```

### Проблема: node_modules добавлен

```bash
# Удалить из git (но оставить локально)
git rm -r --cached node_modules
git commit -m "Remove node_modules"
```

### Проблема: Большие файлы (recordings)

```bash
# Удалить большие видео файлы
git rm --cached recordings/*.mp4
git commit -m "Remove large video files"

# Добавить в .gitignore (уже есть)
grep "recordings" .gitignore
```

## Настройка нового репозитория на GitHub

### Создать репозиторий на GitHub

1. Зайти на https://github.com
2. Нажать "New repository"
3. Назвать: `videoguard` или `video-surveillance-system`
4. НЕ добавлять README, .gitignore, license (у нас уже есть)
5. Создать

### Подключить локальный репозиторий

```bash
# Если еще не инициализирован git
git init
git add .
git commit -m "Initial commit"

# Подключить к GitHub
git remote add origin https://github.com/your-username/videoguard.git
git branch -M main
git push -u origin main
```

### Проверить на GitHub

1. Открыть https://github.com/your-username/videoguard
2. Проверить что `frontend/yarn.lock` есть в списке файлов
3. Проверить размер репозитория (должен быть < 50MB)

## .gitignore правила для yarn.lock

### ✅ ПРАВИЛЬНО:

```gitignore
# Исключить yarn cache
.yarn/cache/
.yarn/unplugged/

# НЕ исключать yarn.lock
# yarn.lock должен быть в git!
```

### ❌ НЕПРАВИЛЬНО:

```gitignore
# Это исключит yarn.lock!
.yarn/*
*.lock
yarn.lock
```

## Автоматическая проверка перед коммитом

Создать pre-commit hook:

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Проверка yarn.lock
if git diff --cached --name-only | grep -q "frontend/package.json"; then
    if ! git diff --cached --name-only | grep -q "frontend/yarn.lock"; then
        echo "ERROR: package.json changed but yarn.lock not updated!"
        echo "Run: cd frontend && yarn install"
        exit 1
    fi
fi

# Проверка что .env не коммитится
if git diff --cached --name-only | grep -E "\.env$" | grep -v ".env.example"; then
    echo "ERROR: Trying to commit .env file (contains secrets!)"
    exit 1
fi

echo "Pre-commit checks passed"
exit 0
```

Сделать исполняемым:
```bash
chmod +x .git/hooks/pre-commit
```

## Полезные команды

```bash
# Показать все отслеживаемые файлы
git ls-files

# Показать размер репозитория
du -sh .git

# Показать большие файлы в git
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print $3 " " $4}' | \
  numfmt --to=iec-i --suffix=B --padding=7 | \
  sort -h | tail -20

# Проверить что будет отправлено
git diff origin/main..HEAD --name-only

# Посмотреть историю yarn.lock
git log --follow -- frontend/yarn.lock
```

## Готовый .gitignore

Актуальный .gitignore уже создан в проекте:

```bash
cat .gitignore | grep -A 5 -B 2 "yarn"
```

Должен показать правильные правила без исключения yarn.lock.

## Получение помощи

Если yarn.lock все еще не добавляется:

1. Запустить диагностику:
```bash
./verify-git-setup.sh
```

2. Проверить все:
```bash
ls -la frontend/yarn.lock          # Файл существует?
git check-ignore -v frontend/yarn.lock  # Не игнорируется?
git status frontend/yarn.lock       # В каком состоянии?
cat .gitignore | grep lock          # Правила .gitignore
```

3. Создать issue с выводом всех команд выше

## Заключение

После выполнения этих шагов:
- ✅ yarn.lock будет в Git и на GitHub
- ✅ Docker build будет работать после клонирования
- ✅ Другие разработчики смогут собрать проект
- ✅ CI/CD сможет собрать образы

**Главное правило:** yarn.lock, package.json, requirements.txt ВСЕГДА должны быть в Git!
