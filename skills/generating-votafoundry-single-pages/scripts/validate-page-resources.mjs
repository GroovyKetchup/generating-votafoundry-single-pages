#!/usr/bin/env node
/**
 * 单页「内部资源」校验器 —— 静态检查，只用 Node 标准库，无依赖。
 *
 *   node skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs [--legacy-unmanaged] <页面.html> [更多.css ...]
 *
 * 校验（不解析动态 JS）：
 *   - 受管页面恰好 1 个 <script type="application/json" data-cdp-internal-resources> manifest
 *   - manifest 路径为规范形式：相对页面根、原样可读（Unicode/空格）、无 ./ .. 段、无 URL 方案、无重复
 *   - HTML/CSS 引用的业务路径都包含在 manifest 中；已有的正确百分号编码引用可接受
 *   - 拒绝：根绝对业务引用、逃出受管根的 .. 遍历、非法百分号编码、manifest 重复/非法路径
 *   - 系统资源（references/system-resources.json 的 legacy URL 与 data-cdp-resource 标签）及 data:/blob: URL
 *     不参与校验；第三方静态 CDN URL 必须先纳管，不能直接留在资源载入位置
 *
 * 退出码：0 = PASS，1 = FAIL，2 = 用法错误。
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---- 系统资源注册表（单一来源） ----
const registry = JSON.parse(
  readFileSync(new URL('../references/system-resources.json', import.meta.url), 'utf8'),
);
const SYSTEM_URLS = [];
for (const r of registry.resources ?? []) {
  for (const u of r.urls ?? []) if (u) SYSTEM_URLS.push(u);
}
const isSystemUrl = (v) => SYSTEM_URLS.some((u) => v === u || (u.startsWith('/') && v.endsWith(u)));

// ---- 扫描骨架（朴素正则，不做完整 HTML/CSS 解析；动态 JS 不解析） ----
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
const STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const HAS_MANIFEST_ATTR = /(?:^|\s)data-cdp-internal-resources(?![-\w])/i;
const HAS_CDP_RESOURCE_ATTR = /(?:^|\s)data-cdp-resource(?![-\w])/i;
const HREF_RESOURCE_TAGS = new Set(['link', 'use', 'image']);
const SRC_ATTRS = ['src', 'poster', 'data', 'srcset'];
const STATIC_LINK_RELS = /(?:^|\s)(?:stylesheet|icon|shortcut\s+icon|apple-touch-icon|mask-icon|preload|modulepreload)(?:\s|$)/i;

function attrValue(attrs, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i');
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

function cssRefs(text) {
  const out = [];
  for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi)) {
    const v = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (v) out.push(v);
  }
  for (const m of text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gi)) out.push(m[1].trim());
  return out;
}

const CANONICAL_RULES = [
  [(p) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p), '不得包含 URL 方案（系统/外部资源不属于内部资源）'],
  [(p) => p.includes('\\'), '不得使用 "\\" 分隔符'],
  [(p) => p.split('/').some((s) => s === ''), '不得包含空路径段（"//" 或结尾 "/"）'],
  [(p) => p.split('/').some((s) => s === '.' || s === '..'), '不得包含 "." / ".." 段'],
  [(p) => /[\u0000-\u001f\u007f]/.test(p), '不得包含控制字符'],
];

function canonicalError(p) {
  if (!p) return '路径为空';
  if (p.startsWith('/')) return '业务路径必须相对受管根，不得以 "/" 开头';
  for (const [bad, msg] of CANONICAL_RULES) if (bad(p)) return msg;
  return null;
}

function validate(files, { legacyUnmanaged = false } = {}) {
  const failures = [];
  const fail = (m) => failures.push(m);
  const [pageEntry, ...extraEntries] = files;

  if (!/\.html?$/i.test(pageEntry)) fail(`第一个参数必须是受管页面 HTML：${pageEntry}`);
  const pageRoot = dirname(resolve(pageEntry));
  const html = readFileSync(resolve(pageEntry), 'utf8');
  const relOf = (p) => relative(pageRoot, resolve(p)).split('\\').join('/');

  // ---- 1. manifest：恰好一个 ----
  const manifests = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    if (HAS_MANIFEST_ATTR.test(m[1])) manifests.push({ attrs: m[1], body: m[2] });
  }
  if (legacyUnmanaged) {
    if (manifests.length !== 0) fail('旧版非托管页面不得包含内部资源 manifest');
    return failures;
  }
  if (manifests.length !== 1) {
    fail(
      `受管页面必须恰好有 1 个内部资源 manifest（没有业务资源时写 {"version":1,"resources":[]}），实际 ${manifests.length} 个`,
    );
  }

  const manifestPaths = new Set();
  if (manifests.length === 1) {
    const { attrs, body } = manifests[0];
    const type = (attrValue(attrs, 'type') ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') {
      fail('manifest 必须是 <script type="application/json" data-cdp-internal-resources>');
    }
    let data = null;
    try {
      data = JSON.parse(body.trim());
    } catch (e) {
      fail(`manifest 不是合法 JSON：${e.message}`);
    }
    if (data) {
      if (data.version !== 1) fail(`manifest.version 必须为 1，实际 ${JSON.stringify(data.version)}`);
      if (!Array.isArray(data.resources)) {
        fail('manifest.resources 必须是数组（空数组表示该页没有业务资源）');
      } else {
        data.resources.forEach((entry, i) => {
          const raw =
            typeof entry === 'string'
              ? entry
              : entry && typeof entry === 'object'
                ? entry.resourcePath
                : undefined;
          if (typeof raw !== 'string' || !raw.trim()) {
            fail(`manifest.resources[${i}] 缺少 resourcePath`);
            return;
          }
          let decoded;
          try {
            decoded = decodeURIComponent(raw);
          } catch {
            fail(`manifest.resources[${i}] 非法百分号编码：${raw}`);
            return;
          }
          const bad = canonicalError(decoded);
          if (bad) {
            fail(`manifest.resources[${i}] 路径不规范（${bad}）：${raw}`);
            return;
          }
          if (manifestPaths.has(decoded)) {
            fail(`manifest 路径重复：${decoded}`);
            return;
          }
          manifestPaths.add(decoded);
        });
      }
    }
  }

  // ---- 2. 引用扫描 ----
  const handleRef = (rawValue, baseDir, label) => {
    const raw = (rawValue ?? '').trim();
    if (!raw || raw.startsWith('#')) return;
    if (isSystemUrl(raw)) return; // 系统 legacy URL
    if (/^(data|blob|javascript|mailto|tel|about):/i.test(raw)) return;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('//')) {
      fail(`${label}：第三方静态资源不得保留外链，先下载并上传为业务资源 "${raw}"`);
      return;
    }
    if (raw.startsWith('/')) {
      fail(`${label}：业务引用不得是根绝对路径 "${raw}"`);
      return;
    }
    const stripped = raw.split('#')[0].split('?')[0];
    let decoded;
    try {
      decoded = decodeURIComponent(stripped);
    } catch {
      fail(`${label}：非法百分号编码 "${raw}"`);
      return;
    }
    const joined = baseDir ? `${baseDir}/${decoded}` : decoded;
    const norm = posix.normalize(joined);
    if (norm === '..' || norm.startsWith('../') || decoded.startsWith('/')) {
      fail(`${label}：引用逃出受管根 "${raw}"`);
      return;
    }
    if (!manifestPaths.has(norm)) {
      fail(`${label}：引用的业务路径不在 manifest 中 "${norm}"（来自 "${raw}"）`);
    }
  };

  const scanCss = (text, baseDir, label) => {
    for (const r of cssRefs(text)) handleRef(r, baseDir, label);
  };

  const scanMarkup = (text, baseDir, label) => {
    for (const tag of text.matchAll(TAG_RE)) {
      const [, name, attrs] = tag;
      if (HAS_CDP_RESOURCE_ATTR.test(attrs)) continue; // 系统资源标签：整体跳过
      const lower = name.toLowerCase();
      for (const attr of SRC_ATTRS) {
        const v = attrValue(attrs, attr);
        if (!v) continue;
        if (attr === 'srcset') {
          for (const candidate of v.split(',')) {
            const url = candidate.trim().split(/\s+/)[0];
            if (url) handleRef(url, baseDir, `${label} <${lower} srcset>`);
          }
        } else {
          handleRef(v, baseDir, `${label} <${lower} ${attr}>`);
        }
      }
      const shouldScanHref = lower !== 'link'
        ? HREF_RESOURCE_TAGS.has(lower)
        : STATIC_LINK_RELS.test(attrValue(attrs, 'rel') ?? '');
      if (shouldScanHref) {
        const href = attrValue(attrs, 'href') ?? attrValue(attrs, 'xlink:href');
        if (href) handleRef(href, baseDir, `${label} <${lower} href>`);
      }
      const style = attrValue(attrs, 'style');
      if (style) scanCss(style, baseDir, `${label} style=`);
    }
    for (const m of text.matchAll(STYLE_RE)) {
      scanCss(m[1], baseDir, `${label} <style>`);
    }
  };

  scanMarkup(html, '', posix.basename(pageEntry));

  // ---- 3. 额外 CSS 文件（相对页面根定位，用于依赖闭包内的 ../ 引用） ----
  for (const extra of extraEntries) {
    const rel = relOf(extra);
    if (rel.startsWith('..')) {
      fail(`待校验文件在受管根之外：${extra}`);
      continue;
    }
    const dir = posix.dirname(rel);
    scanCss(readFileSync(resolve(extra), 'utf8'), dir === '.' ? '' : dir, rel);
  }

  return failures;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const input = process.argv.slice(2);
  const legacyUnmanaged = input[0] === '--legacy-unmanaged';
  const files = legacyUnmanaged ? input.slice(1) : input;
  if (files.length === 0) {
    console.error('用法: node validate-page-resources.mjs [--legacy-unmanaged] <页面.html> [更多.css ...]');
    process.exit(2);
  }
  const missing = files.find((f) => !statSync(resolve(f), { throwIfNoEntry: false })?.isFile());
  if (missing) {
    console.error(`FAIL: 文件不存在：${missing}`);
    process.exit(2);
  }
  let failures;
  try {
    failures = validate(files, { legacyUnmanaged });
  } catch (e) {
    failures = [`校验异常：${e.message}`];
  }
  for (const f of failures) console.log(`FAIL: ${f}`);
  console.log(failures.length ? `RESULT: FAIL (${failures.length})` : 'RESULT: PASS');
  process.exit(failures.length ? 1 : 0);
}
