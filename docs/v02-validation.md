# Smart Notes v0.2 — validation record

Date: 2026-10-27. Status: real-editor acceptance passed; final documentation/test CI pending before publication.

## Decision and architecture

See [ADR 002](adr/002-local-advanced-analysis.md). TypeScript grammar/context heuristics were selected as the cheapest next experiment recommended by the original benchmark; no heavy model is claimed to have won. RuleEngine remains independently callable and unchanged. NLPManager shares a lazy stateless engine. Local UTF-16 ranges, AbortSignal plus revision/generation/file checks, finite idle stages and capped per-editor state protect the host.

Visible fast pass → delayed Advanced pass → up to 64 nearby lines each side within ±20k characters. Up to 256 visible jobs, 128 background jobs, 128 cache records, 2048 stored ranges per view. This deliberately does not eagerly scan the whole vault or whole file. Context is one preceding physical line and is masked using Markdown protection. Context-dependent highlights are invalidated with neighboring edits. Parser advancement uses 5 ms attempts: up to 8 ordinarily / 32 above 100k characters, 100 ms between retries; no perpetual retry timer.

## Quality: frozen references

The original 54 development and 20 test expanded-silver rows are unchanged. Test has six source documents, 49 TERM spans, no natural negative examples. Historical v0.1 predictions are read from the saved benchmark. New predictions use production segmentation/manager/resolver and actual CodeMirror Markdown protection, Balanced/Automatic, after the idle phase. They describe full line coverage, not viewport scheduling. References are single-agent preferences, old test was previously observed: no independent gold or generalization claim. No test annotation was changed to improve scores.

| Test method | Precision | Recall | TERM F1 | TP | FP | FN |
|---|---:|---:|---:|---:|---:|---:|
| v0.1 | .500 | .041 | .075 | 2 | 2 | 47 |
| v0.2 Rules Only | 1.000 | .041 | .078 | 2 | 0 | 47 |
| v0.2 Automatic | .667 | .163 | .262 | 8 | 4 | 41 |

Development TERM F1: .080 → .281; TP 6 → 25, FP 8 → 17. Four explicit development NONE examples have zero highlights in both versions. Test DEFINITION_TERM F1: 0 → .462; KEY_TERM F1 stays .114. Semantic IMPORTANT/EXAMPLE F1 stays zero in this natural test. DEFINITION body remains unsupported. Full-taxonomy diagnostic macro F1 .023 → .115 includes unsupported body/semantic categories, so is not a claim of full formatting quality. Exact counts, overlap metrics, per-category metrics, predictions and reference SHA-256 are in [quality.json](../research/results/v02/quality.json).

Useful new cases: «Под коэффициентом обучения понимают размер шага» (only the term), «Функция потерь определяется как мера ошибки», multiword dash definitions, a nearby explicitly anchored repeated term. Common conversational verb subjects are rejected. Exact inflected spellings are required for context repetition; noun heuristics can reject valid terms or accept ambiguous contrasts. No arbitrary semantic importance, global coreference or full morphology is implemented.

## Synthetic performance

Machine: Apple M5, arm64, 16 GiB, Darwin 25.5.0, Node v24.22.1. CPU only; no external model. A separate process for each method, five warmups, 100 samples through 1k words and 30 for larger documents. p95 nearest rank. Identical texts, bounded physical lines except the explicit paragraph case. Includes Promise and resolver cost; excludes Markdown, debounce, renderer, UI and process startup. A Promise itself does not move work off the UI thread: this engine is bounded to 4000 text + 4000 context characters and yields between controller jobs. A future heavy adapter requires a worker or external process.

| Input | v0.1 p50 / p95 ms | v0.2 p50 / p95 ms | v0.2 CPU per pass ms (user+system) |
|---|---:|---:|---:|
| single paragraph 300 words | 0.066 / 0.119 | 0.223 / 0.320 | 0.306 |
| 20 words | 0.005 / 0.014 | 0.021 / 0.031 | 0.037 |
| 300 words | 0.060 / 0.107 | 0.293 / 0.343 | 0.445 |
| 1000 words | 0.178 / 0.201 | 0.943 / 0.987 | 1.062 |
| 10000 words | 1.644 / 1.813 | 9.183 / 9.582 | 9.430 |
| 100000 words | 15.724 / 15.861 | 89.933 / 90.269 | 90.238 |

