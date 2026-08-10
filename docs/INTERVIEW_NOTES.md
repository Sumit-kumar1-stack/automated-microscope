# Interview Notes

## Architecture

📌 **LEARN FOR INTERVIEW**

> I separated microscope orchestration from hardware implementation. Acquisition, autofocus and scan execution depend on device interfaces rather than a specific controller, so the same workflow can run against simulation today and a physical adapter later.

## Hardware Compatibility

📌 **LEARN FOR INTERVIEW**

> The goal is not to hardcode one microscope. The hardware layer should discover devices, capabilities and properties at runtime, while target-specific adapters translate common commands into Micro-Manager, vendor SDK, serial or network operations.

## Scan Engine

📌 **LEARN FOR INTERVIEW**

> The scan engine uses a controlled state machine: move, settle, autofocus, capture, analyze and advance. Pause, resume and abort are independent of the physical stage implementation.

## Physical Readiness

📌 **LEARN FOR INTERVIEW**

> The software workflow is ready for engineering evaluation, but physical commissioning still requires the target instrument, homing, travel limits, calibration and safety verification.

## Accuracy

📌 **LEARN FOR INTERVIEW**

> Hardware compatibility and analysis accuracy are separate validation tracks. Successful microscope control does not prove analytical accuracy, and model performance does not prove mechanical safety.

## Roha Precision Pitch

> I would like the team to evaluate the software architecture and microscope workflow first. If it maps to one of your instruments, the next step would be to obtain the controller or SDK details and implement a target adapter followed by a small-motion commissioning and calibration test.
