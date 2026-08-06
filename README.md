# Automated Microscope Research Platform

A browser-based **automated microscopy research prototype** that demonstrates autofocus, live camera analysis, configurable test profiles, computer-vision candidate detection, hardware-safe Z-axis control, analysis history, and downloadable PDF/image reports.

> **Research prototype only.**
> This project is not clinically validated and must not be used for medical diagnosis, treatment decisions, or unattended production microscopy.

---

## Overview

This project explores the architecture of an automated microscope system using a combination of:

* Image acquisition
* Focus-quality measurement
* Coarse-to-fine autofocus
* Classical computer vision
* Configurable test profiles
* Analysis snapshot generation
* PDF reporting
* Local analysis history
* Browser-to-hardware communication

The system currently runs without physical microscope hardware through a synthetic microscopy simulation, while also supporting real webcam/USB microscope input.

A hardware mode is included for future integration with an Arduino/ESP32-controlled Z-axis motor.

---

## Live Architecture

```text
                TEST PROFILE
                     │
                     ▼
              KNOWLEDGE CONFIG
                     │
                     ▼
          ┌──────────────────────┐
          │  IMAGE ACQUISITION   │
          └──────────────────────┘
             │              │
             │              │
       Simulation       Live Camera
             │              │
             └──────┬───────┘
                    ▼
           FOCUS MEASUREMENT
          Variance of Laplacian
                    │
                    ▼
             AUTOFOCUS ENGINE
             Coarse → Fine Z
                    │
                    ▼
            IMAGE ANALYSIS
      Color masks + connected
             components
                    │
                    ▼
           CANDIDATE DETECTION
        RBC / WBC / Platelet
             research classes
                    │
                    ▼
           ANALYSIS SNAPSHOT
          image + measurements
                    │
             ┌──────┴───────┐
             ▼              ▼
         PDF REPORT     ANALYZED PNG
             │
             ▼
        LOCAL HISTORY
          IndexedDB
```

---

# Features

## 1. Synthetic Microscope Simulation

The project contains a generated blood-field-like microscopy scene that allows the complete pipeline to be demonstrated without specialized hardware.

The simulator includes:

* Synthetic microscope field
* Virtual Z-axis position
* Controlled defocus blur
* Known optimal focal position
* Real focus measurement from rendered pixels

This allows autofocus performance to be verified against a known simulator optimum.

---

## 2. Real Image-Based Focus Measurement

Image sharpness is measured using **Variance of Laplacian**.

The autofocus engine does not directly use the simulator's known focal point.

Instead, each candidate Z position produces an image, and the focus score is calculated from that image.

```text
Move Z
   ↓
Acquire Image
   ↓
Calculate Laplacian
   ↓
Calculate Variance
   ↓
Focus Score
```

Higher focus scores generally indicate greater high-frequency image detail.

---

## 3. Coarse-to-Fine Autofocus

The autofocus algorithm performs two stages.

### Coarse Search

A larger Z interval is searched to locate the approximate focus peak.

```text
Z10
Z14
Z18
Z22
...
Z90
```

### Fine Search

The system then evaluates positions near the best coarse candidate.

```text
Coarse Peak
     ↓
Z59
Z60
Z61
Z62
Z63
Z64
Z65
```

The Z position with the strongest measured focus score is selected.

The autofocus process supports:

* Cancellation
* Progress reporting
* Coarse/fine phases
* Measurement history
* Final verification
* Hardware-compatible movement callbacks

---

# 4. Live Camera Mode

The application supports:

```text
Laptop webcam
USB camera
USB microscope camera
```

through the browser `MediaDevices` API.

Live camera frames are continuously displayed and periodically analyzed for focus quality.

The image is downsampled before focus measurement to reduce browser CPU usage.

---

# 5. Hardware Mode

The project includes a browser-based serial hardware abstraction for future microscope stage integration.

Architecture:

```text
Browser
   │
   │ Web Serial
   ▼
Arduino / ESP32
   │
   ▼
Motor Driver
   │
   ▼
Stepper Motor
   │
   ▼
Microscope Z Axis
```

Possible controllers include:

* Arduino
* ESP32

Possible motor systems include:

