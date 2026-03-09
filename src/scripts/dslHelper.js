
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

function extractStatement(source, startIndex) {
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
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
    
    if (char === '(') depthParen++;
    else if (char === ')') depthParen--;
    else if (char === '{') depthBrace++;
    else if (char === '}') depthBrace--;
    else if (char === '[') depthBracket++;
    else if (char === ']') depthBracket--;
    
    // Stop at top-level semicolon
    if (char === ';' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      return {
        text: source.slice(startIndex, i), // Exclude semicolon for display
        end: i + 1 // Include semicolon in range
      };
    }
  }
  
  // If no semicolon found, return until end (fallback)
  return {
      text: source.slice(startIndex),
      end: source.length
  };
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
  
  const callRegex = /compileInteractionsDSL\s*\(\s*/g;
  let match;
  
  while ((match = callRegex.exec(sourceCode)) !== null) {
    const startIndex = match.index + match[0].length;
    
    // Find the end of the first argument
    let argEndIndex = -1;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = startIndex; i < sourceCode.length; i++) {
        const char = sourceCode[i];
        if (inString) {
            if (char === stringChar && sourceCode[i-1] !== '\\') inString = false;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
            continue;
        }
        
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') {
            if (depth === 0) {
                argEndIndex = i;
                break;
            }
            depth--;
        } else if (char === ',' && depth === 0) {
            argEndIndex = i;
            break;
        }
    }
    
    if (argEndIndex === -1) continue;
    
    const firstArg = sourceCode.slice(startIndex, argEndIndex).trim();
    
    if (firstArg.startsWith('[')) {
       // Direct array literal: use extractBalanced to get exact range
       const openBracketIndex = sourceCode.indexOf('[', startIndex);
       if (openBracketIndex !== -1 && openBracketIndex < argEndIndex) {
           const { text, end } = extractBalanced(sourceCode, openBracketIndex, '[', ']');
           if (text) {
               dsls.push(text);
               ranges.push({ start: openBracketIndex, end });
           }
       }
    } else {
        // Expression: find all variables and their definitions
        const identifiers = new Set();
        const idRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
        let idMatch;
        while ((idMatch = idRegex.exec(firstArg)) !== null) {
            identifiers.add(idMatch[0]);
        }
        
        identifiers.forEach(varName => {
            // Find definition: const/let/var varName = ...
            const defRegex = new RegExp(`(const|let|var)\\s+${varName}\\s*=\\s*`, 'g');
            let defMatch;
            
            // Search from beginning of file
            while ((defMatch = defRegex.exec(sourceCode)) !== null) {
                 const defStart = defMatch.index + defMatch[0].length;
                 const defRemaining = sourceCode.slice(defStart);
                 const defFirstCharMatch = defRemaining.match(/\S/);
                 
                 if (defFirstCharMatch) {
                     const defOffset = defFirstCharMatch.index;
                     const absStart = defStart + defOffset;
                     
                     if (defFirstCharMatch[0] === '[') {
                         const { text, end } = extractBalanced(sourceCode, absStart, '[', ']');
                         if (text) {
                            dsls.push(text);
                            ranges.push({ start: absStart, end });
                         }
                     } else if (defFirstCharMatch[0] === '{') {
                         const { text, end } = extractBalanced(sourceCode, absStart, '{', '}');
                         if (text) {
                            dsls.push(text);
                            ranges.push({ start: absStart, end });
                         }
                     } else {
                         // Fallback: extract statement until semicolon
                         const { text, end } = extractStatement(sourceCode, absStart);
                         if (text) {
                            dsls.push(text.trim());
                            ranges.push({ start: absStart, end });
                         }
                     }
                 }
                 break; // Only pick the first definition found
            }
        });
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
