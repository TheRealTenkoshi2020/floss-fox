# Floss Fox user-testing package (Milestone 1.1)

Prepared Oct 10, 2026 for Myke and Samira. This package only *prepares* testing. Nobody has been contacted, and there is no feedback in it. Every result field below is blank until a real session fills it.

## 1. Purpose
Find out whether a stitcher can use Floss Fox to answer **"Can I start this project with what I have, and what exactly do I still need?"** We want to see if they can do it without help, without losing or misreading quantities, and without accepting a substitution they didn't choose.

## 2. Participants (8–12 volunteers)
- **Recruit through existing contacts only:** friends, a local stitching group with the organiser's permission, or an opt-in sign-up. **Do not** post market-research requests on r/CrossStitch; its public rules prohibit them. Check any community's rules before asking.
- **Aim for a mix:** someone moving from kits to patterns; a spreadsheet user; someone with several projects on the go; someone who buys a brand different from the pattern's (Sullivans or Anchor); at least 3 people who mainly use a phone (include a foldable if anyone has one).
- **Consent:** explain the session is about the tool, not the person. Participants can stop at any time. Get permission before taking notes or recording the screen. Floss Fox sends no data anywhere, and anything a participant saves stays in their own browser.
- **Bring:** one real pattern key (thread list) and access to their own floss, or use the provided materials.

## 3. Setup (moderator)
- **Live site:** https://therealtenkoshi2020.github.io/floss-fox/. Use the participant's own device and browser where possible, and note the device, browser and screen width.
- **Fallback list** if they have no pattern: `310 x2, 415, 817, 948, 3863 x?, 413, 815, 898, 3771, BLANC`
- **Timing:** about 30–40 minutes per person. Use a stopwatch and the note sheet (section 6).
- **Moderator rules:** don't explain features unless the participant is stuck for 2 minutes or asks to give up. Log each time you help. Ask them to think aloud.

## 4. Scenarios
Read the task aloud. Don't name buttons.

**A. New project.** "Here is the thread list for a pattern you want to start. Put it into Floss Fox, keep it as a project, and find out which threads you're missing."
- *Done when:* the project is saved with every pattern colour, and the participant can say which threads still need attention.
- *Watch for:* quantity formats ("x2", unknown amounts), error messages, finding "Save project".

**B. Existing supplies.** "Go through the threads and record what you already have. One you have plenty of, one you think you have but aren't sure how much, and one you need to buy. Then show me your shopping list."
- *Done when:* the threads are marked Have, Check and Buy correctly, the uncertain one is **not** on the buy list and **not** counted as ready, and the shopping list matches.
- *Watch for:* whether Have, Check and Buy are understood; use of "Owned" for a partial skein; finding Details.

**C. Shopping.** "Pretend you went to the shop. You bought the first item on your list, but only part of the amount. A second item arrived in full. Record that and tell me whether you can start."
- *Done when:* the partial purchase still shows what's left to buy, the full one is confirmed as received, and the participant reads the summary correctly as "not ready".
- *Watch for:* "bought" being confused with "received"; the "Mark received and ready" flow; trust in the summary.

**D. Save and return.** "Close the browser tab completely. Open Floss Fox again and carry on where you left off."
- *Done when:* the project reopens with the statuses, purchases and receipts intact, and the participant continues without help.

**E. Backup.** "Make a backup of your projects. Delete this project, then bring it back from the backup."
- *Done when:* the backup file is downloaded, the project is deleted after confirmation, restored from the file, and its contents are unchanged.
- *Watch for:* where the file lands on a phone; whether the warnings about browser storage are understood.

## 5. Measures (per scenario)
| Measure | How to record |
|---|---|
| Completed without help | Yes / with help (count) / not completed |
| Time to complete | Minutes from task read to done |
| Quantities still correct | Compare the final project to the pattern key: any lost, wrong or invented quantity is a **critical error** |
| Choices still correct | Any substitution the participant didn't choose, or a status they didn't set, is a **critical error** |
| Points of confusion | Moderator notes: quote the participant's words, plus the screen or control involved |
| Errors recovered | Did they notice and fix their own mistakes? |

