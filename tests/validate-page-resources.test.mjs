// 内部资源校验器确定性测试（node:test，无依赖）
//   node --test tests/validate-page-resources.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL = join(REPO_ROOT, 'skills', 'generating-votafoundry-single-pages');
const VALIDATOR = join(SKILL, 'scripts', 'validate-page-resources.mjs');
const REGISTRY = join(SKILL, 'references', 'system-resources.json');

const SYSTEM_TAILWIND = 'https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js';
const SYSTEM_WAVE_LEGACY = '/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js';

const page = (head, body = '') =>
  `<!doctype html>\n<html lang="zh-CN">\n<head><meta charset="utf-8">${head}</head>\n<body>${body}</body>\n</html>\n`;
const manifestTag = (resources) =>
  `<script type="application/json" data-cdp-internal-resources>${JSON.stringify({ version: 1, resources })}</script>`;
const encRef = (p) => p.split('/').map(encodeURIComponent).join('/');

function runPage(files, entry = 'index.html', options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-page-res-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  const extra = Object.keys(files).filter((r) => r !== entry).map((r) => join(dir, r));
  const args = [VALIDATOR];
  if (options.legacyUnmanaged) args.push('--legacy-unmanaged');
  args.push(join(dir, entry), ...extra);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

const out = (r) => `${r.stdout}${r.stderr}`;
function assertPass(r) {
  assert.equal(r.status, 0, out(r));
  assert.match(out(r), /RESULT: PASS/);
}
function assertFail(r, needle) {
  assert.equal(r.status, 1, `expected FAIL but got: ${out(r)}`);
  assert.match(out(r), /RESULT: FAIL/);
  if (needle) assert.match(out(r), needle);
}

const IMG = '图片/背景 图.png';
const FONT = '图片/字体 体.woff2';
const SMALL = '图片/小 图.png';
const LARGE = '图片/大 图.png';
const CSS = 'assets/app.css';

test('合规页面通过：相对引用、./ 与非逃逸 ..、百分号编码、Unicode、系统资源排除', () => {
  const files = {
    'index.html': page(
      [
        `<script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="${SYSTEM_TAILWIND}"></script>`,
        `<script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="${SYSTEM_WAVE_LEGACY}"></script>`,
        `<link rel="stylesheet" href="./${CSS}">`,
        manifestTag([IMG, FONT, SMALL, LARGE, CSS]),
        `<style>.bg{background:url(data:image/svg+xml;base64,AAA)} .x{background:url("${IMG}")}</style>`,
      ].join('\n'),
      [
        `<img src="${encRef(IMG)}" alt="背景">`,
        `<img src="./assets/../${IMG}" alt="规范化">`,
        // srcset 按空白分词，路径里的空格必须按规范编码（%20）
        `<img srcset="${encRef(SMALL)} 1x, ${encRef(LARGE)} 2x" alt="多倍图">`,
        `<a href="https://example.com/page">外链导航</a>`,
        '<a href="#top">锚点</a>',
      ].join('\n'),
    ),
    [CSS]: `@font-face{src:url("../${FONT}")}\n.hero{background:url(../${IMG})}`,
  };
  assertPass(runPage(files));
});

test('第三方静态 CDN 资源必须先纳管，导航链接不受此规则约束', () => {
  const html = page(
    manifestTag([]),
    [
      '<link rel="stylesheet" href="https://cdn.example.test/swiper.css">',
      '<script src="https://cdn.example.test/swiper.js"></script>',
      '<img src="https://cdn.example.test/product.png" alt="">',
      '<a href="https://example.com/support">帮助</a>',
    ].join('\n'),
  );
  assertFail(runPage({ 'index.html': html }), /第三方静态资源不得保留外链/);
});

test('空 manifest 合法（该页没有业务资源）', () => {
  assertPass(runPage({ 'index.html': page(manifestTag([])) }));
});

test('旧版非托管模式允许旧资源引用但拒绝 manifest', () => {
  const legacy = page('', '<script src="https://cdn.example.test/legacy.js"></script>');
  assertPass(runPage({ 'index.html': legacy }, 'index.html', { legacyUnmanaged: true }));

  assertFail(
    runPage({ 'index.html': page(manifestTag([])) }, 'index.html', { legacyUnmanaged: true }),
    /旧版非托管页面不得包含内部资源 manifest/,
  );
});

test('manifest 条目可以是含 resourcePath 的对象，未引用的条目也允许', () => {
  const html = page(
    manifestTag([
      { resourcePath: IMG, etag: 'abc' },
      { resourcePath: '仅供 JS 使用的.js' },
    ]),
    `<img src="${IMG}" alt="">`,
  );
  assertPass(runPage({ 'index.html': html }));
});

test('缺少 manifest 判 FAIL', () => {
  assertFail(runPage({ 'index.html': page('', `<img src="${IMG}" alt="">`) }), /恰好有 1 个内部资源 manifest/);
});

test('两个 manifest 判 FAIL', () => {
  assertFail(
    runPage({ 'index.html': page(manifestTag([]) + manifestTag([])) }),
    /恰好有 1 个内部资源 manifest.*实际 2 个/,
  );
});

test('manifest type / version 不合法判 FAIL', () => {
  const badType = `<script type="text/plain" data-cdp-internal-resources>{"version":1,"resources":[]}</script>`;
  assertFail(runPage({ 'index.html': page(badType) }), /type="application\/json"/);
  const badVersion = `<script type="application/json" data-cdp-internal-resources>{"version":2,"resources":[]}</script>`;
  assertFail(runPage({ 'index.html': page(badVersion) }), /version 必须为 1/);
});

test('根绝对业务引用判 FAIL（系统 legacy URL 除外）', () => {
  const html = page(manifestTag([IMG]), `<img src="/${IMG}" alt="">`);
  assertFail(runPage({ 'index.html': html }), /不得是根绝对路径/);
});

test('逃出受管根的 .. 遍历判 FAIL（原生与百分号编码两种写法）', () => {
  const plain = page(manifestTag([]), '<img src="../secret.png" alt="">');
  assertFail(runPage({ 'index.html': plain }), /逃出受管根/);
  const encoded = page(manifestTag([]), '<img src="%2e%2e%2fsecret.png" alt="">');
  assertFail(runPage({ 'index.html': encoded }), /逃出受管根/);
});

test('受管根之外的待校验 CSS 文件判 FAIL', () => {
  const files = { 'pages/index.html': page(manifestTag([])), 'x.css': 'a{}' };
  assertFail(runPage(files, 'pages/index.html'), /受管根之外/);
});

test('非法百分号编码判 FAIL（引用与 manifest 路径）', () => {
  const ref = page(manifestTag([IMG]), '<img src="图片/背景%2G图.png" alt="">');
  assertFail(runPage({ 'index.html': ref }), /非法百分号编码/);
  const inManifest = page(manifestTag(['图片/背景%2G图.png']));
  assertFail(runPage({ 'index.html': inManifest }), /非法百分号编码/);
});

test('引用的业务路径不在 manifest 中判 FAIL', () => {
  const html = page(manifestTag([CSS]), `<img src="${IMG}" alt="">`);
  assertFail(runPage({ 'index.html': html }), /不在 manifest 中/);
});

test('manifest 路径重复判 FAIL（含编码/原样等价）', () => {
  assertFail(runPage({ 'index.html': page(manifestTag([IMG, IMG])) }), /路径重复/);
  assertFail(runPage({ 'index.html': page(manifestTag([IMG, encRef(IMG)])) }), /路径重复/);
});

test('manifest 路径不规范判 FAIL（根绝对 / ./ 段 / 方案 URL / 系统 URL / 缺 resourcePath）', () => {
  assertFail(runPage({ 'index.html': page(manifestTag(['/assets/a.png'])) }), /路径不规范/);
  assertFail(runPage({ 'index.html': page(manifestTag(['./assets/a.png'])) }), /路径不规范/);
  assertFail(runPage({ 'index.html': page(manifestTag(['https://example.com/a.png'])) }), /路径不规范/);
  assertFail(runPage({ 'index.html': page(manifestTag([SYSTEM_TAILWIND])) }), /路径不规范/);
  assertFail(runPage({ 'index.html': page(manifestTag([SYSTEM_WAVE_LEGACY])) }), /路径不规范/);
  assertFail(runPage({ 'index.html': page(manifestTag([{ etag: 'x' }])) }), /缺少 resourcePath/);
});

test('CSS 依赖闭包内的非逃逸 ../ 引用计入清单校验', () => {
  const files = {
    'index.html': page([`<link rel="stylesheet" href="${CSS}">`, manifestTag([CSS, IMG])].join('\n')),
    [CSS]: `.hero{background:url(../${IMG})}`,
  };
  assertPass(runPage(files));
  const missing = {
    'index.html': page([`<link rel="stylesheet" href="${CSS}">`, manifestTag([CSS])].join('\n')),
    [CSS]: `.hero{background:url(../${IMG})}`,
  };
  assertFail(runPage(missing), /不在 manifest 中/);
});

test('系统资源注册表是单一来源且与技能文档声明一致', () => {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const byName = Object.fromEntries(registry.resources.map((r) => [r.name, r]));
  assert.deepEqual(Object.keys(byName).sort(), ['echarts', 'tailwindcss', 'wave-loading']);
  for (const r of registry.resources) {
    assert.ok(/^\d+\.\d+\.\d+$/.test(r.version), `${r.name} 版本应固定`);
    const legacy = r.urls.filter((u) => u.startsWith('/cdn_general/'));
    assert.equal(legacy.length, 1, `${r.name} 应有且仅有一条 legacy URL`);
    for (const url of r.urls) assert.ok(url.includes(`/${r.version}/`), url);
    for (const url of r.urls.filter((u) => u.startsWith('http'))) {
      assert.ok(url.endsWith(legacy[0]), `${r.name} 绝对 URL 应与 legacy URL 同源`);
    }
  }
  assert.ok(byName.tailwindcss.urls.includes('/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js'));
  assert.ok(byName['wave-loading'].urls.includes('/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js'));
  assert.ok(byName.echarts.urls.includes('/cdn_general/libs/echarts/5.6.0/dist/echarts.min.js'));

  const skillDoc = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  const refDoc = readFileSync(join(SKILL, 'references', 'internal-resources.md'), 'utf8');
  assert.match(skillDoc, /data-cdp-resource="tailwindcss"/);
  assert.match(skillDoc, /system-resources\.json/);
  assert.match(refDoc, /data-cdp-resource/);
  assert.match(refDoc, /system-resources\.json/);
  assert.match(refDoc, /accessPath/);
  assert.match(refDoc, /先调用一次 `custom-page-resource list` 进行能力探测/);
  assert.match(refDoc, /--legacy-unmanaged/);
  assert.match(refDoc, /CDP.*1[.]20[.]0/);
  assert.match(refDoc, /webPage.*1[.]4[.]2/);
  for (const prompt of ['normal-generator.md', 'databoard-generator.md', 'custom-shell-generator.md']) {
    const content = readFileSync(join(SKILL, 'references', 'prompts', prompt), 'utf8');
    assert.match(content, /第三方静态 CDN 依赖/);
    assert.match(content, /先调用一次 `custom-page-resource list` 进行能力探测/);
  }
});
