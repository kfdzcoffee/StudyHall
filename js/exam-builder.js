// 选题组卷插件 v2 - 勾选错题生成 Word 试卷
(function() {
  'use strict';

  const STORAGE_KEY = 'exam-builder-v2';
  const state = {
    selectedIds: new Set(),
    options: { includeAnalysis: true, includeSource: true, includeAnswer: false, includeSimilar: false }
  };

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s) {
        state.selectedIds = new Set(s.selectedIds || []);
        if (s.options) Object.assign(state.options, s.options);
      }
    } catch(e) {}
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedIds: [...state.selectedIds],
      options: state.options
    }));
  }

  // Docsify plugin
  if (!window.$docsify) window.$docsify = {};
  if (!window.$docsify.plugins) window.$docsify.plugins = [];
  window.$docsify.plugins.push(function(hook) {
    hook.doneEach(function() {
      loadState();
      setTimeout(function() {
        injectCheckboxes();
        renderToolbar();
      }, 200);
    });
  });

  function injectCheckboxes() {
    var content = document.querySelector('.markdown-section');
    if (!content) return;
    var h4s = content.querySelectorAll('h4');
    h4s.forEach(function(h4) {
      var text = h4.textContent || '';
      if (!text.match(/错题\s*\d+/)) return;
      if (h4.querySelector('.qb-checkbox')) return;
      var id = h4.id || text.trim().replace(/\s+/g, '-').replace(/[：:]/g, '-');

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'qb-checkbox';
      cb.dataset.qid = id;
      cb.checked = state.selectedIds.has(id);

      cb.addEventListener('change', function() {
        if (cb.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
        saveState();
        updateToolbar();
      });

      h4.style.display = 'flex';
      h4.style.alignItems = 'flex-start';
      h4.insertBefore(cb, h4.firstChild);
    });
  }

  function renderToolbar() {
    var existing = document.getElementById('qb-toolbar');
    if (existing) existing.remove();

    var tb = document.createElement('div');
    tb.id = 'qb-toolbar';
    tb.className = 'qb-toolbar';
    tb.innerHTML =
      '<span style="color:#666;">已选：</span>' +
      '<span class="qb-count"><span id="qb-num">' + state.selectedIds.size + '</span> 题</span>' +
      '<button class="qb-btn qb-btn-outline" id="qb-btn-options">选项</button>' +
      '<button class="qb-btn qb-btn-primary" id="qb-btn-generate">生成试卷</button>' +
      '<button class="qb-btn qb-btn-danger" id="qb-btn-clear">清空</button>';
    document.body.appendChild(tb);

    document.getElementById('qb-btn-options').addEventListener('click', showOptionsModal);
    document.getElementById('qb-btn-generate').addEventListener('click', generateExam);
    document.getElementById('qb-btn-clear').addEventListener('click', clearSelection);

    // Options modal
    var modal = document.createElement('div');
    modal.id = 'qb-modal';
    modal.className = 'qb-modal-overlay';
    modal.innerHTML =
      '<div class="qb-modal">' +
      '<h3>试卷选项</h3>' +
      '<label><input type="checkbox" id="qb-opt-analysis" ' + (state.options.includeAnalysis ? 'checked' : '') + '> 包含解析</label>' +
      '<label><input type="checkbox" id="qb-opt-source" ' + (state.options.includeSource ? 'checked' : '') + '> 包含来源</label>' +
      '<label><input type="checkbox" id="qb-opt-answer" ' + (state.options.includeAnswer ? 'checked' : '') + '> 包含正确答案</label>' +
      '<label><input type="checkbox" id="qb-opt-similar" ' + (state.options.includeSimilar ? 'checked' : '') + '> 包含同类题巩固</label>' +
      '<div class="qb-modal-actions">' +
      '<button class="qb-btn qb-btn-outline" id="qb-modal-cancel">取消</button>' +
      '<button class="qb-btn qb-btn-primary" id="qb-modal-confirm">确认</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    document.getElementById('qb-modal-cancel').addEventListener('click', function() {
      modal.classList.remove('active');
    });
    document.getElementById('qb-modal-confirm').addEventListener('click', function() {
      state.options.includeAnalysis = document.getElementById('qb-opt-analysis').checked;
      state.options.includeSource = document.getElementById('qb-opt-source').checked;
      state.options.includeAnswer = document.getElementById('qb-opt-answer').checked;
      state.options.includeSimilar = document.getElementById('qb-opt-similar').checked;
      saveState();
      modal.classList.remove('active');
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  function showOptionsModal() {
    document.getElementById('qb-opt-analysis').checked = state.options.includeAnalysis;
    document.getElementById('qb-opt-source').checked = state.options.includeSource;
    document.getElementById('qb-opt-answer').checked = state.options.includeAnswer;
    document.getElementById('qb-opt-similar').checked = state.options.includeSimilar;
    document.getElementById('qb-modal').classList.add('active');
  }

  function updateToolbar() {
    var el = document.getElementById('qb-num');
    if (el) el.textContent = state.selectedIds.size;
  }

  function clearSelection() {
    if (state.selectedIds.size === 0) return;
    if (!confirm('确定清空全部 ' + state.selectedIds.size + ' 道已选题目？')) return;
    state.selectedIds.clear();
    saveState();
    document.querySelectorAll('.qb-checkbox').forEach(function(cb) { cb.checked = false; });
    updateToolbar();
  }

  function extractQuestion(h4) {
    var data = { id: h4.id, title: h4.textContent.replace(/^错题\s*\d+[：:]\s*/, '').trim(), fullTitle: h4.textContent.trim(), html: '' };
    var blocks = [];
    var el = h4.nextElementSibling;
    while (el && el.tagName !== 'H4') {
      blocks.push(el.outerHTML);
      el = el.nextElementSibling;
    }
    data.html = blocks.join('\n');
    return data;
  }

  function getPageSubject() {
    var h1 = document.querySelector('.markdown-section h1');
    if (h1) {
      var t = h1.textContent;
      if (t.includes('数学')) return '数学';
      if (t.includes('语文')) return '语文';
      if (t.includes('英语')) return '英语';
      if (t.includes('地理')) return '地理';
      if (t.includes('历史')) return '历史';
      if (t.includes('政治')) return '政治';
    }
    return '';
  }

  function generateExam() {
    if (state.selectedIds.size === 0) { alert('请先勾选题目'); return; }

    var allH4s = document.querySelectorAll('.markdown-section h4');
    var questions = [];
    var subject = getPageSubject();

    allH4s.forEach(function(h4) {
      var id = h4.id || h4.textContent.trim().replace(/\s+/g, '-').replace(/[：:]/g, '-');
      if (state.selectedIds.has(id)) {
        questions.push(extractQuestion(h4));
      }
    });

    if (questions.length === 0) { alert('当前页面没有已选中的题目，请切换到对应学科页面'); return; }

    var now = new Date();
    var dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';
    var title = (subject || '综合') + '错题组卷 - ' + dateStr;

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="utf-8"><title>' + title + '</title>';
    html += '<style>body{font-family:"Microsoft YaHei",SimSun,sans-serif;font-size:14px;line-height:1.8;padding:40px;}h1{text-align:center;font-size:22px;margin-bottom:30px;}h3{font-size:16px;color:#333;margin-top:24px;}p{margin:6px 0;}.source{color:#999;font-size:12px;}.analysis{background:#f9f9f9;padding:10px;border-left:3px solid #4a90d9;margin:8px 0;}hr{border:none;border-top:1px dashed #ddd;margin:20px 0;}blockquote{color:#888;font-style:italic;margin:8px 0;padding-left:12px;border-left:3px solid #ddd;}table{border-collapse:collapse;width:100%;margin:8px 0;}table td,table th{border:1px solid #ddd;padding:6px 10px;}</style>';
    html += '</head><body>';
    html += '<h1>' + title + '</h1>';
    html += '<p style="text-align:center;color:#999;">共 ' + questions.length + ' 题 | 生成时间：' + dateStr + '</p>';

    questions.forEach(function(q, i) {
      html += '<h3>' + (i+1) + '. ' + q.title + '</h3>';

      // Parse blocks to selectively include content
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = q.html;
      var children = tempDiv.children;
      var inAnalysis = false, inSimilar = false, skipUntilNext = false;

      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        var text = child.textContent || '';

        if (text.includes('错因分析') || text.includes('正确解法') || text.includes('关键步骤')) {
          inAnalysis = true;
        }
        if (text.includes('同类题巩固')) {
          inSimilar = true;
        }

        if (text.includes('正确答案') || text.includes('手写答案')) {
          if (!state.options.includeAnswer) continue;
        }

        if ((text.includes('**来源**') || text.includes('录入日期') || text.includes('错因')) && child.tagName === 'BLOCKQUOTE') {
          if (!state.options.includeSource) continue;
          html += '<p class="source">' + child.innerHTML + '</p>';
          continue;
        }

        if (inAnalysis) {
          if (!state.options.includeAnalysis) continue;
        }
        if (inSimilar) {
          if (!state.options.includeSimilar) continue;
        }

        html += child.outerHTML;
      }

      html += '<hr>';
    });

    html += '</body></html>';

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[\/:*?"<>|]/g, '_') + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Initialize
  loadState();
})();
