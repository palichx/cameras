# Git Configuration Guide for VideoGuard

## Важные файлы для Git

### ✅ Файлы которые ДОЛЖНЫ быть в Git

#### Root Level
- `package.json` и `yarn.lock` (если есть)
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `Makefile`
- `.dockerignore`
- `README.md` и все `*.md` файлы
- `setup-ssl.sh`
- `verify-docker-setup.sh`
- `.env.example` и `.env.*.example`

#### Backend (`/backend`)
- `requirements.txt`
- `server.py` и все `*.py` файлы
- `Dockerfile`, `Dockerfile.dev`, `Dockerfile.ubuntu`, `Dockerfile.minimal`
- `.dockerignore`
- `healthcheck.sh`
- `entrypoint.sh`
- `.env.docker.example`

#### Frontend (`/frontend`)
- `package.json`
- `yarn.lock` ⚠️ ВАЖНО!
- `package-lock.json` (если используется npm)
- Все файлы в `src/`
- Все файлы в `public/`
- `Dockerfile`
- `nginx.conf`
- `.dockerignore`
- `.env.docker.example`
- `tailwind.config.js`
- `postcss.config.js`
- `craco.config.js` (если есть)

#### Nginx
- `nginx/nginx-ssl.conf`

### ❌ Файлы которые НЕ должны быть в Git

#### Dependencies
- `node_modules/`
- `venv/`, `.venv/`, `env/`
- `__pycache__/`
- `.yarn/cache`, `.yarn/unplugged`

#### Build artifacts
- `build/`, `dist/`
- `*.pyc`, `*.pyo`

#### Environment files
- `.env` (содержит секреты)
- `.env.local`, `.env.production` (содержат секреты)
- Но ВКЛЮЧИТЬ: `.env.example`, `.env.*.example`

#### Large files
- `recordings/*.mp4`
- `recordings/*.avi`
- `backups/`
- `mongodb_data/`

#### OS files
- `.DS_Store`
- `Thumbs.db`
- `*.swp`, `*.swo`

#### Logs
- `*.log`
- `npm-debug.log*`
- `yarn-error.log*`

## Проверка перед коммитом

### Команда для проверки что попадет в Git

```bash
git add -n .
```

### Проверить что yarn.lock не игнорируется

```bash
git check-ignore -v yarn.lock
git check-ignore -v frontend/yarn.lock
```

Должно вывести: (nothing) или "no match"

Если вывод показывает что файл игнорируется:
```bash
# Добавить принудительно
git add -f frontend/yarn.lock
```

### Проверить размер коммита

```bash
git diff --stat
```

Если видите большие файлы (node_modules, recordings):
```bash
git reset HEAD
# Проверить .gitignore
```

## Настройка .gitignore

### Корректная структура .gitignore

```gitignore
# ПРАВИЛЬНО: Исключить директорию node_modules
node_modules/

# ПРАВИЛЬНО: Исключить кэш Yarn, но не yarn.lock
.yarn/cache
.yarn/unplugged
!yarn.lock

# НЕПРАВИЛЬНО: Это исключит yarn.lock!
# .yarn/*

# ПРАВИЛЬНО: Исключить все .env кроме примеров
.env
.env.*
!.env.example
!.env.*.example

# ПРАВИЛЬНО: Исключить логи
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

## Исправление типичных проблем

### Проблема: yarn.lock не добавляется в Git

**Причина:** Неправильный .gitignore

**Решение:**
```bash
# 1. Проверить что игнорируется
git check-ignore -v frontend/yarn.lock

# 2. Если файл игнорируется, найти строку в .gitignore
grep -n "yarn" .gitignore

# 3. Исправить .gitignore (убрать .yarn/* или добавить !yarn.lock)

# 4. Добавить файл
git add -f frontend/yarn.lock
git commit -m "Add yarn.lock"
```

### Проблема: Добавляется node_modules

**Решение:**
```bash
# 1. Удалить из Git (но оставить локально)
git rm -r --cached node_modules

# 2. Добавить в .gitignore
echo "node_modules/" >> .gitignore

# 3. Коммит
git add .gitignore
git commit -m "Remove node_modules from git"
```

### Проблема: Случайно закоммитили .env с секретами

**Решение:**
```bash
# ОСТОРОЖНО: Это изменит историю Git!

# 1. Удалить файл из всей истории
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Добавить в .gitignore
echo ".env" >> .gitignore

# 3. Force push (если уже запушили)
git push origin --force --all

