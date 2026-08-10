# Architecture

## Design Principle

Scientific workflow logic is separated from physical microscope implementation.

```text
Scientific Workflow
    |
    |-- acquisition
    |-- focus measurement
    |-- autofocus
    |-- scan execution
    |-- analysis
    |-- reporting
    |
Hardware Abstraction
    |
    |-- camera
    |-- XY stage
    |-- Z stage
    |-- objective
    |-- illumination
    |-- filters
```

## Current Architecture

```text
Next.js Microscopy Workstation
        │
        ├── Scan / Focus Coordinator
        │       └── Camera / Z / Simulated XY
        │
        └── FastAPI ML Inference
                └── Frozen research models
```

## Target Architecture

```text
Next.js Workstation
        ↓ REST / WebSocket
Local Hardware Agent
        ↓
Hardware Backend
   ┌───────────────┬──────────────────┬─────────────────┐
   ↓               ↓                  ↓
Simulator      Micro-Manager      Vendor / Custom
                                   SDK / Serial / LAN
```

## Planned Universal Interfaces

- `MicroscopeBackend`
- `CameraController`
- `XYStageController`
- `ZStageController`
- `ObjectiveController`
- `IlluminatorController`
- `FilterController`

The scan engine and autofocus logic must not contain vendor-specific commands.

## Dynamic Capability Discovery

Example:

```json
{
  "camera": true,
  "xyStage": true,
  "zStage": true,
  "objectiveTurret": true,
  "illuminator": true,
  "filterWheel": false
}
```

The UI should enable only capabilities reported by the backend.

## Dynamic Device Properties

Example:

```json
{
  "name": "Exposure",
  "type": "number",
  "unit": "ms",
  "min": 0.1,
  "max": 10000,
  "writable": true
}
```

Recommended UI mapping:

```text
boolean       → switch
enum          → dropdown
number range  → slider + numeric input
string        → text input
read-only     → telemetry
```

## Scan Contract

```text
Move XY
  ↓
Wait until stage ready
  ↓
Settle
  ↓
Autofocus
  ↓
Capture
  ↓
Analyze
  ↓
Store result
  ↓
Next field
```
