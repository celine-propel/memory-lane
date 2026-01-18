# Assessment Scoring Map

This app stores game outcomes in `score.details` using field names that match the dataset variable descriptions. Below is the scoring system used for each game.

## Stroop (Executive Function)
**Game:** `stroop`

- `SATURN_SCORE_STROOP_POINTS` = `max(0, 3 - errors)` over 12 incongruent trials
- `SATURN_TIME_STROOP_ERRORS` = total incorrect selections
- `SATURN_TIME_STROOP_MEAN_ms` = mean response time (ms) across the 12 trials

Stored fields (JSON in `details`):
- `SATURN_SCORE_STROOP_POINTS`
- `SATURN_TIME_STROOP_ERRORS`
- `SATURN_TIME_STROOP_MEAN_ms`
- `correct_first_try`
- `total_trials`

## Five-Word Recall (Memory)
**Game:** `recall`

- `SATURN_SCORE_RECALL_FIVEWORDS` = number of correct words (0–5)
- `SATURN_TIME_RECALL_FIVEWORDS_ms` = recall duration (ms)

Stored fields:
- `SATURN_SCORE_RECALL_FIVEWORDS`
- `SATURN_TIME_RECALL_FIVEWORDS_ms`

## Orientation (Orientation)
**Game:** `orientation`

Device-based items:
- `SATURN_SCORE_ORIENTATION_MONTH` (0/1)
- `SATURN_SCORE_ORIENTATION_YEAR` (0/1)
- `SATURN_SCORE_ORIENTATION_DAY_OF_WEEK` (0/1)
- `SATURN_SCORE_ORIENTATION_DATE` (0/1)

Timing:
- `SATURN_TIME_ORIENTATION_MONTH_ms`
- `SATURN_TIME_ORIENTATION_YEAR_ms`
- `SATURN_TIME_ORIENTATION_DAY_OF_WEEK_ms`
- `SATURN_TIME_ORIENTATION_DATE_ms`

Custom prompts:
- `custom_score`
- `custom_total`

## Finger Tapping (Attention / Motor proxy)
**Game:** `tapping`

- `SATURN_MOTOR_SPEED_ms_per_button` = `duration_ms / taps`

Stored fields:
- `SATURN_MOTOR_SPEED_ms_per_button`
- `taps`
- `duration_s`

## Trails (Executive Function proxy)
**Game:** `trails_switch`

- `MoCA_1_SCORE_trailsB` = 1 if fully completed, else 0

Stored fields:
- `MoCA_1_SCORE_trailsB`
- `elapsed_ms`
- `errors`
- `completed_steps`
- `total_steps`
- `mean_step_ms`
- `step_ms`

## Notes
- Scores are saved via `/api/score` and stored in the `score` table.
- `score.value` stores the primary score for quick summaries; detailed fields live in `score.details` (JSON).

## Language Fluency (Dataset Reference)
The dataset’s language fluency metric is captured in:
- `MoCA_1_SCORE_fluency` (binary MoCA fluency score)
