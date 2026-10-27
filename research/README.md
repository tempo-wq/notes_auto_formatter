# Smart Notes NLP research

This directory is an isolated experiment, not a plugin dependency. Stable plugin: `v0.1.1-stable` (`1bccd5d383f93749b190bd65faa3b2ec5e702696`). Research branch: `experiment/nlp-benchmark`; do not merge into main automatically.

## Reproduce

Use Node.js 22+ and Python 3.12 on a CPU. Commands run from repository root. Install pnpm dependencies first with `pnpm install --frozen-lockfile`.

```sh
python3.12 -m venv research/.venv
research/.venv/bin/python -m pip install -r research/requirements.lock.txt
node research/prepare.mjs
HF_HOME=research/cache/hf research/.venv/bin/python research/download_model.py
PYTHONPATH=research research/.venv/bin/python -m unittest evaluation.test_metrics -v
PYTHONPATH=research research/.venv/bin/python research/evaluation/benchmark.py
PYTHONPATH=research research/.venv/bin/python research/evaluation/cold_probe.py
PYTHONPATH=research research/.venv/bin/python research/evaluation/augment_quality.py
research/.venv/bin/python research/report.py
```

If Node.js is outside PATH, set `NODE_BINARY` to its executable. Model download is the only embedding network step. Measurements use `local_files_only=True`, CPU, one torch thread and offline environment settings. No weights or environments are tracked in Git. There are no LLM calls, training or fine-tuning.

Use the committed datasets to reproduce reported experiments. `collect.py` is a **refresh** tool: without its ignored cache it requests current source revisions, so it may generate a new dataset. Exact source revisions, text hashes and attribution are recorded in the checked-in files. Do not refresh data silently when comparing existing results.

`annotate_silver.py` contains explicit reference choices reviewed by the coding agent, not annotations produced by the extraction adapters. They remain **silver** because no independent human review occurred. The 98 corpus excerpts have no reference annotations; empty annotations there do not mean NONE. The separate 20 silver leads and 13 original challenge controls provide diagnostics only. All primary gold metrics are null. No winner is declared from these diagnostics.

## Format and evaluation

Every adapter returns `{start, end, label, score, text}`. Offsets are Python Unicode code points, `[start,end)`, in the exact `text` field; this differs from CodeMirror UTF-16. The actual TypeScript baseline bridge converts UTF-16 offsets, tested with emoji. `score` is method-specific, not a calibrated probability.

Taxonomy: DEFINITION_TERM, DEFINITION, IMPORTANT, EXAMPLE, KEY_TERM. NONE is represented by an explicit `none: true` and no spans in original controls. Overlapping reference definition and its subject are allowed in this research format. They are not directly passed to the stable renderer.

Common comparison task: **lead definition term**, collapsing DEFINITION_TERM and KEY_TERM to TERM. This does not measure exhaustive keyphrase quality. Standalone YAKE/TextRank/embeddings do not claim to classify IMPORTANT/EXAMPLE. Full per-category counts and macro F1 are saved as descriptive diagnostics, not interchangeable task performance.

Matching is maximum-cardinality one-to-one. Exact requires identical boundaries; partial allows any positive character overlap and should be interpreted cautiously. Ranking uses adapter output order (MRR@5 and P@3). The test silver set has six source documents; bootstrap intervals resample sources, but cannot measure annotation error. Development/test corpus split is by source document with seed 20261027 (14/6 documents; 68/30 excerpts). Controls are a separate challenge partition, not mixed into natural test metrics.

## Measurements and limitations

Each approach runs in its own subprocess. Record initialization, first inference, post-init RSS, 10ms-sampled peak RSS of Python plus Node children, process wall time and CPU time. Two further fresh-process probes yield three startup samples. OS filesystem caches are not flushed, so these are not disk-cold timings. Inference uses two warmups and five repeats at 100/500/2000/10000 words; with five repeats, nearest-rank p95 equals the maximum and is imprecise. This is not Obsidian UI latency or integrated-plugin RAM.

The shared pinned environment contains torch. spaCy/Thinc can detect/import optional frameworks; measured spaCy RSS is specific to this environment and is not its minimal possible footprint. Shared pages may be counted more than once when summing process RSS. Installed dependency bytes are platform-specific file sums and can overlap between approaches; do not add them across rows. Model bytes are measured separately, and spaCy's model is already included in its dependency closure.

YAKE: top 3/5, three-word phrases, Russian, dedup .9; no score-threshold tuning on the test set. TextRank: windows 2/4, damping .85, top 5, simple adjacent phrase assembly; it is a prototype, not all TextRank variants. Morphology is an auxiliary YAKE normalization layer. spaCy uses Russian dependencies and modified noun groups, not every noun. Embedding candidate generation is regex-based with a 64-phrase cap (or spaCy candidates in the three-component hybrid), then context centroid ranking with MMR. Context is chunked into 120-token windows, up to 256 windows; larger documents require further engineering. All configurations are exploratory, not optimized production algorithms.

See `reports/nlp-benchmark.md`, `reports/stable-validation.md`, `datasets/LICENSE.md`, `configs/models.json`, `results/environment.json` and raw JSON results for details.

## Первый пользовательский раунд

В `review/` сохранён выбор пользователя на двух development-примерах без подсказок алгоритмов. Категории интерпретированы агентом, поэтому это не окончательно согласованный gold. [Результаты](reports/human-review-round-01.md) и [процедура](review/README.md) отделены от исходного benchmark. Параметры моделей и стабильный плагин не менялись.
