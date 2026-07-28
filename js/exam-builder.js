// 选题组卷插件 v3 - 勾选错题生成 Word 试卷
(function() {
  'use strict';

  const STORAGE_KEY = 'exam-builder-v3';
  const state = {
    selectedIds: new Set(),
    examName: ''
  };

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s) state.selectedIds = new Set(s.selectedIds || []);
    } catch(e) {}
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedIds: [...state.selectedIds] }));
  }

  if (!window.$docsify) window.$docsify = {};
  if (!window.$docsify.plugins) window.$docsify.plugins = [];
  window.$docsify.plugins.push(function(hook) {
    hook.doneEach(function() {
      loadState();
      setTimeout(function() {
        injectCheckboxes();
        renderToolbar();
      }, 300);
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
      var id = h4.id || text.trim().replace(/\s+/g, '-').replace(/[：:]/g, '-').replace(/[（）()]/g, '');

      var wrapper = document.createElement('span');
      wrapper.className = 'qb-cb-wrap';

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

      wrapper.appendChild(cb);
      var span = document.createElement('span');
      span.textContent = text;
      wrapper.appendChild(span);
      h4.textContent = '';
      h4.appendChild(wrapper);
    });
  }

  function renderToolbar() {
    var existing = document.getElementById('qb-toolbar');
    if (existing) existing.remove();

    var tb = document.createElement('div');
    tb.id = 'qb-toolbar';
    tb.className = 'qb-toolbar';
    tb.innerHTML =
      '<div class="qb-tb-inner">' +
      '<div class="qb-tb-left">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>' +
      '<span>已选 <strong id="qb-num">' + state.selectedIds.size + '</strong> 题</span>' +
      '</div>' +
      '<div class="qb-tb-right">' +
      '<button class="qb-btn qb-btn-clear" id="qb-btn-clear">清空</button>' +
      '<button class="qb-btn qb-btn-go" id="qb-btn-generate">生成试卷</button>' +
      '</div></div>';
    document.body.appendChild(tb);

    document.getElementById('qb-btn-generate').addEventListener('click', showGenerateModal);
    document.getElementById('qb-btn-clear').addEventListener('click', clearSelection);

    renderGenerateModal();
  }

  function renderGenerateModal() {
    var existing = document.getElementById('qb-generate-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'qb-generate-modal';
    modal.className = 'qb-modal-overlay';
    modal.innerHTML =
      '<div class="qb-modal">' +
      '<div class="qb-modal-header">生成试卷</div>' +
      '<div class="qb-modal-body">' +
      '<div class="qb-field">' +
      '<label>试卷名称</label>' +
      '<input type="text" id="qb-exam-name" placeholder="例：数学错题组卷 - 函数与导数" />' +
      '</div>' +
      '<div class="qb-field qb-field-check">' +
      '<label class="qb-check-label">' +
      '<input type="checkbox" id="qb-opt-analysis" checked />' +
      '<span class="qb-check-mark"></span>' +
      '在末尾附带解析与答案' +
      '</label>' +
      '</div>' +
      '</div>' +
      '<div class="qb-modal-footer">' +
      '<button class="qb-btn qb-btn-outline" id="qb-modal-cancel">取消</button>' +
      '<button class="qb-btn qb-btn-primary" id="qb-modal-confirm">生成 Word 文档</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    document.getElementById('qb-modal-cancel').addEventListener('click', function() {
      modal.classList.remove('active');
    });
    document.getElementById('qb-modal-confirm').addEventListener('click', doGenerateExam);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  function showGenerateModal() {
    if (state.selectedIds.size === 0) {
      var tb = document.getElementById('qb-toolbar');
      tb.classList.add('qb-shake');
      setTimeout(function() { tb.classList.remove('qb-shake'); }, 500);
      return;
    }

    // 自动生成默认试卷名
    var subject = getPageSubject();
    var now = new Date();
    var dateStr = now.getFullYear() + '.' + (now.getMonth()+1) + '.' + now.getDate();
    var defaultName = (subject || '综合') + '错题组卷 ' + dateStr;
    var nameInput = document.getElementById('qb-exam-name');
    if (nameInput && !nameInput.value) nameInput.value = defaultName;

    document.getElementById('qb-generate-modal').classList.add('active');
    setTimeout(function() {
      var inp = document.getElementById('qb-exam-name');
      if (inp) inp.focus();
    }, 100);
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
    var data = { id: h4.id, title: '', fullTitle: '', html: '', analysisHtml: '' };
    var cbWrap = h4.querySelector('.qb-cb-wrap span');
    data.fullTitle = cbWrap ? cbWrap.textContent.trim() : h4.textContent.trim();
    data.title = data.fullTitle.replace(/^错题\s*\d+[：:]\s*/, '').trim();

    var blocks = [];
    var analysisBlocks = [];
    var el = h4.nextElementSibling;
    var inAnalysis = false, inSimilar = false;

    while (el && el.tagName !== 'H4') {
      var text = el.textContent || '';

      if (text.match(/错因分析|正确解法|关键步骤/)) {
        inAnalysis = true;
      }
      if (text.match(/同类题巩固/)) {
        inSimilar = true;
      }

      if (inAnalysis && !inSimilar) {
        analysisBlocks.push(el.outerHTML);
      } else {
        blocks.push(el.outerHTML);
      }

      el = el.nextElementSibling;
    }

    data.html = blocks.join('\n');
    data.analysisHtml = analysisBlocks.join('\n');
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

  function doGenerateExam() {
    if (state.selectedIds.size === 0) return;

    var examName = document.getElementById('qb-exam-name').value.trim();
    if (!examName) examName = (getPageSubject() || '综合') + '错题组卷';
    var includeAnalysis = document.getElementById('qb-opt-analysis').checked;

    document.getElementById('qb-generate-modal').classList.remove('active');

    var allH4s = document.querySelectorAll('.markdown-section h4');
    var questions = [];

    allH4s.forEach(function(h4) {
      var cbWrap = h4.querySelector('.qb-cb-wrap span');
      var raw = cbWrap ? cbWrap.textContent.trim() : h4.textContent.trim();
      var id = h4.id || raw.replace(/\s+/g, '-').replace(/[：:]/g, '-').replace(/[（）()]/g, '');
      if (state.selectedIds.has(id)) {
        questions.push(extractQuestion(h4));
      }
    });

    if (questions.length === 0) { alert('当前页面没有已选中的题目，请切换到对应学科页面'); return; }

    var now = new Date();
    var dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="utf-8"><title>' + examName + '</title>';
    html += '<style>@page{margin:2.54cm 3.18cm 2.54cm 3.18cm;}' +
      'body{font-family:SimSun,宋体,serif;font-size:14pt;line-height:1.8;color:#000;}' +
      'h1{font-family:STZhongsong,华文中宋,SimSun,serif;font-size:16pt;font-weight:bold;text-align:center;margin-bottom:24pt;}' +
      'h3{font-family:SimSun,宋体,serif;font-size:14pt;font-weight:bold;margin:18pt 0 8pt 0;}' +
      'p,li,blockquote,table{font-family:SimSun,宋体,serif;font-size:14pt;margin:6pt 0;}' +
      '.subtitle{text-align:center;font-size:12pt;color:#666;margin-bottom:24pt;}' +
      '.analysis-section{border-top:1pt solid #000;margin-top:24pt;padding-top:12pt;}' +
      '.analysis-section h2{font-family:STZhongsong,华文中宋,SimSun,serif;font-size:16pt;font-weight:bold;text-align:center;margin-bottom:18pt;}' +
      '.analysis-item{margin:12pt 0;}' +
      '.analysis-item h3{font-size:14pt;font-weight:bold;}' +
      '.source-tag{font-size:10pt;color:#888;}' +
      'hr{border:none;border-top:1pt dashed #999;margin:16pt 0;}' +
      'blockquote{color:#555;margin:8pt 0;padding-left:12pt;border-left:3pt solid #ccc;}' +
      'table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:12pt;}' +
      'table td,table th{border:1pt solid #000;padding:4pt 8pt;}</style>';
    html += '</head><body>';

    // 试卷标题
    html += '<h1>' + examName + '</h1>';
    html += '<p class="subtitle">共 ' + questions.length + ' 题 | ' + dateStr + '</p>';

    // 题目正文
    questions.forEach(function(q, i) {
      html += '<h3>' + (i+1) + '. ' + q.title + '</h3>';

      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = q.html;
      var children = tempDiv.children;

      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        var text = child.textContent || '';

        // 来源信息小字显示
        if ((text.includes('来源') || text.includes('录入日期') || text.includes('错因')) && child.tagName === 'BLOCKQUOTE') {
          html += '<p class="source-tag">' + child.textContent.replace(/\n/g, ' ').trim() + '</p>';
          continue;
        }

        // 题干用 p
        if (text.includes('题干') && child.tagName === 'P') {
          var strongs = child.querySelectorAll('strong');
          strongs.forEach(function(s) { s.outerHTML = s.textContent; });
          html += '<p>' + child.textContent.replace(/^\*\*题干\*\*[：:]?\s*/, '').trim() + '</p>';
          continue;
        }

        html += child.outerHTML;
      }

      html += '<hr>';
    });

    // 解析部分
    if (includeAnalysis) {
      html += '<div class="analysis-section">';
      html += '<h2>解析与答案</h2>';

      questions.forEach(function(q, i) {
        html += '<div class="analysis-item">';
        html += '<h3>' + (i+1) + '. ' + q.title + '</h3>';

        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = q.analysisHtml;
        var children = tempDiv.children;

        for (var j = 0; j < children.length; j++) {
          html += children[j].outerHTML;
        }

        html += '</div>';
      });

      html += '</div>';
    }

    html += '</body></html>';

    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = examName.replace(/[\/:*?"<>|]/g, '_') + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  loadState();
})();
