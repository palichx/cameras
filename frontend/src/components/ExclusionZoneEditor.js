import React, { useState, useRef, useEffect } from 'react';
import { X, Square, Pentagon, Trash2, Save } from 'lucide-react';

const ExclusionZoneEditor = ({ cameraId, cameraName, isOpen, onClose, onSave, initialZones = [] }) => {
  const canvasRef = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [zones, setZones] = useState(initialZones);
  const [currentTool, setCurrentTool] = useState('rect'); // 'rect' or 'polygon'
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load camera snapshot
  useEffect(() => {
    if (isOpen && cameraId) {
      loadSnapshot();
    }
  }, [isOpen, cameraId]);

  const loadSnapshot = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/api/cameras/${cameraId}/snapshot`);
      
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.onload = () => {
          setSnapshot(img);
          setCanvasSize({ width: img.width, height: img.height });
          setLoading(false);
        };
        img.src = imageUrl;
      } else {
        console.error('Failed to load snapshot');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading snapshot:', error);
      setLoading(false);
    }
  };

  // Draw on canvas
  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw snapshot
    ctx.drawImage(snapshot, 0, 0);
    
    // Draw existing zones
    zones.forEach((zone, index) => {
      const isSelected = index === selectedZoneIndex;
      ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 0, 0, 0.3)';
      ctx.strokeStyle = isSelected ? '#ff0000' : '#ff6666';
      ctx.lineWidth = isSelected ? 3 : 2;
      
      if (zone.type === 'rect') {
        const { x, y, width, height } = zone.coordinates;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
      } else if (zone.type === 'polygon') {
        const points = zone.coordinates.points;
        if (points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    });
    
    // Draw current shape being drawn
    if (currentShape && currentTool === 'rect') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.fillRect(currentShape.x, currentShape.y, currentShape.width, currentShape.height);
      ctx.strokeRect(currentShape.x, currentShape.y, currentShape.width, currentShape.height);
      ctx.setLineDash([]);
    }
    
    // Draw current polygon
    if (polygonPoints.length > 0 && currentTool === 'polygon') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0][0], polygonPoints[0][1]);
      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i][0], polygonPoints[i][1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw points
      polygonPoints.forEach(point => {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [snapshot, zones, currentShape, polygonPoints, selectedZoneIndex]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    if (!snapshot) return;
    
    const coords = getCanvasCoords(e);
    
    if (currentTool === 'rect') {
      setIsDrawing(true);
      setCurrentShape({ x: coords.x, y: coords.y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || currentTool !== 'rect' || !currentShape) return;
    
    const coords = getCanvasCoords(e);
    setCurrentShape({
      x: currentShape.x,
      y: currentShape.y,
      width: coords.x - currentShape.x,
      height: coords.y - currentShape.y
    });
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || currentTool !== 'rect' || !currentShape) return;
    
    const coords = getCanvasCoords(e);
    const finalShape = {
      x: Math.min(currentShape.x, coords.x),
      y: Math.min(currentShape.y, coords.y),
      width: Math.abs(coords.x - currentShape.x),
      height: Math.abs(coords.y - currentShape.y)
    };
    
    // Only add if shape has some size
    if (finalShape.width > 5 && finalShape.height > 5) {
      setZones([...zones, { type: 'rect', coordinates: finalShape }]);
    }
    
    setIsDrawing(false);
    setCurrentShape(null);
  };

  const handleCanvasClick = (e) => {
    if (currentTool !== 'polygon') return;
    
    const coords = getCanvasCoords(e);
    setPolygonPoints([...polygonPoints, [coords.x, coords.y]]);
  };

  const handleCanvasDoubleClick = (e) => {
    if (currentTool !== 'polygon' || polygonPoints.length < 3) return;
    
    // Finish polygon
    setZones([...zones, { type: 'polygon', coordinates: { points: polygonPoints } }]);
    setPolygonPoints([]);
  };

  const handleDeleteZone = (index) => {
    setZones(zones.filter((_, i) => i !== index));
    setSelectedZoneIndex(null);
  };

  const handleClearAll = () => {
    setZones([]);
    setSelectedZoneIndex(null);
  };

  const handleSave = async () => {
    try {
      await onSave(zones);
      onClose();
    } catch (error) {
      console.error('Error saving zones:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Зоны исключения: {cameraName}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-4 border-b bg-gray-50">
          <button
            onClick={() => {
              setCurrentTool('rect');
              setPolygonPoints([]);
            }}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'rect'
                ? 'bg-blue-500 text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            <Square size={18} />
            Прямоугольник
          </button>
          
          <button
            onClick={() => {
              setCurrentTool('polygon');
              setIsDrawing(false);
              setCurrentShape(null);
            }}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              currentTool === 'polygon'
                ? 'bg-blue-500 text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            <Pentagon size={18} />
            Полигон
          </button>

          <div className="flex-1" />

          {selectedZoneIndex !== null && (
            <button
              onClick={() => handleDeleteZone(selectedZoneIndex)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
            >
              <Trash2 size={18} />
              Удалить зону
            </button>
          )}

          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            Очистить всё
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Загрузка снимка камеры...</div>
            </div>
          ) : snapshot ? (
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                className="border border-gray-300 cursor-crosshair"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-red-500">
              Не удалось загрузить снимок камеры
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
          {currentTool === 'rect' ? (
            <p>Кликните и перетащите мышью, чтобы нарисовать прямоугольник</p>
          ) : (
            <p>Кликайте, чтобы добавить точки полигона. Двойной клик для завершения.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-white">
          <div className="text-sm text-gray-600">
            Зон исключения: {zones.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Save size={18} />
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExclusionZoneEditor;
