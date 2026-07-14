# English OS Progress Metrics

This document defines the backend source of truth for progress numbers returned by the API. A metric must not be shown as real unless it has a persisted source, an update event, and an idempotency rule.

## Source Of Truth

- Daily plan state: `DailyPlan` documents.
- Daily progress snapshot: `Progress` documents.
- Accumulated progress snapshot: `UserProgressStats` documents.
- Idempotency ledger: `ProgressEvent` documents.
- Raw skill history: `SpeakingAttempt`, `ListeningAttempt`, `VocabularyItem`, `ReviewSchedule`, `PracticeActivity`.

`ProgressService` is responsible for updating progress metrics. Feature modules should record raw facts first, then call `ProgressService` with an idempotent source id.

## Metrics

| Metric | Meaning | Source | Formula | Update Event | Reset | Collection/Fields | Idempotency |
|---|---|---|---|---|---|---|---|
| `studiedMinutesToday` | Minutes completed in the current daily plan | Completed daily-plan blocks | Sum of completed block `durationMinutes` for today's plan | `daily_block_completed` | New daily plan/day | `Progress.studiedMinutesToday` | `ProgressEvent.eventKey = daily-block:{planId}:{blockId}:completed` |
| `totalStudyMinutes` | Lifetime study minutes | Completed blocks and speaking attempts | Sum of block minutes plus speaking attempt duration rounded up to minutes | `daily_block_completed`, `speaking_attempt_recorded` | Never | `UserProgressStats.totalStudyMinutes` | One event per block/attempt |
| `currentStreak` | Number of active study days | Accumulated activity dates | Increment once per calendar day with activity | Any accumulated progress event | Break policy not yet implemented | `UserProgressStats.currentStreak`, `lastStudyDate` | Compare `lastStudyDate` day before increment |
| `consistencyScore` | Today's plan completion percentage | Daily plan blocks | `completedBlocks / totalBlocks * 100` | `daily_block_completed` | New daily plan/day | `Progress.consistencyScore` | One event per block |
| `totalWordsPronounced` | Words spoken in analyzed recordings | Speaking transcript | Count normalized word tokens in `transcribedText` | `speaking_attempt_recorded` | Never | `UserProgressStats.totalWordsPronounced` | `speaking-attempt:{attemptId}:stats` |
| `totalPhrasesPracticed` | Count of persisted speaking attempts | Speaking attempts | `+1` per saved attempt | `speaking_attempt_recorded` | Never | `UserProgressStats.totalPhrasesPracticed` | One event per attempt |
| `totalSpeakingSessions` | Count of speaking analysis sessions | Speaking attempts | `+1` per saved attempt | `speaking_attempt_recorded` | Never | `UserProgressStats.totalSpeakingSessions` | One event per attempt |
| `totalRecordings` | Count of uploaded/analyzed recordings | Speaking attempts | `+1` per saved attempt | `speaking_attempt_recorded` | Never | `UserProgressStats.totalRecordings` | One event per attempt |
| `totalCorrections` | Count of relevant speaking differences | Speaking attempt comparison | Max of missing words, extra words, corrected words, and low-similarity penalty | `speaking_attempt_recorded` | Never | `SpeakingAttempt.correctionCount`, `UserProgressStats.totalCorrections` | One event per attempt |
| `listeningScore` | Recent listening independence/performance | Last 20 listening attempts | Average of attempt scores: comprehension base minus support/replay/unknown-word penalties | `listening_attempt_recorded`, bootstrap recalculation | Recalculated | `ListeningAttempt`, `Progress.listeningScore` | Raw attempt is unique by `{ userId, exerciseId }`; progress event by attempt id |
| `speakingScore` | Recent speaking performance estimate | Last 20 speaking attempts | Average of pronunciation, naturalness, connected speech, rhythm and fluency estimates, scaled to 0-100 | `speaking_attempt_recorded`, bootstrap recalculation | Recalculated | `SpeakingAttempt`, `Progress.speakingScore` | One event per speaking attempt |
| `vocabularyScore` | Recent vocabulary/review performance | Last 50 personal vocabulary items | Average of confidence and observed review accuracy | `vocabulary_review_recorded`, bootstrap recalculation | Recalculated | `VocabularyItem`, `Progress.vocabularyScore` | Review event key includes item id and review count |
| `pronunciationScore` | Recent pronunciation estimate | Last 20 speaking attempts | Average `SpeakingAttempt.pronunciationScore * 10` | `speaking_attempt_recorded`, bootstrap recalculation | Recalculated | `SpeakingAttempt`, `Progress.pronunciationScore` | One event per speaking attempt |
| `completedBlocks` | Lifetime completed daily-plan blocks | Daily plan block completion | `+1` per block completion event | `daily_block_completed` | Never | `Progress.completedBlocks` | One event per block |
| `completedPlans` | Lifetime completed daily plans | Daily plan completion | `+1` when final block completes a plan | `daily_block_completed` | Never | `Progress.completedPlans` | One event per plan-final block |

## Estimated Pronunciation Metrics

Speaking metrics currently use `heuristic_audio_text`: transcript similarity, local alignment, energy-based speech detection, pause/rhythm estimates, and deterministic scoring. They are useful coaching estimates, not professional acoustic phonetic measurements.

API responses keep legacy score fields for compatibility and add:

- `isEstimated: true`
- `analysisMethod: "heuristic_audio_text"`
- `confidence: 0..1`
- `pronunciationEstimate`, `rhythmEstimate`, `intonationEstimate`

## Streak Rule

`currentStreak` is updated from `lastStudyDate`:

- same calendar day: keep current streak;
- previous calendar day: increment by one;
- any older date or no previous date: reset to one.

## Remaining Work

The formulas are intentionally simple and explainable. Future work can add level normalization, weekly trend reporting, and richer review algorithms without changing the event ledger.
