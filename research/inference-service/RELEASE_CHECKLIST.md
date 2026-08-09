\# Automated Microscope Inference Service

\## Engineering Release Checklist



Status: Research-only engineering prototype



This checklist validates engineering readiness only.



It does not represent clinical validation, diagnostic approval,

medical-device certification, or suitability for patient care.



\---



\## 1. Scientific Configuration



\- \[ ] Frozen detector model is binary-parasite-detector-v2

\- \[ ] Frozen classifier model is stage-classifier-v2

\- \[ ] Model version is v2-frozen

\- \[ ] Detector confidence threshold remains 0.25

\- \[ ] Detector image size remains 512

\- \[ ] Classifier image size remains 160

\- \[ ] Crop context scale remains 1.8

\- \[ ] Scientific thresholds are not controlled by deployment environment variables

\- \[ ] BBBC041 official test remains frozen and is not used for tuning



\---



\## 2. Research Safety Metadata



\- \[ ] API reports research\_only=true

\- \[ ] API reports clinically\_validated=false

\- \[ ] Product wording does not claim diagnostic capability

\- \[ ] External validation limitations remain documented



\---



\## 3. Application Verification



\- \[ ] TypeScript typecheck passes

\- \[ ] Scan regression tests pass

\- \[ ] ESLint passes

\- \[ ] Next.js production build passes



\---



\## 4. Inference API Verification



\- \[ ] /live returns HTTP 200

\- \[ ] /ready returns HTTP 200

\- \[ ] /health returns HTTP 200

\- \[ ] /model-info reports v2-frozen

\- \[ ] Known-positive inference regression passes



\---



\## 5. Security Boundaries



\- \[ ] Unsupported MIME types return HTTP 415

\- \[ ] Malformed image data returns HTTP 400

\- \[ ] Oversized uploads return HTTP 413

\- \[ ] Excessive image dimensions are rejected

\- \[ ] Unsafe request IDs are replaced

\- \[ ] Failed requests do not corrupt model readiness



\---



\## 6. Observability



\- \[ ] Structured JSON application logging enabled

\- \[ ] Request IDs returned in X-Request-ID

\- \[ ] Request IDs propagated into inference logs

\- \[ ] Inference latency logged

\- \[ ] Candidate count logged

\- \[ ] Unexpected internal failures produce structured error events

\- \[ ] Image bytes are not written to operational logs



\---



\## 7. Runtime Hardening



\- \[ ] Container runs as non-root user

\- \[ ] Root filesystem is read-only

\- \[ ] /tmp is the only intentional writable runtime area

\- \[ ] Linux capabilities are dropped

\- \[ ] no-new-privileges is enabled

\- \[ ] Memory limit configured

\- \[ ] CPU limit configured

\- \[ ] PID limit configured

\- \[ ] Docker readiness healthcheck passes

\- \[ ] Graceful SIGTERM shutdown works



\---



\## 8. Frozen Model Regression



Expected known-positive BBBC041 result:



\- \[ ] candidate\_count = 2

\- \[ ] candidate 1 stage = ring

\- \[ ] candidate 2 stage = trophozoite

\- \[ ] smoke test reports PASS



\---



\## 9. Production Regression



Run:



research\\inference-service\\production-regression.cmd



Required final result:



PRODUCTION REGRESSION PASS



\- \[ ] Production regression passes



\---



\## 10. Repository Safety



Before committing:



\- \[ ] Review git status

\- \[ ] Do not stage raw datasets

\- \[ ] Do not stage training outputs accidentally

\- \[ ] Do not stage node\_modules

\- \[ ] Do not stage .next

\- \[ ] Do not stage local virtual environments

\- \[ ] Do not stage secrets or .env.local

\- \[ ] Do not accidentally stage large .pt checkpoints unless intentionally versioned

\- \[ ] Review staged file names before commit



\---



\## Release Classification



Engineering status:



Production-style research prototype



Scientific status:



Experimental research system



Clinical status:



Not clinically validated



Intended use:



Engineering, research, demonstration, benchmarking,

software architecture validation, and future hardware integration.

