#!/usr/bin/env node
/**
 * 从 panelx-http-api 的 endpoint-catalog.json 生成单页技能消费的 Scene 资源契约子集。
 *
 *   node tools/generate-custom-page-resource-contract.mjs --panelx-skill-root <panelx-http-api 技能目录>
 *   node tools/generate-custom-page-resource-contract.mjs --panelx-skill-root <dir> --check
 *   node tools/generate-custom-page-resource-contract.mjs --panelx-skill-root <dir> --out <file>
 *
 * 只提取 listCustomPageResources / uploadCustomPageResource 两个操作，默认写入
 * skills/generating-votafoundry-single-pages/references/custom-page-resource-contract.json。
 * 产物不得手工编辑：--check 在 catalog 或产物任一漂移时非零退出。
 * 产出只含相对来源标签，不写入 --panelx-skill-root 的绝对路径。
 *
 * 退出码：0 = 成功/一致，1 = 漂移，2 = 用法或 catalog 错误。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = join(
  REPO_ROOT,
  'skills',
  'generating-votafoundry-single-pages',
  'references',
  'custom-page-resource-contract.json',
);

const SOURCE_LABEL = 'panelx-http-api/references/endpoint-catalog.json';
const OPERATIONS = [
  ['list', 'listCustomPageResources'],
  ['upload', 'uploadCustomPageResource'],
];
const ALTERNATE_AUTH_KIND = 'active-scene-session';

function fail(message, code = 2) {
  console.error(`[custom-page-resource-contract] ${message}`);
  process.exit(code);
}

export function buildContract(catalog) {
  const byName = new Map((catalog.operations ?? []).map((op) => [op.name, op]));
  const operations = {};
  let sessionHeader = '';
  for (const [key, name] of OPERATIONS) {
    const op = byName.get(name);
    if (!op) throw new Error(`catalog 缺少操作: ${name}`);
    if (op.group !== 'custom-page-resource') throw new Error(`${name}: group 漂移 ${op.group}`);
    if (op.auth !== 'required') throw new Error(`${name}: auth 漂移 ${op.auth}`);
    const alternateAuth = op.alternateAuth;
    if (!alternateAuth || alternateAuth.kind !== ALTERNATE_AUTH_KIND || !alternateAuth.header) {
      throw new Error(`${name}: 缺少 alternateAuth(${ALTERNATE_AUTH_KIND})`);
    }
    if (sessionHeader && sessionHeader !== alternateAuth.header) {
      throw new Error(`${name}: alternateAuth.header 与前一操作不一致`);
    }
    sessionHeader = alternateAuth.header;
    operations[key] = {
      name,
      method: op.method,
      path: op.path,
      location: op.request?.location ?? null,
      required: op.request?.required ?? [],
      optional: op.request?.optional ?? [],
      response: op.response,
    };
  }
  return { version: 1, source: SOURCE_LABEL, sessionHeader, operations };
}

export function renderContract(contract) {
  const text = `${JSON.stringify(contract, null, 2)}\n`;
  if (/[A-Za-z]:[\\/]/.test(text)) throw new Error('产物含 Windows 绝对路径，禁止写入分发文件');
  return text;
}

function parseArgs(argv) {
  const out = { check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') out.check = true;
    else if (a === '--panelx-skill-root') out.skillRoot = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else fail(`未知参数: ${a}`);
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.skillRoot) {
    fail('用法: node tools/generate-custom-page-resource-contract.mjs --panelx-skill-root <dir> [--check] [--out <file>]');
  }
  const catalogPath = join(resolve(args.skillRoot), 'references', 'endpoint-catalog.json');
  if (!existsSync(catalogPath)) fail(`缺少 catalog: ${catalogPath}`);

  const out = args.out ? resolve(args.out) : DEFAULT_OUT;
  let text;
  try {
    text = renderContract(buildContract(JSON.parse(readFileSync(catalogPath, 'utf8'))));
  } catch (err) {
    fail(err.message);
  }

  if (args.check) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : null;
    if (current !== text) fail(`契约漂移: ${out} 与 catalog 不一致（重新生成后提交）`, 1);
    console.log('[custom-page-resource-contract] PASS（与 catalog 一致）');
    return 0;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text, 'utf8');
  console.log(`[custom-page-resource-contract] 已写入 ${out}`);
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main();
}
