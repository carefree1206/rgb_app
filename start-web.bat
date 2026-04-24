@echo off
setlocal
cd /d "%~dp0"
echo Starting LOCAL DEV server at http://127.0.0.1:5173/index.html
echo Note: mobile production access should use deployed HTTPS URL (Vercel).
start "" http://127.0.0.1:5173/index.html
python -m http.server 5173