Analyzer-only initialization 0.417 ms (one observation, not cold plugin startup). Node before/after RSS 47.2/81.6 MiB, OS peak 81.6 MiB; baseline OS peak 70.5 MiB. Includes runtime/JIT/transient allocation; no forced GC or claim of isolated plugin RAM. This is not proof of long-term absence of leaks. Controller tests verify structural bounds, finite completion, stale responses and cleanup. Raw samples: `research/results/v02/performance-*.json`.

A paired warm Obsidian snapshot with the same two note tabs/settings showed summed RSS 747.1 MiB with the plugin disabled and 750.5 MiB enabled (+3.4 MiB). This includes all host processes and shared pages, GUI work and existing allocations; it is not isolated plugin heap, a cold-start result, or proof against leaks. CPU times and timestamps are in `research/results/v02/obsidian-host-snapshots.json`.

Installed files: main.js + manifest.json + styles.css, approximately 19 KB combined; downloaded weights 0 bytes; optional Python process none. Plugin startup/first-highlight p50/p95 and exact typing latency inside Obsidian were not instrumented. Fast/Advanced configured delays are budgets, not measured end-to-end timings.

## Real Obsidian checks

Obsidian 1.14.5, test-vault only. Replaced the three plugin files with backups in /tmp; disable/enable actually reloads code, list refresh alone is insufficient. Opened an existing synthetic note: all requested definition constructions, nearby contextual underline, capped enumeration, important markers and examples appeared. Added and completed a new definition, observed highlight, exercised Undo/Redo, then removed only the synthetic addition. Inline code, fenced code, inline/block formulas and existing emphasis were visually protected.

Opened a second tab containing 100,000 whitespace-delimited tokens (~836k UTF-16 characters, Obsidian counts 92,861 words because punctuation-only tokens differ). Jumped to end: initial budget was insufficient; Reanalyze current note completed and highlighted the last term. With the final increased finite parse budget, a fresh copy of the large document was opened, jumped to the end, and automatically highlighted the last term without the command. Rules Only was selected and saved through the UI: advanced definitions/context/enumerations disappeared while fast rules remained. Advanced was selected and saved; Automatic was restored. Source mode and Live Preview were both exercised; multiple tabs remained independent. All three synthetic notes match their original SHA-256 after editing/recovery; user notes were not changed. Existing v0.1.1 real validation remains in research/reports/stable-validation.md.

## Automated checks and release gate

- 85 Vitest tests passed: original 46 regressions plus new definition/negative/context/protection/cancellation/failure/idle/burst/paste/geometry and unfinished-input mode tests. Controller tests simulate viewport and do not claim real browser layout.
- Strict TypeScript and production esbuild passed; no separate linter configured.
- 19 Python research tests passed; new quality evaluation checks every output substring/offset and records unchanged reference hashes.
- Fresh frozen-lockfile dependency install passed in an isolated temporary folder. No new runtime dependencies.
- Initial hosted push and PR CI passed at 775ce168. GitHub warned about Node20 actions, so actions are being pinned to official v6/Node24 revisions and Ubuntu 24.04; both updated hosted push/PR runs passed at a2d9024a with zero annotations. Sources: [checkout changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md), [setup-node documentation](https://github.com/actions/setup-node/blob/main/README.md). Final metadata/CI and tag publication follow this record. Previous v0.1.1-stable is preserved.

## Reproduce

Run pnpm test / build / package / bench:v02. Build the quality bridge with node scripts/prepare-v02.mjs, then NODE_BINARY=<node> research/.venv/bin/python research/evaluate_v02.py. Existing research environment is not required by the installed plugin.

Package audit: exactly main.js (18,289 bytes), manifest.json (253) and styles.css (446), total 18,988 bytes. No model weights, environments, test vault notes or common GitHub/private-key credential patterns in tracked files. License remains unassigned by the owner; no new runtime dependency license is introduced.