* 28BYJ-48 for basic proof-of-motion testing
* NEMA stepper motors for more serious stage development
* A4988
* DRV8825
* TMC2209

---

## Hardware Safety Interlocks

Motor movement is not immediately enabled after connecting hardware.

The system requires:

```text
Serial Connected
       +
Live Camera Active
       +
Explicit Motor Arming
       ↓
Motor Movement Allowed
```

Additional software protections include:

* Limited Z range
* Maximum movement per serial command
* Autofocus cancellation
* Emergency stop
* Automatic motor disarming

### Important

A real production microscope should additionally implement hardware-side safety:

* Physical minimum limit switch
* Physical maximum limit switch
* Homing
* Controller-side travel limits
* Position acknowledgement
* Watchdog
* Motor-disable state
* Fault state

Browser-side limits alone should never be considered sufficient for unattended physical motion.

---

# 6. Research Cell Candidate Analysis

The current detector is an explainable **classical computer-vision candidate detector**.

Pipeline:

```text
Microscope Frame
      ↓
Downsample
      ↓
Color Classification
      ↓
Binary Masks
      ↓
Connected Components
      ↓
Size / Shape Filtering
      ↓
Candidate Classification
```

Current research candidate classes:

* RBC-like
* WBC-like
* Platelet-like

Each candidate can be displayed with:

* Bounding box
* Candidate class
* Heuristic candidate score

The displayed heuristic value is **not model confidence** and must not be interpreted as diagnostic certainty.

---

# 7. Configurable Test Profiles

The application uses a profile-driven knowledge layer instead of hard-coding the complete system around one experiment.

Current profiles include:

### Blood Cell Research

Implemented detector:

```text
Classical CV
Color segmentation
Connected components
Morphological filtering
```

Measurements include:

* Focus score
* Relative detail
* RBC-like candidate count
* WBC-like candidate count
* Platelet-like candidate count
* Total candidates
* Foreground coverage
* Processing time

---

### Focus Quality Assessment

Used for optical/focus evaluation without biological classification.

Measurements include:

* Focus score
* Relative detail
* Z position

---

### GI Parasite Egg Screening

Currently included as a **knowledge configuration only**.

Target-specific automated detection has not yet been implemented.

A future version could integrate:

* Object detection
* Image segmentation
* Morphological analysis
* Egg size measurement

---

### Blood Parasite Screening

Currently included as a **future research configuration**.

A validated target-specific model would be required before automatic candidate screening should be enabled.

---

# 8. Knowledge-Based Configuration

Each test profile defines:

```text
Profile ID
Profile Name
Version
Specimen Type
Focus Method
Minimum Focus Requirement
Detector Type
Target Classes
Measurements
Report Configuration
Disclaimer
```

This allows the microscope pipeline to evolve from:

```text
one hard-coded detector
```

into:

```text
Test Profile
     ↓
Detector Selection
     ↓
Measurement Configuration
     ↓
Report Configuration
```

Future detector implementations could include:

```text
Classical CV
YOLO
ONNX Runtime
Segmentation Model
Custom Research Model
```

---

# 9. Analysis Snapshot

Each completed analysis can generate a frozen snapshot containing:

```text
Analysis ID
Timestamp
Test Profile
Profile Version
Acquisition Mode
Focus Score
Relative Detail
Focus Status
Z Position
Analysis Results
Analyzed Image
```

The snapshot combines:

```text
Base microscope image
        +
Detection overlay
        ↓
Final analyzed image
```

This ensures the generated report refers to the exact analyzed frame even if the live camera subsequently changes.

---

# 10. Downloadable Analyzed Image

The analyzed microscopy field can be exported as PNG.

The exported image includes:

* Optical field
* Detection bounding boxes
* Detection labels
* Research-use watermark

Example action:

```text
DOWNLOAD ANALYZED IMAGE
```

---

# 11. PDF Analysis Report

The application can generate a downloadable research PDF directly in the browser using `jsPDF`.

The report includes:

* Report/analysis ID
* Date and time
* Test profile
* Profile version
* Specimen configuration
* Detector type
* Focus method
* Focus state
* Configured measurements
* Analyzed image
* Knowledge configuration
* Research disclaimer

