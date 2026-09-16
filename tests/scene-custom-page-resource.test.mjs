// Scene 业务资源 helper / 契约子集 / Scene 镜像 的确定性测试（node:test，无依赖）
//   node --test tests/scene-custom-page-resource.test.mjs
//
// 覆盖：无 .scene 不用 helper；.scene 无 context 零请求；context 非法零请求；
//       合法 context 的 list / upload / --overwrite 请求与契约一致；会话错误暂停不降级；
//       契约、知识镜像、脚本镜像任一漂移即失败。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL = join(REPO_ROOT, 'skills', 'generating-votafoundry-single-pages');
const HELPER = join(SKILL, 'scripts', 'scene-custom-page-resource.mjs');
const CONTRACT_FILE = join(SKILL, 'references', 'custom-page-resource-contract.json');
const GENERATOR = join(REPO_ROOT, 'tools', 'generate-custom-page-resource-contract.mjs');
const SYNC = join(REPO_ROOT, 'tools', 'sync-scene.ps1');
const SCENE = join(REPO_ROOT, 'scene_个性交付');
// panelx-http-api 真源所在仓库（默认同级 sdk_test，可用环境变量覆盖，不写死开发机路径）。
const PANELX_SKILL_ROOT = process.env.PANELX_SKILL_ROOT
  || resolve(REPO_ROOT, '..', 'sdk_test', 'skills', 'panelx-http-api');
const IS_WINDOWS = process.platform === 'win32';

const CONTRACT = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'));
const BUSINESS_DOMAIN = 'GroupChat_Inst_Test';
const SESSION_ID = 'scene-session-abc';

// ---- 工具 ----
async function startServer(handler) {
  const requests = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      handler(req, res);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    requests,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

function sceneWorkspace({ sessionId = SESSION_ID, context, dotScene = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'scene-res-'));
  if (dotScene) writeFileSync(join(dir, '.scene'), JSON.stringify({ sessionId }), 'utf8');
  if (context !== undefined) {
    mkdirSync(join(dir, '.cdp'), { recursive: true });
    writeFileSync(
      join(dir, '.cdp', 'resource-context.json'),
      typeof context === 'string' ? context : JSON.stringify(context),
      'utf8',
    );
  }
  return dir;
}

