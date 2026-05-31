import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseTex } from 'tex-math-parser';
import * as math from 'mathjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const EXCLUDED_SYMBOLS = new Set([
  'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
  'arcsin', 'arccos', 'arctan', 'log', 'ln',
  'sqrt', 'pi', 'e', 'det', 'inv', 'abs'
]);

// Helper to get variables from an AST Node
function getVariables(node) {
  try {
    const symbols = node.filter(n => n.type === 'SymbolNode').map(n => n.name);
    const uniqueSymbols = [...new Set(symbols)];
    return uniqueSymbols.filter(name => !EXCLUDED_SYMBOLS.has(name) && isNaN(name));
  } catch (error) {
    return [];
  }
}

function sanitizeLatex(latex) {
  if (!latex) return '';
  let cleaned = latex.trim();
  
  // Remove enclosing equation brackets if present
  if (cleaned.startsWith('\\[') && cleaned.endsWith('\\]')) {
    cleaned = cleaned.substring(2, cleaned.length - 2).trim();
  }
  if (cleaned.startsWith('\\(') && cleaned.endsWith('\\)')) {
    cleaned = cleaned.substring(2, cleaned.length - 2).trim();
  }
  if (cleaned.startsWith('$') && cleaned.endsWith('$')) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }

  // Remove array and matrix environments
  cleaned = cleaned.replace(/\\begin\{(array|matrix|align|split|equation|gather)\}(\{[^{}]*\})?/g, '');
  cleaned = cleaned.replace(/\\end\{(array|matrix|align|split|equation|gather)\}/g, '');
  cleaned = cleaned.replace(/\\\\/g, ' ');

  // Standardize digits (OCR misrecognitions of 1 and 0 shapes)
  cleaned = cleaned.replace(/\\i(?![a-zA-Z])/g, '1');
  cleaned = cleaned.replace(/\\mid(?![a-zA-Z])/g, '1');
  cleaned = cleaned.replace(/\\vert(?![a-zA-Z])/g, '1');
  cleaned = cleaned.replace(/\\vert(?![a-zA-Z])/g, '1');
  cleaned = cleaned.replace(/\\dagger(?![a-zA-Z])/g, '1');
  cleaned = cleaned.replace(/\\bigcirc(?![a-zA-Z])/g, '0');
  cleaned = cleaned.replace(/\\circ(?![a-zA-Z])/g, '0');
  cleaned = cleaned.replace(/\\cup(?![a-zA-Z])/g, '0');
  cleaned = cleaned.replace(/\\cap(?![a-zA-Z])/g, '0');
  cleaned = cleaned.replace(/\bO\b/g, '0');
  cleaned = cleaned.replace(/\bo\b/g, '0');

  // Strip LaTeX accents and style modifiers (e.g. \bar{3} -> 3)
  cleaned = cleaned.replace(/\\(bar|hat|tilde|vec|overline|underline|mathbf|mathit|mathsf|mathtt|mathbb|mathcal)\{([^}]+)\}/g, '$2');
  cleaned = cleaned.replace(/\\(bar|hat|tilde|vec|overline|underline|mathbf|mathit|mathsf|mathtt|mathbb|mathcal)\s+([a-zA-Z0-9])/g, '$2');

  // Clean degree/angle symbols and strip trailing dots/circs (often misrecognized degrees)
  cleaned = cleaned.replace(/\^\{\s*\\(circ|cdot|ast|star)\s*\}/g, '');
  cleaned = cleaned.replace(/\^\\(circ|cdot|ast|star)/g, '');
  cleaned = cleaned.replace(/\^\{\s*\*\s*\}/g, '');
  
  // Repair trigonometric functions with superscript arguments but no parentheses (e.g. \tan^{45} -> tan(45))
  cleaned = cleaned.replace(/\\(sin|cos|tan)\^\{([^}]+)\}(?!\s*\()/g, '$1($2)');
  cleaned = cleaned.replace(/\\(sin|cos|tan)\^([a-zA-Z0-9]+)(?!\s*\()/g, '$1($2)');

  // Replace common LaTeX styles to keep parsing simpler
  cleaned = cleaned.replace(/\^{\\wedge}/g, '^');
  cleaned = cleaned.replace(/\\wedge/g, '^');
  cleaned = cleaned.replace(/\\mathrm\{([^{}]+)\}/g, '$1');
  cleaned = cleaned.replace(/\\text\{([^{}]+)\}/g, '$1');
  cleaned = cleaned.replace(/\\mathrm/g, '');
  cleaned = cleaned.replace(/\\text/g, '');
  cleaned = cleaned.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
  cleaned = cleaned.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
  cleaned = cleaned.replace(/\\left\\{/g, '{').replace(/\\right\\}/g, '}');
  cleaned = cleaned.replace(/\\quad/g, ' ');
  
  // Standardize multiplication & division
  cleaned = cleaned.replace(/\\times/g, '*');
  cleaned = cleaned.replace(/\\cdot/g, '*');
  cleaned = cleaned.replace(/\\star/g, '*');
  cleaned = cleaned.replace(/\\ast/g, '*');
  cleaned = cleaned.replace(/\\div/g, '/');

  // Strip whitespaces around operators
  cleaned = cleaned.replace(/\s*([\+\-\*\/])\s*/g, '$1');
  // Strip whitespaces between adjacent digits (OCR spacing artifacts)
  cleaned = cleaned.replace(/(\d)\s+(?=\d)/g, '$1');
  // Strip whitespaces after closing braces and parentheses
  cleaned = cleaned.replace(/\}\s+/g, '}');
  cleaned = cleaned.replace(/\)\s+/g, ')');
  
  return cleaned.trim();
}

