@echo off
REM Quick start script for Traffic Project with OpenCV backend

echo.
echo ========================================
echo Traffic Project - Quick Start Guide
echo ========================================
echo.

echo Step 1: Installing Python dependencies...
python setup_api.py
if errorlevel 1 (
    echo Failed to install dependencies
    exit /b 1
)

echo.
echo Step 2: Python backend is ready!
echo.
echo Next steps:
echo.
echo Terminal 1 - Start the Python API Server:
echo   python api_server.py
echo.
echo Terminal 2 - Start the React development server:
echo   npm install
echo   npm run dev
echo.
echo Then open http://localhost:5173 in your browser
echo.
echo The system will connect to the API at http://localhost:5000
echo.
echo Documentation: See OPENCV_BACKEND_SETUP.md for detailed setup and API docs
echo.
pause
