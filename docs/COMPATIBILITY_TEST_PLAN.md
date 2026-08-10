# Hardware Compatibility Test Plan

## Connection

```text
Hardware agent running                 PASS/FAIL
Backend loaded                         PASS/FAIL
Instrument connected                   PASS/FAIL
```

## Discovery

```text
Device enumeration                     PASS/FAIL
Camera identified                      PASS/FAIL
XY identified                          PASS/FAIL
Z identified                           PASS/FAIL
Objective identified                   PASS/FAIL/NA
Illumination identified                PASS/FAIL/NA
```

## Properties

```text
Properties readable                    PASS/FAIL
Allowed values readable                PASS/FAIL
Read-only state respected              PASS/FAIL
Numeric limits readable                PASS/FAIL
```

## Safety

```text
Software limits configured             PASS/FAIL
Hardware-limit state readable          PASS/FAIL/NA
Homing available                       PASS/FAIL/NA
Stop available                         PASS/FAIL
Busy state available                   PASS/FAIL
Fault state available                  PASS/FAIL
```

## Camera

```text
Snap                                   PASS/FAIL
Repeat snap                            PASS/FAIL
Exposure read/write                    PASS/FAIL/NA
Gain read/write                        PASS/FAIL/NA
Live mode                              PASS/FAIL/NA
```

## Z

```text
Read position                          PASS/FAIL
Small positive move                    PASS/FAIL
Small negative move                    PASS/FAIL
Stop                                   PASS/FAIL
Home                                   PASS/FAIL/NA
```

## XY

```text
Read position                          PASS/FAIL
Small X move                           PASS/FAIL
Small Y move                           PASS/FAIL
Return                                 PASS/FAIL
Stop                                   PASS/FAIL
Home                                   PASS/FAIL/NA
```

## Workflow

```text
Focus score from real frame            PASS/FAIL
Autofocus                              PASS/FAIL
1-field capture                        PASS/FAIL
Scan dry-run                           PASS/FAIL
2×2 physical scan                      PASS/FAIL
```

## Final Report

```text
ENGINEERING TRIAL: READY / NOT READY
Physical safety validation: REQUIRED / COMPLETE
Optical calibration: REQUIRED / COMPLETE
Analysis performance: SEPARATE VALIDATION TRACK
```
