export default function init(data) {
  const h1 = document.querySelector('h1');
  if (h1) h1.textContent = 'User 页面（配对 JS + JSON）';

  const info = document.createElement('p');
  info.textContent = '已根据 URL 后缀加载 user.js 和 user.json。';
  document.body.appendChild(info);

  if (data) {
    const pre = document.createElement('pre');
    pre.style.background = '#eef';
    pre.style.padding = '10px';
    pre.style.borderRadius = '6px';
    pre.textContent = JSON.stringify(data, null, 2);
    document.body.appendChild(pre);
  }
}