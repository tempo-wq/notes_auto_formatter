# ADR 002 — bounded local Advanced Analysis

Status: accepted for v0.2; 2026-10-27. Regression, resource and real-editor acceptance are recorded in [validation](../v02-validation.md).

## Evidence

Read `research/reports/nlp-benchmark.md`, `expanded-silver.md` and the saved configurations/results. On the unchanged expanded test (20 fragments, six sources), baseline TERM F1 is .075 (2 TP, 2 FP, 47 FN); rule+spaCy .127 (9 TP, 84 FP, 40 FN). Source-bootstrap intervals overlap. The 74-example annotations are agent-reviewed silver; the two user-reviewed fragments are insufficient independent evidence. There is no proven quality winner. IMPORTANT/EXAMPLE semantic coverage remains poor for every adapter. DEFINITION bodies are not rendered.

Previously measured Python prototypes: YAKE5 p95 8/201 ms for 100/10,000 words, peak RSS 76 MiB; spaCy 17/1254 ms, 806 MiB; MiniLM 433/2219 ms, 1209 MiB. These include runtimes; spaCy's environment includes optional torch. Model files are 44 MiB spaCy / 476 MiB MiniLM. CPU samples and startup probes are in the original JSON, not editor measurements. None justifies mandatory Python or weights.

## Decision

Keep the v0.1 RuleEngine as the fast baseline. Add a TypeScript Advanced Engine using conservative definition grammar and explicit context cues, with no external dependencies/models. This follows the benchmark's recommended next experiment, **not** a claim that an untested heuristic defeated all NLP libraries. Measure this candidate against frozen baseline and references before release. Do not port YAKE under its name or claim full Russian morphological parsing.

Advanced recognizes bounded naming constructions, noun-like dash definitions and explicit lists of manifestations/components. It can select repeated multiword phrases only when anchored by a nearby definition; it does not highlight arbitrary nouns or infer truth. At most three additional key terms per line; input/context are bounded. Fast rules still work when advanced is disabled or fails.

An `NLPEngine` contract uses local UTF-16 half-open offsets, a version and AbortSignal. One stateless engine per plugin, lazy initialization; no per-tab model. The controller preserves document/generation/identity guards. Visible fast pass precedes delayed advanced analysis; a finite, cursor-based background pass yields between bounded lines, has no document-sized queue and no polling when finished. Cache keys include context and mode, memory/ranges remain capped. Protected Markdown context is masked before advanced analysis and rejected again by the resolver.

## Alternatives and limits

YAKE/TextRank: smaller than embeddings but many extra highlights; a JS port needs independent boundary/quality validation. spaCy: useful grammatical candidates, integration/runtime cost unproven. ONNX/MiniLM: no demonstrated gain sufficient for hundreds of megabytes and backend/export work. Optional Python deferred.

Russian noun/verb heuristics are incomplete; ambiguous names, inflected references, unmarked semantic importance and arbitrary coreference remain unsupported. Existing silver test has already been observed: comparisons are diagnostic, not an unseen final evaluation. Synthetic acceptance cases supplement, never replace or modify references. Oversized physical lines are skipped according to performance profile. Background analysis of unparsed content fails closed; scrolling/reanalysis revisits it.

## Validation and release gate

Freeze implementation after development checks, compare identical references and negative controls; report P/R/F1, macro, TP/FP/FN separately from formatting. Measure CPU/RSS and latency in a Node synthetic harness at 1k/10k/100k words, explicitly separate from real Obsidian. Verify open/type/paste/scroll/switch/idle/unload and byte-identical synthetic notes in the actual app. Preserve v0.1.1-stable and research history. Publish v0.2.0 only after required checks and CI pass.