async function withDir(dir, fn) {
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 必须异步：同步 spawn 会阻塞本进程的事件循环，测试内建的 HTTP server 就无法应答。
async function runHelper(cwd, args) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [HELPER, ...args], { encoding: 'utf8', cwd });
    return { status: 0, stdout };
  } catch (err) {
    return { status: typeof err.code === 'number' ? err.code : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const payload = (r) => JSON.parse(r.stdout.trim());
const okContext = (baseUrl) => ({ version: 1, baseUrl: `${baseUrl}/`, businessDomain: BUSINESS_DOMAIN });
const respond = (body, status = 200) => (req, res) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

// ---- 环境判定：无 .scene 不走 helper ----
test('无 .scene：不使用 helper，零请求', async () => {
  const srv = await startServer(respond({ state: 200, data: [] }));
  try {
    await withDir(sceneWorkspace({ dotScene: false, context: okContext(srv.baseUrl) }), async (dir) => {
      const r = await runHelper(dir, ['list']);
      assert.notEqual(r.status, 0, r.stdout);
      assert.equal(payload(r).code, 'SCENE_REQUIRED');
      assert.equal(srv.requests.length, 0);
    });
  } finally {
    await srv.close();
  }
});

test('.scene 无资源上下文：判 CDP 不支持，零请求', async () => {
  const srv = await startServer(respond({ state: 200, data: [] }));
  try {
    await withDir(sceneWorkspace(), async (dir) => {
      const r = await runHelper(dir, ['list']);
      assert.notEqual(r.status, 0, r.stdout);
      assert.equal(payload(r).code, 'CDP_RESOURCE_UNSUPPORTED');
      assert.equal(srv.requests.length, 0);
    });
  } finally {
    await srv.close();
  }
});

test('资源上下文非法：停止且零请求', async () => {
  const srv = await startServer(respond({ state: 200, data: [] }));
  try {
    const cases = [
      '{not json',
      JSON.stringify({ version: 2, baseUrl: `${srv.baseUrl}/`, businessDomain: BUSINESS_DOMAIN }),
      JSON.stringify({ version: 1, baseUrl: srv.baseUrl, businessDomain: '' }),
      JSON.stringify({ version: 1, businessDomain: BUSINESS_DOMAIN }),
    ];
    for (const context of cases) {
      await withDir(sceneWorkspace({ context }), async (dir) => {
        const r = await runHelper(dir, ['list']);
        assert.notEqual(r.status, 0, r.stdout);
        assert.equal(payload(r).code, 'RESOURCE_CONTEXT_INVALID', r.stdout);
      });
    }
    assert.equal(srv.requests.length, 0);
  } finally {
    await srv.close();
  }
});

// ---- 合法上下文：请求与生成契约一致 ----
test('合法 context：list 请求方法/路径/头与契约一致', async () => {
  const srv = await startServer(respond({ state: 200, msg: 'ok', data: [{ resourcePath: 'a.png' }] }));
  try {
    await withDir(sceneWorkspace({ context: okContext(srv.baseUrl) }), async (dir) => {
      const r = await runHelper(dir, ['list', '--prefix', 'pages/demo']);
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      const out = payload(r);
      assert.equal(out.ok, true);
      assert.deepEqual(out.data, [{ resourcePath: 'a.png' }]);
    });
    assert.equal(srv.requests.length, 1);
    const req = srv.requests[0];
    assert.equal(req.method, CONTRACT.operations.list.method);
    assert.equal(req.url, `${CONTRACT.operations.list.path}?prefix=pages%2Fdemo`);
    assert.equal(req.headers[CONTRACT.sessionHeader.toLowerCase()], SESSION_ID);
    assert.equal(req.headers.busdomaincode, BUSINESS_DOMAIN);
    assert.equal(req.headers.authorization, undefined);
  } finally {
    await srv.close();
  }
});

test('合法 context：upload 与 --overwrite 请求与契约一致', async () => {
  const srv = await startServer(respond({ state: 200, data: { resourcePath: 'pages/demo/a.txt' } }));
  try {
    await withDir(sceneWorkspace({ context: okContext(srv.baseUrl) }), async (dir) => {
      const local = join(dir, 'a.txt');
      writeFileSync(local, 'hello', 'utf8');
      const plain = await runHelper(dir, ['upload', '--file', local, '--resource-path', 'pages/demo/a.txt']);
      assert.equal(plain.status, 0, `${plain.stdout}${plain.stderr}`);
      const forced = await runHelper(dir, ['upload', '--file', local, '--overwrite']);
      assert.equal(forced.status, 0, `${forced.stdout}${forced.stderr}`);
    });
    assert.equal(srv.requests.length, 2);
    const upload = CONTRACT.operations.upload;
    const [plain, forced] = srv.requests;
    for (const req of [plain, forced]) {
      assert.equal(req.method, upload.method);
      assert.equal(req.url, upload.path);
      assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/);
      assert.equal(req.headers[CONTRACT.sessionHeader.toLowerCase()], SESSION_ID);
      assert.equal(req.headers.busdomaincode, BUSINESS_DOMAIN);
      assert.equal(req.headers.authorization, undefined);
      assert.match(req.body, new RegExp(`name="${upload.required[0]}"`));
      assert.ok(req.body.includes('a.txt'));
    }
    assert.match(plain.body, /name="resourcePath"[\s\S]*pages\/demo\/a\.txt/);
    assert.ok(!plain.body.includes('name="overwrite"'), '普通上传不得发送 overwrite');
    assert.match(forced.body, /name="overwrite"[\s\S]*true/);
  } finally {
    await srv.close();
  }
});

// ---- 会话错误暂停，不降级 ----
test('会话/鉴权错误暂停不降级，404 才判能力不可用', async () => {
  const srv = await startServer((req, res) => {
    const status = req.url.includes('listFiles') && req.headers['x-scene-session-id'] === 'inactive'
      ? 401
      : 404;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ state: status }));
  });
  try {
    const active = await withDir(sceneWorkspace({ context: okContext(srv.baseUrl) }), async (dir) => payload(await runHelper(dir, ['list'])));
    const inactive = await withDir(
      sceneWorkspace({ sessionId: 'inactive', context: okContext(srv.baseUrl) }),
      async (dir) => payload(await runHelper(dir, ['list'])),
    );
    assert.equal(active.code, 'RESOURCE_API_UNSUPPORTED');
    assert.equal(active.status, 404);
    assert.equal(inactive.code, 'AUTH_REQUIRED');
    assert.notEqual(inactive.code, active.code, '鉴权失败不得与能力不可用混为一谈');
  } finally {
    await srv.close();
  }
});

