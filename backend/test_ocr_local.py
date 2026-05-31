import os
import requests
from PIL import Image, ImageDraw, ImageFont

def generate_test_image(filename="test_math.png", text="x^2-4"):
    print(f"Creating a synthetic white-on-black image with text: '{text}'...")
    # Create black image (300 x 100)
    image = Image.new("RGB", (300, 100), color=(6, 7, 10))
    draw = ImageDraw.Draw(image)
    
    # Try to load a default font or standard system font
    font = None
    try:
        # Standard Mac font path
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
    except Exception:
        try:
            # Fallback standard TrueType font
            font = ImageFont.truetype("arial.ttf", 36)
        except Exception:
            # Absolute basic fallback
            font = ImageFont.load_default()
            
    # Draw white text in the center
    # On basic fallback fonts, size option doesn't apply, so it might be small.
    # We position it around (50, 30)
    draw.text((50, 30), text, fill=(255, 255, 255), font=font)
    
    # Save the image
    image.save(filename)
    print(f"Saved test image to {filename}")

def test_ocr_service(filename="test_math.png"):
    url = "http://127.0.0.1:5001/ocr"
    print(f"Sending POST request to Pix2Text OCR Service at {url}...")
    with open(filename, "rb") as f:
        files = {"file": (filename, f, "image/png")}
        try:
            res = requests.post(url, files=files)
            print("OCR Service Status Code:", res.status_code)
            print("OCR Response JSON:", res.json())
        except Exception as e:
            print("OCR Request failed:", e)

def test_backend_solve(filename="test_math.png"):
    url = "http://127.0.0.1:5000/api/solve"
    print(f"Sending POST request to Express Backend Solver at {url}...")
    with open(filename, "rb") as f:
        files = {"image": (filename, f, "image/png")}
        try:
            res = requests.post(url, files=files)
            print("Backend Status Code:", res.status_code)
            print("Backend Response JSON:", res.json())
        except Exception as e:
            print("Backend Request failed:", e)

if __name__ == "__main__":
    generate_test_image()
    # Test OCR directly (FastAPI)
    test_ocr_service()
    # Test through main Express Backend
    test_backend_solve()
