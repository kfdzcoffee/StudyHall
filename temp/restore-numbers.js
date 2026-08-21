// 从备份文件提取原始 number 映射，并更新当前 index.json
const fs = require('fs');

const BACKUP = 'd:/BaiduSyncdisk/学习/高考复习/网页/temp/index_corrupted_backup.json';
const INDEX = 'd:/BaiduSyncdisk/学习/高考复习/网页/错题库/index.json';

// 1. 从备份文件提取原始 number 映射
const raw = fs.readFileSync(BACKUP, 'utf8').replace(/^\uFEFF/, '');
const firstNul = raw.indexOf('\u0000');
const before = raw.substring(0, firstNul);
const after = raw.substring(firstNul).replace(/\u0000/g, '');
const combined = before + '\n' + after;

const re = /"number":\s*"([^"]+)",\s*"type":\s*"([^"]+)",\s*"subject":\s*"([^"]+)",\s*"file":\s*"([^"]+)",\s*"n":\s*(\d+)/g;
let m;
const numberMap = {}; // key: subject-n -> number
while ((m = re.exec(combined)) !== null) {
  const key = m[3] + '-' + m[5];
  if (!numberMap[key]) numberMap[key] = m[1];
}
console.log('从备份恢复的原始 number 映射数:', Object.keys(numberMap).length);

// 2. 读取当前 index.json
const curRaw = fs.readFileSync(INDEX, 'utf8').replace(/^\uFEFF/, '');
const records = JSON.parse(curRaw);

// 3. 更新 number
let updated = 0;
for (const r of records) {
  const key = r.subject + '-' + r.n;
  if (numberMap[key] && numberMap[key] !== r.number) {
    r.number = numberMap[key];
    updated++;
  }
}
console.log('更新了', updated, '条记录的 number');

// 4. 写回
fs.writeFileSync(INDEX, JSON.stringify(records, null, 4), 'utf8');
console.log('已写回 index.json，共', records.length, '条记录');
