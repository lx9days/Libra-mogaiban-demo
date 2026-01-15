export default function(data) {
  const container = document.getElementById('LibraPlayground');
  if (!container) return;
  container.innerHTML = ""; 

  const wrapper = document.createElement("div");
  wrapper.style.padding = "20px";
  wrapper.style.fontFamily = "system-ui, -apple-system, sans-serif";

  const title = document.createElement("h2");
  title.textContent = "Available Demos";
  title.style.borderBottom = "1px solid #eaecef";
  title.style.paddingBottom = "0.3em";
  wrapper.appendChild(title);

  const list = document.createElement("ul");
  list.style.listStyleType = "none";
  list.style.padding = "0";
  
  // Dynamic page discovery using webpack's require.context
  // Scanning src/pages (parent directory)
  // Note: This relies on webpack's static analysis.
  const ctx = require.context('../', true, /\.js$/);
  
  const pages = new Set();
  
  ctx.keys().forEach(key => {
    // key examples: "./user.js", "./Matrix/Matrix.js"
    // Filter out self (home) and data directory
    if (key.includes('/home/') || key.includes('/data/')) return;
    
    const path = key.replace(/^\.\//, '');
    const parts = path.split('/');
    
    let pageName = null;
    
    if (parts.length === 1) {
      // e.g. "user.js"
      pageName = parts[0].replace(/\.js$/, '');
    } else if (parts.length === 2) {
      // e.g. "Matrix/Matrix.js"
      const folder = parts[0];
      const file = parts[1].replace(/\.js$/, '');
      if (folder === file || file === 'index') {
        pageName = folder;
      }
    }
    
    if (pageName) {
      pages.add(pageName);
    }
  });

  const sortedPages = Array.from(pages).sort();
  
  if (sortedPages.length === 0) {
     const empty = document.createElement("p");
     empty.textContent = "No pages found.";
     wrapper.appendChild(empty);
  } else {
      sortedPages.forEach(page => {
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        
        const a = document.createElement("a");
        a.href = `?page=${page}`;
        a.textContent = page;
        a.style.color = "#0366d6";
        a.style.textDecoration = "none";
        a.style.fontSize = "16px";
        
        a.addEventListener('mouseenter', () => a.style.textDecoration = "underline");
        a.addEventListener('mouseleave', () => a.style.textDecoration = "none");
        
        li.appendChild(a);
        list.appendChild(li);
      });
      wrapper.appendChild(list);
  }

  container.appendChild(wrapper);
}
