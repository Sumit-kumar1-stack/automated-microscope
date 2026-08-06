# Automated Microscope Research Prototype

Interview-ready Next.js prototype for automated microscopy research.

## Phase 2 features

- Simulation mode with synthetic blood-field optics
- Real Laplacian-variance focus measurement
- Coarse-to-fine simulated Z autofocus
- Live Camera mode using the browser MediaDevices API
- Real-time focus/detail trend from actual camera pixels
- Hardware-ready Web Serial bridge
- MOVE_Z and STOP command protocol
- Emergency-stop UI
- No specialist hardware required for the software demo

## Run

```cmd
npm install
npm run dev
```

Open `http://localhost:3000`.

## Interview demo without hardware

1. Run Simulation mode and click **Run Autofocus**.
2. Show that the search finds the high-sharpness Z plane.
3. Switch to **Live Camera**.
4. Click **Start Live Camera** and allow camera permission.
5. Point the webcam at text, fabric, electronics, hair, or another detailed object.
6. Move the object/camera in and out of focus and show the live Laplacian score changing.
7. Explain that the Hardware mode replaces manual camera movement with an ESP32/Arduino-controlled stepper motor on the microscope Z axis.

## Important

This is a research/engineering prototype and is not clinically validated or intended to provide medical diagnoses.
