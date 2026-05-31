import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calculator, AlertTriangle } from 'lucide-react';
import Canvas from './components/Canvas';
import MathRenderer from './components/MathRenderer';
import GraphView from './components/GraphView';
import Sidebar from './components/Sidebar';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('drawcalc_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('drawcalc_history', JSON.stringify(history));
  }, [history]);

  // Solve the drawing canvas image
  const handleSolveDrawing = async (imageBlob) => {
    setIsLoading(true);
    setError(null);
    setActiveIndex(-1);

    const formData = new FormData();
    formData.append('image', imageBlob, 'drawing.png');

    try {
      const response = await axios.post(`${API_URL}/solve`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data && response.data.success) {
        const newRecord = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          latex: response.data.latex,
          type: response.data.type,
          result: response.data.result,
          variables: response.data.variables || null,
          plotData: response.data.plotData || null,
          equationType: response.data.equationType || null,
          lhs: response.data.lhs !== undefined ? response.data.lhs : null,
          rhs: response.data.rhs !== undefined ? response.data.rhs : null,
          isTrue: response.data.isTrue !== undefined ? response.data.isTrue : null
        };

        setHistory((prev) => [newRecord, ...prev]);
        setActiveIndex(0); // Select the newest record
      } else {
        throw new Error(response.data.error || 'Failed to solve equation.');
      }
    } catch (err) {
      console.error('API Error:', err);
      const msg = err.response?.data?.error || err.message || 'Connecting to backend failed. Make sure the server is running.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (index) => {
    setActiveIndex(index);
    setError(null);
  };

  const handleDeleteHistory = (index) => {
    setHistory((prev) => prev.filter((_, i) => i !== index));
    if (activeIndex === index) {
      setActiveIndex(-1);
    } else if (activeIndex > index) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      setHistory([]);
      setActiveIndex(-1);
    }
  };

  const activeRecord = activeIndex !== -1 ? history[activeIndex] : null;

  return (
    <div className="app">
      <header className="app-header">
        <Calculator size={32} className="app-logo" />
        <div className="app-title-group">
          <h1 className="text-gradient">DrawCalc AI</h1>
          <p>Draw any math equation on the canvas and solve it instantly</p>
        </div>
      </header>

      <div className="app-content animate-fade-in">
        <div className="main-column">
          {/* Canvas Drawer */}
          <Canvas onSolve={handleSolveDrawing} isLoading={isLoading} />

          {/* Error Alert Display */}
          {error && (
            <div className="error-panel glass-panel animate-fade-in">
              <AlertTriangle className="error-icon" size={20} />
              <div className="error-details">
                <h4>Calculation Failed</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Results Panel */}
          <div className="result-panel glass-panel">
            <h3 className="panel-header">Result & Solution</h3>
            
            {isLoading && (
              <div className="skeleton-loader animate-fade-in">
                <div className="skeleton-line title"></div>
                <div className="skeleton-line body-lg"></div>
                <div className="skeleton-line title"></div>
                <div className="skeleton-line body-md"></div>
              </div>
            )}

            {!isLoading && !activeRecord && !error && (
              <div className="empty-result-state">
                <p>No Active Solution</p>
                <span>Draw on the canvas above and click "Solve Drawing" to see the output.</span>
              </div>
            )}

            {!isLoading && activeRecord && (
              <div className="result-display animate-fade-in">
                <div className="formula-section">
                  <span className="section-label">Recognized LaTeX Formula</span>
                  <div className="latex-container">
                    <MathRenderer latex={activeRecord.latex} displayMode={true} />
                  </div>
                </div>

                <div className="equals-divider">↓</div>

                <div className="answer-section">
                  <span className="section-label">
                    {activeRecord.type === 'equation-solve' ? 'Solved Solution' : 'Evaluated Result'}
                  </span>
                  <div className="answer-value">
                    {activeRecord.result}
                  </div>
                  {activeRecord.equationType && (
                    <span className="details-indicator">
                      Parsed as {activeRecord.equationType} equation
                    </span>
                  )}
                  {activeRecord.type === 'equation-check' && (
                    <span className="details-indicator">
                      Numeric comparison evaluates to {activeRecord.isTrue ? 'valid' : 'invalid'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side Column containing History & Plotting */}
        <div className="side-column">
          <Sidebar 
            history={history}
            activeIndex={activeIndex}
            onSelectHistory={handleSelectHistory}
            onDeleteHistory={handleDeleteHistory}
            onClearHistory={handleClearHistory}
          />
          
          {activeRecord && activeRecord.plotData && (
            <GraphView 
              plotData={activeRecord.plotData}
              variables={activeRecord.variables}
              type={activeRecord.type}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
