# Roha Precision — Engineering Demo

## Purpose

This demo is intended to demonstrate software engineering, microscopy automation architecture, CV/ML integration, scan orchestration and readiness for future physical microscope integration.

## What Roha Precision Can Evaluate Today

- workstation workflow
- live/simulated acquisition
- focus measurement
- autofocus orchestration
- scan planning
- scan state machine
- pause/resume/abort
- research analysis integration
- experiment summaries
- reporting/history
- hardware abstraction
- proposed commissioning process

## Current Hardware Boundary

```text
Camera acquisition             SOFTWARE READY
Focus measurement              SOFTWARE READY
Autofocus workflow             SOFTWARE READY
Z-stage abstraction            SOFTWARE READY
Scan orchestration             SOFTWARE READY
Simulated XY                   READY

Physical XY                    NOT COMMISSIONED
Physical Z                     NOT COMMISSIONED
Homing                         TARGET DEVICE REQUIRED
Limit switches                 TARGET DEVICE REQUIRED
µm calibration                 TARGET DEVICE REQUIRED
Vendor adapter                 TARGET DEVICE REQUIRED
Physical safety validation     TARGET DEVICE REQUIRED
```

## Suggested Message

> I have developed an automated microscopy research workstation covering acquisition, autofocus, scan orchestration, research analysis, reporting and hardware-control abstractions. The current version uses simulated XY movement so the full software workflow can be tested safely without physical hardware. The next phase is target-instrument integration through a hardware adapter, calibration and commissioning process.

## Information Needed for a Physical Trial

- microscope manufacturer/model
- camera manufacturer/model
- XY stage/controller
- Z/focus controller
- objective turret
- illumination controller
- communication type
- vendor SDK/API
- homing mechanism
- limit switches
- travel ranges
- stage units
- controller documentation

## Suggested First Physical Trial

```text
Connect
  ↓
Read device state
  ↓
Discover capabilities
  ↓
Read properties
  ↓
Camera snap
  ↓
Small Z movement
  ↓
Stop
  ↓
Small XY movement
  ↓
Stop
  ↓
Home
  ↓
Calibrate
  ↓
Autofocus
  ↓
1-field capture
  ↓
2×2 scan
```

Use the phrase:

> Ready for software demonstration and hardware-integration discussion.

Avoid:

> Plug in any microscope and it will immediately work.
