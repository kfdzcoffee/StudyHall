// 统一各科 md 错题标题为 #### 级别，并修复地理嵌套重复标题
// 用法: node temp/fix-titles.js
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || __dirname + '/..';
const dryRun = process.argv.includes('--dry');
const files = ['数学.md', '英语.md', '地理.md'];

function readFile(fp) {
  let s = fs.readFileSync(fp, 'utf8');
  const hadBom = s.charCodeAt(0) === 0xFEFF;
  if (hadBom) s = s.slice(1);
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  return { s: s.replace(/\r\n/g, '\n'), eol, hadBom };
}
function writeFile(fp, { s, eol, hadBom }) {
  const body = s.replace(/\n/g, eol);
  fs.writeFileSync(fp, (hadBom ? '\uFEFF' : '') + body, 'utf8');
}

for (const f of files) {
  const fp = path.join(root, f);
  if (!fs.existsSync(fp)) { console.log('skip (missing):', f); continue; }
  const { s, eol, hadBom } = readFile(fp);
  let out = s;
  let count = 0;

  if (f === '数学.md') {
    // 把 ## 错题 N： 统一为 #### 错题 N：
    out = out.replace(/^## 错题 (\d+)[：:]/gm, (m, n) => { count++; return '#### 错题 ' + n + '：'; });
  } else if (f === '英语.md') {
    // 把 ### 错题 N： 统一为 #### 错题 N：
    out = out.replace(/^### 错题 (\d+)[：:]/gm, (m, n) => { count++; return '#### 错题 ' + n + '：'; });
  } else if (f === '地理.md') {
    // 把 ### 错题 N： 统一为 #### 错题 N：
    out = out.replace(/^### 错题 (\d+)[：:]/gm, (m, n) => { count++; return '#### 错题 ' + n + '：'; });
    // 删除嵌套重复标题块：#### 错题 4：错题 4：...\n\n---\n\n（该标题后无内容，只有分隔线）
    const before = out;
    out = out.replace(/^#### 错题 (\d+)[：:]\s*错题 \1[：:][^\n]*\n\n-{3,}\n\n/gm, (m, n) => { count++; return ''; });
    if (out !== before) console.log('  删除嵌套标题');
  }

  if (!dryRun) writeFile(fp, { s: out, eol, hadBom });
  console.log(f + ': 修改 ' + count + ' 处标题' + (dryRun ? ' (dry-run)' : ''));
}
console.log('done');
