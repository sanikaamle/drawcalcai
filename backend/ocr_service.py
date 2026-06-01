import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image, ImageOps
from pix2text import Pix2Text
import uvicorn

app = FastAPI()

print("✅ FastAPI app created")

@app.on_event("startup")
async def startup_event():
    print("✅ FastAPI startup event triggered")

p2t = None

def get_p2t():
    global p2t

    if p2t is None:
        try:
            print("🚀 Initializing Pix2Text model...")
            p2t = Pix2Text.from_config()
            print("✅ Pix2Text model initialized successfully")
        except Exception as e:
            print(f"❌ Error initializing Pix2Text: {e}")
            raise

    return p2t


@app.get("/")
def root():
    return {"message": "OCR Service Running"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "Pix2Text OCR Service"}


@app.post("/ocr")
async def recognize_formula(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        image = Image.open(io.BytesIO(contents)).convert("RGB")

        # Invert black canvas -> white background
        inverted_image = ImageOps.invert(image)

        model = get_p2t()

        latex_result = model.recognize_formula(inverted_image)

        print(f"📄 OCR Result: {latex_result}")

        return {
            "success": True,
            "latex": latex_result
        }

    except Exception as e:
        print(f"❌ OCR Service Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "ocr_service:app",
        host="0.0.0.0",
        port=5001,
        reload=False
    )