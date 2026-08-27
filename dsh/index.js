/**
 * dsh-council — Council of High Intelligence for dsh web.
 *
 * Server side: HTTP API for panel config + live DAG progress + a notify
 * channel the skill coordinator calls as each member advances. Config is
 * persisted to ~/.dsh/council/config.json; progress state is in-memory per
 * run with SSE streaming for the UI.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);
let yaml;
try {
  // 可选依赖：js-yaml 仅在读取 ~/.dsh/settings.yaml 模型列表时使用；缺失时降级跳过
  yaml = require('js-yaml');
} catch (e) {
  yaml = null;
}

const name = 'dsh-council';
const inject = ['webServer'];
// settings 是可选注入（rc.7+ 才有），在 apply 里单独 try/catch

const CONFIG_DIR = join(homedir(), '.dsh', 'council');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const ROSTER = [
  { id: 'aristotle',   label: '亚里士多德',       lens: '分类与结构' },
  { id: 'socrates',    label: '苏格拉底',         lens: '假设拆解' },
  { id: 'sun-tzu',     label: '孙子',             lens: '对抗策略' },
  { id: 'ada',         label: '阿达·洛芙莱斯',    lens: '形式系统与抽象' },
  { id: 'aurelius',    label: '马可·奥勒留',      lens: '韧性与道德清晰' },
  { id: 'machiavelli', label: '马基雅维利',       lens: '权力博弈与现实政治' },
  { id: 'lao-tzu',     label: '老子',             lens: '无为与涌现' },
  { id: 'feynman',     label: '费曼',             lens: '第一性原理调试' },
  { id: 'torvalds',    label: '林纳斯·托瓦兹',    lens: '务实工程' },
  { id: 'musashi',     label: '宫本武藏',         lens: '战略时机' },
  { id: 'watts',       label: '艾伦·瓦茨',        lens: '视角重构' },
  { id: 'meadows',     label: '德内拉·梅多斯',    lens: '系统思维' },
  { id: 'munger',      label: '查理·芒格',        lens: '逆向思维与心智模型' },
  { id: 'kahneman',    label: '丹尼尔·卡尼曼',    lens: '决策心理学' },
  { id: 'taleb',       label: '纳西姆·塔勒布',    lens: '反脆弱与风险' },
  { id: 'karpathy',    label: '安德烈·卡帕西',    lens: 'ML 工程现实主义' },
  { id: 'sutskever',   label: '伊利亚·苏茨克沃',  lens: '深度学习理论' },
  { id: 'hillel',      label: '希勒尔·韦恩',      lens: '形式化方法与验证' }
];

function defaultConfig() {
  const members = {};
  for (const m of ROSTER) members[m.id] = { enabled: true, model: '' };
  return {
    version: 1,
    chairman: '',
    mode: 'triad',
    members,
    ui: { showDag: true, councilToggle: true }
  };
}

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return defaultConfig();
  }
}

function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ---- SQLite persistence (runs / nodes / edges survive restarts) ----
mkdirSync(CONFIG_DIR, { recursive: true });
const DB_FILE = join(CONFIG_DIR, 'council.sqlite');
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    problem TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL DEFAULT '',
    started_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running'
  );
  CREATE TABLE IF NOT EXISTS nodes (
    run_id TEXT NOT NULL,
    id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    member TEXT NOT NULL DEFAULT '',
    round INTEGER,
    kind TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'pending',
    detail TEXT NOT NULL DEFAULT '',
    at INTEGER NOT NULL,
    PRIMARY KEY (run_id, id)
  );
  CREATE TABLE IF NOT EXISTS edges (
    run_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (run_id, from_id, to_id, label)
  );
`);
const stmt = {
  insertRun: db.prepare('INSERT INTO runs (id, problem, mode, session_id, started_at, status) VALUES (?, ?, ?, ?, ?, ?)'),
  updateRun: db.prepare('UPDATE runs SET problem = ?, mode = ?, session_id = ?, status = ? WHERE id = ?'),
  getRun: db.prepare('SELECT id, problem, mode, session_id, started_at, status FROM runs WHERE id = ?'),
  listRuns: db.prepare('SELECT id, problem, mode, session_id, started_at, status FROM runs ORDER BY started_at DESC LIMIT 50'),
  listRunsBySession: db.prepare('SELECT id, started_at FROM runs WHERE session_id = ? ORDER BY started_at DESC LIMIT 5'),
  insertNode: db.prepare('INSERT OR REPLACE INTO nodes (run_id, id, label, member, round, kind, status, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  listNodes: db.prepare('SELECT id, label, member, round, kind, status, detail, at FROM nodes WHERE run_id = ?'),
  insertEdge: db.prepare('INSERT OR IGNORE INTO edges (run_id, from_id, to_id, label) VALUES (?, ?, ?, ?)'),
  listEdges: db.prepare('SELECT from_id, to_id, label FROM edges WHERE run_id = ?'),
};

function dbRunToApi(row) {
  return {
    id: row.id,
    problem: row.problem,
    mode: row.mode,
    sessionId: row.session_id,
    startedAt: row.started_at,
    status: row.status
  };
}

function loadRun(id) {
  const row = stmt.getRun.get(id);
  if (!row) return null;
  const run = dbRunToApi(row);
  run.nodes = stmt.listNodes.all(id).map(n => ({ ...n }));
  run.edges = stmt.listEdges.all(id).map(e => ({ from: e.from_id, to: e.to_id, label: e.label }));
  return run;
}

let runSeq = 0;

function newRun(problem, mode, sessionId) {
  const id = `run_${Date.now()}_${++runSeq}`;
  const run = {
    id,
    problem: problem || '',
    mode: mode || '',
    sessionId: sessionId || '',
    startedAt: Date.now(),
    status: 'running',
    nodes: [],
    edges: []
  };
  stmt.insertRun.run(run.id, run.problem, run.mode, run.sessionId, run.startedAt, run.status);
  return run;
}

function findRun(id) {
  return loadRun(id);
}

function saveRun(run) {
  stmt.updateRun.run(run.problem || '', run.mode || '', run.sessionId || '', run.status || 'running', run.id);
}

function addNode(run, node) {
  const existing = run.nodes.find(n => n.id === node.id);
  if (existing) Object.assign(existing, node);
  else run.nodes.push({ status: 'pending', ...node });
  stmt.insertNode.run(run.id, node.id, node.label || node.id, node.member || '', node.round ?? null, node.kind || 'member', node.status || 'running', String(node.detail || '').slice(0, 500), node.at || Date.now());
}

function addEdge(run, from, to, label = '') {
  if (!run.edges.some(e => e.from === from && e.to === to && e.label === label)) {
    run.edges.push({ from, to, label });
    stmt.insertEdge.run(run.id, from, to, label);
  }
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

async function apply(ctx, config) {
  // webServer only exists under the web profile
  ctx.inject(['webServer'], (scope) => {
    const webServer = scope.webServer;

    // ---- config API ----
    webServer.register({
      name: 'council-config-get',
      kind: 'exact',
      path: '/council/api/config',
      handler: async (req, res) => {
        if (req.method === 'GET') return json(res, 200, loadConfig());
        if (req.method === 'PUT') {
          const body = await readBody(req);
          const cfg = { ...loadConfig(), ...body };
          saveConfig(cfg);
          return json(res, 200, cfg);
        }
        return json(res, 405, { error: 'method not allowed' });
      }
    });

    // ---- roster (static + merged with saved config) ----
    webServer.register({
      name: 'council-roster',
      kind: 'exact',
      path: '/council/api/roster',
      handler: async (_req, res) => {
        const cfg = loadConfig();
        const roster = ROSTER.map(m => ({
          ...m,
          enabled: cfg.members?.[m.id]?.enabled !== false,
          model: cfg.members?.[m.id]?.model || ''
        }));
        return json(res, 200, { roster, chairman: cfg.chairman || '', mode: cfg.mode || 'triad' });
      }
    });

    // ---- 可用模型列表（从 ~/.dsh/settings.yaml 读取）----
    webServer.register({
      name: 'council-models',
      kind: 'exact',
      path: '/council/api/models',
      handler: async (_req, res) => {
        const out = [];
        try {
          if (yaml) {
            const raw = readFileSync(join(homedir(), '.dsh', 'settings.yaml'), 'utf8');
            const doc = yaml.load(raw) || {};
            const providers = doc['llm-pi-ai']?.providers || {};
            for (const [pid, prov] of Object.entries(providers)) {
              const pname = prov.displayName || pid;
              for (const m of (prov.models || [])) {
                out.push({ value: `${pid}/${m.id}`, label: `${pname} / ${m.name || m.id}`, provider: pid, model: m.id });
              }
            }
          }
        } catch (e) {
          // 读取失败时返回空列表
        }
        return json(res, 200, { models: out });
      }
    });

    // ---- DAG progress: report + query ----
    webServer.register({
      name: 'council-progress-report',
      kind: 'exact',
      path: '/council/api/progress/report',
      handler: async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
        const body = await readBody(req);
        let run = body.runId ? findRun(body.runId) : undefined;
        if (!run && body.nodeId === undefined && (body.problem || body.mode)) {
          // bare start: 复用同会话下「尚无节点」的空 run（面板建议题时会先建一个空 run，
          // 协调器再 bare start 时不应重复创建，否则用户看到的是空的那条、点击也无法跳转子会话）
          if (body.sessionId) {
            const cands = stmt.listRunsBySession.all(body.sessionId);
            for (const c of cands) {
              const cnt = db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE run_id = ?').get(c.id).c;
              if (cnt === 0) { run = findRun(c.id); break; }
            }
          }
          if (!run) run = newRun(body.problem || '', body.mode || '', body.sessionId || '');
          return json(res, 200, { ok: true, runId: run.id });
        }
        if (!run) run = newRun(body.problem || '', body.mode || '', body.sessionId || '');
        if (body.sessionId && !run.sessionId) { run.sessionId = body.sessionId; saveRun(run); }
        body.runId = run.id;
        // close 模式：只标记 done，不需要 nodeId
        if (body.done === true && !body.nodeId) {
          run.status = 'done';
          saveRun(run);
          return json(res, 200, { ok: true, runId: run.id });
        }
        if (!body.nodeId) return json(res, 400, { error: 'nodeId required', runId: run.id });
        addNode(run, {
          id: body.nodeId,
          label: body.label || body.nodeId,
          member: body.member || '',
          round: body.round ?? null,
          kind: body.kind || 'member',
          status: body.status || 'running',
          detail: String(body.detail || '').slice(0, 500),
          at: Date.now()
        });
        // 自动建立边：member 节点→run_root，所有成员→chairman（当 chairman 出现时）
        const nid = body.nodeId;
        const kind = body.kind || 'member';
        if (kind === 'member' && (body.round == null || body.round === 1)) {
          // 首轮，连到 run_root
          addEdge(run, 'run_root', nid);
        } else if (kind === 'member' && body.round != null && body.round > 1) {
          // 后几轮，连到上一轮相同 member
          const prevId = nid.replace(/-r\d+$/, '-r' + (body.round - 1));
          addEdge(run, prevId, nid);
        }
        // 如果是 chairman 节点，所有现有 member 节点都连到它
        if (kind === 'system' && (nid === 'chairman' || /chair/i.test(nid))) {
          for (const n of run.nodes) {
            if (n.kind === 'member' && n.id !== nid) {
              addEdge(run, n.id, nid);
            }
          }
        }
        // 如果是 close 节点，从 chairman 连到它
        if (nid === 'close' || /close|finish|done/i.test(nid)) {
          for (const n of run.nodes) {
            if (n.kind === 'system' && n.id !== nid) {
              addEdge(run, n.id, nid);
            }
          }
        }
        if (body.from) addEdge(run, body.from, body.nodeId, body.edgeLabel || '');
        if (body.done === true) { run.status = 'done'; saveRun(run); }
        return json(res, 200, { ok: true, runId: run.id });
      }
    });

    webServer.register({
      name: 'council-progress-get',
      kind: 'exact',
      path: '/council/api/progress',
      handler: async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const id = url.searchParams.get('runId');
        const run = id ? findRun(id) : (() => { const rows = stmt.listRuns.all(); return rows.length ? loadRun(rows[0].id) : null; })();
        if (!run) return json(res, 404, { error: 'no run' });
        return json(res, 200, run);
      }
    });

    // ---- runs list ----
    webServer.register({
      name: 'council-runs',
      kind: 'exact',
      path: '/council/api/runs',
      handler: async (_req, res) => {
        const rows = stmt.listRuns.all();
        return json(res, 200, {
          runs: rows.map(r => {
            const nodeCount = db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE run_id = ?').get(r.id).c;
            return { id: r.id, problem: r.problem, mode: r.mode, status: r.status, nodes: nodeCount, sessionId: r.session_id || '', startedAt: r.started_at };
          })
        });
      }
    });

    ctx.logger?.info?.('dsh-council: api registered under /council/api/*');
  });

  // 注册 settings namespace — rc.7+ 设置页按 namespace 分发 plugin 设置卡片。
  // 这里只注册一个空的 pass-through 让卡片可被分发；实际配置存在 ~/.dsh/council/config.json。
  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (scope) => {
      try {
        const passThrough = (value) => ({ ...(value ?? {}) });
        passThrough.toJSON = () => ({
          uid: 0,
          refs: { 0: { type: 'object', meta: { default: {} }, dict: {} } },
        });
        scope.settings.register(name, passThrough, { base: {} });
      } catch (e) {
        // 旧版无 settings 服务时静默跳过
      }
    });
  }
}

export { apply, name, inject, ROSTER, defaultConfig };
export default { name, inject, apply };