// Numerical root finder for single-variable functions f(x) = 0
function findRootNumerically(f, start = -100, end = 100, steps = 200) {
  // First scan for sign changes
  const stepSize = (end - start) / steps;
  let prevX = start;
  let prevY = f(start);

  for (let i = 1; i <= steps; i++) {
    const x = start + i * stepSize;
    const y = f(x);
    if (!isNaN(y) && isFinite(y)) {
      if (prevY * y <= 0) {
        // Sign change found, perform bisection in this interval
        return bisection(f, prevX, x);
      }
    }
    prevX = x;
    prevY = y;
  }
  
  // Fallback to Secant method from x=0 and x=1
  try {
    return secantMethod(f, 0, 1);
  } catch (e) {
    return null;
  }
}

function bisection(f, left, right, tol = 1e-6, maxIter = 100) {
  let l = left;
  let r = right;
  let fl = f(l);
  
  for (let i = 0; i < maxIter; i++) {
    const mid = (l + r) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < tol || (r - l) / 2 < tol) {
      return Number(mid.toFixed(4));
    }
    if (fl * fm < 0) {
      r = mid;
    } else {
      l = mid;
      fl = fm;
    }
  }
  return Number(((l + r) / 2).toFixed(4));
}

function secantMethod(f, x0, x1, tol = 1e-6, maxIter = 50) {
  let x_prev = x0;
  let x_curr = x1;
  for (let i = 0; i < maxIter; i++) {
    const y_prev = f(x_prev);
    const y_curr = f(x_curr);
    if (Math.abs(y_curr - y_prev) < 1e-12) break;
    
    const x_next = x_curr - y_curr * (x_curr - x_prev) / (y_curr - y_prev);
    if (Math.abs(f(x_next)) < tol) {
      return Number(x_next.toFixed(4));
    }
    x_prev = x_curr;
    x_curr = x_next;
  }
  const finalY = f(x_curr);
  return Math.abs(finalY) < 1e-2 ? Number(x_curr.toFixed(4)) : null;
}

// Generate data points for plotting y = f(x)
function generatePlotData(nodeLhs, nodeRhs = null, varName = 'x') {
  const points = [];
  for (let x = -10; x <= 10; x += 0.4) {
    const xVal = Number(x.toFixed(2));
    let yLhs = NaN;
    let yRhs = nodeRhs ? NaN : 0;
    
    try {
      yLhs = nodeLhs.evaluate({ [varName]: xVal });
      if (typeof yLhs === 'object' && yLhs.type === 'Unit') {
        yLhs = yLhs.toNumber();
      }
    } catch (e) {}

    if (nodeRhs) {
      try {
        yRhs = nodeRhs.evaluate({ [varName]: xVal });
        if (typeof yRhs === 'object' && yRhs.type === 'Unit') {
          yRhs = yRhs.toNumber();
        }
      } catch (e) {}
    }

    if (isFinite(yLhs) && isFinite(yRhs)) {
      points.push({
        x: xVal,
        lhs: Number(yLhs.toFixed(4)),
        rhs: nodeRhs ? Number(yRhs.toFixed(4)) : undefined,
        y: nodeRhs ? undefined : Number(yLhs.toFixed(4))
      });
    }
  }
  return points;
}