# 4. Сменить все секреты которые были в .env!
```

### Проблема: Большие файлы попали в Git

**Решение:**
```bash
# Найти большие файлы
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print substr($0,6)}' | \
  sort --numeric-sort --key=2 | \
  tail -n 10

# Удалить большой файл из истории
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/large/file" \
  --prune-empty --tag-name-filter cat -- --all
```

## Git LFS для больших файлов (опционально)

Если нужно хранить большие файлы (видео для тестов):

```bash
# Установить Git LFS
git lfs install

# Отслеживать видео файлы
git lfs track "*.mp4"
git lfs track "*.avi"

# Добавить .gitattributes
git add .gitattributes

# Теперь можно добавлять большие файлы
git add recordings/test-video.mp4
git commit -m "Add test video via LFS"
```

## Проверка перед push

### Pre-push checklist

```bash
# 1. Проверить что yarn.lock есть
git ls-files | grep yarn.lock

# 2. Проверить размер
git count-objects -vH

# 3. Проверить что нет node_modules
git ls-files | grep node_modules
# Должно быть пусто!

# 4. Проверить что нет .env с секретами
git ls-files | grep -E "\.env$"
# Должно быть пусто или только .env.example

# 5. Проверить что нет больших файлов
git ls-files -s | awk '$4 > 1000000 {print $4/1048576 "MB", $5}'
```

## Git Commands для VideoGuard

### Первый коммит

```bash
git init
git add .
git commit -m "Initial commit: VideoGuard surveillance system"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Обновление после исправления .gitignore

```bash
# Удалить все из кэша
git rm -r --cached .

# Добавить заново с новым .gitignore
git add .

# Посмотреть что изменилось
git status

# Коммит
git commit -m "Update .gitignore: exclude large files, include yarn.lock"
```

### Клонирование репозитория

```bash
# Клонировать
git clone <repository-url>
cd videoguard

# Установить зависимости
cd backend
pip install -r requirements.txt
cd ../frontend
yarn install
cd ..

# Запустить с Docker
make dev-up
```

## Рекомендуемая структура репозитория

```
videoguard/
├── .gitignore              ✅ Корневой gitignore
├── .git/
├── README.md               ✅ Главная документация
├── docker-compose.yml      ✅ Production compose
├── docker-compose.dev.yml  ✅ Dev compose
├── Makefile                ✅ Команды управления
├── backend/
│   ├── .gitignore         ✅ Backend-специфичный gitignore
│   ├── requirements.txt   ✅ Python зависимости
│   ├── Dockerfile         ✅ Docker конфигурация
│   ├── server.py          ✅ Код приложения
│   └── .env.example       ✅ Пример env переменных
├── frontend/
│   ├── .gitignore         ✅ Frontend-специфичный gitignore
│   ├── package.json       ✅ NPM/Yarn конфигурация
│   ├── yarn.lock          ✅ ВАЖНО: Lock file
│   ├── Dockerfile         ✅ Docker конфигурация
│   ├── src/               ✅ Исходный код
│   └── public/            ✅ Статические файлы
└── nginx/
    └── nginx-ssl.conf      ✅ Nginx конфигурация
```

## Автоматизация проверки

Создать pre-commit hook:

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Running pre-commit checks..."

# Проверка yarn.lock
if git diff --cached --name-only | grep -q "frontend/package.json"; then
    if ! git diff --cached --name-only | grep -q "frontend/yarn.lock"; then
        echo "Error: package.json changed but yarn.lock not updated!"
        echo "Run: cd frontend && yarn install"
        exit 1
    fi
fi

# Проверка на большие файлы
MAX_SIZE=5242880  # 5MB
while read -r file; do
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ "$size" -gt "$MAX_SIZE" ]; then
        echo "Error: File $file is larger than 5MB ($size bytes)"
        echo "Consider using Git LFS or adding to .gitignore"
        exit 1
    fi
done < <(git diff --cached --name-only)

echo "All checks passed!"
exit 0
```

Сделать исполняемым:
```bash
chmod +x .git/hooks/pre-commit
```

## Заключение

Правильная настройка .gitignore критична для:
- ✅ Включения всех необходимых файлов (yarn.lock, package.json)
- ✅ Исключения больших файлов (recordings, node_modules)
- ✅ Защиты секретов (.env файлы)
- ✅ Быстрого клонирования и сборки

**Золотое правило:** Если сомневаетесь - лучше включить файл с `!filename` в .gitignore, чем исключить нужный файл.
