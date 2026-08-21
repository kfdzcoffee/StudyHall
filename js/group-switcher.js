// 错题组切换插件 - 按错题组筛选/切换错题
// 数据来源：错题库/groups.json（错题组定义）、错题库/index.json（错题记录，含 group 字段）
// 说明：当前 groups.json 可能为空，此时仅显示"全部"，功能框架可用；后续在错题助手桌面端添加错题组后自动生效。
(function() {
  'use strict';

  var STORAGE_KEY = 'group-switcher-v1';
  var groups = [];       // 错题组列表 [{id, name, createdAt}]
  var errorIndex = [];   // 错题记录 [{number, type, subject, file, n, group, ...}]
  var currentGroup = 'all'; // 当前选中的错题组（'all' 表示全部）

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && s.currentGroup) currentGroup = s.currentGroup;
    } catch(e) {}
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentGroup: currentGroup }));
  }

  // 加载错题组数据（通过 HTTP 服务器访问时 fetch 可用）
  function loadGroupData() {
    return Promise.all([
      fetch('错题库/groups.json').then(function(r) { return r.json(); }).catch(function() { return []; }),
      fetch('错题库/index.json').then(function(r) { return r.json(); }).catch(function() { return []; })
    ]).then(function(results) {
      groups = Array.isArray(results[0]) ? results[0] : [];
      errorIndex = Array.isArray(results[1]) ? results[1] : [];
    });
  }

  // 获取当前页面所属科目文件（如 数学.md）
  function getCurrentFile() {
    var h1 = document.querySelector('.markdown-section h1');
    if (!h1) return '';
    var t = h1.textContent;
    if (t.indexOf('数学') !== -1) return '数学.md';
    if (t.indexOf('语文') !== -1) return '语文.md';
    if (t.indexOf('英语') !== -1) return '英语.md';
    if (t.indexOf('地理') !== -1) return '地理.md';
    if (t.indexOf('历史') !== -1) return '历史.md';
    if (t.indexOf('政治') !== -1) return '政治.md';
    return '';
  }

  // 获取当前页面中属于指定错题组的错题编号集合
  // 返回：{ map: {n: groupName}, hasGroupData: bool, total: 错题总数 }
  function getPageGroupMap() {
    var file = getCurrentFile();
    if (!file) return null;
    var map = {};
    var hasGroupData = false;
    var total = 0;
    errorIndex.forEach(function(e) {
      if (e.file === file && e.n) {
        map[String(e.n)] = e.group || '';
        total++;
        if (e.group) hasGroupData = true;
      }
    });
    return { map: map, hasGroupData: hasGroupData, total: total };
  }

  // 统计当前页面各错题组的错题数量
  function countByGroup(pageInfo) {
    var counts = {};
    if (!pageInfo) return counts;
    Object.keys(pageInfo.map).forEach(function(n) {
      var g = pageInfo.map[n] || '';
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }

  // 渲染错题组筛选条（仅在有错题的科目页面显示）
  function renderGroupBar() {
    var existing = document.getElementById('qb-group-bar');
    if (existing) existing.remove();

    var pageInfo = getPageGroupMap();
    // 非科目页面（总览/分数预测等）或无错题时不显示
    if (!pageInfo || pageInfo.total === 0) return;

    var bar = document.createElement('div');
    bar.id = 'qb-group-bar';
    bar.className = 'qb-group-bar';

    var counts = countByGroup(pageInfo);
    var allCount = pageInfo.total;

    var html = '<span class="qb-group-label">错题组：</span>';
    html += '<select id="qb-group-select" class="qb-group-select">';
    html += '<option value="all"' + (currentGroup === 'all' ? ' selected' : '') + '>全部（' + allCount + '）</option>';
    groups.forEach(function(g) {
      var c = counts[g.name] || 0;
      html += '<option value="' + g.name + '"' + (currentGroup === g.name ? ' selected' : '') + '>' + g.name + '（' + c + '）</option>';
    });
    html += '</select>';
    if (groups.length === 0) {
      html += '<span class="qb-group-hint">（暂无错题组，可在错题助手桌面端添加）</span>';
    }
    bar.innerHTML = html;

    // 插入到 markdown-section 之前
    var content = document.querySelector('.markdown-section');
    if (content && content.parentNode) {
      content.parentNode.insertBefore(bar, content);
    } else {
      document.body.appendChild(bar);
    }

    var sel = document.getElementById('qb-group-select');
    if (sel) {
      sel.addEventListener('change', function() {
        currentGroup = this.value;
        saveState();
        applyGroupFilter();
      });
    }
  }

  // 应用错题组筛选：隐藏不属于当前组的错题
  function applyGroupFilter() {
    var content = document.querySelector('.markdown-section');
    if (!content) return;

    var pageInfo = getPageGroupMap();
    if (!pageInfo) return;

    var h4s = content.querySelectorAll('h4');
    h4s.forEach(function(h4) {
      var text = h4.textContent || '';
      var m = text.match(/错题\s*(\d+)/);
      if (!m) return; // 非错题标题，跳过

      var n = m[1];
      var groupName = pageInfo.map[n];

      var shouldShow;
      if (currentGroup === 'all') {
        shouldShow = true;
      } else {
        // 选中了某个错题组：只显示属于该组的错题
        shouldShow = (groupName === currentGroup);
      }

      // 隐藏/显示该错题及其后续内容（直到下一个 h4）
      h4.style.display = shouldShow ? '' : 'none';
      var el = h4.nextElementSibling;
      while (el && el.tagName !== 'H4') {
        el.style.display = shouldShow ? '' : 'none';
        el = el.nextElementSibling;
      }
    });
  }

  if (!window.$docsify) window.$docsify = {};
  if (!window.$docsify.plugins) window.$docsify.plugins = [];
  window.$docsify.plugins.push(function(hook) {
    hook.doneEach(function() {
      loadState();
      loadGroupData().then(function() {
        renderGroupBar();
        applyGroupFilter();
      });
    });
  });
})();