No report-generation server is currently required.

---

# 12. Analysis History

Completed analyses are stored locally using browser **IndexedDB**.

Each record contains:

* Analysis image
* Profile
* Date/time
* Focus score
* Candidate count
* Acquisition mode

History actions include:

```text
PDF
IMAGE
DELETE
```

The current implementation stores data on the local browser/device only.

It is not cloud synchronized.

A production architecture could replace IndexedDB with:

```text
Frontend
   ↓
API
   ↓
PostgreSQL
   +
Object Storage
```

---

# Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* HTML Canvas API
* Browser MediaDevices API
* IndexedDB

## Computer Vision

* Variance of Laplacian
* RGB/color-space heuristics
* Binary masks
* Connected-component analysis
* Morphological candidate filtering

## Reporting

* jsPDF
* Canvas image composition
* PNG export

## Hardware Integration

* Web Serial API
* Arduino / ESP32-ready command architecture

## Deployment

* GitHub
* Vercel

---

# Project Structure

```text
automated-microscope
│
├── src
│   │
│   ├── app
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components
│   │   ├── AnalysisHistory.tsx
│   │   ├── CellAnalysisPanel.tsx
│   │   ├── KnowledgeBasePanel.tsx
│   │   ├── MicroscopePrototype.tsx
│   │   ├── ReportActions.tsx
│   │   └── TestProfileSelector.tsx
│   │
│   ├── knowledge
│   │   └── test-profiles.ts
│   │
│   └── lib
│       ├── analysis-history.ts
│       ├── analysis-snapshot.ts
│       ├── autofocus-engine.ts
│       ├── cell-analysis.ts
│       ├── focus.ts
│       ├── microscope-config.ts
│       ├── serial-controller.ts
│       ├── synthetic-field.ts
│       │
│       └── reports
│           ├── capture-analysis-image.ts
│           ├── generate-pdf-report.ts
│           └── report-measurements.ts
│
├── package.json
├── package-lock.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

---

# Running Locally

Clone the repository:

```bash
git clone https://github.com/Sumit-kumar1-stack/automated-microscope.git
```

Enter the project:

```bash
cd automated-microscope
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Production Build

Run:

```bash
npm run build
```

A successful build should complete:

```text
Next.js production compilation
TypeScript validation
Static page generation
Final page optimization
```

Start the production build locally with:

```bash
npm start
```

---

# Recommended Demo

For an interview or research demonstration:

## Demo 1 — Autofocus

```text
Simulation
    ↓
Move Z away from focus
    ↓
RUN AUTOFOCUS
    ↓
Observe coarse search
    ↓
Observe fine search
    ↓
AUTOFOCUS LOCKED
```

Explain:

> The simulator contains a known optimum only for validation. The autofocus engine does not directly use that value. It selects the focal plane based on measured image sharpness.

---

## Demo 2 — Field Analysis

```text
Blood Cell Research
       ↓
RUN AUTOFOCUS
       ↓
ANALYZE CURRENT FIELD
       ↓
Candidate bounding boxes
       ↓
Candidate counts
```

Explain:

> The current detector is an explainable classical computer-vision research detector. It validates the acquisition, focus, segmentation, detection and reporting architecture. A target-specific validated AI model can later replace this detector without changing the full system architecture.

---

## Demo 3 — Reporting

After analysis:

```text
DOWNLOAD ANALYZED IMAGE
```

Then:

```text
DOWNLOAD PDF REPORT
```

Show:

* Detection image
* Focus measurement
* Candidate counts
* Test configuration
* Research disclaimer

---

## Demo 4 — Knowledge Profiles

Switch from:

```text
Blood Cell Research
```

to:

```text
Focus Quality Assessment
```

and explain that measurements and analysis behavior are controlled by the selected protocol.

Then show:

```text
GI Parasite Egg Screening
```

and explain that the knowledge configuration exists but automatic detection is intentionally blocked until a target-specific detector is implemented and validated.

---

## Demo 5 — Live Camera

Select:

```text
Live Camera
```

Then:

```text
START CAMERA
```

The browser calculates real-time focus measurements from camera pixels.