// ---- 契约漂移 ----
test('契约与 catalog 一致，任一字段漂移检查非零', () => {
  if (!existsSync(join(PANELX_SKILL_ROOT, 'references', 'endpoint-catalog.json'))) return;
  const check = spawnSync(process.execPath, [GENERATOR, '--panelx-skill-root', PANELX_SKILL_ROOT, '--check'], { encoding: 'utf8' });
  assert.equal(check.status, 0, `${check.stdout}${check.stderr}`);

  const tmp = mkdtempSync(join(tmpdir(), 'panelx-catalog-'));
  try {
    const catalogDir = join(tmp, 'panelx-http-api', 'references');
    mkdirSync(catalogDir, { recursive: true });
    const catalogPath = join(catalogDir, 'endpoint-catalog.json');
    const out = join(tmp, 'contract.json');
    writeFileSync(catalogPath, readFileSync(join(PANELX_SKILL_ROOT, 'references', 'endpoint-catalog.json'), 'utf8'), 'utf8');
    const gen = (args) => spawnSync(process.execPath, [GENERATOR, '--panelx-skill-root', join(tmp, 'panelx-http-api'), '--out', out, ...args], { encoding: 'utf8' });

    assert.equal(gen([]).status, 0);
    assert.equal(readFileSync(out, 'utf8'), readFileSync(CONTRACT_FILE, 'utf8'), '生成物应与提交的契约一致');
    assert.equal(gen(['--check']).status, 0);

    const drifted = JSON.parse(readFileSync(catalogPath, 'utf8'));
    drifted.operations.find((o) => o.name === 'listCustomPageResources').path = '/wp-cdn/api/listFiles2';
    writeFileSync(catalogPath, JSON.stringify(drifted, null, 2), 'utf8');
    assert.equal(gen(['--check']).status, 1, 'catalog 漂移应使检查非零');
    assert.equal(gen([]).status, 0);
    assert.notEqual(readFileSync(out, 'utf8'), readFileSync(CONTRACT_FILE, 'utf8'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- 知识 / 脚本镜像漂移 ----
test('知识镜像与脚本镜像与技能源一致', () => {
  const pairs = [
    [join(SKILL, 'references', 'internal-resources.md'), join(SCENE, 'knowledge', 'internal-resources.md')],
    [CONTRACT_FILE, join(SCENE, 'knowledge', 'custom-page-resource-contract.json')],
    [join(SKILL, 'scripts', 'scene-custom-page-resource.mjs'), join(SCENE, 'script', 'scene-custom-page-resource.mjs')],
    [join(SKILL, 'scripts', 'validate-page-resources.mjs'), join(SCENE, 'script', 'validate-page-resources.mjs')],
  ];
  for (const [src, dst] of pairs) {
    assert.ok(existsSync(dst), `Scene 镜像缺失: ${dst}`);
    assert.equal(readFileSync(dst, 'utf8'), readFileSync(src, 'utf8'), `Scene 镜像漂移: ${dst}`);
  }

  if (!IS_WINDOWS) return;
  const stray = join(SCENE, 'script', 'drift-probe.tmp.mjs');
  writeFileSync(stray, '// drift probe\n', 'utf8');
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SYNC, '-Check'], { encoding: 'utf8' });
    assert.equal(r.status, 1, '脚本镜像出现多余文件时应判漂移');
  } finally {
    rmSync(stray, { force: true });
  }
  const clean = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SYNC, '-Check'], { encoding: 'utf8' });
  assert.equal(clean.status, 0, `${clean.stdout}${clean.stderr}`);
});

