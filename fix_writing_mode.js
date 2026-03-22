const fs = require('fs');
const files = [
  'd:/workspace/libra-实验室版/svg/lens.svg',
  'd:/workspace/libra-实验室版/svg/brush-lens/brush-lens-fail.svg'
];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  
  if (content.includes('writing-mode="tb"')) {
    content = content.replace(/writing-mode="tb"/g, '');
    changed = true;
  }
  if (content.includes('rotate(180)')) {
    content = content.replace(/rotate\(180\)/g, 'rotate(-90)');
    changed = true;
  }
  if (content.includes('rotate(180deg)')) {
    content = content.replace(/rotate\(180deg\)/g, 'rotate(-90)');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed writing-mode in', f);
  }
});