This demonstrates that the focus pipeline is not limited to synthetic imagery.

---

# Design Decisions

## Why Variance of Laplacian?

It provides a computationally inexpensive estimate of edge sharpness and is suitable for demonstrating image-based autofocus.

---

## Why Coarse-to-Fine Search?

Scanning every possible motor position is inefficient.

A coarse search identifies the approximate focus region, and a fine search provides higher positional resolution around the focus peak.

---

## Why Downsample Camera Frames?

Full-resolution image processing for every live frame would unnecessarily increase CPU usage.

A smaller analysis frame provides much lower computational cost while preserving enough high-frequency information for focus estimation.

---

## Why Test Profiles?

Different microscopy workflows require different:

* Target classes
* Measurements
* Image-quality requirements
* Algorithms
* Reporting formats

A profile-driven architecture avoids hard-coding the platform around a single use case.

---

## Why IndexedDB?

Analysis images are larger than normal configuration values.

IndexedDB provides better browser-side storage for structured records and image data than `localStorage`.

---

# Current Limitations

The current project is a research engineering prototype.

Limitations include:

* No clinical validation
* No diagnostic interpretation
* No validated parasite detector
* No physical XY stage
* No physical Z limit switches
* No hardware homing
* No hardware position feedback
* No server-side report storage
* Browser-local history only
* Classical CV blood candidate detection rather than a trained medical model

These are intentionally stated rather than hidden because the project is intended to demonstrate engineering architecture and research methodology.

---

# Future Development

## Phase 4 — Automated Slide Scanning

Planned:

```text
XY stage simulation
Serpentine scanning
Per-field autofocus
Per-field analysis
Empty-region skipping
Adaptive focus prediction
```

Example scan:

```text
01 → 02 → 03 → 04 → 05
                    ↓
10 ← 09 ← 08 ← 07 ← 06
↓
11 → 12 → 13 → 14 → 15
```

---

## Phase 5 — Multi-Field Reports

Aggregate:

* Fields scanned
* Fields skipped
* Total candidates
* Average focus
* Per-field images
* Scan coverage
* Processing time

into a specimen-level PDF.

---

## Phase 6 — AI Model Integration

Introduce a detector interface:

```ts
interface Detector {
  analyze(
    image: ImageData,
    profile: TestProfile,
  ): Promise<AnalysisResult>;
}
```

Possible implementations:

```text
ClassicalCvDetector
YoloDetector
OnnxDetector
SegmentationDetector
```

---

## Phase 7 — Physical Stage Integration

Production-oriented hardware would add:

* Stepper motor
* Microstepping driver
* Z-axis coupling
* XY stage
* Limit switches
* Homing
* Position feedback
* Controller watchdog
* Firmware-side safety limits

---

## Phase 8 — Cloud Data Platform

Potential architecture:

```text
Microscope Client
        ↓
Analysis API
        ↓
PostgreSQL
        +
Object Storage
        ↓
Research Dashboard
```

This would enable:

* Multi-device history
* User accounts
* Sample tracking
* Centralized reports
* Research audit records
* Remote review

---

# Safety

Do not connect a motor to a real microscope using only the current browser-side software limits.

A physical microscope should include independent embedded safety controls and physical limit switches.

Never power a stepper motor directly from a microcontroller USB power output.

---

# Research Disclaimer

This application is an engineering and computer-vision research prototype.

Candidate labels such as:

```text
RBC-like
WBC-like
Platelet-like
Egg-like
Parasite-like
```

describe algorithmic research candidates only.

They do not represent validated clinical findings.

The application must not be used for:

* Medical diagnosis
* Veterinary diagnosis
* Treatment selection
* Clinical decision-making
* Patient screening
* Unattended medical operation

without appropriate datasets, validation, regulatory review, safety engineering, and domain-expert supervision.

---

# Repository

GitHub:

https://github.com/Sumit-kumar1-stack/automated-microscope

---

# Author

**Sumit Kumar**

Automated Microscopy Research Prototype

Focus areas:

* Computer Vision
* Automation
* Autofocus Algorithms
* Hardware/Software Integration
* Research Tooling
* Full-Stack Engineering
