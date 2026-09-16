#!/usr/bin/env node
/**
 * Scene 工作区的业务资源 helper：无登录、无 Token、无 export/import。
 *
 *   node /script/scene-custom-page-resource.mjs list [--prefix <path>]
 *   node /script/scene-custom-page-resource.mjs upload --file <local> [--resource-path <path>] [--overwrite]
 *
 * - 工作区根存在 `.scene` 才按 Scene 处理；否则退出 `SCENE_REQUIRED`，CLI 交付只保留在工作区，不做资源服务上传。
 * - 读取并校验 `.cdp/resource-context.json`（`version=1`、`baseUrl`、`businessDomain`）；
 *   文件缺失表示当前 CDP 不支持业务资源管理，非法表示宿主输出了错误上下文。
 * - method / path / 字段 / 会话头取自 `custom-page-resource-contract.json`（由 catalog 生成，勿手改）。
 * - 只发 `X-Scene-Session-Id` + `BusDomainCode`，不发 `Authorization`。
 *
 * 输出为单行结构化 JSON；失败非零退出，并区分「暂停整批」（鉴权/网络/服务）与
 * 「能力不可用」（404/405/协议不匹配）——调用方不得据此自动降级。
 *
 * ponytail: 会话校验在服务端实时完成，本地只透传 sessionId；若出现会话枚举/越权滥用，
 * 再在服务端加入业务域绑定或短期凭据，helper 侧无需改动。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// 技能仓库把契约放在 references/，Scene 工作区把它镜像到 knowledge/；同名文件二选一。
const CONTRACT_DIRS = ['references', 'knowledge'];
const CONTRACT_FILE = 'custom-page-resource-contract.json';
// 既有平台业务域请求头，与 panelx-http-api CLI 保持一致。
const BUS_DOMAIN_HEADER = 'BusDomainCode';

function emit(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(exitCode);
}

function fail(code, message, exitCode = 1, extra = {}) {
  emit({ ok: false, code, message, ...extra }, exitCode);
}

// ---- 工作区与上下文 ----
function findWorkspaceRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 32; i += 1) {
    if (existsSync(join(dir, '.scene'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readSessionId(root) {
  const raw = readFileSync(join(root, '.scene'), 'utf8').trim();
  try {
    const sessionId = JSON.parse(raw)?.sessionId;
    if (typeof sessionId === 'string' && sessionId.trim()) return sessionId.trim();
  } catch {
    // 非 JSON：允许整个 .scene 就是一行 sessionId
  }
  return /^[\w.-]+$/.test(raw) ? raw : '';
}

function readResourceContext(root) {
  const file = join(root, '.cdp', 'resource-context.json');
  if (!existsSync(file)) {
    return {
      error: [
        'CDP_RESOURCE_UNSUPPORTED',
        '未找到 .cdp/resource-context.json：当前 CDP 不支持业务资源管理，请让用户选择「升级后重试」或「旧版非托管模式」',
      ],
    };
  }
  const invalid = (why) => ({ error: ['RESOURCE_CONTEXT_INVALID', `宿主资源上下文非法（${why}），停止且不降级`] });
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return invalid(`不是合法 JSON：${err.message}`);
  }
  if (!value || typeof value !== 'object') return invalid('不是对象');
  if (value.version !== 1) return invalid(`不支持的 version ${JSON.stringify(value.version)}`);
  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '';
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return invalid('baseUrl 不是合法 URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return invalid(`baseUrl 协议不支持 ${url.protocol}`);
  if (url.username || url.password) return invalid('baseUrl 含凭据');
  if (url.search || url.hash) return invalid('baseUrl 含 query 或 fragment');
  const businessDomain = typeof value.businessDomain === 'string' ? value.businessDomain.trim() : '';
  if (!businessDomain) return invalid('businessDomain 缺失');
  return { context: { baseUrl: baseUrl.replace(/\/+$/, ''), businessDomain } };
}

// ---- 生成的 HTTP 契约 ----
function loadContract() {
  for (const dir of CONTRACT_DIRS) {
    const rel = `../${dir}/${CONTRACT_FILE}`;
    const file = resolve(SCRIPT_DIR, rel);
    if (!existsSync(file)) continue;
    let contract;
    try {
      contract = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      return { error: ['CONTRACT_INVALID', `契约 ${rel} 不是合法 JSON：${err.message}`] };
    }
    const sessionHeader = contract.sessionHeader;
    for (const key of ['list', 'upload']) {
      const op = contract.operations?.[key];
      if (
        !op
        || typeof op.method !== 'string'
        || typeof op.path !== 'string'
        || !Array.isArray(op.required)
        || !Array.isArray(op.optional)
      ) {
        return { error: ['CONTRACT_INVALID', `契约 ${rel} 缺少 operations.${key} 的 method/path/required/optional`] };
      }
    }
    if (typeof sessionHeader !== 'string' || !sessionHeader) {
      return { error: ['CONTRACT_INVALID', `契约 ${rel} 缺少 sessionHeader`] };
    }
    return { contract };
  }
  return { error: ['CONTRACT_INVALID', `未找到 ${CONTRACT_FILE}（应由 catalog 生成并随技能分发）`] };
}

// ---- 请求 ----
function buildQuery(field, value) {
  const params = new URLSearchParams();
  if (field && value) params.set(field, value);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function splitEnvelope(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { error: ['INVALID_RESPONSE', '响应不是合法 JSON'] };
  }
  const state = Number(payload?.state);
  if (state === 401) return { error: ['AUTH_REQUIRED', '业务 401：Scene 会话无效或已结束，暂停整批，不降级'] };
  if (state !== 200) {
    return { error: ['BUSINESS_ERROR', `业务失败 state=${payload?.state} msg=${payload?.msg ?? ''}`] };
  }
  return { data: payload.data ?? null };
}

function classifyHttpStatus(status) {
  if (status === 401 || status === 403) return ['AUTH_REQUIRED', '鉴权失败：Scene 会话无效或已结束，暂停整批，不降级'];
  if (status === 404 || status === 405) return ['RESOURCE_API_UNSUPPORTED', 'webPage 资源接口不存在或路由不支持，由用户选择升级或旧版非托管'];
  return ['HTTP_ERROR', `HTTP ${status}：服务异常，暂停整批，不降级`];
}

async function request({ context, sessionHeader, sessionId, op, query, form }) {
  const options = {
    method: op.method,
    headers: { [BUS_DOMAIN_HEADER]: context.businessDomain, [sessionHeader]: sessionId },
  };
  if (form) options.body = form;
  let res;
  try {
    res = await fetch(`${context.baseUrl}${op.path}${query ?? ''}`, options);
  } catch (err) {
    return { error: ['NETWORK_ERROR', `请求失败：${err.message}，暂停整批，不降级`] };
  }
  let text = '';
  try {
    text = await res.text();
  } catch {
    // 状态码已足够判定，正文不可读时按空处理
  }
  if (!res.ok) return { error: classifyHttpStatus(res.status), status: res.status };
  return splitEnvelope(text.slice(0, 200000));
}

// ---- CLI ----
function parseArgs(argv) {
  const flags = {};
  const unknown = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      unknown.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!['prefix', 'file', 'resource-path', 'overwrite'].includes(key)) {
      unknown.push(arg);
      continue;
    }
    if (key === 'overwrite') {
      flags.overwrite = eq === -1 ? true : arg.slice(eq + 1) !== 'false';
      continue;
    }
    const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
    if (value === undefined) unknown.push(arg);
    else flags[key] = value;
  }
  return { flags, unknown };
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (command !== 'list' && command !== 'upload') {
    fail('BAD_INPUT', '用法: list [--prefix <path>] | upload --file <local> [--resource-path <path>] [--overwrite]', 2);
  }
  const { flags, unknown } = parseArgs(rest);
  if (unknown.length) fail('BAD_INPUT', `不支持的参数: ${unknown.join(' ')}`, 2);
  if (command === 'upload' && !flags.file) fail('BAD_INPUT', 'upload 缺少 --file', 2);

  const root = findWorkspaceRoot(process.cwd());
  if (!root) {
    fail('SCENE_REQUIRED', '工作区没有 .scene：这不是 Scene 环境；CLI 交付只保留在工作区，不调用资源服务', 2);
  }
  const sessionId = readSessionId(root);
  if (!sessionId) fail('SCENE_SESSION_MISSING', '.scene 缺少可用 sessionId，暂停且不降级');

  const { context, error: contextError } = readResourceContext(root);
  if (contextError) fail(contextError[0], contextError[1]);
  const { contract, error: contractError } = loadContract();
  if (contractError) fail(contractError[0], contractError[1], 2);

  const op = contract.operations[command];
  const base = { context, sessionHeader: contract.sessionHeader, sessionId, op };
  const result =
    command === 'list'
      ? await request({
          ...base,
          query: buildQuery(contract.operations.list.optional.find((f) => f === 'prefix'), flags.prefix),
        })
      : await request({
          ...base,
          form: buildForm(contract.operations.upload, flags),
        });

  if (result.error) fail(result.error[0], result.error[1], 1, result.status ? { status: result.status } : {});
  emit({ ok: true, command: `custom-page-resource ${command}`, data: result.data }, 0);
}

function buildForm(uploadOp, flags) {
  const fileField = uploadOp.required?.[0];
  const pathField = uploadOp.optional.find((f) => f === 'resourcePath');
  const overwriteField = uploadOp.optional.find((f) => f === 'overwrite');
  if (!fileField || !pathField || !overwriteField) {
    fail('CONTRACT_INVALID', 'upload 契约缺少 file/resourcePath/overwrite 字段声明', 2);
  }
  const local = resolve(flags.file);
  if (!statSync(local, { throwIfNoEntry: false })?.isFile()) {
    fail('BAD_INPUT', `--file 不是存在的普通文件: ${local}`, 2);
  }
  const form = new FormData();
  form.append(fileField, new Blob([readFileSync(local)]), basename(local));
  if (flags['resource-path']) form.append(pathField, flags['resource-path']);
  if (flags.overwrite) form.append(overwriteField, 'true');
  return form;
}

await main(process.argv.slice(2));
