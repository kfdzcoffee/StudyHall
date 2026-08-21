// ===== 修复 _sidebar.md 锚点：让链接指向唯一错题编号 =====
// 读取 错题库/index.json，把 _sidebar.md 中每个错题链接的锚点
// 从「#错题-N：标题」替换为「#E-2026-xxxxxx」（唯一错题编号）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, '错题库', 'index.json');
const SIDEBAR_FILE = path.join(ROOT, '_sidebar.md');

function readFile(fp) {
  let s = fs.readFileSync(fp, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s;
}
function writeFile(fp, content) {
  fs.writeFileSync(fp, '\uFEFF' + content, 'utf8');
}

// 读取索引
const index = JSON.parse(readFile(INDEX_FILE).replace(/^\uFEFF/, ''));
// 构建 file#n -> number 映射
const byKey = {};
index.forEach((e) => { byKey[e.file + '#' + e.n] = e.number; });

// 读取 sidebar
let sb = readFile(SIDEBAR_FILE);
const lines = sb.split('\n');
let changed = 0;
let matched = 0;

const out = lines.map((line) => {
  // 匹配错题链接：* [错题N: 标题](文件.md#错题-N：标题)
  // 注意：锚点中的标题可能含空格、全角字符等
  const re = /^(\s*\*\s*\[错题\s*\d+[^\]]*\]\(([^#]+\.md)#错题-(\d+)[^)]*\)\s*)$/;
  const m = line.match(re);
  if (m) {
    matched++;
    const file = m[2];
    const n = parseInt(m[3], 10);
    const number = byKey[file + '#' + n];
    if (number) {
      // 替换锚点为错题编号
      const newLine = line.replace(/#错题-[^)]*\)/, '#' + number + ')');
      if (newLine !== line) {
        changed++;
        return newLine;
      }
    }
  }
  return line;
});

writeFile(SIDEBAR_FILE, out.join('\n'));
console.log('匹配到错题链接: ' + matched);
console.log('已替换为错题编号: ' + changed);
