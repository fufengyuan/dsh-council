// dsh-council client bundle: 侧边栏入口 + 全屏 DAG 面板 + 设置页成员配置
window.__ModuleLoader__.load({
  id: 'dsh-council',
  factory: function(require) {
    var React = require('react');

    var STATUS_CN = { pending: '等待', running: '进行中', done: '已完成', error: '出错' };
    var MODE_CN = { triad: '三人组', quick: '快速', duo: '二人对辩', full: '全体18人' };
    function statusColor(st) {
      if (st === 'done') return '#22a06b';
      if (st === 'running') return '#e2a400';
      if (st === 'error') return '#d13239';
      return 'var(--text-muted,#999)';
    }

    // ---------- API helpers ----------
    function getJSON(path) { return fetch(path).then(function(r){ return r.json(); }); }
    function putJSON(path, body) {
      return fetch(path, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(body) }).then(function(r){ return r.json(); });
    }

    // 注入全局样式（一次性）
    function injectStyles() {
      if (document.getElementById('dsh-council-styles')) return;
      var st = document.createElement('style');
      st.id = 'dsh-council-styles';
      st.textContent = [
        '.council-root { position: relative; display: inline-flex; }',
        '.council-trigger { height:28px; padding:0 10px; border:0; border-radius:7px; display:inline-flex; align-items:center; gap:6px;',
        '  color:var(--text-secondary,#666); background:transparent; font:inherit; font-size:12px; cursor:pointer; transition:background .15s,color .15s; }',
        '.council-trigger:hover, .council-trigger[aria-expanded="true"] { color:var(--text-primary,#222); background:var(--surface-secondary,rgba(0,0,0,.05)); }',
        '.council-live-dot { width:6px; height:6px; border-radius:50%; background:#e2a400; box-shadow:0 0 0 3px rgba(226,164,0,.25); animation:council-pulse 1s infinite alternate; }',
        '@keyframes council-pulse { from{opacity:.4} to{opacity:1} }',
        '.council-backdrop { position:fixed; inset:0; z-index:2147482000; background:rgba(0,0,0,.16); display:grid; place-items:center; }',
        '.council-panel { position:relative; z-index:2147482001; width:min(860px,calc(100vw - 32px)); max-height:min(720px,calc(100vh - 40px)); overflow:auto;',
        '  background:var(--surface-primary,#fff); border:1px solid var(--border,#ddd); border-radius:12px; box-shadow:0 18px 60px rgba(0,0,0,.22); padding:16px 18px; }',
        '.council-panel h3 { margin:0 0 2px 0; font-size:15px; }',
        '.council-panel .sub { margin:0 0 14px 0; font-size:11px; color:var(--text-muted,#888); }',
        '.council-row { display:flex; align-items:center; gap:10px; padding:7px 10px; border-bottom:1px solid var(--border,#eee); }',
        '.council-row:last-child { border-bottom:none; }',
        '.council-member-label { width:150px; font-weight:600; font-size:13px; }',
        '.council-member-lens { flex:1; font-size:12px; color:var(--text-secondary,#777); }',
        '.council-node { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:16px; font-size:12px; border:1.5px solid var(--dsw-alias-border-l2, #ccc); }',
        '.council-node-dot { width:8px; height:8px; border-radius:50%; }',
        '.council-round-title { font-size:11px; font-weight:700; letter-spacing:.5px; color:var(--text-muted,#888); margin:10px 0 6px; text-transform:uppercase; }',
        '.council-select { color-scheme: light dark; height:28px; padding:0 24px 0 8px; border-radius:6px;',
        '  border:1px solid var(--dsw-alias-border-l2, var(--border,#ccc));',
        '  background:var(--dsw-alias-bg-layer-1, var(--surface-primary,#fff));',
        '  color:var(--dsw-alias-label-primary, inherit); font-size:12px; cursor:pointer;',
        '  appearance:none; -webkit-appearance:none;',
        '  background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' fill=\'none\'%3E%3Cpath d=\'M3 4.5L6 7.5L9 4.5\' stroke=\'%2381858C\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E");',
        '  background-repeat:no-repeat; background-position:right 6px center; background-size:12px 12px; }',
        '.council-select:focus { border-color:var(--dsw-alias-brand-primary, #6366f1); outline:none; }',
        '.council-select option { background:var(--dsw-alias-bg-layer-1, #fff); color:var(--dsw-alias-label-primary, #222); padding:4px 8px; }',
        '.council-save-btn { border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;',
        '  background:var(--dsw-alias-brand-primary, #6366f1); color:#fff; transition:opacity .15s; }',
        '.council-save-btn:hover:not(:disabled) { opacity:.88; }',
        '.council-save-btn:disabled { opacity:.5; cursor:default; }',
        '.council-input-toggle { height:30px; padding:0 10px; border-radius:8px; border:none; cursor:pointer;',
        '  font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px;',
        '  color:var(--dsw-alias-label-tertiary, var(--text-secondary,#888));',
        '  background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); transition:all .15s; }',
        '.council-input-toggle:hover { background:var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.18)); }',
        '.council-input-toggle--on { color:#fff; background:var(--dsw-alias-brand-primary, #6366f1); }',
        '.council-input-toggle--on:hover { opacity:.88; background:var(--dsw-alias-brand-primary, #6366f1); }',
        '.council-input-toggle-dot { width:6px; height:6px; border-radius:50%; background:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.3); }',
        '.council-input-toggle-state { font-size:10px; opacity:.85; }'
      ].join('\n');
      document.head.appendChild(st);
    }

    // ---------- 数据 hooks ----------
    function useRoster() {
      var s = React.useState(null); var v = s[0], set = s[1];
      React.useEffect(function() { getJSON('/council/api/roster').then(set).catch(function(){}); }, []);
      return [v, set];
    }
    function useRuns() {
      var s = React.useState(null);
      React.useEffect(function() {
        var iv = setInterval(function(){ getJSON('/council/api/runs').then(s[1]).catch(function(){}); }, 3000);
        getJSON('/council/api/runs').then(s[1]).catch(function(){});
        return function(){ clearInterval(iv); };
      }, []);
      return s[0];
    }
    function useProgress(runId) {
      var s = React.useState(null); var v = s[0], set = s[1];
      React.useEffect(function() {
        if (!runId) return;
        var iv = setInterval(function(){ getJSON('/council/api/progress?runId='+encodeURIComponent(runId)).then(set).catch(function(){}); }, 1500);
        getJSON('/council/api/progress?runId='+encodeURIComponent(runId)).then(set).catch(function(){});
        return function(){ clearInterval(iv); };
      }, [runId]);
      return v;
    }
    function useModels() {
      var s = React.useState(null);
      React.useEffect(function() { getJSON('/council/api/models').then(s[1]).catch(function(){}); }, []);
      return s[0];
    }

    // ---------- 设置面板：成员配置 ----------
    function CouncilSettings() {
      var rs = useRoster();
      var roster = rs[0], setRoster = rs[1];
      var modelData = useModels();
      var sv = React.useState(false); var isSaving = sv[0], setSaving = sv[1];
      var nt = React.useState(''); var notice = nt[0], setNotice = nt[1];
      if (!roster) return React.createElement('div', null, '加载中…');
      var models = (modelData && modelData.models) || [];
      var e = React.createElement;
      function upd(id, patch) {
        setRoster(Object.assign({}, roster, { roster: roster.roster.map(function(m){ return m.id===id?Object.assign({},m,patch):m; }) }));
      }
      function save() {
        setSaving(true);
        var members = {};
        roster.roster.forEach(function(m){ members[m.id] = { enabled: !!m.enabled, model: m.model || '' }; });
        putJSON('/council/api/config', { members: members, chairman: roster.chairman||'', mode: roster.mode||'triad' })
          .then(function(){ setSaving(false); setNotice('✓ 已保存'); setTimeout(function(){setNotice('');},2000); })
          .catch(function(){ setSaving(false); setNotice('❌ 保存失败'); });
      }
      return e('div', { style:{maxWidth:720} },
        e('h3', null, '🧠 议会（Council）成员配置'),
        e('p', { className:'sub' }, '勾选参与辩论的成员；可为每位成员选择模型（默认则用当前对话模型）；主席负责汇总最终裁决。保存后下次辩论生效。'),
        e('div', { style:{display:'flex',gap:14,marginBottom:10} },
          e('label', { style:{fontSize:13} }, '主席: ',
            e('select', { className:'council-select', value: roster.chairman||'', onChange:function(ev){ setRoster(Object.assign({},roster,{chairman:ev.target.value})); }, style:{marginLeft:6} },
              e('option', { value:'' }, '（自动选择）'),
              roster.roster.map(function(m){ return e('option',{key:m.id,value:m.id},m.label); }))),
          e('label', { style:{fontSize:13} }, '默认模式: ',
            e('select', { className:'council-select', value: roster.mode||'triad', onChange:function(ev){ setRoster(Object.assign({},roster,{mode:ev.target.value})); }, style:{marginLeft:6} },
              Object.keys(MODE_CN).map(function(k){ return e('option',{key:k,value:k},MODE_CN[k]); })))
        ),
        e('div', { style:{border:'1px solid var(--border,#eee)', borderRadius:8, overflow:'hidden'} },
          roster.roster.map(function(m,i){
            return e('div',{key:m.id,className:'council-row',style:{background:i%2?'var(--surface-secondary,rgba(0,0,0,.02))':'transparent'}},
              e('input',{type:'checkbox',checked:!!m.enabled,onChange:function(ev){upd(m.id,{enabled:ev.target.checked});}}),
              e('span',{className:'council-member-label'},m.label),
              e('span',{className:'council-member-lens'},m.lens),
              e('select',{className:'council-select',value:m.model||'',onChange:function(ev){upd(m.id,{model:ev.target.value});},
                style:{width:220}},
                e('option',{value:''},'（使用默认模型）'),
                models.map(function(md){ return e('option',{key:md.value,value:md.value},md.label); }))
            );
          })),
        e('div',{style:{marginTop:10,display:'flex',alignItems:'center',gap:10}},
          e('button',{onClick:save,disabled:isSaving,className:'council-save-btn',style:{padding:'6px 20px'}},isSaving?'保存中…':'💾 保存配置'),
          notice?e('span',{style:{fontSize:12}},notice):null)
      );
    }

    // ---------- DAG 进度内容 ----------
    function DagContent(props) {
      var runId = props.runId;
      var run = useProgress(runId);
      var rs = useRoster();
      var roster = rs[0];
      // 子代理目录（session scope 注入的 useSessions），用于节点点击跳转子会话
      var useSessionsHook = props.useSessions;
      var catalog = null;
      if (typeof useSessionsHook === 'function' && props.sessionId) {
        try { catalog = useSessionsHook(function(s) { return (s.subagentsByParent || {})[props.sessionId]; }); } catch(_) {}
      }
      var e = React.createElement;
      if (!run) return e('div',{style:{fontSize:12,color:'var(--dsw-alias-label-tertiary, #999)'}},'暂无辩论进度。发起一次 council 辩论后这里会实时显示各成员进度。');
      // 构建 memberId → 中文名映射
      var nameMap = {};
      if (roster && roster.roster) roster.roster.forEach(function(m){ nameMap[m.id] = m.label; });
      function nodeLabel(n) {
        if (n.kind === 'system') {
          if (n.id === 'chairman' || /chair/i.test(n.id)) return '⚖️ 主席裁决';
          if (n.id === 'close' || /close|finish|done/i.test(n.id)) return '✅ 辩论结束';
          return n.label || n.id;
        }
        if (nameMap[n.id]) return nameMap[n.id];
        var dash = String(n.id).lastIndexOf('-r');
        var mid = dash > 0 ? n.id.slice(0, dash) : n.id;
        return nameMap[mid] || n.label || n.id;
      }
      // 节点 → 子代理会话匹配（与 dsh-task-dag 对齐：点击节点打开对应子会话）
      // 别名表：子会话标题由主代理起名，可能与 roster 全名不一致（如 ada → 艾达 vs 阿达·洛芙莱斯）
      var NAME_ALIAS = { ada: ['艾达', '阿达'], feynman: ['费曼'], torvalds: ['托瓦兹', '林纳斯'], munger: ['芒格'], aristotle: ['亚里士多德'] };
      var childEntries = ((catalog && catalog.entries) || []).filter(function(en) { return en.kind === 'child'; });
      function findChildSession(n) {
        if (!childEntries.length) return null;
        var cands = [];
        if (n.kind === 'system') {
          if (/chair/i.test(n.id)) cands = ['主席'];
          else return null; // close 等节点不跳转
        } else {
          var dash = String(n.id).lastIndexOf('-r');
          var mid = dash > 0 ? n.id.slice(0, dash) : n.id;
          var cn = nameMap[mid] || nameMap[n.id] || '';
          if (cn) {
            cands.push(cn);
            var segs = cn.split('·');
            if (segs.length > 1) cands.push(segs[segs.length - 1]); // 林纳斯·托瓦兹 → 托瓦兹
          }
          if (NAME_ALIAS[mid]) cands = cands.concat(NAME_ALIAS[mid]);
          cands.push(mid);
        }
        for (var i = 0; i < childEntries.length; i++) {
          var lb = childEntries[i].label || '';
          for (var j = 0; j < cands.length; j++) {
            if (cands[j] && cands[j].length >= 2 && lb.indexOf(cands[j]) >= 0) return childEntries[i];
          }
        }
        return null;
      }
      // 计算深度（parentId 链）：run_root 深度0，成员深度1，chairman深度2，close深度3
      var depths = { run_root: 0 };
      var nodes = run.nodes || [];
      var edges = run.edges || [];
      edges.forEach(function(edge) {
        var child = edge.to;
        var parent = edge.from;
        if (depths[parent] !== undefined) {
          var d = depths[parent] + 1;
          if (depths[child] === undefined || depths[child] < d) depths[child] = d;
        }
      });
      // 为没有父级的节点分配深度
      nodes.forEach(function(n) {
        var hasParent = edges.some(function(e) { return e.to === n.id; });
        if (!hasParent && depths[n.id] === undefined) {
          if (n.kind === 'system') depths[n.id] = 2;
          else depths[n.id] = 1;
        }
      });
      // 按深度分层
      var maxDepth = 0;
      Object.keys(depths).forEach(function(id) { if (depths[id] > maxDepth) maxDepth = depths[id]; });
      var layers = [];
      for (var i = 0; i <= maxDepth; i++) layers.push([]);
      nodes.forEach(function(n) {
        var d = depths[n.id] || 0;
        if (d > maxDepth) d = maxDepth;
        layers[d].push(n);
      });
      // 每层内排序：按 round 再按 id
      layers.forEach(function(layer) {
        layer.sort(function(a, b) { return (a.round||0) - (b.round||0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
      });
      // 计算布局
      // 移动端（<1024px）紧凑节点，桌面端大尺寸
      var isMobile = window.matchMedia('(max-width: 1023px)').matches;
      var NODE_W = isMobile ? 132 : 200, NODE_H = isMobile ? 44 : 56, X_GAP = isMobile ? 28 : 60, Y_GAP = isMobile ? 24 : 32, PAD = isMobile ? 16 : 28;
      var widest = 1;
      layers.forEach(function(layer) { if (layer.length > widest) widest = layer.length; });
      var cw = PAD * 2 + widest * NODE_W + (widest - 1) * X_GAP;
      var ch = PAD * 2 + (maxDepth + 1) * NODE_H + maxDepth * Y_GAP;
      var positions = {};
      layers.forEach(function(layer, depth) {
        var lw = layer.length * NODE_W + (layer.length - 1) * X_GAP;
        var sx = (cw - lw) / 2;
        layer.forEach(function(n, ni) {
          positions[n.id] = { x: Math.max(20, sx + ni * (NODE_W + X_GAP)), y: PAD + depth * (NODE_H + Y_GAP), w: NODE_W, h: NODE_H };
        });
      });
      // 新增：run_root 作为可见的议题根节点（depth0 居中）
      positions['run_root'] = { x: cw/2 - (isMobile ? 60 : 80), y: 12, w: isMobile ? 120 : 160, h: isMobile ? 26 : 32 };
      // run_root 议题根节点数据
      var runObj = run;
      var rootClickable = !!(runObj.sessionId && props.openSession);
      // 提取结论：chairman 节点的 detail 就是裁决内容
      var chairmanNode = null;
      nodes.forEach(function(n) { if (n.kind === 'system' && (/chair/i.test(n.id) || n.id === 'chairman')) chairmanNode = n; });
      var verdict = (chairmanNode && chairmanNode.detail) ? String(chairmanNode.detail) : '';
      return e('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flex: 'none' } },
          e('strong', { style: { fontSize: 13 } }, '🏛️ ' + String(run.problem || '').slice(0, 50)),
          e('span', { style: { fontSize: 11, color: statusColor(run.status) } }, '模式: ' + (MODE_CN[run.mode] || run.mode) + ' · ' + (STATUS_CN[run.status] || run.status))),
        e('div', { style: { flex: 1, minHeight: 0, overflow: 'auto' } },
        e('svg', { width: '100%', height: ch, style: { display: 'block', overflow: 'visible' } },
          edges.map(function(edge, i) {
            var from = positions[edge.from];
            var to = positions[edge.to];
            if (!from || !to) return null;
            // 垂直连线：父节点底部中点 → 子节点顶部中点
            var x1 = from.x + from.w / 2, y1 = from.y + from.h;
            var x2 = to.x + to.w / 2, y2 = to.y;
            var ym = (y1 + y2) / 2;
            var lineColor = 'var(--dsw-alias-label-caption, #999)';
            return e('g', { key: 'edge-' + i },
              e('path', {
                d: 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + ym + ' ' + x2 + ',' + ym + ' ' + x2 + ',' + y2,
                fill: 'none', stroke: lineColor, strokeWidth: 1.5
              }),
              e('polygon', {
                points: '-4,0 4,0 0,6', fill: lineColor,
                transform: 'translate(' + x2 + ',' + (y2 - 1) + ')'
              }));
          }),
          // run_root 议题根节点
          e('g', { key: 'node-run_root',
            style: { cursor: rootClickable ? 'pointer' : 'default' },
            onClick: rootClickable ? function() { props.openSession(runObj.sessionId); } : null
          },
            rootClickable ? e('title', null, '点击打开「' + (runObj.problem || '议题') + '」会话') : null,
            e('rect', { x: positions['run_root'].x, y: positions['run_root'].y, width: positions['run_root'].w, height: positions['run_root'].h, rx: 16, ry: 16, fill: 'var(--dsw-alias-brand-primary, #4a6cf7)' }),
            e('text', { x: positions['run_root'].x + positions['run_root'].w / 2, y: positions['run_root'].y + (isMobile ? 17 : 20), fontSize: isMobile ? 12 : 14, fontWeight: 600, textAnchor: 'middle', fill: 'var(--dsw-alias-label-primary-inverted, #fff)' }, '🎯 ' + String(runObj.problem || '议题').slice(0, isMobile ? 8 : 14) + (rootClickable ? ' ↗' : ''))),
          nodes.map(function(n) {
            var pos = positions[n.id];
            if (!pos) return null;
            var sc = statusColor(n.status);
            var bg = n.status === 'done' ? 'rgba(34,160,107,.1)' : n.status === 'running' ? 'rgba(226,164,0,.1)' : 'var(--dsw-alias-bg-layer-1, #fff)';
            var text = nodeLabel(n);
            var child = findChildSession(n);
            var clickable = !!(child && props.openSession);
            return e('g', {
                key: 'node-' + n.id,
                style: { cursor: clickable ? 'pointer' : 'default' },
                onClick: clickable ? function() { props.openSession(child.id); } : null
              },
              clickable ? e('title', null, '点击打开「' + (child.label || '子会话') + '」') : null,
              e('rect', { x: pos.x, y: pos.y, width: pos.w, height: pos.h, rx: 8, ry: 8, fill: bg, stroke: sc, strokeWidth: clickable ? 2.5 : 2, strokeDasharray: clickable ? 'none' : 'none' }),
              e('circle', { cx: pos.x + (isMobile ? 13 : 16), cy: pos.y + pos.h / 2, r: isMobile ? 5 : 6, fill: sc }),
              e('text', { x: pos.x + (isMobile ? 22 : 28), y: pos.y + pos.h / 2 + 5, fontSize: isMobile ? 12 : 14, fontWeight: 600, fill: 'var(--dsw-alias-label-primary, #222)' }, text + (clickable ? ' ↗' : '')),
              e('text', { x: pos.x + pos.w - (isMobile ? 8 : 10), y: pos.y + pos.h - 6, fontSize: isMobile ? 10 : 11, textAnchor: 'end', fill: 'var(--dsw-alias-label-tertiary, #999)' }, STATUS_CN[n.status] || n.status));
          })),
        ),
        verdict ? e('div', { style: {
            marginTop: 14, padding: '14px 18px', borderRadius: 12,
            border: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08))',
            background: 'rgba(74,108,247,.05)',
            flex: 'none'
          }},
          e('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--dsw-alias-brand-primary, #4a6cf7)', marginBottom: 6 } }, '⚖️ 主席裁决'),
          e('div', { style: { fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-primary, #222)' } }, verdict))
        : null);
    }

    // ---------- 左侧栏底部导航按钮 ----------
    function CouncilNavButton() {
      var e = React.createElement;
      var runs = useRuns();
      var runList = (runs && runs.runs) || [];
      var live = runList.some(function(r){ return r.status === 'running'; });
      return e(React.Fragment, null,
        e('style', null, NAV_STYLES),
        e('div', { className: 'council-nav-wrapper' },
          e('button', {
            type: 'button',
            className: 'council-nav-btn',
            'aria-label': '打开议会面板',
            onClick: function() { window.dispatchEvent(new CustomEvent('council:toggle')); }
          },
            e('span', { style: { fontSize: 16, flex: 'none' } }, live ? '🏛️' : '🏛️'),
            e('span', { className: 'council-nav-label' }, '议会'))));
    }

    var NAV_STYLES = '.council-nav-wrapper{width:100%;flex:0 0 100%}[class*="footerActions"]{flex-wrap:wrap !important}.council-nav-btn{-webkit-appearance:none;appearance:none;display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:6px 2px 6px 10px;box-sizing:border-box;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#0f1115);cursor:pointer;font:inherit;font-size:14px;line-height:22px;overflow:hidden}.council-nav-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}.council-nav-label{overflow:hidden;white-space:nowrap}';

    // ---------- 面板内容（议题列表 + DAG） ----------
    function CouncilPanelContent(props) {
      var e = React.createElement;
      var isMobile = window.matchMedia('(max-width: 1023px)').matches;
      var runs = useRuns();
      var runList = (runs && runs.runs) || [];
      var sel = React.useState(null);
      var selectedRunId = sel[0], setSelectedRunId = sel[1];
      React.useEffect(function() {
        if (selectedRunId) return;
        if (!runList || runList.length === 0) return;
        var latest = runList[0];
        var cur = runList.filter(function(r){ return r.sessionId === props.sessionId; });
        if (cur.length > 0) latest = cur[0];
        setSelectedRunId(latest.id);
      }, [selectedRunId, runList, props.sessionId]);
      var topicInput = React.useState('');
      var topic = topicInput[0], setTopic = topicInput[1];
      // 工作区选择：从 ctx.workspaces.list 读取
      var wsSnapshot = (typeof props.listWorkspaces === 'function') ? props.listWorkspaces() : null;
      var wsItems = (wsSnapshot && wsSnapshot.items) || [];
      var wsState = React.useState('');
      var workspaceId = wsState[0], setWorkspaceId = wsState[1];
      // 默认选中当前会话所在工作区（recentWorkspaceId 或第一个）
      React.useEffect(function() {
        if (workspaceId || wsItems.length === 0) return;
        var recent = wsSnapshot && wsSnapshot.recentWorkspaceId;
        var pick = recent || (wsItems[0] && wsItems[0].workspaceId) || '';
        setWorkspaceId(pick);
      }, [workspaceId, wsItems.length]);
      var creating = React.useState(false);
      var isCreating = creating[0], setCreating = creating[1];
      var errState = React.useState('');
      var issueErr = errState[0], setIssueErr = errState[1];
      function createIssue() {
        var t = topic.trim();
        if (!t) return;
        setTopic('');
        setIssueErr('');
        setCreating(true);
        // 先在新工作区创建空白会话（一个议题一个会话，不污染当前会话）
        var runSessionId = props.sessionId || '';
        var createPromise;
        if (typeof props.createSession === 'function' && workspaceId) {
          createPromise = Promise.resolve(props.createSession(workspaceId)).then(function(res) {
            // ctx.sessions.create() 返回 sessionId 字符串；兼容对象形态
            if (typeof res === 'string' && res) {
              runSessionId = res;
            } else if (res && typeof res === 'object') {
              var sid = (res.result && res.result.value && res.result.value.sessionId) || res.value || (res.sessionId) || '';
              if (sid) runSessionId = sid;
            }
            return runSessionId;
          }).catch(function() { return runSessionId; });
        } else {
          createPromise = Promise.resolve(runSessionId);
        }
        createPromise.then(function(finalSid) {
          return fetch('/council/api/progress/report', {
            method:'POST', headers:{'content-type':'application/json'},
            body: JSON.stringify({ problem: t, mode: 'quick', sessionId: finalSid || '' })
          }).then(function(r){ return r.json(); }).then(function(d){
            setCreating(false);
            if (d.runId) {
              setSelectedRunId(d.runId);
              // 打开新会话（不污染当前会话）
              if (finalSid && typeof props.openSession === 'function') {
                try { props.openSession(finalSid); } catch(_) {}
              }
            }
          });
        }).catch(function(){ setCreating(false); setIssueErr('创建失败，请重试'); });
      }
      return e('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } },
        e('div', { style: { flex: 'none', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 8 : 10, padding: isMobile ? '10px 12px' : '14px 20px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))' } },
          e('input', { type: 'text', placeholder: '输入议题名称，按 Enter 创建…', value: topic,
            onChange: function(ev) { setTopic(ev.target.value); },
            onKeyDown: function(ev) { if (ev.key === 'Enter') createIssue(); },
            style: { flex: 1, height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', fontSize: 14, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', outline: 'none' }
          }),
          e('select', { value: workspaceId, onChange: function(ev) { setWorkspaceId(ev.target.value); },
            style: { height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', fontSize: 13, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', outline: 'none', maxWidth: isMobile ? '100%' : 200, flex: 'none' }
          },
            wsItems.length === 0
              ? e('option', { value: '' }, '（无工作区）')
              : wsItems.map(function(w) {
                return e('option', { key: w.workspaceId, value: w.workspaceId }, w.name || w.path || w.workspaceId);
              })),
          e('button', { onClick: createIssue, disabled: !topic.trim() || isCreating,
            style: { height: 38, padding: '0 24px', border: 0, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 'none',
              background: topic.trim() && !isCreating ? 'var(--dsw-alias-brand-primary, #4a6cf7)' : 'var(--dsw-alias-border-l2, #ccc)', color: '#fff' }
          }, isCreating ? '创建中…' : '发起辩论')),
        issueErr ? e('div', { style: { padding: '6px 20px', fontSize: 12, color: '#d64545' } }, issueErr) : null,
        e('div', { style: { flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' } },
          e('div', { style: { width: isMobile ? 150 : 240, flex: 'none', overflowY: 'auto', borderRight: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))', padding: '8px 0' } },
            e('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--dsw-alias-label-tertiary, #888)', padding: '8px 16px', letterSpacing: .5, textTransform: 'uppercase' } }, '议题列表'),
            runList.length === 0
              ? e('div', { style: { padding: '20px 16px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #888)', textAlign: 'center' } }, '暂无议题')
              : runList.map(function(r) {
                var active = r.id === selectedRunId;
                return e('div', { key: r.id,
                  onClick: function() { setSelectedRunId(r.id); },
                  style: { padding: isMobile ? '10px 12px' : '10px 16px', cursor: 'pointer', fontSize: isMobile ? 12 : 13,
                    background: active ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.04))' : 'transparent',
                    borderLeft: active ? '3px solid var(--dsw-alias-brand-primary, #4a6cf7)' : '3px solid transparent' }
                },
                  e('div', { style: { fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    String(r.problem || '未命名').slice(0, 30)),
                  e('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', marginTop: 3 } },
                    (STATUS_CN[r.status] || r.status) + ' · ' + r.nodes + ' 节点'));
              })),
          e('div', { style: { flex: 1, overflow: 'auto', padding: '16px 20px' } },
            selectedRunId
              ? e(DagContent, { runId: selectedRunId, sessionId: props.sessionId, useSessions: props.useSessions, openSession: props.openSession })
              : e('div', { style: { fontSize: 13, color: 'var(--dsw-alias-label-tertiary, #888)', textAlign: 'center', padding: 60 } }, '暂无议题。在上方输入框输入议题名称，点击「发起辩论」创建一个新议题。'))),
        e('div', { style: { flex: 'none', padding: isMobile ? '8px 12px' : '10px 20px', borderTop: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)' } },
          '成员与模型配置在 设置 → 议会 中调整。在聊天框输入 /council 来发起辩论。'));
    }

    // ---------- 右侧抽屉面板（不遮挡左侧导航栏） ----------
    // 测量 grid 首尾列宽，让面板盖住中间会话列、不遮左右侧栏
    function useFrameInsets(ref, active) {
      var st = React.useState({ left: 0, right: 0 });
      var insets = st[0], setInsets = st[1];
      React.useEffect(function() {
        if (!active || !ref.current) return;
        var frame = ref.current.parentElement && ref.current.parentElement.parentElement && ref.current.parentElement.parentElement.parentElement;
        if (!frame) return;
        function measure() {
          try {
            var tracks = getComputedStyle(frame).gridTemplateColumns.split(' ');
            var left = parseFloat(tracks[0] || '0');
            var right = parseFloat(tracks[tracks.length - 1] || '0');
            setInsets({ left: isFinite(left) ? left : 0, right: isFinite(right) ? right : 0 });
          } catch (_) {}
        }
        measure();
        var ro = new ResizeObserver(measure);
        ro.observe(frame);
        return function() { ro.disconnect(); };
      }, [active, ref]);
      return insets;
    }

    function CouncilOverlayPanel(props) {
      var controller = props.controller;
      var e = React.createElement;
      var isMobile = window.matchMedia('(max-width: 1023px)').matches;
      var isOpen = React.useSyncExternalStore(
        controller.subscribe, controller.getSnapshot, controller.getSnapshot
      );
      React.useEffect(function() {
        var handler = function() { controller.toggle(); };
        window.addEventListener('council:toggle', handler);
        return function() { window.removeEventListener('council:toggle', handler); };
      }, [controller]);
      var sessionId = props.useSessions ? props.useSessions(function(s){ return s.current; }) : null;
      var rootRef = React.useRef(null);
      var insets = useFrameInsets(rootRef, isOpen);
      if (!isOpen) return null;
      return e('div', {
        ref: rootRef,
        style: {
          position: 'absolute', top: 0, bottom: 0,
          left: insets.left, right: insets.right,
          zIndex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'var(--dsw-alias-bg-layer-1, #fff)',
          color: 'var(--dsw-alias-label-primary, #222)',
          boxShadow: '0 0 40px rgba(0,0,0,.12)',
          borderLeft: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))',
          borderRight: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))'
        }
      },
        e('div', { style: {
          flex: 'none', height: isMobile ? 46 : 52, padding: isMobile ? '0 10px 0 12px' : '0 16px 0 20px',
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
          borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))'
        }},
          e('div', { style: { width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--dsw-alias-brand-primary, #4a6cf7)', color: '#fff', fontSize: 18, flex: 'none' } }, '🏛️'),
          e('div', { style: { flex: 1, minWidth: 0 } },
            e('div', { style: { fontSize: 15, fontWeight: 600 } }, '高智会议 · 辩论进度'),
            e('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)' } }, '议题管理与 DAG 实时可视化'))),
        e(CouncilPanelContent, {
          sessionId: sessionId,
          useSessions: props.useSessions,
          openSession: props.openSession,
          refreshSubagents: props.refreshSubagents,
          createSession: props.createSession,
          listWorkspaces: props.listWorkspaces
        }));
    }

    function apply(ctx) {
      injectStyles();

      // --- 简单的 open/close controller ---
      var listeners = [];
      var state = { open: false };
      function subscribe(fn) { listeners.push(fn); return function() { listeners = listeners.filter(function(l){ return l !== fn; }); }; }
      function getSnapshot() { return state.open; }
      function setOpen(v) { state.open = v; listeners.forEach(function(l){ try { l(); } catch(_){} }); }
      var controller = { subscribe: subscribe, getSnapshot: getSnapshot, open: function(){ setOpen(true); }, close: function(){ setOpen(false); }, toggle: function(){ setOpen(!state.open); } };

      // 1. 左侧栏底部导航按钮（和"任务板"并排，在"设置"上方）
      ctx.slots.inject('sidebar.footer.action', function* () {
        yield ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'council-nav',
          order: 20
        }, CouncilNavButton);
      });

      // 2. 全屏覆盖面板
      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({
          name: 'shell.overlay',
          id: 'council-panel',
          order: 50,
          inject: function() { return {
            controller: controller,
            openSession: function(id) { ctx.sessions.open(id); },
            refreshSubagents: function(id) { try { return ctx.sessions.refreshSubagents(id); } catch(_){} },
            createSession: function(workspaceId) { return ctx.sessions.create({ workspaceId: workspaceId }); },
            listWorkspaces: function() {
              try { return ctx.workspaces.list.getSnapshot(); } catch(_) { return null; }
            }
          }; }
        }, CouncilOverlayPanel);
      });

      // 3. 设置页顶级菜单：议会配置
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register({
          name: 'settings.section',
          id: 'council',
          order: 20,
          label: function() { return '🏛️ 议会'; }
        }, CouncilSettings);
      });
    }

    return { apply: apply, inject: ['slots', 'sessions', 'workspaces'] };
  }
});

