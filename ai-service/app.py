import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models.assignment import (
    BillAssignRequest,
    BillAssignResponse,
    BillAssignmentResult,
)
from models.bill import Bill, BillParseRequest, BillParseResponse
from models.split import BillSplitRequest, BillSplitResponse, BillSplitResult
from services.bill_assignment import (
    BillAssignmentAmbiguityError,
    BillAssignmentAPIError,
    BillAssignmentConfigError,
    BillAssignmentValidationError,
    get_bill_assignment_service,
)
from services.bill_parser import (
    BillParserAPIError,
    BillParserConfigError,
    BillParserValidationError,
    get_bill_parser_service,
    validate_bill_consistency,
)
from services.bill_splitter import (
    BillSplitterError,
    UnassignedItemsError,
    get_bill_splitter_service,
)
from services.ocr_service import get_ocr_service

# Load environment variables from .env if present
load_dotenv()

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("enhanced-sw-ai")

# Configuration constants
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "15"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/pjpeg",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up OCR service on application startup."""
    logger.info("Initializing OCR engine on startup...")
    try:
        get_ocr_service()
        logger.info("OCR engine successfully warmed up and ready.")
    except Exception as e:
        logger.error("Failed to initialize OCR engine on startup: %s", str(e), exc_info=True)
    yield
    logger.info("Shutting down AI service.")


app = FastAPI(
    title="Enhanced SW AI Service",
    description="AI/ML microservice for receipt OCR, LangChain-powered bill parsing with Google Gemini, natural-language consumption mapping, and deterministic bill splitting.",
    version="0.3.0",
    lifespan=lifespan,
)


