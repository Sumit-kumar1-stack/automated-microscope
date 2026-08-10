# Demo Guide

## Recommended 3-Minute Flow

### 00:00 — Overview
Show the workstation, optical viewer, telemetry, active protocol and controls.

### 00:20 — Focus / Z
Change Z, show focus-score change, run autofocus and show the selected best focus.

### 00:50 — Research Analysis
Load a microscopy image, run research analysis and show candidate overlay/results.

### 01:30 — Slide Scan
Example:

```text
Rows       2
Columns    3
Origin X   0
Origin Y   0
Step X     500
Step Y     500
Serpentine ON
```

Show:

```text
moving
settling
autofocusing
capturing
analyzing
```

Explain that XY is currently simulated but the orchestration is hardware-independent.

### 02:10 — Experiments
Show progress, whole-slide summary, field results and logs.

### 02:30 — Validation
Show autofocus evidence, model telemetry and documented limitations.

### 02:45 — Hardware
Show the Hardware workspace and explain the next integration phase.

## Demo Goal

Prove:

- system design
- microscopy automation workflow
- scan-state engineering
- CV/ML integration
- reporting
- hardware extensibility
- safety thinking

Do not make diagnostic-accuracy claims.
