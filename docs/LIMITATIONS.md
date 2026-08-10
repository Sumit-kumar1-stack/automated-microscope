# Limitations

## Research-Only Status

The platform is a research and engineering prototype, not a clinically validated diagnostic device.

## Physical Hardware Not Yet Validated

The current software has not physically validated:

- XY travel
- Z travel
- homing
- physical limit switches
- motor-driver safety
- stage repeatability
- backlash
- vibration/settling
- reconnect behavior
- emergency-stop effectiveness
- µm calibration
- objective switching
- illumination hardware

## Compatibility

Arbitrary microscopes cannot be guaranteed to work without a compatible adapter.

A target instrument requires one of:

- standard adapter
- Micro-Manager backend
- vendor SDK integration
- serial/network integration
- custom adapter

## Separate Validation Tracks

```text
Software correctness
        ↓
Hardware compatibility
        ↓
Mechanical performance
        ↓
Optical calibration
        ↓
Analysis performance
        ↓
Domain / clinical validation
```

Success in one track does not prove the others.

## Correct Positioning

Use:

> Ready for software evaluation and target-instrument integration.

Avoid:

> Universal plug-and-play, production-certified hardware control, or clinically validated diagnosis.