# Standard error response helper
def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
            },
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    """Format HTTPExceptions into standard JSON error structure."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": detail,
            },
        )
    return error_response(
        status_code=exc.status_code,
        code=f"HTTP_{exc.status_code}",
        message=str(detail),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    """Handle missing parameters or payload format errors cleanly."""
    return error_response(
        status_code=status.HTTP_400_BAD_REQUEST,
        code="INVALID_REQUEST",
        message=f"Invalid request parameters: {exc.errors()}",
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception):
    """Catch-all for uncaught exceptions to prevent exposing raw stack traces."""
    logger.error("Uncaught server error: %s", str(exc), exc_info=True)
    return error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected server error occurred during processing.",
    )


# Response Models for OCR
class OCRLine(BaseModel):
    text: str
    confidence: float
    box: Optional[List[List[float]]] = None


class OCRReceiptResponse(BaseModel):
    success: bool
    text: str
    lines: List[OCRLine]


@app.get("/health")
def health_check():
    """Service health check endpoint."""
    return {
        "status": "ok",
        "service": "enhanced-sw-ai",
    }


@app.post(
    "/api/ocr/receipt",
    response_model=OCRReceiptResponse,
    responses={
        200: {"description": "OCR extraction succeeded"},
        400: {"description": "Missing file, empty file, or corrupted image"},
        413: {"description": "Uploaded image exceeds size limit"},
        415: {"description": "Unsupported file format"},
        500: {"description": "OCR engine processing failure"},
    },
)
async def ocr_receipt(file: UploadFile = File(...)):
    """
    Extract raw text and line-level metadata from an uploaded receipt image.
    Supports JPEG, JPG, PNG, and WEBP formats up to 15MB.
    """
    if not file or not file.filename:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "MISSING_FILE",
            "No file was provided in the upload request.",
        )

    filename = file.filename.lower()
    _, ext = os.path.splitext(filename)
    if ext not in ALLOWED_EXTENSIONS:
        return error_response(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "UNSUPPORTED_MEDIA_TYPE",
            f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    if file.content_type and file.content_type != "application/octet-stream":
        if file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
            return error_response(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_MEDIA_TYPE",
                f"Unsupported Content-Type '{file.content_type}'. Allowed image types: JPEG, PNG, WEBP.",
            )

    content_chunks = []
    total_bytes = 0
    chunk_size = 1024 * 1024  # 1MB chunks

    try:
        while chunk := await file.read(chunk_size):
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                return error_response(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    "FILE_TOO_LARGE",
                    f"Uploaded image exceeds the maximum permitted size of {MAX_UPLOAD_SIZE_MB}MB.",
                )
            content_chunks.append(chunk)
    finally:
        await file.close()

    if total_bytes == 0:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "EMPTY_FILE",
            "The uploaded file is empty (0 bytes).",
        )

    image_bytes = b"".join(content_chunks)

    ocr_service = get_ocr_service()
    try:
        ocr_result = ocr_service.extract_text(image_bytes)
    except ValueError as val_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_IMAGE",
            str(val_err),
        )
    except Exception as exc:
        logger.error("OCR execution error: %s", str(exc), exc_info=True)
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "OCR_PROCESSING_FAILED",
            "Failed to process the receipt image with the OCR engine.",
        )

    return {
        "success": True,
        "text": ocr_result["text"],
        "lines": ocr_result["lines"],
    }


@app.post(
    "/api/bill/parse",
    response_model=BillParseResponse,
    responses={
        200: {"description": "Bill structured extraction succeeded"},
        400: {"description": "Missing or empty OCR text input"},
        500: {"description": "LLM schema validation or extraction failure"},
        502: {"description": "Gemini API failure or communication error"},
        503: {"description": "Gemini API key not configured on server"},
    },
)
async def parse_bill(payload: BillParseRequest):
    """
    Extract structured bill items, totals, tax, and merchant data from raw OCR text using LangChain + Google Gemini LLM.
    """
    if not payload.text or not payload.text.strip():
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "EMPTY_TEXT",
            "OCR text must not be empty or whitespace only.",
        )

    try:
        bill_parser = get_bill_parser_service()
        extracted_bill = await bill_parser.parse_bill(payload.text)
        validation_result = validate_bill_consistency(extracted_bill)
        return {
            "success": True,
            "data": extracted_bill.model_dump(),
            "validation": validation_result.model_dump(),
        }
    except BillParserConfigError as cfg_err:
        return error_response(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            cfg_err.code,
            cfg_err.message,
        )
    except BillParserAPIError as api_err:
        return error_response(
            status.HTTP_502_BAD_GATEWAY,
            api_err.code,
            api_err.message,
        )
    except BillParserValidationError as val_err:
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            val_err.code,
            val_err.message,
        )
    except ValueError as val_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
            str(val_err),
        )
    except Exception as exc:
        logger.error("Unhandled error during bill parsing: %s", str(exc), exc_info=True)
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred while parsing the bill.",
        )


@app.post(
    "/api/bill/assign",
    response_model=BillAssignResponse,
    responses={
        200: {"description": "Item assignment succeeded"},
        400: {"description": "Invalid input, ambiguous instruction, or unknown participant/item"},
        502: {"description": "Gemini API communication failure"},
        503: {"description": "Gemini API key not configured"},
    },
)
async def assign_bill_items(payload: BillAssignRequest):
    """
    Map natural language consumption instructions to bill items and participants using LangChain + Google Gemini.
    """
    try:
        assignment_service = get_bill_assignment_service()
        assignment_result = await assignment_service.assign_items(
            bill=payload.bill,
            people=payload.people,
            instruction=payload.instruction,
        )
        return {
            "success": True,
            "data": assignment_result.model_dump(),
        }
    except BillAssignmentConfigError as cfg_err:
        return error_response(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            cfg_err.code,
            cfg_err.message,
        )
    except BillAssignmentAmbiguityError as amb_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            amb_err.code,
            amb_err.message,
        )
    except BillAssignmentValidationError as val_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            val_err.code,
            val_err.message,
        )
    except BillAssignmentAPIError as api_err:
        return error_response(
            status.HTTP_502_BAD_GATEWAY,
            api_err.code,
            api_err.message,
        )
    except ValueError as val_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
            str(val_err),
        )
    except Exception as exc:
        logger.error("Unhandled error during bill item assignment: %s", str(exc), exc_info=True)
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred during item assignment.",
        )


@app.post(
    "/api/bill/split",
    response_model=BillSplitResponse,
    responses={
        200: {"description": "Bill split calculated successfully"},
        400: {"description": "Invalid input, ambiguous instruction, or unassigned items"},
        502: {"description": "Gemini API communication failure"},
        503: {"description": "Gemini API key not configured"},
    },
)
async def split_bill(payload: BillSplitRequest):
    """
    Complete end-to-end bill split:
    1. Maps natural-language consumption instruction to items via LangChain + Google Gemini.
    2. Deterministically calculates per-person shares, taxes, discounts, and strict total reconciliation.
    """
    try:
        # Step 1: Natural-language assignment
        assignment_service = get_bill_assignment_service()
        assignment_result = await assignment_service.assign_items(
            bill=payload.bill,
            people=payload.people,
            instruction=payload.instruction,
        )

        # Step 2: Deterministic calculation
        splitter_service = get_bill_splitter_service()
        split_result = splitter_service.split_bill(
            bill=payload.bill,
            people=payload.people,
            assignment_result=assignment_result,
            allow_unassigned=False,
        )

        return {
            "success": True,
            "data": split_result.model_dump(),
        }
    except BillAssignmentConfigError as cfg_err:
        return error_response(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            cfg_err.code,
            cfg_err.message,
        )
    except BillAssignmentAmbiguityError as amb_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            amb_err.code,
            amb_err.message,
        )
    except BillAssignmentValidationError as val_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            val_err.code,
            val_err.message,
        )
    except UnassignedItemsError as unassigned_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            unassigned_err.code,
            unassigned_err.message,
        )
    except BillAssignmentAPIError as api_err:
        return error_response(
            status.HTTP_502_BAD_GATEWAY,
            api_err.code,
            api_err.message,
        )
    except ValueError as val_err:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
            str(val_err),
        )
    except Exception as exc:
        logger.error("Unhandled error during bill split: %s", str(exc), exc_info=True)
        return error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_SERVER_ERROR",
            "An unexpected error occurred during bill splitting.",
        )


@app.post(
    "/api/bill/process",
    response_model=BillSplitResponse,
    responses={
        200: {"description": "Full end-to-end receipt OCR, parsing, assignment, and split succeeded"},
        400: {"description": "Invalid input, ambiguous instruction, unassigned items, or bad image"},
        500: {"description": "Processing failure"},
        502: {"description": "Gemini API failure"},
        503: {"description": "Gemini API key not configured"},
    },
)
async def process_bill_end_to_end(
    file: UploadFile = File(...),
    people: str = Form(..., description="JSON-encoded array of participant names, e.g. '[\"A\", \"B\", \"C\"]'"),
    instruction: str = Form(..., description="Natural language consumption instruction"),
):
    """
    Convenience endpoint executing full pipeline:
    Receipt Image -> OCR -> LangChain Bill Parsing -> LangChain Item Assignment -> Deterministic Split
    """
    # 1. Parse people list
    try:
        people_list = json.loads(people)
        if not isinstance(people_list, list) or not people_list:
            return error_response(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_PEOPLE",
                "The 'people' parameter must be a valid JSON array of participant names.",
            )
    except Exception:
        # Fallback to comma-separated list
        people_list = [p.strip() for p in people.split(",") if p.strip()]
        if not people_list:
            return error_response(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_PEOPLE",
                "Failed to parse 'people' participant list.",
            )

    # 2. Run OCR
    ocr_response = await ocr_receipt(file)
    if isinstance(ocr_response, JSONResponse):
        return ocr_response
    ocr_text = ocr_response["text"]

    # 3. Parse Bill
    try:
        bill_parser = get_bill_parser_service()
        bill = await bill_parser.parse_bill(ocr_text)
        validation = validate_bill_consistency(bill)
    except BillParserConfigError as cfg_err:
        return error_response(status.HTTP_503_SERVICE_UNAVAILABLE, cfg_err.code, cfg_err.message)
    except BillParserAPIError as api_err:
        return error_response(status.HTTP_502_BAD_GATEWAY, api_err.code, api_err.message)
    except BillParserValidationError as val_err:
        return error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, val_err.code, val_err.message)

    # 4. Assign and Split
    try:
        assignment_service = get_bill_assignment_service()
        assignment_result = await assignment_service.assign_items(
            bill=bill,
            people=people_list,
            instruction=instruction,
        )

        splitter_service = get_bill_splitter_service()
        split_result = splitter_service.split_bill(
            bill=bill,
            people=people_list,
            assignment_result=assignment_result,
            allow_unassigned=False,
        )

        return {
            "success": True,
            "data": split_result.model_dump(),
            "validation": validation.model_dump() if validation else None,
        }
    except BillAssignmentAmbiguityError as amb_err:
        return error_response(status.HTTP_400_BAD_REQUEST, amb_err.code, amb_err.message)
    except BillAssignmentValidationError as val_err:
        return error_response(status.HTTP_400_BAD_REQUEST, val_err.code, val_err.message)
    except UnassignedItemsError as unassigned_err:
        return error_response(status.HTTP_400_BAD_REQUEST, unassigned_err.code, unassigned_err.message)
    except BillAssignmentAPIError as api_err:
        return error_response(status.HTTP_502_BAD_GATEWAY, api_err.code, api_err.message)
    except Exception as exc:
        logger.error("Error during end-to-end bill processing: %s", str(exc), exc_info=True)
        return error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", str(exc))
