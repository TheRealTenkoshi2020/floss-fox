# Pip’s skein estimator: community evidence and provisional averages

Research date: 14 October 2026. Model: `pip-dmc-full-cross-community-v2`.

Pip now uses **about 2,100 full crosses per 8 m DMC cotton skein at 14 stitches/inch with two strands**, before the selected extra. This is a rounded, provisional average from a small, search-selected set of reports. It is not a measured population average or a guarantee. Most included reports favor efficient stitching.

The code, source ledger and arithmetic are supplied so Mouse does not need to repeat this research. `evidence.json` contains inclusion/exclusion decisions and numerical inputs. `tests/skeins_unit.js` reproduces the group calculations from reported lengths and counts.

## What was searched

Public discussions on Reddit’s r/CrossStitch, YouTube/FlossTube, Facebook, Instagram and TikTok were searched, along with creator blogs and cross-stitch forums. The usable numerical evidence came from Reddit and a creator’s own chart. No independently usable numerical yield was verified from Facebook, Instagram or YouTube. TikTok retrieval was blocked. Do not describe those other platforms as validating the average.

Reddit evidence was available as indexed post/comment text; direct fetching was unavailable. The June 2024 experiment’s comment explicitly confirms 18-count, two strands over one. Original images/videos and stitch counts were not independently audited. Usernames were not retrieved, so distinct reports cannot be claimed as verified distinct people. Repeated search hits, upvotes, likes and calculator citations carry no additional weight.

## Included source groups

Every yield below is for a nominal 8 m, six-strand skein. All five included groups describe two-strand full crosses at effective 14–18 count. Each source group gets equal weight; one creator’s multi-row chart is averaged within its group first.

