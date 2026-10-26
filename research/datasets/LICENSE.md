# Dataset attribution and license

The 98 educational excerpts and 20 shortened lead-definition examples are adaptations of Russian Wikipedia text under Creative Commons Attribution-ShareAlike 4.0 International:
https://creativecommons.org/licenses/by-sa/4.0/

Every source is attributed to Wikipedia contributors in `sources.json`, with its exact revision permalink, revision timestamp and author-history link. License evidence retrieved from the Wikimedia siteinfo rightsinfo endpoint is stored in `rights.json`. Images and media were not collected. No blanket claim is made about unrelated material on Wikimedia.

Changes: MediaWiki plain-text extraction, paragraph grouping, omission of headings/overlong paragraphs, removal of combining acute stress marks U+0301, shortening of 20 lead excerpts, and addition of annotation metadata. No facts have been paraphrased by a model. The source cache is excluded from Git.

The adaptation and annotation of these excerpt files is distributed under the same CC BY-SA 4.0 license. This does not set a license for the plugin's source code. `challenge.jsonl` contains 12 original agent-authored controls, not quotations from Wikimedia; they are provided with this research dataset under CC BY-SA 4.0. They must not be mistaken for external-source data or independently human-validated gold.

The corpus's empty `annotations` means **unverified**, not NONE. Only the explicitly designated challenge controls use `none: true`. Do not evaluate the unverified corpus as a negative set.
