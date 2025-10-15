# Улучшение детекции движения

## Текущий метод

**Frame Differencing (разность кадров)**
- Сравнивает текущий кадр с предыдущим
- Threshold для бинаризации
- GaussianBlur для уменьшения шума
- Dilate для объединения близких областей
- Detection zones (опционально)

### Проблемы текущего метода:
1. ❌ **Ложные срабатывания** на изменения освещения (облака, включение света)
2. ❌ **Чувствителен к теням** - тень от движущегося объекта воспринимается как движение
3. ❌ **Дрожание камеры** вызывает ложные срабатывания
4. ❌ **Медленное движение** может не детектироваться
5. ❌ **Шум** от камеры воспринимается как движение

---

## Предлагаемые улучшения

### 1. Background Subtraction (MOG2/KNN) ⭐ РЕКОМЕНДУЕТСЯ

**Преимущества:**
- ✅ Адаптируется к постепенным изменениям освещения
- ✅ Игнорирует статичные тени
- ✅ Лучше работает с медленным движением
- ✅ Встроенная фильтрация шума

**Сложность:** Низкая (уже есть в OpenCV)

**Код:**
```python
# Инициализация
self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
    history=500,           # Количество последних кадров для обучения
    varThreshold=16,       # Порог для определения переднего плана
    detectShadows=True     # Детектировать и игнорировать тени
)

# Использование
def _detect_motion(self, frame):
    fg_mask = self.bg_subtractor.apply(frame)
    
    # Игнорируем тени (значение 127)
    fg_mask[fg_mask == 127] = 0
    
    # Морфологическая фильтрация
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
    
    # Подсчёт движения
    motion_pixels = np.sum(fg_mask > 0)
    total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
    motion_percentage = motion_pixels / total_pixels
    
    return motion_percentage > threshold
```

**Производительность:** Средняя (немного медленнее frame diff, но не критично)

---

### 2. Optical Flow (Lucas-Kanade) ⭐⭐ ТОЧНОЕ ДЕТЕКТИРОВАНИЕ

**Преимущества:**
- ✅ Детектирует **направление** и **скорость** движения
- ✅ Можно игнорировать движение фона (ветер, деревья)
- ✅ Точное определение движущихся объектов

**Недостатки:**
- ⚠️ Более CPU-интенсивный
- ⚠️ Требует больше настроек

**Код:**
```python
# Инициализация
self.lk_params = dict(
    winSize=(15, 15),
    maxLevel=2,
    criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03)
)
self.feature_params = dict(
    maxCorners=100,
    qualityLevel=0.3,
    minDistance=7,
    blockSize=7
)

def _detect_motion_optical_flow(self, frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    if self.last_frame is None:
        self.last_points = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
        self.last_frame = gray
        return False
    
    if self.last_points is None or len(self.last_points) < 10:
        self.last_points = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
        self.last_frame = gray
        return False
    
    # Вычисляем optical flow
    new_points, status, error = cv2.calcOpticalFlowPyrLK(
        self.last_frame, gray, self.last_points, None, **self.lk_params
    )
    
    # Выбираем только успешно отслеженные точки
    good_new = new_points[status == 1]
    good_old = self.last_points[status == 1]
    
    # Вычисляем среднее движение
    movement = np.linalg.norm(good_new - good_old, axis=1).mean()
    
    self.last_frame = gray
    self.last_points = cv2.goodFeaturesToTrack(gray, mask=None, **self.feature_params)
    
    return movement > threshold
```

**Производительность:** Низкая-Средняя (требует больше CPU)

---

### 3. AI/ML Object Detection (YOLO, MobileNet) ⭐⭐⭐ МАКСИМАЛЬНАЯ ТОЧНОСТЬ

**Преимущества:**
- ✅ Детектирует **конкретные объекты** (люди, машины, животные)
- ✅ Минимум ложных срабатываний
- ✅ Можно настроить детекцию только нужных классов

**Недостатки:**
- ⚠️ Требует больше CPU/GPU
- ⚠️ Нужна модель (YOLO nano/tiny для Raspberry Pi)
- ⚠️ Сложнее настройка

**Код (с MobileNet SSD):**
```python
# Загрузка модели
self.net = cv2.dnn.readNetFromCaffe(
    'MobileNetSSD_deploy.prototxt',
    'MobileNetSSD_deploy.caffemodel'
)
self.CLASSES = ["person", "car", "motorbike", "cat", "dog"]

def _detect_motion_ai(self, frame):
    (h, w) = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(
        cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5
    )
    
    self.net.setInput(blob)
    detections = self.net.forward()
    
    detected_objects = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        
        if confidence > 0.5:
            idx = int(detections[0, 0, i, 1])
            if idx < len(self.CLASSES):
                detected_objects.append(self.CLASSES[idx])
    
    return len(detected_objects) > 0
```

