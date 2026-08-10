# Commissioning Guide

## 1. Identify Target Hardware

Record:

- microscope manufacturer/model
- camera
- XY controller
- Z controller
- objective turret
- illumination
- filters
- SDK/API
- communication interface
- homing behavior
- limit switches
- travel limits
- units/resolution

## 2. Connect Backend

Select Simulator, Micro-Manager, Vendor SDK or Serial/Network backend.

## 3. Discover Devices

Map detected hardware to:

```text
camera
xy
z
objective
illumination
filter
autofocus
```

## 4. Read-Only Property Test

Verify:

- current values
- units
- allowed values
- numeric limits
- writable/read-only status

## 5. Safety

Before motion:

- configure software limits
- confirm physical limits
- confirm homing
- confirm limit switches
- configure timeouts
- verify stop

## 6. Camera

Test:

```text
single snap
repeat snap
live mode
exposure
gain
ROI
frame timeout
```

## 7. Z

Use small safe moves only.

## 8. XY

Use small safe moves only.

## 9. Calibration

Establish:

- µm/pixel
- camera orientation
- stage direction
- XY-camera transform
- field of view
- objective calibration
- Z step

## 10. Autofocus

Run within a safe Z range and verify selected focus visually.

## 11. Scan Expansion

Progress safely:

```text
1×1
1×2
2×2
2×3
larger only after verification
```

Any unknown limit, direction error, timeout, home failure or controller fault must block automated scanning.
