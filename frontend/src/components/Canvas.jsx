import React, { useRef, useState, useEffect } from 'react';
import { Undo2, Redo2, Trash2, Eraser, Brush, Cpu, Grid, Sparkles, Download } from 'lucide-react';
import './Canvas.css';

const COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Blue', value: '#38bdf8' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Violet', value: '#c084fc' },
  { name: 'Yellow', value: '#fbbf24' }
];

const Canvas = ({ onSolve, isLoading }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('draw'); // 'draw' | 'erase'
  const [brushSize, setBrushSize] = useState(6);
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [brushStyle, setBrushStyle] = useState('solid'); // 'solid' | 'chalk'
  
  // History stacks for undo/redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  // Points buffer for smooth quadratic curves
  const pointsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    // Internal canvas resolution (independent of CSS scaling)
    canvas.width = 1000;
    canvas.height = 480;
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Fill background with transparency
    clearCanvas(false);
  }, []);

  // Save canvas state to undo stack
  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    setUndoStack((prev) => [...prev, state]);
    // Clear redo stack on new action
    setRedoStack([]);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Support touch events
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Scale coordinates based on visual bounds vs internal canvas bounds
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  // Helper to apply current drawing style properties to context
  const applyDrawingStyle = (ctx, currentTool = tool, currentStyle = brushStyle, size = brushSize, color = drawColor) => {
    ctx.lineWidth = size;
    if (currentTool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      if (currentStyle === 'chalk') {
        ctx.shadowBlur = 4;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.88;
      } else {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1.0;
      }
    }
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    
    saveState();
    
    setIsDrawing(true);
    pointsRef.current = [{ x, y }];
    
    const ctx = contextRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    applyDrawingStyle(ctx);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    const ctx = contextRef.current;
    
    pointsRef.current.push({ x, y });
    
    applyDrawingStyle(ctx);
    
    // Draw smooth bezier curves
    if (pointsRef.current.length > 2) {
      const lastPoint = pointsRef.current[pointsRef.current.length - 1];
      const prevPoint = pointsRef.current[pointsRef.current.length - 2];
      const prevPrevPoint = pointsRef.current[pointsRef.current.length - 3];
      
      const xc = (prevPoint.x + lastPoint.x) / 2;
      const yc = (prevPoint.y + lastPoint.y) / 2;
      
      ctx.beginPath();
      const xStart = (prevPrevPoint.x + prevPoint.x) / 2;
      const yStart = (prevPrevPoint.y + prevPoint.y) / 2;
      
      ctx.moveTo(xStart, yStart);
      ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc);
      ctx.stroke();
    } else {
      // Direct line fallback
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      pointsRef.current = [];
    }
  };

  const clearCanvas = (resetHistory = true) => {
    if (resetHistory) {
      saveState();
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear to transparency
    
    if (resetHistory) {
      setRedoStack([]);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    setRedoStack((prev) => [...prev, currentState]);
    
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(previousState, 0, 0);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    setUndoStack((prev) => [...prev, currentState]);
    
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(nextState, 0, 0);
  };

  // Helper to compile drawing onto solid black canvas with strokes mapped to pure white for OCR compatibility
  const getCompiledCanvas = () => {
    const canvas = canvasRef.current;
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const oCtx = offscreen.getContext('2d');
    
    // 1. Draw solid white rectangle over everything
    oCtx.fillStyle = '#ffffff';
    oCtx.fillRect(0, 0, offscreen.width, offscreen.height);
    
    // 2. destination-in: Retains white color only where drawing strokes overlap (maps colors to white)
    oCtx.globalCompositeOperation = 'destination-in';
    oCtx.drawImage(canvas, 0, 0);
    
    // 3. destination-over: Places the solid black background behind the white strokes
    oCtx.globalCompositeOperation = 'destination-over';
    oCtx.fillStyle = '#06070a';
    oCtx.fillRect(0, 0, offscreen.width, offscreen.height);
    
    return offscreen;
  };

  // Convert canvas to blob and trigger solve callback
  const handleSolve = () => {
    const compiled = getCompiledCanvas();
    compiled.toBlob((blob) => {
      if (blob) {
        onSolve(blob);
      }
    }, 'image/png');
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    
    // Export with its actual colors onto a solid black background
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const oCtx = offscreen.getContext('2d');
    oCtx.fillStyle = '#06070a';
    oCtx.fillRect(0, 0, offscreen.width, offscreen.height);
    oCtx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = 'drawcalc-equation.png';
    link.href = offscreen.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="canvas-container glass-panel animate-fade-in">
      <div className="canvas-toolbar">
        <div className="toolbar-group">
          <button 
            className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
            onClick={() => setTool('draw')}
            title="Brush"
          >
            <Brush size={18} />
            <span>Draw</span>
          </button>
          <button 
            className={`tool-btn ${tool === 'erase' ? 'active' : ''}`}
            onClick={() => setTool('erase')}
            title="Eraser"
          >
            <Eraser size={18} />
            <span>Eraser</span>
          </button>
        </div>

        <div className="toolbar-separator"></div>

        {/* Color Selector Group */}
        <div className="toolbar-group">
          <span className="color-label">Color</span>
          <div className="color-palette">
            {COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-btn ${drawColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value, color: color.value }}
                onClick={() => {
                  setDrawColor(color.value);
                  setTool('draw'); // Automatically switch to draw when selecting color
                }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        <div className="toolbar-separator"></div>

        <div className="toolbar-group">
          <button 
            className={`tool-btn ${gridEnabled ? 'active' : ''}`}
            onClick={() => setGridEnabled(!gridEnabled)}
            title="Toggle Grid Paper Background"
          >
            <Grid size={18} />
            <span>Grid</span>
          </button>
          <button 
            className={`tool-btn ${brushStyle === 'chalk' ? 'active' : ''}`}
            onClick={() => setBrushStyle(brushStyle === 'solid' ? 'chalk' : 'solid')}
            disabled={tool === 'erase'}
            title="Toggle Chalk Glow Filter"
          >
            <Sparkles size={18} />
            <span>Chalk Mode</span>
          </button>
        </div>

        <div className="toolbar-separator"></div>

        <div className="toolbar-group">
          <label className="brush-slider-label">
            <span>Size</span>
            <input 
              type="range" 
              min="2" 
              max="24" 
              value={brushSize} 
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="brush-slider"
            />
            <span className="size-indicator">{brushSize}px</span>
          </label>
        </div>

        <div className="toolbar-separator"></div>

        <div className="toolbar-group ml-auto">
          <button 
            onClick={handleExport}
            className="action-btn"
            title="Export drawing as PNG"
          >
            <Download size={18} />
          </button>
          <button 
            onClick={handleUndo} 
            disabled={undoStack.length === 0}
            className="action-btn"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button 
            onClick={handleRedo} 
            disabled={redoStack.length === 0}
            className="action-btn"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
          <button 
            onClick={() => clearCanvas(true)}
            className="action-btn danger"
            title="Clear Canvas"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`math-canvas ${gridEnabled ? 'grid-bg' : ''}`}
        />
      </div>

      <div className="canvas-footer">
        <button 
          onClick={handleSolve} 
          disabled={isLoading}
          className="solve-btn btn-primary"
        >
          {isLoading ? (
            <>
              <div className="spinner"></div>
              <span>Analyzing Equation...</span>
            </>
          ) : (
            <>
              <Cpu size={18} />
              <span>Solve Drawing</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Canvas;