**Производительность:** Низкая (требует GPU или мощный CPU)

---

### 4. Морфологические улучшения текущего метода ⭐ БЫСТРОЕ УЛУЧШЕНИЕ

**Простые улучшения для текущего алгоритма:**

```python
def _detect_motion_improved(self, frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (21, 21), 0)
    
    if self.last_frame is None:
        self.last_frame = gray
        return False
    
    # 1. Используем абсолютную разность
    frame_delta = cv2.absdiff(self.last_frame, gray)
    
    # 2. Адаптивный threshold вместо фиксированного
    thresh = cv2.adaptiveThreshold(
        frame_delta, 255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    
    # 3. Морфологические операции для уменьшения шума
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)  # Убрать мелкий шум
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)  # Заполнить дыры
    
    # 4. Находим контуры и фильтруем по размеру
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    significant_motion = 0
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 500:  # Минимальная площадь объекта
            significant_motion += area
    
    total_pixels = thresh.shape[0] * thresh.shape[1]
    motion_percentage = significant_motion / total_pixels
    
    # 5. Обновляем фон только если нет движения
    if motion_percentage < threshold:
        self.last_frame = cv2.addWeighted(self.last_frame, 0.9, gray, 0.1, 0)
    
    return motion_percentage > threshold
```

**Производительность:** Высокая (почти как текущий метод)

---

### 5. Temporal Filtering (Временная фильтрация)

**Идея:** Игнорировать кратковременные изменения (1-2 кадра)

```python
def _detect_motion_temporal(self, frame):
    current_motion = self._basic_motion_detection(frame)
    
    # Буфер последних N результатов
    if not hasattr(self, 'motion_buffer'):
        self.motion_buffer = deque(maxlen=5)
    
    self.motion_buffer.append(current_motion)
    
    # Движение только если детектируется в большинстве кадров
    motion_count = sum(self.motion_buffer)
    return motion_count >= 3  # Минимум 3 из 5 кадров
```

---

## Рекомендации по выбору

### Для слабого железа (Raspberry Pi, старый ПК):
1. **Морфологические улучшения** (метод 4) - самое быстрое улучшение
2. **MOG2 Background Subtraction** (метод 1) - хороший баланс точности/скорости

### Для среднего железа:
1. **MOG2 + Temporal Filtering** - отличная точность
2. **Optical Flow** - если нужно знать направление движения

### Для мощного железа (GPU):
1. **YOLO Nano + MOG2** - максимальная точность
2. **MobileNet SSD** - хороший баланс

---

## Дополнительные настройки

### 1. Настройки чувствительности по времени суток
```python
from datetime import datetime

def get_dynamic_threshold(self):
    hour = datetime.now().hour
    
    # Ночью (23:00 - 6:00) - выше чувствительность
    if hour >= 23 or hour < 6:
        return 0.005
    # День (9:00 - 18:00) - ниже чувствительность
    elif 9 <= hour <= 18:
        return 0.02
    # Утро/вечер - средняя
    else:
        return 0.01
```

### 2. Игнорирование зон с постоянным движением
```python
# Детектируем "горячие зоны" (деревья, дорога с машинами)
# и уменьшаем чувствительность в этих областях
```

### 3. Настройка минимального размера объекта
```python
min_object_area = 500  # пикселей
# Игнорировать мелкие объекты (насекомые, мусор)
```

---

## Предлагаемый план внедрения

### Этап 1: Быстрые улучшения (1-2 часа)
- ✅ Добавить морфологические операции
- ✅ Фильтрация контуров по размеру
- ✅ Temporal filtering

### Этап 2: MOG2 Background Subtraction (2-3 часа)
- ✅ Интеграция MOG2
- ✅ Настройка параметров
- ✅ Тестирование

### Этап 3: AI/ML (опционально, 4-8 часов)
- ✅ Интеграция MobileNet SSD
- ✅ Настройка классов объектов
- ✅ Оптимизация производительности

---

## Вопросы для уточнения

1. **Какие конкретные проблемы?**
   - Много ложных срабатываний?
   - Пропускает реальное движение?
   - Срабатывает на освещение?

2. **Железо:**
   - Что используется? (Raspberry Pi, обычный ПК, мощный сервер?)
   - Доступен ли GPU?

3. **Приоритеты:**
   - Важнее точность или скорость?
   - Нужна детекция конкретных объектов (люди, машины)?

4. **Условия съёмки:**
   - Помещение или улица?
   - Есть ли деревья, которые качаются?
   - Проблемы с освещением?

---

## Тестирование

После внедрения рекомендуется:
1. Записать тестовое видео с разными сценариями
2. Сравнить количество ложных срабатываний
3. Проверить CPU usage
4. Настроить параметры под конкретную камеру
