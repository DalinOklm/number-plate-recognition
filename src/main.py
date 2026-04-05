import cv2
from ultralytics import YOLO
import easyocr

# Load YOLO model (this will auto-download on first run)
model = YOLO("yolov8n.pt")

# Initialize OCR
reader = easyocr.Reader(['en'])

# Load image
image = cv2.imread("data/test_images/car.jpg")

if image is None:
    print("❌ Image not found. Check your path.")
    exit()

# Run detection
results = model(image)

for r in results:
    for box in r.boxes.xyxy:
        x1, y1, x2, y2 = map(int, box)

        # Crop detected region
        crop = image[y1:y2, x1:x2]

        # OCR
        text = reader.readtext(crop)

        print("Detected Text:", text)

        # Show cropped area
        cv2.imshow("Detected Area", crop)
        cv2.waitKey(0)

cv2.destroyAllWindows()