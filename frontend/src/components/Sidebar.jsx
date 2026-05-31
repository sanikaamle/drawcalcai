import React from 'react';
import { History, Trash2, ChevronRight } from 'lucide-react';
import MathRenderer from './MathRenderer';
import './Sidebar.css';

const Sidebar = ({ history, activeIndex, onSelectHistory, onDeleteHistory, onClearHistory }) => {
  return (
    <div className="sidebar glass-panel animate-fade-in">
      <div className="sidebar-header">
        <div className="header-title">
          <History size={18} className="title-icon" />
          <h2>History</h2>
        </div>
        {history.length > 0 && (
          <button 
            onClick={onClearHistory} 
            className="clear-all-btn"
            title="Clear all history"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <div className="empty-history">
            <p>No recent equations.</p>
            <span>Equations you draw and solve will appear here.</span>
          </div>
        ) : (
          history.map((item, idx) => (
            <div 
              key={item.id || idx}
              className={`history-item ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => onSelectHistory(idx)}
            >
              <div className="history-item-content">
                <div className="math-wrapper">
                  <MathRenderer latex={item.latex} />
                </div>
                <div className="result-preview">
                  {item.result ? `= ${item.result}` : 'Solved'}
                </div>
              </div>
              
              <div className="item-actions">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteHistory(idx);
                  }}
                  className="delete-item-btn"
                  title="Delete calculation"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="arrow-icon" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
