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
let issues = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('\u2212') || content.includes('鈭') || content.includes('writing-mode="tb"') || /style="[^"]*transform:\s*translate/.test(content)) {
    console.log('Issue found in:', f);
    issues++;
  }
});
console.log('Total issues:', issues);
