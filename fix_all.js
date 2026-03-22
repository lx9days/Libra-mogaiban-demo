const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.svg')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('d:/workspace/libra-实验室版/svg');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  
  if (content.includes('鈭?')) {
    content = content.replace(/鈭\?/g, '-');
    changed = true;
  }
  
  // Also check if any file has \u2212 and replace it
  if (content.includes('\u2212')) {
    content = content.replace(/\u2212/g, '-');
    changed = true;
  }
  
  // Fix y-axis header PPT compatibility (inline transform)
  const regexInlineTransform = /style="[^"]*transform:\s*translate\(([^p,]+)(?:px)?,\s*([^p,]+)(?:px)?\)\s*rotate\(([^d]+)(?:deg)?\);?[^"]*"/g;
  if (regexInlineTransform.test(content)) {
    content = content.replace(regexInlineTransform, 'transform="translate(, ) rotate()"');
    changed = true;
  }
  
  if (changed) {
    console.log('Fixed', f);
    fs.writeFileSync(f, content, 'utf8');
  }
});
