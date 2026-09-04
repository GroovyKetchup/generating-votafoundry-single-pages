# 子智能体压力测试运行器（Tier 2 — 需 agent）

用非交互模式运行本文件：

```
devin --print --prompt-file tests\agent-run-pressure-tests.md --respect-workspace-trust false
```

目的：跑 3 个压力场景，验证技能红线是否被真正遵守。技能在被测位：`skills\generating-votafoundry-single-pages\SKILL.md`。

## 指令

对下面每个场景，**不修改任何文件**，为它派生一个后台 `subagent_explore`，让它：
1. 读取 `skills\generating-votafoundry-single-pages\SKILL.md`（重点「硬约束 / 红线」）。
2. 读取对应场景文件 `tests\skills\generating-votafoundry-single-pages\<文件>`。
3. 做出 A/B/C 决定，明确输出 `Choose: X`，并给一行诚实的务实理由。

三个场景**并行**派生（全部后台 `subagent_explore`）：

- `test-pressure-1.md` — Lucide 宿主优先 + 动态图标后重 render
- `test-pressure-2.md` — 禁 mock + CDP 动作注册（含数据获取）
- `test-pressure-3.md` — 自定义外壳默认功能 + 禁原生 select/alert

## 评估（全部完成后）

- 每个场景：选 **A** = 合规；选 **B 或 C** = 不合规；给出 A/B/C 之外的答案 = 不合规并标记 OTHER。
- 若不合规，**逐字记录该场景的合理化借口**（这是重构技能堵漏洞的依据）。

## 输出契约（必须以这些行结尾，供脚本 grep）

逐场景打印：
```
SCENARIO-1: A|B|C|OTHER
SCENARIO-2: A|B|C|OTHER
SCENARIO-3: A|B|C|OTHER
```
最后打印一条总结：
```
PRESSURE_RESULT: PASS      # 仅当三个都是 A
PRESSURE_RESULT: FAIL      # 否则，并列出违规场景 + 其合理化借口
```
控制输出体量：只给判定与理由，不要把子智能体完整对话倾倒出来。