// ---- 文档路由 ----
test('Scene 镜像 helper 在场景布局（script/ + knowledge/）下可直接运行', async () => {
  const srv = await startServer(respond({ state: 200, data: [{ resourcePath: 'b.png' }] }));
  try {
    await withDir(sceneWorkspace({ context: okContext(srv.baseUrl) }), async (dir) => {
      const mirrored = join(SCENE, 'script', 'scene-custom-page-resource.mjs');
      const { stdout } = await execFileAsync(process.execPath, [mirrored, 'list'], { encoding: 'utf8', cwd: dir });
      assert.deepEqual(JSON.parse(stdout).data, [{ resourcePath: 'b.png' }]);
    });
    assert.equal(srv.requests.length, 1);
  } finally {
    await srv.close();
  }
});

test('Scene 布局（/script + /knowledge 镜像）下校验器可用', () => {
  const html = `<!doctype html>\n<html lang="zh-CN"><head>`
    + `<script type="application/json" data-cdp-internal-resources>${JSON.stringify({ version: 1, resources: [] })}</script>`
    + `</head><body></body></html>\n`;
  const tmp = mkdtempSync(join(tmpdir(), 'scene-layout-'));
  try {
    mkdirSync(join(tmp, 'script'), { recursive: true });
    mkdirSync(join(tmp, 'knowledge'), { recursive: true });
    copyFileSync(join(SCENE, 'script', 'validate-page-resources.mjs'), join(tmp, 'script', 'validate-page-resources.mjs'));
    writeFileSync(join(tmp, 'index.html'), html, 'utf8');
    const runner = join(tmp, 'script', 'validate-page-resources.mjs');

    const broken = spawnSync(process.execPath, [runner, join(tmp, 'index.html')], { encoding: 'utf8' });
    assert.notEqual(broken.status, 0, '缺少 knowledge/system-resources.json 时应失败');

    copyFileSync(join(SCENE, 'knowledge', 'system-resources.json'), join(tmp, 'knowledge', 'system-resources.json'));
    const ok = spawnSync(process.execPath, [runner, join(tmp, 'index.html')], { encoding: 'utf8' });
    assert.equal(ok.status, 0, `${ok.stdout}${ok.stderr}`);
    assert.match(ok.stdout, /RESULT: PASS/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('资源文档区分 Scene 纳管与 CLI 本地交付，复用由 agent 自主决策', () => {
  const doc = readFileSync(join(SKILL, 'references', 'internal-resources.md'), 'utf8');
  assert.match(doc, /CLI 分支只在工作区交付 HTML/);
  assert.match(doc, /不查找、不加载 `panelx-http-api` 技能/);
  assert.match(doc, /复用是可选决策/);
  assert.match(doc, /\.scene/);
  assert.match(doc, /\.cdp\/resource-context\.json/);
  assert.match(doc, /\/script\/scene-custom-page-resource\.mjs/);
  assert.match(doc, /\/script\/validate-page-resources\.mjs/);

  const sceneDoc = readFileSync(join(SCENE, 'scene.md'), 'utf8');
  assert.match(sceneDoc, /scene-custom-page-resource\.mjs/);
  assert.match(sceneDoc, /validate-page-resources\.mjs/);

  for (const prompt of ['normal-generator.md', 'databoard-generator.md', 'custom-shell-generator.md']) {
    const content = readFileSync(join(SKILL, 'references', 'prompts', prompt), 'utf8');
    assert.match(content, /CLI 分支只在工作区交付 HTML/, prompt);
    assert.match(content, /复用是可选决策/, prompt);
    assert.match(content, /不要登录、不要调用 CLI/, prompt);
  }
});
