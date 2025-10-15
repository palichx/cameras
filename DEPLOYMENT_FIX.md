# Исправление развертывания - Относительные URL

## Проблема
При локальном развертывании приложение обращалось к `localhost:8001` напрямую вместо использования веб-интерфейса.

## Решение

### Изменение в `/app/frontend/src/App.js`

**Было:**
```javascript
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const API = `${BACKEND_URL}/api`;
```

**Стало:**
```javascript
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
export const API = `${BACKEND_URL}/api`;
```

## Как это работает

### Development режим (yarn start)
- Frontend работает на `http://localhost:3000`
- Backend работает на `http://localhost:8001`
- Proxy в `setupProxy.js` перенаправляет `/api/*` на `http://localhost:8001/api/*`
- Пользователь работает только с `http://localhost:3000`

### Production режим (с nginx)
- Nginx слушает на порту 80/443
- Статические файлы frontend раздаются напрямую
- Запросы `/api/*` проксируются на backend (порт 8001)
- Пользователь работает через единый домен

### Внешний доступ (Kubernetes)
- Используется переменная окружения `REACT_APP_BACKEND_URL`
- Все запросы идут через внешний URL
- Kubernetes ingress маршрутизирует трафик

## Конфигурация окружений

### Локальная разработка
```env
# .env не требуется, работает через proxy
```

### Production
```env
REACT_APP_BACKEND_URL=https://your-domain.com
```

## Преимущества

1. ✅ **Единая точка входа** - пользователь работает только с веб-интерфейсом
2. ✅ **Безопасность** - backend не доступен напрямую
3. ✅ **Простота** - нет необходимости знать порты backend
4. ✅ **Гибкость** - работает в любом окружении

## Проверка

### Локально
```bash
# Откройте http://localhost:3000
# Проверьте Network в DevTools - все запросы должны идти на /api/*
```

### Production
```bash
# Откройте https://your-domain.com
# Все запросы должны идти на https://your-domain.com/api/*
```

## Troubleshooting

### Ошибка CORS в локальной разработке
Убедитесь что `setupProxy.js` правильно настроен:
```javascript
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
}));
```

### 404 на /api/* в production
Проверьте nginx конфигурацию:
```nginx
location /api/ {
    proxy_pass http://backend:8001/api/;
}
```

### Запросы всё ещё идут на localhost:8001
1. Очистите кэш браузера
2. Перезапустите frontend: `sudo supervisorctl restart frontend`
3. Проверьте `.env` файл - `REACT_APP_BACKEND_URL` должен быть пустым для локальной разработки
