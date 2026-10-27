# Discovery feed ranking

The student home page shows live classes and the next two weeks of classes
from every teacher, ordered by a score. The code is
[`artifacts/api-server/src/lib/ranking.ts`](../../artifacts/api-server/src/lib/ranking.ts)
(pure functions, weights in `WEIGHTS`), fed by `GET /api/feed`
([`routes/feed.ts`](../../artifacts/api-server/src/routes/feed.ts)).

## The rule in one line

Liked classes that people watch to the end rise; classes with a big crowd
but mostly dislikes sink; new teachers get a fair first look; each student
sees their own grade and subjects first.

```
score = (0.45·approval + 0.25·retention + 0.30·popularity)
        × relevance × timing × dislikeGuard  +  newTeacherBoost
```

| Signal | What it is | Why this way |
|---|---|---|
| **approval** | Wilson lower bound (95%) of likes / votes, with the teacher's past votes as a 6-vote Bayesian prior | 5 👍 / 0 👎 can't outrank 900 👍 / 100 👎; a new class starts from its teacher's record, not from zero |
| **retention** | Average share of the class actually watched (smoothed toward the teacher's average) | The hardest signal to fake, and the best sign the class was good |
| **popularity** | `watching now + 0.6·attended + 0.4·booked`, log scale, saturating at 500 | Big classes rank well without taking every slot |
| **relevance** | ×0.55 if not the student's grade; up to +25% for subjects they book; +15% for teachers they've booked | A 3rd-secondary student sees 3rd-secondary first |
| **timing** | Live = 1; upcoming 0.75–1, rising as the start nears | What's about to start matters more than next week |
| **dislikeGuard** | ×0.35 when there are 10+ votes and more than half are dislikes | However many people came, a disliked class goes down |
| **newTeacherBoost** | +0.06, fading over a teacher's first 3 lectures | Newcomers get seen; then they rank on merit |

**Who can vote:** only a student with a confirmed booking who watched at
least 3 minutes live or 5 minutes of the recording (`VOTE_MIN_*` in
`@workspace/live-core`). One vote per student per class, changeable.
This is what keeps the ranking honest: there's no voting without watching.

## Worked examples (live, same grade)

| Class | Score |
|---|---|
| Loved and big: 900 👍 / 100 👎, 300 watching, 80% watched | **0.895** |
| Small but perfect: 5 👍 / 0 👎, 12 watching | 0.584 |
| Same as the first, but not the student's grade | 0.492 |
| Brand-new teacher, no votes yet, 8 watching | 0.474 |
| Huge but disliked: 300 👍 / 700 👎, 800 watching | **0.179** |

## Tuning

Change `WEIGHTS` only, and re-run the examples above (they're in the PR
description template; a unit test should pin them once a test runner is
added). Things to watch after launch: the share of feed taps that become
bookings (CTR → conversion), and whether new teachers get their first
bookings within a week.

## Later

- **Momentum:** viewers joining in the last 5 minutes (needs viewer
  history, not just the current count).
- **Teacher reports and moderation** feeding a hard filter.
- **Diversity:** at most two cards in a row from the same teacher.
