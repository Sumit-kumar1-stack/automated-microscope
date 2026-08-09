@echo off
setlocal

cd /d "%~dp0..\.."

research\focus-validation\.venv\Scripts\python.exe research\inference-service\production_regression.py --base-url http://127.0.0.1:8000 --container microscope-inference

if errorlevel 1 (
    echo.
    echo PRODUCTION REGRESSION FAILED
    exit /b 1
)

echo.
echo PRODUCTION REGRESSION COMPLETE
exit /b 0