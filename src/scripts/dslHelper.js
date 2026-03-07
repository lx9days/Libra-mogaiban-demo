
function extractBalanced(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];
    
    if (inString) {
      if (char === stringChar && source[i-1] !== '\\') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return {
          text: source.slice(startIndex, i + 1),
          end: i + 1
        };
      }
    }
  }
  return { text: null, end: -1 };
}

function getPositionFromIndex(source, index) {
  const lines = source.slice(0, index).split('\n');
  return {
    lineNumber: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function extractDSL(sourceCode) {
  const dsls = [];
  const ranges = [];
  
  // Match compileInteractionsDSL(varName, ...) or compileInteractionsDSL([...], ...)
  const callRegex = /compileInteractionsDSL\s*\(\s*/g;
  let match;
  
  while ((match = callRegex.exec(sourceCode)) !== null) {
    const startIndex = match.index + match[0].length;
    const remaining = sourceCode.slice(startIndex);
    const firstCharMatch = remaining.match(/\S/);
    if (!firstCharMatch) continue;
    
    const firstChar = firstCharMatch[0];
    const offset = firstCharMatch.index;
    
    if (firstChar === '[') {
      const absStart = startIndex + offset;
      const { text, end } = extractBalanced(sourceCode, absStart, '[', ']');
      if (text) {
        dsls.push(text);
        ranges.push({ start: absStart, end });
      }
    } else {
      const varMatch = remaining.match(/^([a-zA-Z0-9_$]+)/);
      if (varMatch) {
        const varName = varMatch[1];
        // Find variable definition
        // Supports: const x = [...]; let x = [...]; var x = [...];
        const defRegex = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*`);
        const defMatch = sourceCode.match(defRegex);
        if (defMatch) {
            const defStart = defMatch.index + defMatch[0].length;
            const defRemaining = sourceCode.slice(defStart);
            const defFirstCharMatch = defRemaining.match(/\S/);
            
            if (defFirstCharMatch && defFirstCharMatch[0] === '[') {
                 const defOffset = defFirstCharMatch.index;
                 const absStart = defStart + defOffset;
                 const { text, end } = extractBalanced(sourceCode, absStart, '[', ']');
                 if (text) {
                    dsls.push(text);
                    ranges.push({ start: absStart, end });
                 }
            }
        }
      }
    }
  }
  return { dsls, ranges };
}

let dslDecorations = [];

function updateDSLHighlight(editor, code) {
  const { dsls, ranges } = extractDSL(code);
  
  // Render DSL in JsonPane
  const combinedDSL = dsls.join('\n\n');
  const jsonEditor = ensureJsonMonaco();
  if (jsonEditor) {
    jsonEditor.setValue(combinedDSL);
  }
  
  // Highlight in JsEditor
  const decorations = ranges.map(range => {
    const startPos = getPositionFromIndex(code, range.start);
    const endPos = getPositionFromIndex(code, range.end);
    return {
      range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
      options: {
        isWholeLine: false,
        className: 'dsl-highlight',
        inlineClassName: 'dsl-highlight-inline'
      }
    };
  });
  
  dslDecorations = editor.deltaDecorations(dslDecorations, decorations);
}
