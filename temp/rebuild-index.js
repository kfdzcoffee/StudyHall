// 重建 index.json 脚本
// 从被破坏的 index.json 中恢复能恢复的记录，从各科 md 文件补全缺失记录
const fs = require('fs');
const path = require('path');

const BASE = 'd:/BaiduSyncdisk/学习/高考复习/网页';
const INDEX_PATH = path.join(BASE, '错题库/index.json');

// ========== 1. 从被破坏的 index.json 提取能恢复的记录 ==========
function extractRecoverable() {
  const raw = fs.readFileSync(INDEX_PATH, 'utf8').replace(/^\uFEFF/, '');
  const firstNul = raw.indexOf('\u0000');
  const before = raw.substring(0, firstNul); // 空字符前（历史 n=1-9 完好）
  const after = raw.substring(firstNul).replace(/\u0000/g, ''); // 空字符后（清理）

  const records = [];

  // 解析空字符前的完整 JSON 数组（历史 n=1-9）
  // 空字符前的内容以 "n": 9, 结尾，缺少闭合的 } 和 ]，需要补全
  try {
    const parsed = JSON.parse(before);
    records.push(...parsed);
  } catch (e) {
    // 尝试补全闭合后解析
    try {
      const fixed = before + '\n    }\n]';
      const parsed = JSON.parse(fixed);
      records.push(...parsed);
    } catch (e2) {
      console.log('空字符前解析失败（预期，因为结构不完整）:', e2.message);
    }
  }

  // 解析空字符后的内容（清理空字符后，用正则提取每条记录）
  // 空字符后的内容结构被破坏，但数据字段可读
  // 用正则匹配完整的记录块
  const recordRegex = /\{\s*"number":\s*"([^"]+)",\s*"type":\s*"([^"]+)",\s*"subject":\s*"([^"]+)",\s*"file":\s*"([^"]+)",\s*"n":\s*(\d+),\s*"familiarity":\s*"([^"]+)",\s*"group":\s*"([^"]*)",\s*"source":\s*"([^"]*)",\s*"date":\s*"([^"]*)",\s*"linkedPapers":\s*\[\s*\],\s*"createdAt":\s*"([^"]*)",\s*"updatedAt":\s*"([^"]*)"\s*\}/g;
  let m;
  while ((m = recordRegex.exec(after)) !== null) {
    records.push({
      number: m[1],
      type: m[2],
      subject: m[3],
      file: m[4],
      n: parseInt(m[5], 10),
      familiarity: m[6],
      group: m[7],
      source: m[8],
      date: m[9],
      linkedPapers: [],
      createdAt: m[10],
      updatedAt: m[11]
    });
  }

  return records;
}

// ========== 2. 从各科 md 文件扫描错题 ==========
function scanMdFiles() {
  const subjects = ['数学', '语文', '英语', '地理', '历史', '政治'];
  const result = {}; // subject -> [{n, title, source, date}]

  for (const subject of subjects) {
    const file = path.join(BASE, `${subject}.md`);
    if (!fs.existsSync(file)) {
      console.log(`文件不存在: ${file}`);
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    const errors = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 匹配错题标题
      const titleMatch = line.match(/^#{2,4}\s*错题\s*(\d+)\s*[：:]\s*(.+)$/);
      if (titleMatch) {
        if (current) errors.push(current);
        current = { n: parseInt(titleMatch[1], 10), title: titleMatch[2].trim(), source: '', date: '' };
        continue;
      }
      // 匹配来源和日期
      if (current) {
        // 格式1: - **来源**：xxx  /  - **录入时间**：xxx
        const sourceMatch = line.match(/^-\s*\*\*来源\*\*\s*[：:]\s*(.+)$/);
        if (sourceMatch) { current.source = sourceMatch[1].trim(); continue; }
        const dateMatch = line.match(/^-\s*\*\*录入时间\*\*\s*[：:]\s*(.+)$/);
        if (dateMatch) { current.date = dateMatch[1].trim(); continue; }
        // 格式2: > **来源**：xxx &nbsp;|&nbsp; **录入日期**：xxx &nbsp;|&nbsp; **错因**：xxx
        const metaMatch = line.match(/^>\s*\*\*来源\*\*\s*[：:]\s*(.+?)\s*&nbsp;\|\s*&nbsp;\s*\*\*录入日期\*\*\s*[：:]\s*(.+?)(?:\s*&nbsp;\|\s*&nbsp;.*)?$/);
        if (metaMatch) {
          current.source = metaMatch[1].trim();
          current.date = metaMatch[2].trim();
          continue;
        }
      }
    }
    if (current) errors.push(current);
    result[subject] = errors;
  }

  return result;
}

// ========== 3. 生成唯一编号 ==========
function generateNumber(subject, n) {
  // 生成类似 E-2026-xxxxxx 的编号
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `E-2026-${id}`;
}

// ========== 主流程 ==========
function main() {
  // 1. 提取可恢复的记录
  const recovered = extractRecoverable();
  console.log(`从被破坏文件恢复的记录数: ${recovered.length}`);

  // 2. 扫描 md 文件
  const mdData = scanMdFiles();
  for (const [subject, errors] of Object.entries(mdData)) {
    console.log(`${subject}: ${errors.length} 个错题`);
  }

  // 3. 建立 subject+n -> 记录的映射（用于去重和补全）
  const recoveredMap = new Map();
  for (const r of recovered) {
    const key = `${r.subject}-${r.n}`;
    if (!recoveredMap.has(key)) {
      recoveredMap.set(key, r);
    }
  }

  // 4. 合并：以 md 文件为准，补全缺失记录
  const finalRecords = [];
  const usedKeys = new Set();

  // 先处理 md 文件中的所有错题
  for (const [subject, errors] of Object.entries(mdData)) {
    for (const err of errors) {
      const key = `${subject}-${err.n}`;
      const existing = recoveredMap.get(key);
      if (existing) {
        // 用 md 文件的信息补全缺失字段
        existing.type = err.title;
        if (!existing.source && err.source) existing.source = err.source;
        if (!existing.date && err.date) existing.date = err.date;
        finalRecords.push(existing);
      } else {
        // 新建记录
        finalRecords.push({
          number: generateNumber(subject, err.n),
          type: err.title,
          subject: subject,
          file: `${subject}.md`,
          n: err.n,
          familiarity: 'medium',
          group: '',
          source: err.source,
          date: err.date,
          linkedPapers: [],
          createdAt: '',
          updatedAt: ''
        });
      }
      usedKeys.add(key);
    }
  }

  // 5. 检查是否有 md 文件中没有但 recovered 中有的记录（不应存在，但保险起见）
  for (const [key, r] of recoveredMap) {
    if (!usedKeys.has(key)) {
      console.log(`警告: recovered 中有但 md 中没有的记录: ${key}`);
      finalRecords.push(r);
    }
  }

  // 6. 排序：按科目顺序 + n
  const subjectOrder = { '数学': 0, '语文': 1, '英语': 2, '地理': 3, '历史': 4, '政治': 5 };
  finalRecords.sort((a, b) => {
    const sa = subjectOrder[a.subject] ?? 99;
    const sb = subjectOrder[b.subject] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.n - b.n;
  });

  // 7. 输出
  const output = JSON.stringify(finalRecords, null, 4);
  fs.writeFileSync(INDEX_PATH, output, 'utf8');
  console.log(`\n重建完成! 共 ${finalRecords.length} 条记录`);
  const counts = {};
  finalRecords.forEach(r => { counts[r.subject] = (counts[r.subject] || 0) + 1; });
  console.log('各科记录数:', JSON.stringify(counts));
}

main();
