#!/bin/bash

# Clean exit: Kill all background processes started by this script
trap 'kill $(jobs -p) 2>/dev/null' EXIT

echo "========================================="
echo "   🚀 Starting DrawCalc AI Project 🚀   "
echo "========================================="

# 1. Start Python OCR Service
echo "🐍 [1/3] Starting Pix2Text OCR Service on port 5001..."
cd backend
./venv/bin/python3 ocr_service.py > ocr_service.log 2>&1 &
OCR_PID=$!

# Wait briefly for OCR service to launch
sleep 2

# Check if OCR service is still running
if kill -0 $OCR_PID 2>/dev/null; then
  echo "✅ Pix2Text OCR Service is running! (Logs saved to backend/ocr_service.log)"
else
  echo "❌ Failed to start Pix2Text OCR Service. Check backend/ocr_service.log"
  exit 1
fi

# 2. Start Node.js Express server
echo "🟢 [2/3] Starting Express Server on port 5000..."
npm run dev &
EXPRESS_PID=$!

# 3. Start React Frontend
echo "💻 [3/3] Starting React Dev Server on port 5173..."
cd ../frontend
npm run dev &
VITE_PID=$!

echo "========================================="
echo " DrawCalc AI is up and running!          "
echo " - Frontend: http://localhost:5173       "
echo " - Backend API: http://localhost:5000    "
echo " - OCR Service: http://localhost:5001    "
echo " Press Ctrl+C to terminate all services. "
echo "========================================="

# Keep script running to wait for Ctrl+C
wait
