const fs = require('fs');
const content = fs.readFileSync('d:/workspace/libra-实验室版/svg/groupSelection/gS-pan.svg');
const str = content.toString('utf8');
const idx = str.indexOf('000000" y="9" dy="0.71em">');
console.log(str.slice(idx, idx+100));
