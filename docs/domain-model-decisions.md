# Domain Model Decisions

## Progress

Decision: keep `Progress` for the current daily progress snapshot and `UserProgressStats` for accumulated stats, but centralize writes through `ProgressService` and `ProgressEvent`.

Reason: daily plan progress and lifetime stats have different reset rules. The old issue was not two collections by itself; it was scattered writes without idempotency.

## UserGoal

Decision: implement `UserGoalModel` as the persisted user-owned goal.

Fields:

- `userId`
- `primaryGoal`
- `targetLevel`
- `professionalContext`
- `deadline`

The bootstrap must return `requiresGoalSetup: true` when no goal exists. It must not create a fake goal.

## StudyBlock

Decision: removed standalone `StudyBlockModel`. Daily-plan blocks are embedded in `DailyPlan`.

Reason: current code reads and writes embedded blocks only.

## ReviewItem

Decision: removed `ReviewItemModel`. `ReviewSchedule` is the active review scheduling model.

Reason: active review flow reads and writes `ReviewSchedule` with a unique `{ userId, vocabularyItemId }` index.

## Fallback Persistence

Decision: in-memory fallback is acceptable in test and development only. Production database connection failure must fail startup instead of simulating persistence.