## 6. Moderator note sheet (copy per participant)
```
Participant #: ___  Device/browser/width: ______________  Date: ______
Stitching background: kits→patterns / spreadsheet / multi-WIP / other brand
Scenario | Done? (Y / help×n / N) | Time | Critical errors | Confusion notes
A        |                        |      |                 |
B        |                        |      |                 |
C        |                        |      |                 |
D        |                        |      |                 |
E        |                        |      |                 |
Other observations:
```

## 7. Questionnaire (after the session)
Use a 1–5 scale (1 = strongly disagree, 5 = strongly agree) unless the question says otherwise.
1. Floss Fox was easy to use.
2. I understood how many skeins of each thread I need and how many I still have to buy.
3. I'd trust the shopping list enough to take it to a shop.
4. On my phone, it was easy to move between the summary, the threads and the shopping list. (Phone users only.)
5. I understood the difference between Have, Check and Buy.
6. I understood the difference between "bought" and "received and ready".
7. Which words, buttons or screens were confusing? *(open answer)*
8. What was missing that you expected? *(open answer)*
9. Would you use Floss Fox again for your next project? Yes / maybe / no, and why? *(open answer)*
10. How do you track floss today (memory, paper, spreadsheet, app)? What would make you switch, or not? *(open answer)*
11. Optional: if Floss Fox offered a paid extra (for example multi-project planning), what would you choose? A specific offer / decline. *(Record the actual choice; general enthusiasm isn't evidence.)*

## 8. Proposed success criteria (internal targets, not benchmarks)
- At least **8 of 10** participants complete scenarios A–C without help.
- **Zero** silent critical errors (lost, invented or wrong quantities; unapproved substitutions; "ready" shown while something is unresolved) across all sessions. Any one critical error blocks the next milestone until it's fixed.
- At least 8 of 10 complete D and E. Restore leaves the project unchanged in 100% of attempts.
- Median of 4 or more on questions 1–3 and 5–6.
- Each confusing term or control mentioned by 3 or more people gets a fix before new features.
- **Decision rule:** if people like the list but not the project workflow, keep Floss Fox lightweight. If entering the legend is the biggest burden, prioritise reviewed import. If stash questions dominate, start Phase 2 (inventory).

## 9. After the sessions
- Write up the results in one table per scenario. Keep direct quotes, keep observed behaviour separate from opinions, and record the devices actually used.
- Delete any personal notes participants ask you to remove. Nothing is collected by the app itself.

---

## Addendum for Milestone 1.2 (preview build, branch `milestone-1.2`)

Run these with the 1.2 preview (open `index.html` from `floss-fox-1.2-preview.zip`, or a local server). Same volunteers, consent and recording rules as above.

| # | Scenario (read aloud) | Watch for | Success |
|---|---|---|---|
| A | "You've never seen this site. Find out what it does without help." | Do they read the headline/3 steps; time to first action | Says what it's for in < 30 s and starts typing or taps *Try an example* |
| B | "Type two of your own colors, then try the example, then get your colors back." | Do they notice the example banner; do they find *Back to my list* | Draft restored with no help; nothing saved by accident |
| C | "You're in the craft store with this list. Buy 310 and 321 (you got 1 skein of 321, the pattern needs 3)." | Use of *Shop my list → Bought it → I have it with me → amount* | Ends with 310 done, 321 still listed with 2 left |
| D | "You ordered 415 online. Record that, then pretend it arrived." | *Waiting for delivery* then *I received it* | 415 shows as bought, then as done, without a wrong "ready" in between |
| E | "Find 3799 in this 150-color project and mark it Not sure." | Search box, filters | Found in < 20 s |
| F | "Oops, you checked in 310 by mistake. Fix it." | *Done → Undo received* | Fixed in < 30 s, understands it's back on the list |

Extra 1.2 questions (1–5 agree scale): "The words on the screen were easy to understand." "I always knew what to do next." "I trusted the *Ready to stitch* message." "Shopping mode would work for me in a store." Open: "Which word or button confused you?"

Proposed 1.2 pass bar: ≥ 80% complete A–F unaided; average ≥ 4 on the four statements; zero volunteers believe a bought-but-not-received thread counts as ready.
