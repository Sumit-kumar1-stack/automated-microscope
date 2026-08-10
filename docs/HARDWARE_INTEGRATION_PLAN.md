# Hardware Integration Plan

## Goal

Make the platform instrument-integration-ready for engineering trials without requiring ownership of the target microscope during most development.

## H1 — Hardware Capability Model

Create:

- `MicroscopeCapabilities`
- `MicroscopeState`
- `DeviceDescriptor`
- `DeviceProperty`
- `HardwareFault`
- `HardwareLimits`
- `CalibrationProfile`

## H2 — Universal Device Interfaces

Implement:

- `MicroscopeBackend`
- `CameraController`
- `XYStageController`
- `ZStageController`
- `ObjectiveController`
- `IlluminatorController`
- `FilterController`

## H3 — Local Hardware Agent

Responsibilities:

- connection lifecycle
- backend selection
- device discovery
- capability discovery
- property read/write
- command queue
- telemetry
- state synchronization
- timeouts
- faults
- stop
- calibration state

Suggested API:

```text
GET    /hardware/health
GET    /hardware/backends
GET    /hardware/devices
GET    /hardware/capabilities
GET    /hardware/state
POST   /hardware/connect
POST   /hardware/disconnect
GET    /hardware/properties
PATCH  /hardware/properties
POST   /hardware/camera/snap
POST   /hardware/xy/move
POST   /hardware/xy/home
POST   /hardware/z/move
POST   /hardware/z/home
POST   /hardware/stop
GET    /hardware/faults
WS     /hardware/events
```

## H4 — High-Fidelity Virtual Microscope

Simulate:

- camera
- XY
- Z
- objective
- illumination
- shutter
- filter wheel
- autofocus device

Fault injection:

- disconnect
- timeout
- stage busy
- travel limit
- homing failure
- camera timeout
- invalid property
- stale telemetry
- XY failure
- Z failure
- autofocus failure

## H5 — Micro-Manager Backend

Use as the first general commercial-microscope compatibility path.

## H6 — Dynamic Capability / Property Discovery

Generate UI controls based on reported device properties.

## H7 — Microscope Settings UI

Sections:

```text
Microscope
Camera
Optics
XY Stage
Z / Focus
Illumination
Channels / Filters
Autofocus
Calibration
Safety
Vendor Properties
```

## H8 — Presets

Examples:

- Brightfield 10×
- Brightfield 40×
- Blood Smear Research
- Fast Preview
- High Quality Capture

## H9 — Calibration

Support:

- µm/pixel
- camera rotation
- mirror X/Y
- stage direction
- XY-camera transform
- field of view
- overlap
- Z step
- backlash
- objective offsets

## H10 — Safety / Interlocks

Software:

- required homing
- soft limits
- command timeout
- movement timeout
- busy-state check
- stop
- fault state
- reconnect policy
- safe shutdown

Physical hardware:

- limit switches
- hard travel limits
- motor disable
- physical emergency stop

## H11 — Commissioning Wizard

```text
Select backend
    ↓
Connect
    ↓
Discover devices
    ↓
Map roles
    ↓
Read capabilities
    ↓
Configure safety
    ↓
Home
    ↓
Camera test
    ↓
Small motion
    ↓
Calibration
    ↓
Autofocus
    ↓
Trial scan
```

## H12 — Hardware Conformance Test

Produce pass/fail results for connection, discovery, properties, camera, XY, Z, stop, home, autofocus and small scan.

## Completion Statement

> The platform is instrument-integration-ready for engineering trials. Physical performance and safety still require validation on the target microscope.
