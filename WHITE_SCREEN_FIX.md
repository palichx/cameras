# Исправление белого экрана при открытии страницы

## Проблема

При открытии http://localhost:3000 показывается белый экран.

## Причина

React приложение не загружается из-за проблем с dev server или отсутствия JavaScript bundle.

## Быстрое решение

### Вариант 1: Перезапустить контейнеры

```bash
# Остановить все
make dev-down

# Или
docker-compose -f docker-compose.dev.yml down

# Запустить заново
make dev-up

# Или  
docker-compose -f docker-compose.dev.yml up -d

# Подождать 30 секунд для запуска
sleep 30

# Открыть http://localhost:3000
```

### Вариант 2: Использовать production build

```bash
# Собрать production версию
cd frontend
yarn build
cd ..

# Запустить production
docker-compose down
docker-compose up -d

# Открыть http://localhost:3000
```

### Вариант 3: Пересобрать frontend

```bash
# Остановить
docker-compose down

# Пересобрать только frontend
docker-compose build frontend --no-cache

# Запустить
docker-compose up -d
```

## Диагностика

### Проверка 1: Логи frontend

```bash
# Development
docker logs videoguard-frontend-dev

# Production
docker logs videoguard-frontend

# Должно быть:
# "webpack compiled successfully"
# или
# "nginx started"
```

### Проверка 2: Статус контейнера

```bash
docker ps | grep frontend

# Должно показать running контейнер
```

### Проверка 3: Проверить что загружается

```bash
curl http://localhost:3000 | grep -i script

# Должно показать:
# <script defer="defer" src="/static/js/main...
```

### Проверка 4: Консоль браузера

1. Открыть http://localhost:3000
2. Нажать F12 (DevTools)
3. Перейти на вкладку Console
4. Искать ошибки

Типичные ошибки:
- `Failed to load resource: net::ERR_CONNECTION_REFUSED` - backend не доступен
- `Uncaught SyntaxError` - ошибка в коде
- `Module not found` - отсутствует зависимость

### Проверка 5: Network tab

1. F12 → Network tab
2. Обновить страницу (F5)
3. Проверить что загружается:
   - ✅ index.html (200 OK)
   - ✅ main.js (200 OK)
   - ✅ main.css (200 OK)

## Частые причины

### 1. Dev server не запущен

**Решение:**
```bash
docker-compose -f docker-compose.dev.yml restart frontend
```

### 2. Port 3000 занят

**Проверка:**
```bash
lsof -i :3000
# или
netstat -tulpn | grep 3000
```

**Решение:**
```bash
# Остановить процесс или изменить порт в docker-compose
```

### 3. REACT_APP_BACKEND_URL не установлен

**Проверка:**
```bash
docker exec videoguard-frontend-dev env | grep REACT_APP
```

**Решение:**
```bash
# Добавить в docker-compose.dev.yml
environment:
  - REACT_APP_BACKEND_URL=http://localhost:8001
```

### 4. Node modules не установлены

**Решение:**
```bash
cd frontend
rm -rf node_modules
yarn install
cd ..

# Перезапустить
make dev-up
```

### 5. Синтаксическая ошибка в коде

**Проверка:**
```bash
cd frontend
yarn build

# Если есть ошибки - исправить
```

## Проверка после исправления

### 1. Homepage загружается

```bash
curl -I http://localhost:3000
# HTTP/1.1 200 OK
```

### 2. JavaScript bundle загружается

```bash
curl http://localhost:3000/static/js/main.*.js
# Должен вернуть JavaScript код
```

### 3. API работает

```bash
curl http://localhost:8001/api/
# {"message":"Video Surveillance System API"}
```

### 4. Frontend подключается к backend

Открыть http://localhost:3000 и проверить:
- Dashboard загружается
- Статистика показывается
- Нет ошибок в консоли

## Ручная сборка и запуск

Если Docker не работает, можно запустить локально:

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
yarn start

# Откроется на http://localhost:3000
```

## Production deployment

Для production используйте собранную версию:

```bash
# Собрать
cd frontend
yarn build

# Запустить с nginx
docker-compose up -d

# Или локально с serve
npx serve -s build -p 3000
```

## Альтернативные порты

Если порт 3000 занят:

**docker-compose.dev.yml:**
```yaml
frontend:
  ports:
    - "3001:3000"  # Изменить на 3001
```

Затем открыть http://localhost:3001

## Чистая переустановка

Если ничего не помогает:

```bash
# Полная очистка
make clean
rm -rf frontend/node_modules frontend/build
rm -rf frontend/yarn.lock

# Переустановка
cd frontend
yarn install
yarn build
cd ..

# Пересборка Docker
docker-compose build --no-cache
docker-compose up -d
```

## Проверочный скрипт

Создайте и запустите:

```bash
#!/bin/bash
echo "=== VideoGuard Frontend Debug ==="
echo ""

echo "1. Checking containers..."
docker ps | grep frontend || echo "❌ Frontend container not running"

echo ""
echo "2. Checking port 3000..."
curl -Is http://localhost:3000 | head -1 || echo "❌ Port 3000 not responding"

echo ""
echo "3. Checking backend..."
curl -s http://localhost:8001/api/ | grep message && echo "✅ Backend OK" || echo "❌ Backend not responding"

echo ""
echo "4. Checking frontend build..."
[ -f frontend/build/index.html ] && echo "✅ Build exists" || echo "❌ No build found"

echo ""
echo "5. Checking node_modules..."
[ -d frontend/node_modules ] && echo "✅ Dependencies installed" || echo "❌ Run yarn install"

echo ""
echo "=== End Debug ==="
```

Сохранить как `debug-frontend.sh` и запустить:
```bash
chmod +x debug-frontend.sh
./debug-frontend.sh
```

## Получение помощи

Если проблема не решена, соберите информацию:

```bash
# Логи
docker logs videoguard-frontend-dev > frontend.log 2>&1
docker logs videoguard-backend > backend.log 2>&1

# Статус
docker ps > status.log

# Конфигурация
docker-compose config > config.log

# Отправьте эти файлы для диагностики
```

## Контрольный список

- [ ] Docker контейнеры запущены (`docker ps`)
- [ ] Port 3000 доступен (`curl http://localhost:3000`)
- [ ] Backend работает (`curl http://localhost:8001/api/`)
- [ ] Node modules установлены (`ls frontend/node_modules`)
- [ ] Build существует (`ls frontend/build`)
- [ ] Нет ошибок в логах (`docker logs videoguard-frontend-dev`)
- [ ] REACT_APP_BACKEND_URL установлен
- [ ] Нет синтаксических ошибок (`yarn build`)

После проверки всех пунктов страница должна загружаться корректно.