| Group | Reported setup and result | Measurement status | Equivalent yield at 14-count / 2 strands |
|---|---|---|---:|
| [Reddit measured-length comment, 17 June 2025](https://www.reddit.com/r/CrossStitch/comments/1ld12t8) | 14-count; one 1 m single strand folded for a two-strand loop start; about 40 crosses per cut | Measured-length self-report, extrapolated to 1,920 per skein; approximate | 1,920.00 |
| [Reddit measured-length post, 28 March 2023](https://www.reddit.com/r/CrossStitch/comments/124yihl) | 16-count or 32 over two; 24 in single strand folded to two strands; 32–35 crosses; Danish rows, little carrying | Measured-length range, extrapolated to 2,519.69–2,755.91; our midpoint is 2,637.80 | 2,308.07 |
| [Reddit whole-skein post, 30 September 2019](https://www.reddit.com/r/CrossStitch/comments/dbeuc9) | DMC 927; 18-count; two strands over one; 2,788 crosses in a large block | Self-reported whole-skein count | 2,168.44 |
| [Reddit whole-skein experiment, 23 June 2024](https://www.reddit.com/r/CrossStitch/comments/1dmthpn) | DMC; 18-count; two strands over one; 2,920 crosses; loop starts and very short discarded ends | Self-reported whole-skein count with explicit settings clarification | 2,271.11 |
| [Lindy Stitches chart, 20 October 2021](https://www.lindystitches.com/blogs/news/how-many-skeins-of-floss-will-i-need) | Two strands: 210 crosses per yard on 14-count, 250 on 16-count, 275 on 18-count | Creator combines counting her own stitches and estimation; lower-quality evidence than a documented trial; three normalized rows averaged as one group | 1,874.13 |

The Lindy chart’s original image was visually inspected. Per-yard figures refer to the purchased floss length, as confirmed by the creator’s worked skein example. Use `8 / 0.9144` yards for an exact nominal 8 m skein, rather than treating the rounded 8.7-yard label as exact. On linen/evenweave, the chart’s 28/32/36-count rows are equivalent to 14/16/18 stitches per inch when worked over two.

## Reproducible arithmetic

For a single strand folded into two, do not divide the number of cuts by two again: each separated strand makes one doubled working length.

```text
14-count length report:
40 crosses × 6 separated strands × 8 one-metre cuts = 1,920

16-count length report, using exact 8 m:
24 inches = 0.6096 m of one single strand before folding
48 single-strand metres / 0.6096 = 78.740157 folded working lengths
32–35 crosses × 78.740157 = 2,519.685039–2,755.905512
Midpoint = 2,637.795276

Normalize size and strands:
yield14 = reportedYield × (14 / effectiveCount) × (strands / 2)

Lindy chart group:
mean(210 × 8/0.9144,
     250 × 8/0.9144 × 14/16,
     275 × 8/0.9144 × 14/18) = 1,874.129160

Equal-group arithmetic mean:
(1,920 + 2,308.070866 + 2,168.444444 + 2,271.111111 + 1,874.129160) / 5
= 2,108.351116
Rounded to nearest 100 => provisional baseline 2,100
```

The group median is 2,168.44; group summaries span 1,874.13–2,308.07. These are descriptions of this selected dataset, not confidence intervals or bounds for actual use. The four Reddit groups alone average 2,166.91 after normalization; the two strictly eligible whole-skein 18-count reports average 2,854 at their original count. Including the lower-quality chart lowers the combined baseline.

The averaging targets reported stitches per skein. It is not a stitch-weighted average of thread consumption. Linear scaling across stitch sizes and inverse scaling across strand counts remain modeling assumptions; fabric thickness, tails, tension and carrying do not scale perfectly. Direct included evidence covers two strands at effective 14–18 count. Other counts and strands are extrapolations.

## Pip’s implementation values

| Effective count | Provisional baseline, 2 strands | Planning coverage with 20% extra |
|---|---:|---:|
| 14, or 28 over two | 2,100 crosses/skein | 1,750 crosses/skein |
| 16, or 32 over two | 2,400 crosses/skein | 2,000 crosses/skein |
| 18, or 36 over two | 2,700 crosses/skein | 2,250 crosses/skein |

The table is the scaled model, not three independently measured community averages.

```text
coverage = 2,100 × (effectiveCount / 14) × (2 / strands)
baseSkeins = fullCrossCount / coverage
planningSkeins = baseSkeins × (1 + extraPercent / 100)
wholeSkeinsBeforeStock = ceil(planningSkeins)
```

For 2,400 crosses on 14-count with two strands: base = 1.142857 skeins, planning with 20% = 1.371429, buy 2 before stock. With one confirmed skein available, subtract first and buy 1 more. Round separately per purchase color; keep fractional calculations until that step.

Discarded ends are already present in the source yields. Do **not** also apply the old `15/18` usable-thread factor or `6/count` path formula. The selected extra is additional planning allowance. Its default of 20% is a product choice, not an empirically validated percentile. Extra choices include 50% and 100% for greater allowance; at 14-count/two strands, 100% budgets 1,050 crosses per skein. No option guarantees enough floss for every stitching style.

## Reports retained outside the mean

| Source | What it says | Why it does not enter the core average |
|---|---|---|
| [36-count linen skein, June 2025](https://www.reddit.com/r/CrossStitch/comments/1ld12t8) | Approximately 2,300 crosses per skein | Actual DMC/two-strand/over-two settings are suggested by surrounding discussion, not all explicitly confirmed by the retrieved OP text. Its 14-count equivalent would be 1,788.89 if those assumptions hold. The eligible 14-count measured-length comment in that thread is counted separately. |
| [32-count linen skein, January 2024](https://www.reddit.com/r/CrossStitch/comments/18ymsil) | Almost 2,900 crosses over two, efficient loop starts | Strand count not explicitly stated; a loop start alone does not establish two strands. |
| [Single skein experiment, March 2026](https://www.reddit.com/r/CrossStitch/comments/1rwd52x/fo_a_single_skein_of_floss/) | 2,900 full crosses plus 50 half stitches at 18-count/two strands; approximately 95% of skein weight remained on fabric | Mixed stitch types. Do not invent a half-stitch conversion. Useful efficient-stitching benchmark. |
| [14-count budget discussion, May 2025](https://www.reddit.com/r/CrossStitch/comments/1kl2lnj) | About 1,700 per skein | Unsourced rule of thumb without a reported measurement. |
| [14-count/two-strand discussion, May 2026](https://www.reddit.com/r/CrossStitch/comments/1tpba5h/chat_color_chart_given_but_how_many_skeins_will_i/) | 1,000–1,500 per skein | Unsourced rule of thumb; signals possible higher consumption, not a measured low-yield trial. |
| [Eponases, January 2014](https://www.eponases.com/blog/2014/01/cross-stitch-stitches-per-skein/) | Measured 404 crosses from a 1 m cut; forecasts 3,232, then budgets 3,000 on 18-count | Author’s strand count unavailable. |
| [Crossstitchforum, October 2014](https://www.crossstitchforum.com/viewtopic.php?t=26314) | 25-count, one over one full crosses; 45 per strand cut × 6 × 16 cuts = 4,320; budgets 4,000 | Genuine measured-length self-report, but outside core two-strand/14–18 conditions. Cross-country stitching yields much less under proportional normalization: 1,209.6 at 14-count/two strands. Keep this as evidence that the efficient-sample baseline can understate use. |

Other guesses, conservative personal budgets, unclear settings and copied calculator values are listed in `evidence.json`. Do not average them together with measurements as if each were a completed trial. Kathleen Dyer’s FAQ and Lord Libidan’s calculator/test table remain contextual references; they do not receive an extra vote each time a commenter repeats them.

## Confidence and remaining work

This research improves traceability and gives a reproducible provisional baseline. It does not establish a reliable universal average. Selection bias, approximate length reports, unverified distinct contributors and sparse conditions limit confidence; confetti, many starts and long carries are poorly represented.

Do not automatically modify stated designer quantities, confirmed stock, or manual Have enough choices. The model identifier changes, so existing checked-estimate fingerprints ask for rechecking; saved settings retain their compatible version. Real Barbara/Amanda trials and a complete pattern fixture remain pending. Record actual materials, fabric count/over, strands, full/other stitch types, starting amount, leftovers and method in future trials before recalibrating.
