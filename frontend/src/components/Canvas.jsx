import React, { useRef, useState, useEffect } from 'react';
import { Undo2, Redo2, Trash2, Eraser, Brush, Cpu } from 'lucide-react';
import './Canvas.css';

const Canvas = ({ onSolve, isLoading }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('draw'); // 'draw' | 'erase'
  const [brushSize, setBrushSize] = useState(6);
  
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
    context.strokeStyle = '#ffffff';
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Fill background with solid black
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

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    
    saveState();
    
    setIsDrawing(true);
    pointsRef.current = [{ x, y }];
    
    const ctx = contextRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === 'erase' ? '#06070a' : '#ffffff';
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    const ctx = contextRef.current;
    
    pointsRef.current.push({ x, y });
    
    // Clear canvas and redraw smooth stroke
    // Actually, drawing incrementally is simpler and faster on canvas:
    if (pointsRef.current.length > 2) {
      const lastPoint = pointsRef.current[pointsRef.current.length - 1];
      const prevPoint = pointsRef.current[pointsRef.current.length - 2];
      const prevPrevPoint = pointsRef.current[pointsRef.current.length - 3];
      
      const xc = (prevPoint.x + lastPoint.x) / 2;
      const yc = (prevPoint.y + lastPoint.y) / 2;
      
      ctx.beginPath();
      // Draw curve from midpoint of (prevPrev, prev) to midpoint of (prev, last)
      const xStart = (prevPrevPoint.x + prevPoint.x) / 2;
      const yStart = (prevPrevPoint.y + prevPoint.y) / 2;
      
      ctx.moveTo(xStart, yStart);
      ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc);
      ctx.strokeStyle = tool === 'erase' ? '#06070a' : '#ffffff';
      ctx.lineWidth = brushSize;
      ctx.stroke();
    } else {
      // Direct line fallback
      ctx.lineTo(x, y);
      ctx.strokeStyle = tool === 'erase' ? '#06070a' : '#ffffff';
      ctx.lineWidth = brushSize;
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
    ctx.fillStyle = '#06070a'; // Sleek dark canvas background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (resetHistory) {
      setRedoStack([]);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Push current state to redo stack
    setRedoStack((prev) => [...prev, currentState]);
    
    // Pop from undo stack and draw
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(previousState, 0, 0);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Push current to undo stack
    setUndoStack((prev) => [...prev, currentState]);
    
    // Pop from redo stack and draw
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    ctx.putImageData(nextState, 0, 0);
  };

  // Convert canvas to blob and trigger solve callback
  const handleSolve = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (blob) {
        onSolve(blob);
      }
    }, 'image/png');
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
          className="math-canvas"
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