// Main solving logic
function solveMath(latex) {
  const sanitized = sanitizeLatex(latex);
  if (!sanitized) {
    throw new Error('Empty formula string after cleanup.');
  }

  // Handle equation with equal sign
  if (sanitized.includes('=')) {
    const parts = sanitized.split('=');
    if (parts.length !== 2) {
      throw new Error('Equations must have exactly one "=" sign.');
    }
    const lhsStr = parts[0].trim();
    const rhsStr = parts[1].trim();

    const lhsNode = parseTex(lhsStr);
    const rhsNode = parseTex(rhsStr);

    const lhsVars = getVariables(lhsNode);
    const rhsVars = getVariables(rhsNode);
    const allVars = [...new Set([...lhsVars, ...rhsVars])];

    if (allVars.length === 0) {
      // Numerical equation check (e.g. 5 + 3 = 8)
      const lhsVal = lhsNode.evaluate();
      const rhsVal = rhsNode.evaluate();
      const isEqual = Math.abs(lhsVal - rhsVal) < 1e-9;
      return {
        type: 'equation-check',
        lhs: lhsVal,
        rhs: rhsVal,
        isTrue: isEqual,
        result: isEqual ? 'True' : 'False'
      };
    } else if (allVars.length === 1) {
      const variable = allVars[0];
      const f = (val) => {
        try {
          const lVal = lhsNode.evaluate({ [variable]: val });
          const rVal = rhsNode.evaluate({ [variable]: val });
          return lVal - rVal;
        } catch (e) {
          return NaN;
        }
      };

      // 1. Try Linear Solve
      const f0 = f(0);
      const f1 = f(1);
      const f2 = f(2);
      const a_lin = f1 - f0;
      const b_lin = f0;
      const isLinear = Math.abs(f2 - (2 * a_lin + b_lin)) < 1e-7;

      if (isLinear && Math.abs(a_lin) > 1e-7) {
        const sol = -b_lin / a_lin;
        return {
          type: 'equation-solve',
          variables: allVars,
          equationType: 'linear',
          solution: [Number(sol.toFixed(4))],
          plotData: generatePlotData(lhsNode, rhsNode, variable),
          result: `${variable} = ${Number(sol.toFixed(4))}`
        };
      }

      // 2. Try Quadratic Solve (a x^2 + b x + c = 0)
      const c_quad = f0;
      const ab_sum = f1 - c_quad;
      const a4b2_sum = f2 - c_quad;
      // We solve:
      // a + b = ab_sum
      // 4a + 2b = a4b2_sum => 2a + b = a4b2_sum / 2
      // Subtracting: a = a4b2_sum/2 - ab_sum
      const a_quad = (a4b2_sum / 2) - ab_sum;
      const b_quad = ab_sum - a_quad;
      
      // Check if quadratic by evaluating at x = 3
      const f3 = f(3);
      const expectedF3 = 9 * a_quad + 3 * b_quad + c_quad;
      const isQuadratic = Math.abs(f3 - expectedF3) < 1e-7;

      if (isQuadratic && Math.abs(a_quad) > 1e-7) {
        const D = b_quad * b_quad - 4 * a_quad * c_quad;
        if (D > 0) {
          const r1 = (-b_quad + Math.sqrt(D)) / (2 * a_quad);
          const r2 = (-b_quad - Math.sqrt(D)) / (2 * a_quad);
          const roots = [Number(r1.toFixed(4)), Number(r2.toFixed(4))].sort((x, y) => x - y);
          return {
            type: 'equation-solve',
            variables: allVars,
            equationType: 'quadratic',
            solution: roots,
            plotData: generatePlotData(lhsNode, rhsNode, variable),
            result: `${variable} = ${roots[0]} or ${roots[1]}`
          };
        } else if (Math.abs(D) < 1e-9) {
          const r = -b_quad / (2 * a_quad);
          return {
            type: 'equation-solve',
            variables: allVars,
            equationType: 'quadratic',
            solution: [Number(r.toFixed(4))],
            plotData: generatePlotData(lhsNode, rhsNode, variable),
            result: `${variable} = ${Number(r.toFixed(4))}`
          };
        } else {
          // Complex roots
          const real = -b_quad / (2 * a_quad);
          const imag = Math.sqrt(-D) / (2 * a_quad);
          const r1 = `${real.toFixed(2)} + ${imag.toFixed(2)}i`;
          const r2 = `${real.toFixed(2)} - ${imag.toFixed(2)}i`;
          return {
            type: 'equation-solve',
            variables: allVars,
            equationType: 'quadratic-complex',
            solution: [r1, r2],
            plotData: generatePlotData(lhsNode, rhsNode, variable),
            result: `${variable} = ${r1} or ${r2}`
          };
        }
      }

      // 3. Fallback to Numerical Root Finder
      const root = findRootNumerically(f);
      if (root !== null) {
        return {
          type: 'equation-solve',
          variables: allVars,
          equationType: 'non-linear',
          solution: [root],
          plotData: generatePlotData(lhsNode, rhsNode, variable),
          result: `${variable} ≈ ${root}`
        };
      }

      // No roots found, return graph anyway
      return {
        type: 'equation-solve',
        variables: allVars,
        equationType: 'non-linear',
        solution: null,
        plotData: generatePlotData(lhsNode, rhsNode, variable),
        result: 'No real solutions found'
      };
    } else {
      // More than 1 variable (e.g. x + y = 10)
      return {
        type: 'equation-solve',
        variables: allVars,
        equationType: 'multi-variable',
        solution: null,
        result: 'Multi-variable equation. Plotting unsupported.'
      };
    }
  }

  // Handle standard mathematical expression
  const node = parseTex(sanitized);
  const vars = getVariables(node);

  if (vars.length === 0) {
    // Normal arithmetic/calculation
    const value = node.evaluate();
    let resultStr = '';
    
    if (typeof value === 'object' && value.type === 'Fraction') {
      resultStr = value.toString();
    } else if (typeof value === 'number') {
      // Format number nicely
      resultStr = Number(value.toFixed(6)).toString();
    } else {
      resultStr = value.toString();
    }

    return {
      type: 'expression',
      result: resultStr
    };
  } else if (vars.length === 1) {
    // Single variable function (e.g. x^2 + 2x + 1)
    return {
      type: 'function',
      variables: vars,
      plotData: generatePlotData(node, null, vars[0]),
      result: `f(${vars[0]}) = ${sanitized}`
    };
  } else {
    // Multi-variable function (e.g. x^2 + y^2)
    return {
      type: 'function-multivariate',
      variables: vars,
      result: `f(${vars.join(',')}) = ${sanitized}`
    };
  }
}

// POST endpoint to handle the canvas image
app.post('/api/solve', upload.single('image'), async (req, res) => {
  let imagePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    }

    imagePath = req.file.path;
    
    // Call Python OCR Service running on port 5001
    // We send the image file in form data
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(imagePath)], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);

    const ocrResponse = await fetch('http://127.0.0.1:5001/ocr', {
      method: 'POST',
      body: formData
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR service failed with status ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();
    const recognizedLatex = ocrData.latex;

    if (!recognizedLatex || recognizedLatex.trim() === '') {
      return res.status(422).json({
        success: false,
        error: 'No text or math formulas could be recognized from the drawing.'
      });
    }

    // Solve/Evaluate the LaTeX formula
    const mathResult = solveMath(recognizedLatex);

    res.json({
      success: true,
      latex: recognizedLatex,
      ...mathResult
    });

  } catch (error) {
    console.error('Solve error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An internal server error occurred while processing the math.'
    });
  } finally {
    // Delete temp upload file
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DrawCalc AI Backend' });
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
