# Expanded agent annotation v1

The user delegated annotation to the coding agent. References are explicit semantic selections authored from the committed source texts in `decisions.py`; extraction adapters and their prediction files are not used to construct them. The coding agent had prior exposure to the earlier pilot and its limitations, so this is not a fully independent blind assessment. It remains **silver-agent-reviewed**, not human gold.

## Scope and decisions

All 98 original fragments have an explicit decision. Twenty-four contain degraded mathematical extraction (fragmented rendered symbols plus raw `\\displaystyle`), and one starts inside a word after a damaged formula. Their exclusions are recorded with hashes and reasons, not treated as NONE. One clean, verbatim prefix of the integral article is recovered as a separate child, keeping its original test source ID. No formula is repaired or rewritten.

There are 74 eligible references (54 development, 20 test), 9,816 words, 342 spans and four explicit negatives. They retain the original source-document split. The raw corpus, earlier silver leads and the user's review round are unchanged. The original source license and attribution apply to these copies and annotations: see `../datasets/LICENSE.md` and `../datasets/sources.json`.

## Selection policy

- DEFINITION_TERM: an explicitly introduced concept, including nominative or inflected subjects. If its first mention is a heading, that heading can be the reference span.
- DEFINITION: the explanatory predicate/body, excluding the subject and introducing dash when practical. Qualifications and restrictions inside the body remain intact. The definition may precede the named concept. This category is for future pipelines; the current adapters do not produce definition bodies.
- IMPORTANT: a selected instructional assertion, relation, restriction or methodological instruction. An explicit «Важно» marker is not required. Preserve negation, uncertainty and attribution where selected; highlighting does not verify the source's scientific claims.
- EXAMPLE: an explicit illustration or concrete instance, with enough text to preserve its role. Dates/people are not automatically examples.
- KEY_TERM: a small set of salient concepts, methods or components. Not every noun is marked. Prefer coherent phrases; preserve the exact inflected form. Only the first chosen occurrence per fragment is selected.
- NONE: an explicitly reviewed preference for no highlights, with a written reason. Two bibliographic fragments and two peripheral etymological/publishing narratives are negatives. This is contextual salience, not a claim that these texts lack all educational value.

Overlap between categories is allowed in references: subject, body and a nested key term can have different semantic roles. Display priorities and visual density remain separate from this reference layer. The spans express one agent's conservative highlighting preferences, not a mathematically unique exhaustive set of all valid concepts. Additional algorithm phrases counted as FP can still be defensible under another policy.

## Reproduce

From repository root, use the existing pinned research environment:

```sh
PYTHONPATH=research research/.venv/bin/python -m annotation.build
PATH="<node directory>:$PATH" PYTHONPATH=research research/.venv/bin/python -m unittest evaluation.test_metrics review.test_import annotation.test_dataset -v
PATH="<node directory>:$PATH" PYTHONPATH=research research/.venv/bin/python -m annotation.evaluate
research/.venv/bin/python research/annotation/report.py
```

The builder resolves literal selections to Python Unicode-code-point offsets `[start,end)` and refuses missing phrases, unknown decisions or unexplained empty annotations. Validation checks all spans, hashes, provenance, six test topics, explicit negatives and source-disjoint splits. References are frozen before expanded predictions are generated, and their hashes are saved in each result. No thresholds or model parameters are tuned in this round.

The evaluator runs the same 13 configurations offline on CPU. Results go to `../results/expanded-silver/`, preserving previous predictions and performance samples. Common cross-component comparison is TERM (DEFINITION_TERM + KEY_TERM). IMPORTANT/EXAMPLE are assessed only for baseline/rule hybrids, which actually support them. DEFINITION body is marked unsupported rather than pretending current keyword extractors solve it. Exact and permissive overlap matching are separate. Confidence intervals resample the six test source documents, not individual paragraphs; they do not account for annotation uncertainty.

The existing test source documents were visible during the earlier pilot. Expanded results are therefore exploratory source-disjoint silver diagnostics, not a new unseen final test. No model winner should be declared from these results alone; future changes require fresh evaluation documents and explicit visual-density validation.
