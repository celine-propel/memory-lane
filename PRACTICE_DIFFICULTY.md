# Practice Difficulty Policy (Contextual Bandit)

This document defines the practice difficulty policy using a **contextual bandit** (adaptive AI). Assessments remain unchanged and are handled by the ML classification model.

## Overview
Each practice game has three difficulty actions: **Easy**, **Medium**, **Hard**. A contextual bandit selects the action based on recent user performance and receives a reward after each session. Over time, the bandit learns the best difficulty for each user and game.

## Difficulty Level Configuration (Per Practice)
Only the **overall difficulty level** is configured here. Exact game parameters are mapped internally in the app.

- **Easy**: reduced cognitive load (shorter length, fewer items, more time)
- **Medium**: standard load (default experience)
- **Hard**: increased load (longer length, more items, less time)

## Practice Games Covered
- **Stroop (Practice)**: Easy / Medium / Hard
- **Five-Word Recall (Practice)**: Easy / Medium / Hard
- **Orientation (Practice)**: Easy / Medium / Hard
- **Finger Tapping (Practice)**: Easy / Medium / Hard
- **Trails (Practice)**: Easy / Medium / Hard
- **Visual Puzzle (Practice)**: Easy / Medium / Hard

## Bandit Inputs (Context)
The bandit uses recent performance signals (score %, error rate, response time, trend, fatigue) to choose a difficulty level.

## Bandit Output (Action)
The selected action is one of: **Easy**, **Medium**, **Hard**.

## Notes
- Practice uses adaptive difficulty via bandit selection.
- Assessment games are not adapted to provide a baseline to compare test results with historical data from a bigger population.
