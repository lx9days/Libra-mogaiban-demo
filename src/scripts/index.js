import '../styles/index.scss';
import 'monaco-editor/min/vs/editor/editor.main.css';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

console.log('webpack starterkit');

// 目录上下文：页面（同时支持 .js 和 .json）与后备模块
// 递归查找 pages 子目录中的 .js/.json 文件
const pagesJsContext = require.context('../pages', true, /\.js$/);
const pagesJsonContext = require.context('../pages', true, /\.json$/);
const modulesContext = require.context('./modules', false, /\.js$/);

function nameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('file') || params.get('page') || '';
  const fromPath = (window.location.pathname || '')
    .split('/')
    .filter(Boolean)
    .pop() || '';
  const raw = fromQuery || fromPath || 'home';
  const decoded = decodeURIComponent(raw);
  const noExt = decoded.replace(/\.(js|json)$/i, '');
  // 保留连字符和 &，以支持像 "pan&zoom" 这样的页面名
  const safe = noExt.replace(/[^\w&-\s]/g, '').trim();
  return safe || 'home';
}

function baseOfKey(k) {
  return k.replace(/^\.\//, '').replace(/\.(js|json)$/i, '');
}

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function findMatchingKey(keys, name, { fallbackTo } = {}) {
  const lower = name.toLowerCase();
  const normalized = normalizeForMatch(name);
  const candidates = keys.map((k) => {
    const full = baseOfKey(k); // 可能是 'demo' 或 'demo/demo' 或 'demo/index'
    const tail = full.split('/').pop();
    return {
      k,
      full,
      tail,
      lowerFull: full.toLowerCase(),
      lowerTail: tail.toLowerCase(),
      normalizedFull: normalizeForMatch(full),
      normalizedTail: normalizeForMatch(tail),
    };
  });

  // 优先级：
  // 1) 同名文件位于同名文件夹：name/name
  let hit = candidates.find((c) => c.tail === name && c.full === `${name}/${name}`);
  if (hit) return hit.k;

  // 2) 根或任意子目录中，文件名与 name 完全一致
  hit = candidates.find((c) => c.tail === name);
  if (hit) return hit.k;

  // 3) 同名文件夹下的 index 文件：name/index
  hit = candidates.find((c) => c.full === `${name}/index`);
  if (hit) return hit.k;

  // 4) 不区分大小写匹配（文件名）
  hit = candidates.find((c) => c.lowerTail === lower);
  if (hit) return hit.k;

  // 5) 兼容空格/下划线/连字符差异（文件名）
  hit = candidates.find((c) => c.normalizedTail === normalized);
  if (hit) return hit.k;

  // 6) 不区分大小写的部分匹配（路径包含）
  hit = candidates.find((c) => c.lowerFull.includes(lower) || c.normalizedFull.includes(normalized));
  if (hit) return hit.k;

  // 回退
  if (fallbackTo) {
    const back = candidates.find((c) => c.full === fallbackTo || c.lowerTail === fallbackTo.toLowerCase());
    if (back) return back.k;
  }
  return null;
}

// 当前页面初始化函数与 JSON 编辑器引用
let pageInit = null;
let jsonEditor = null;
let jsonChangeTimer = null;

function ensureJsonMonaco() {
  const container = document.getElementById('JsonPane');
  if (!container) return null;
  if (jsonEditor) return jsonEditor;
  try {
    jsonEditor = monaco.editor.create(container, {
      language: 'javascript',
      readOnly: false,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      theme: 'vs',
      wordWrap: 'on',
    });

    // JSON 变更时，重新装配（去抖）
    jsonEditor.onDidChangeModelContent(() => {
      if (jsonChangeTimer) clearTimeout(jsonChangeTimer);
      jsonChangeTimer = setTimeout(() => {
        try {
          const text = jsonEditor.getValue();
          const parsed = text ? JSON.parse(text) : null;
          if (typeof pageInit === 'function') {
            cleanupCanvas();
            pageInit(parsed);
          }
        } catch (e) {
          // 解析失败时不打断输入
        }
      }, 300);
    });
    return jsonEditor;
  } catch (e) {
    return null;
  }
}

function renderJson(data) {
  const editor = ensureJsonMonaco();
  if (editor) {
    const next = data ? JSON.stringify(data, null, 2) : '';
    const current = editor.getValue();
    if (current !== next) editor.setValue(next);
  } else {
    const target = document.getElementById('JsonPane');
    if (target) target.textContent = data ? JSON.stringify(data, null, 2) : '';
  }
}

async function renderJsSourceRaw(key) {
  const target = document.getElementById('JsPane');
  if (!key) return;
  try {
    const rel = key.replace(/^\.\//, '');
    const mod = await import(
      /* webpackChunkName: "raw-pages" */
      /* webpackInclude: /\.js$/ */
      /* webpackMode: "lazy-once" */
      `../pages/${rel}?raw`
    );
    const src = mod && (mod.default || mod);
    const editor = await ensureMonaco();
    if (editor && typeof src === 'string' && src.length > 0) {
      editor.setValue(src);
      updateDSLHighlight(editor, src);
      if (target) target.style.display = 'none';
    } else if (target) {
      target.style.display = '';
      target.textContent = typeof src === 'string' && src.length > 0 ? src : 'Source unavailable.';
    }
  } catch (e) {
    console.error('Failed to load raw source:', e);
    if (target) {
      target.style.display = '';
      target.textContent = 'Source unavailable.';
    }
  }
}

async function loadFromPages(name) {
  const jsKeys = pagesJsContext.keys();
  // const jsonKeys = pagesJsonContext.keys();
  const jsKey = findMatchingKey(jsKeys, name);
  // const jsonKey = findMatchingKey(jsonKeys, name);

  if (!jsKey /* && !jsonKey */) return false; // 未命中 pages，返回让后备逻辑处理

  try {
    // 通过 context 同步加载，避免动态表达式上下文解析失败
    const jsMod = jsKey ? pagesJsContext(jsKey) : null;
    // const jsonMod = jsonKey ? pagesJsonContext(jsonKey) : null;

    // const data = jsonMod ? (jsonMod.default ?? jsonMod) : null;
    const init = jsMod ? (jsMod.default ?? jsMod) : null;

    // Always show JSON pane if available
    // renderJson(data);
    // Show JS source in right pane (raw)
    if (jsKey) await renderJsSourceRaw(jsKey);

    if (typeof init === 'function') {
      cleanupCanvas();
      pageInit = init;
      init(/* data */);
    } else {
      pageInit = null;
    }

    return true;
  } catch (err) {
    console.error('Failed to load page JS/JSON:', err);
    const p = document.createElement('p');
    p.textContent = '页面资源加载失败，请检查 URL 后缀或文件是否同名。';
    p.style.color = 'crimson';
    document.body.appendChild(p);
    return true; // 已处理错误，不再走后备
  }
}

async function loadFallbackModule(name) {
  const modKey = findMatchingKey(modulesContext.keys(), name);
  if (modKey) {
    const mod = modulesContext(modKey);
    if (mod && typeof mod.default === 'function') mod.default();
    return;
  }
  await loadFromPages('home');
}

async function bootstrap() {
  const name = nameFromUrl();
  const handled = await loadFromPages(name);
  if (!handled) await loadFallbackModule(name);
}


// Monaco editor instance (if loaded)
let jsEditor = null;

function ensureMonaco() {
  const container = document.getElementById('JsEditor');
  if (!container) return Promise.resolve(null);
  if (jsEditor) return Promise.resolve(jsEditor);
  try {
    jsEditor = monaco.editor.create(container, {
      language: 'javascript',
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      theme: 'vs',
    });
    return Promise.resolve(jsEditor);
  } catch (e) {
    return Promise.resolve(null);
  }
}

// 清空主画布容器内容，避免旧交互残留
function cleanupCanvas() {
  const root = document.getElementById('LibraPlayground');
  if (!root) {
    console.log("no container");

    return;
  }
  while (root.firstChild) {
    root.removeChild(root.firstChild);
    console.log("clean");
  }
}

// --- DSL Highlighting Support ---
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
  
  const combinedDSL = dsls.join('\n\n');
  const jsonEditor = ensureJsonMonaco();
  if (jsonEditor) {
    jsonEditor.setValue(combinedDSL);
  } else {
    // If editor not ready, fallback to textContent
    const target = document.getElementById('JsonPane');
    if (target) target.textContent = combinedDSL;
  }
  
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

bootstrap();
