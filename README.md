# Automated Microscopy Research Workstation

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white) ![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) ![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?logo=opencv&logoColor=white) ![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?logo=pytorch&logoColor=white)


## Overview

This project is a **production-style automated microscopy research prototype** for acquisition, focus measurement, autofocus, slide-scan orchestration, research analysis, reporting, and future microscope hardware control.

It is suitable for software demonstration, engineering evaluation, and hardware-integration discussion.

> **Research only:** this project is not clinically validated and is not a medical diagnostic device.

## Current Capabilities

- scientific workstation UI
- simulation acquisition
- browser live-camera acquisition
- image capture
- pixel-based focus scoring
- coarse/fine autofocus
- Z-stage abstraction
- automated scan planning
- serpentine scan execution
- pause/resume/abort
- per-field autofocus and capture
- classical-CV research analysis
- FastAPI ML inference integration
- candidate overlays
- experiment summaries
- report/history workflow
- hardware-control UI
- simulated XY stage
- serial-control architecture for custom controllers

## Engineering Status

| Capability | Status |
|---|---|
| Workstation UI | Ready |
| Simulation acquisition | Ready |
| Live camera acquisition | Ready |
| Focus measurement | Ready |
| Autofocus workflow | Ready |
| Z-stage abstraction | Ready |
| Scan orchestration | Ready |
| Simulated XY | Ready |
| ML service integration | Ready |
| Reporting/history | Ready |
| Hardware-control UI | Ready |
| Physical XY | Not commissioned |
| Physical Z commissioning | Not commissioned |
| Homing | Requires target hardware |
| Limit switches | Requires target hardware |
| µm calibration | Requires target hardware |
| Universal microscope adapter | Next phase |
| Clinical validation | Not performed |

## Core Workflow

```text
Acquire image
    ↓
Measure focus
    ↓
Controlled Z search
    ↓
Select best focus
    ↓
Capture field
    ↓
Run research analysis
    ↓
Store result
    ↓
Move to next field
    ↓
Aggregate experiment
    ↓
Generate report/history
```

## Application Workspaces

### Overview
Optical viewer, acquisition mode, focus telemetry, Z position, autofocus and analysis controls.

### Slide Scan
Grid configuration, origin, step size, serpentine traversal, progress, pause/resume/abort.

### Experiments
Experiment status, whole-slide summary, per-field results, pipeline state and logs.

### Validation
Autofocus evidence, ML service telemetry, model information and external benchmark results.

### Reports
Current analysis export and locally persisted history.

### Hardware
Controller state, arming, Z-stage state, stop/abort concepts and hardware-readiness boundary.

### Settings
Research protocol selection today; future microscope configuration, calibration, presets and safety settings.

## Technology

- Next.js
- React
- TypeScript
- Canvas
- MediaDevices
- IndexedDB
- Web Serial architecture
- Python
- OpenCV
- NumPy
- FastAPI
- Ultralytics / YOLO
- PyTorch
- Docker

## Hardware Direction

```text
Next.js Workstation
        ↓
Local Hardware Agent
        ↓
Hardware Backend
   ┌────────┼──────────────┐
   ↓        ↓              ↓
Simulator  Micro-Manager  Vendor/Custom
           Adapter        Adapter
                            ↓
                    SDK / Serial / LAN
```

## Recommended Positioning

> **AI-Assisted Automated Microscopy Research Platform with Autofocus, Hardware Automation and Validated Image-Analysis Pipeline**

> The platform implements the software architecture required for automated microscopy, including acquisition, focus measurement, autofocus, scan planning, execution, research analysis, reporting and hardware-control abstractions. The current XY implementation is simulated, and physical instrument commissioning remains the next hardware-validation phase.

## Documentation

See `docs/`:

- `ARCHITECTURE.md`
- `ENGINEERING_STATUS.md`
- `DEMO_GUIDE.md`
- `ROHA_PRECISION_DEMO.md`
- `HARDWARE_INTEGRATION_PLAN.md`
- `HARDWARE_PARAMETERS.md`
- `COMMISSIONING_GUIDE.md`
- `COMPATIBILITY_TEST_PLAN.md`
- `LIMITATIONS.md`
- `INTERVIEW_NOTES.md`
