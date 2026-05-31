import React from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';
import './GraphView.css';

const GraphView = ({ plotData, variables, type }) => {
  if (!plotData || plotData.length === 0) return null;

  const varName = variables ? variables[0] : 'x';
  const isEquation = plotData[0].rhs !== undefined;

  // Custom styling for Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="graph-tooltip glass-panel">
          <p className="tooltip-x">{`${varName} = ${payload[0].payload.x}`}</p>
          {payload.map((item, idx) => (
            <p 
              key={idx} 
              className="tooltip-val" 
              style={{ color: item.color }}
            >
              {`${item.name}: ${item.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="graph-view glass-panel animate-fade-in">
      <div className="graph-header">
        <h3>Function Graph</h3>
        <p className="graph-subtitle">
          {isEquation 
            ? `Plotting Left Hand Side vs Right Hand Side` 
            : `Plotting f(${varName})`}
        </p>
      </div>

      <div className="graph-chart-wrapper">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={plotData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
            <XAxis 
              dataKey="x" 
              type="number" 
              domain={['dataMin', 'dataMax']}
              stroke="rgba(255, 255, 255, 0.3)"
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}
              tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis 
              type="number"
              domain={['auto', 'auto']}
              stroke="rgba(255, 255, 255, 0.3)"
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}
              tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Draw X and Y Axes lines */}
            <ReferenceLine x={0} stroke="rgba(255, 255, 255, 0.2)" strokeWidth={1.5} />
            <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.2)" strokeWidth={1.5} />

            {isEquation ? (
              <>
                <Line 
                  type="monotone" 
                  dataKey="lhs" 
                  name="Left Hand Side"
                  stroke="hsl(262, 80%, 60%)" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(262, 80%, 60%)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rhs" 
                  name="Right Hand Side"
                  stroke="hsl(142, 70%, 45%)" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(142, 70%, 45%)' }}
                />
              </>
            ) : (
              <Line 
                type="monotone" 
                dataKey="y" 
                name={`f(${varName})`}
                stroke="hsl(262, 80%, 60%)" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(262, 80%, 60%)' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="graph-legend">
        {isEquation ? (
          <>
            <div className="legend-item">
              <span className="legend-color lhs-color"></span>
              <span className="legend-label">Left Side (LHS)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color rhs-color"></span>
              <span className="legend-label">Right Side (RHS)</span>
            </div>
          </>
        ) : (
          <div className="legend-item">
            <span className="legend-color lhs-color"></span>
            <span className="legend-label">f({varName})</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphView;
