# Hardware Parameters

Not every microscope will expose every property. The UI should display only capabilities reported by the connected backend.

## Camera

```text
Exposure
Gain
Binning
ROI
Resolution
Pixel format
Trigger mode
Frame rate
Live mode
Sensor temperature
Frame timeout
Busy state
```

## XY Stage

```text
Current X/Y
Min/Max X/Y
Absolute move
Relative move
Speed
Acceleration
Settling time
Home
Origin
Busy state
Backlash
Axis inversion
Hardware limits
Software limits
```

Preferred software unit: `µm`.

## Z / Focus

```text
Current Z
Min/Max Z
Absolute move
Relative move
Coarse step
Fine step
Velocity
Settling time
Backlash
Approach direction
Home
Busy state
Hardware limits
Software limits
```

## Objective Turret

```text
Current objective
Available objectives
Magnification
Numerical aperture
Immersion type
Objective label
Parfocal offset
```

## Illumination

```text
Source
On/Off
Intensity
Channel
Wavelength
Shutter state
Transmitted light
Fluorescence source
```

## Filters / Channels

```text
Excitation
Emission
Dichroic
Filter-wheel position
Channel preset
```

## Calibration

```text
µm/pixel
Camera rotation
Mirror X/Y
Stage direction
XY-camera transform
Field of view
Overlap %
Z step
Backlash
Objective-specific calibration
```

## Autofocus

```text
Focus metric
Search min/max Z
Coarse step
Fine step
Fine radius
Stage settle time
Camera settle time
Maximum duration
Minimum acceptable score
Retry count
Failure policy
Backlash direction
```

## Scan

```text
Rows
Columns
Origin X/Y
Step X/Y
Overlap
Serpentine
Autofocus per field
Autofocus every N fields
Settle time
Capture delay
Retries
Skip failed field
Abort on failure
Return home
```

## Safety

```text
Homing required
Soft limits
Hardware limits available
Maximum X/Y/Z speed
Command timeout
Movement timeout
Controller fault
Communication fault
Busy state
Stop
Emergency stop
Motor disable
Reconnect behavior
Safe shutdown behavior
```

## Access Levels

### Operator
Objective, exposure, gain, illumination, scan region, channels, autofocus, preset.

### Advanced
Stage speed, settling, focus range, overlap, binning, ROI, autofocus step, retry policy.

### Service / Integration
Backend, device mapping, vendor properties, axis inversion, travel limits, homing, backlash, calibration, timeouts and controller-specific settings.
