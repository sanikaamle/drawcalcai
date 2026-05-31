import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image, ImageOps
from pix2text import Pix2Text
import uvicorn

app = FastAPI()

p2t = None

def get_p2t():
    global p2t
    if p2t is None:
        try:
            print("Initializing Pix2Text model... (This downloads models on first use)")
            p2t = Pix2Text.from_config()
            print("Pix2Text model initialized successfully.")
        except Exception as e:
            print(f"Error initializing Pix2Text: {e}")
            raise e
    return p2t

@app.post("/ocr")
async def recognize_formula(file: UploadFile = File(...)):
    try:
        # Read the uploaded image file bytes
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # DrawCalc AI uses a black canvas with white drawings.
        # Pix2Text expects black text on a white background.
        # We invert the colors of the image to match Pix2Text training distribution.
        inverted_image = ImageOps.invert(image)
        
        # Run Pix2Text formula OCR
        model = get_p2t()
        latex_result = model.recognize_formula(inverted_image)
        
        print(f"OCR Recognized LaTeX: {latex_result}")
        return {"latex": latex_result}
    except Exception as e:
        print(f"OCR Service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "service": "Pix2Text OCR Service"}

if __name__ == "__main__":
    # Load model on startup
    try:
        get_p2t()
    except Exception:
        pass
    uvicorn.run(app, host="127.0.0.1", port=5001)
