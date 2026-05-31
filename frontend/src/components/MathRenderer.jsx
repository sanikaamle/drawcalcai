import React, { useEffect, useRef } from 'react';

const MathRenderer = ({ latex, displayMode = false }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    if (window.katex) {
      try {
        window.katex.render(latex || '', containerRef.current, {
          displayMode: displayMode,
          throwOnError: false,
          trust: true
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
        containerRef.current.textContent = latex;
      }
    } else {
      // Fallback if KaTeX is not loaded yet
      containerRef.current.textContent = latex;
    }
  }, [latex, displayMode]);

  return <span ref={containerRef} className="math-renderer-element" />;
};

export default MathRenderer;
