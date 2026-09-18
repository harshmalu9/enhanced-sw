import io
import logging
from typing import Any, Dict, List, Optional
import numpy as np
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

logger = logging.getLogger("enhanced-sw-ai.ocr")


class OCRService:
    """Service for local OCR processing using PaddleOCR."""

    def __init__(self, lang: str = "en", use_angle_cls: bool = True) -> None:
        logger.info("Initializing PaddleOCR engine (lang=%s, use_angle_cls=%s, cpu=True)...", lang, use_angle_cls)
        # Initialize PaddleOCR engine on CPU with angle classification
        self.ocr_engine = PaddleOCR(
            use_angle_cls=use_angle_cls,
            lang=lang,
            use_gpu=False,
            show_log=False,
        )
        logger.info("PaddleOCR engine initialized successfully.")

    def extract_text(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Process receipt image bytes and return detected lines and joined text in reading order.
        """
        # Validate and open image with Pillow
        try:
            pil_img = Image.open(io.BytesIO(image_bytes))
            # Auto-orient based on EXIF tags if present
            pil_img = ImageOps.exif_transpose(pil_img)
            # Ensure RGB format
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
        except Exception as e:
            logger.warning("Failed to parse image with Pillow: %s", str(e))
            raise ValueError(f"Corrupted or invalid image data: {str(e)}") from e

        # Convert to numpy array for PaddleOCR
        img_np = np.array(pil_img)

        # Run OCR inference
        try:
            ocr_results = self.ocr_engine.ocr(img_np, cls=True)
        except Exception as e:
            logger.error("PaddleOCR execution failed: %s", str(e), exc_info=True)
            raise RuntimeError(f"OCR engine inference failure: {str(e)}") from e

        # PaddleOCR returns a list of results per image; check for empty or None detections
        if not ocr_results or ocr_results[0] is None:
            return {
                "text": "",
                "lines": [],
            }

        raw_lines = ocr_results[0]

        # Extract box, text, confidence
        parsed_items: List[Dict[str, Any]] = []
        for line in raw_lines:
            if not line or len(line) < 2:
                continue
            box, (text_content, conf) = line[0], line[1]
            if not text_content:
                continue

            # Compute bounding box center/top for natural reading order sorting
            # box is [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
            y_top = min(pt[1] for pt in box)
            x_left = min(pt[0] for pt in box)
            y_bottom = max(pt[1] for pt in box)
            height = max(1.0, y_bottom - y_top)

            parsed_items.append({
                "text": str(text_content).strip(),
                "confidence": round(float(conf), 4),
                "box": box,
                "_y_top": y_top,
                "_x_left": x_left,
                "_height": height,
            })

        # Sort lines into top-to-bottom, left-to-right reading order
        # Group items on approximately the same line (within vertical tolerance)
        sorted_items = self._sort_reading_order(parsed_items)

        extracted_lines: List[Dict[str, Any]] = []
        text_lines: List[str] = []

        for item in sorted_items:
            extracted_lines.append({
                "text": item["text"],
                "confidence": item["confidence"],
                "box": item["box"],
            })
            text_lines.append(item["text"])

        full_text = "\n".join(text_lines)

        return {
            "text": full_text,
            "lines": extracted_lines,
        }

    @staticmethod
    def _sort_reading_order(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort detected bounding boxes into natural top-to-bottom, left-to-right reading order."""
        if not items:
            return []

        # Sort primarily by y_top
        items_by_y = sorted(items, key=lambda it: it["_y_top"])

        # Group items that share similar vertical line positions
        lines: List[List[Dict[str, Any]]] = []
        for item in items_by_y:
            placed = False
            for line in lines:
                # Compare vertical overlap with line representative
                ref = line[0]
                y_diff = abs(item["_y_top"] - ref["_y_top"])
                tolerance = max(ref["_height"], item["_height"]) * 0.5
                if y_diff <= tolerance:
                    line.append(item)
                    placed = True
                    break
            if not placed:
                lines.append([item])

        # Sort elements within each line left-to-right, then flatten
        sorted_output: List[Dict[str, Any]] = []
        for line in lines:
            line_sorted = sorted(line, key=lambda it: it["_x_left"])
            sorted_output.extend(line_sorted)

        return sorted_output


# Global singleton instance holder
_ocr_service_instance: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    """Get or initialize the singleton OCRService instance."""
    global _ocr_service_instance
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService()
    return _ocr_service_instance
