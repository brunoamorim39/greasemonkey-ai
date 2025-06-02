import os
import logging
import requests
from functools import wraps
from fastapi import Request, HTTPException
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from supabase import create_client, Client
from dotenv import load_dotenv
from models import UnitPreferences, DocumentType, DocumentStatus, DocumentMetadata, UserTier, DocumentSearchResult
from models import (
    UsageType, UsageRecord, DailyUsageStats, TierLimits,
    UserUsageRequest, UserUsageResponse, OverrideTierRequest,
    ReceiptVerificationRequest, ReceiptVerificationResponse, SubscriptionTier as NewSubscriptionTier,
    Platform, SubscriptionStatusResponse, UserSubscription, SubscriptionStatus, WebhookEvent,
    UsageCheckRequest, UsageCheckResponse
)
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple, Dict
import hashlib
import uuid
import pypdf
import io

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_ORGANIZATION = os.getenv("OPENAI_ORGANIZATION")
OPENAI_PROJECT = os.getenv("OPENAI_PROJECT")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
API_KEY = os.getenv("API_KEY")

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("greasemonkey-backend")

# Unit conversion and TTS-friendly formatting utilities
def create_unit_instructions(preferences: UnitPreferences) -> str:
    """Generate clear instructions for the AI about unit preferences and TTS formatting."""
    instructions = [
        "IMPORTANT FORMATTING RULES FOR TEXT-TO-SPEECH:",
        "- Never use abbreviations for units (no 'Nm', 'lb-ft', 'PSI', etc.)",
        "- Always spell out units completely for clear speech",
        "- Be concise but avoid technical abbreviations",
        "",
        "UNIT PREFERENCES:"
    ]

    # Torque
    if preferences.torque_unit == "newton_meters":
        instructions.append("- Torque: Use newton meters (not Nm)")
    else:
        instructions.append("- Torque: Use pound feet (not lb-ft)")

    # Pressure
    if preferences.pressure_unit == "psi":
        instructions.append("- Pressure: Use pounds per square inch (not PSI)")
    elif preferences.pressure_unit == "bar":
        instructions.append("- Pressure: Use bar")
    else:
        instructions.append("- Pressure: Use kilopascals (not kPa)")

    # Length
    if preferences.length_unit == "metric":
        instructions.append("- Length: Use millimeters, centimeters, meters (not mm, cm, m)")
    else:
        instructions.append("- Length: Use inches, feet (not in, ft)")

    # Volume
    if preferences.volume_unit == "metric":
        instructions.append("- Volume: Use liters, milliliters (not L, ml)")
    else:
        instructions.append("- Volume: Use quarts, gallons, ounces (not qt, gal, oz)")

    # Temperature
    if preferences.temperature_unit == "celsius":
        instructions.append("- Temperature: Use degrees Celsius (not °C)")
    else:
        instructions.append("- Temperature: Use degrees Fahrenheit (not °F)")

    # Weight
    if preferences.weight_unit == "metric":
        instructions.append("- Weight: Use kilograms, grams (not kg, g)")
    else:
        instructions.append("- Weight: Use pounds, ounces (not lbs, oz)")

    # Socket sizes
    if preferences.socket_unit == "metric":
        instructions.append("- Socket sizes: Use millimeter sockets (not mm)")
    else:
        instructions.append("- Socket sizes: Use inch sockets (not in)")

    return "\n".join(instructions)

# API key check
def check_api_key(request: Request):
    if API_KEY:
        key = request.headers.get("x-api-key")
        if key != API_KEY:
            logger.warning("Unauthorized: Invalid or missing API key")
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

def require_api_key(endpoint):
    @wraps(endpoint)
    async def wrapper(*args, **kwargs):
        # Look for FastAPI Request object in kwargs (could be named 'request' or 'request_')
        request = kwargs.get('request_') or kwargs.get('request')

        # If not found in kwargs, search through all args and kwargs for Request instance
        if not request or not isinstance(request, Request):
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                for value in kwargs.values():
                    if isinstance(value, Request):
                        request = value
                        break

        if not request:
            raise HTTPException(status_code=500, detail="Request object not found for API key check")
        check_api_key(request)
        return await endpoint(*args, **kwargs)
    return wrapper

# FSM retrieval setup (placeholder)
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
fsm_docs = [
    # No default documents - only real FSM data should be added here
]

# Lazy initialization for testing
embeddings = None
vectorstore = None

def get_vectorstore():
    global embeddings, vectorstore
    if not OPENAI_API_KEY:
        return None
    if vectorstore is None:
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        vectorstore = Chroma.from_documents(fsm_docs, embeddings, persist_directory=CHROMA_PATH)
    return vectorstore

# Document management configuration
DOCUMENTS_PATH = os.getenv("DOCUMENTS_PATH", "./documents")
MAX_DOCUMENT_SIZE_MB = int(os.getenv("MAX_DOCUMENT_SIZE_MB", "50"))
MAX_STORAGE_FREE_MB = int(os.getenv("MAX_STORAGE_FREE_MB", "100"))
MAX_STORAGE_PAID_MB = int(os.getenv("MAX_STORAGE_PAID_MB", "1000"))

# Supabase Storage configuration
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "documents")

# Tier configuration - 3-tier subscription model (Free + 2 paid)
TIER_CONFIGS = {
    UserTier.FREE_TIER: TierLimits(
        max_daily_asks=3,
        max_document_uploads=0,  # No uploads for free
        max_vehicles=1,
        max_storage_mb=0.0,
        document_upload_enabled=False,
        tts_enabled=True,
        stt_enabled=True
    ),
    UserTier.WEEKEND_WARRIOR: TierLimits(
        max_daily_asks=None,  # No daily limit, but monthly limit applies
        max_monthly_asks=50,  # 50 questions per month
        max_document_uploads=20,  # 20 documents maximum (total)
        max_vehicles=None,  # Unlimited vehicles
        max_storage_mb=MAX_STORAGE_PAID_MB,
        document_upload_enabled=True,
        tts_enabled=True,
        stt_enabled=True
        # No per-use costs for subscription plan
    ),
    UserTier.MASTER_TECH: TierLimits(
        max_daily_asks=None,  # No daily limit, but monthly limit applies
        max_monthly_asks=200,  # 200 questions per month (10¢/question value prop)
        max_document_uploads=None,  # Unlimited documents
        max_vehicles=None,
        max_storage_mb=None,  # Unlimited storage
        document_upload_enabled=True,
        tts_enabled=True,
        stt_enabled=True
        # No per-use costs for subscription plan
    )
}

# Create documents directory if it doesn't exist
os.makedirs(DOCUMENTS_PATH, exist_ok=True)

class DocumentManager:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

    def _get_storage_path(self, user_id: str, document_id: str, filename: str) -> str:
        """Generate storage path for a document."""
        # Sanitize filename to prevent path traversal
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        return f"user_documents/{user_id}/{document_id}_{safe_filename}"

    def _upload_file_to_storage(self, file_content: bytes, storage_path: str) -> bool:
        """Upload file to Supabase Storage."""
        try:
            if not supabase:
                logger.error("Supabase client not available")
                return False

            # Upload file to Supabase Storage
            result = supabase.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=file_content,
                file_options={"content-type": "application/pdf"}
            )

            if result.status_code == 200:
                logger.info(f"File uploaded successfully to {storage_path}")
                return True
            else:
                logger.error(f"Failed to upload file to storage: {result}")
                return False

        except Exception as e:
            logger.error(f"Error uploading file to storage: {e}")
            return False

    def _delete_file_from_storage(self, storage_path: str) -> bool:
        """Delete file from Supabase Storage."""
        try:
            if not supabase:
                return False

            result = supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])

            if result.status_code == 200:
                logger.info(f"File deleted successfully from {storage_path}")
                return True
            else:
                logger.error(f"Failed to delete file from storage: {result}")
                return False

        except Exception as e:
            logger.error(f"Error deleting file from storage: {e}")
            return False

    def get_file_download_url(self, user_id: str, document_id: str) -> Optional[str]:
        """Get a signed download URL for a document."""
        try:
            if not supabase:
                return None

            # Get document metadata to find storage path
            result = supabase.table("documents").select("storage_path").eq("id", document_id).eq("user_id", user_id).execute()

            if not result.data:
                return None

            storage_path = result.data[0]["storage_path"]

            # Generate signed URL (valid for 1 hour)
            signed_url = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(storage_path, 3600)

            if signed_url.status_code == 200:
                return signed_url.json()["signedURL"]
            else:
                logger.error(f"Failed to generate signed URL: {signed_url}")
                return None

        except Exception as e:
            logger.error(f"Error generating download URL: {e}")
            return None

    def can_user_upload_document(self, user_id: str, file_size_mb: float) -> Tuple[bool, str]:
        """Check if user can upload a document based on their tier and current usage."""
        if not supabase:
            return False, "Database not available"

        try:
            # Get user tier
            user_result = supabase.table("users").select("tier").eq("user_id", user_id).execute()
            if not user_result.data:
                return False, "User not found"

            user_tier = UserTier(user_result.data[0]["tier"])

            # Check if tier allows uploads
            if user_tier == UserTier.FREE_TIER:
                return False, "Document uploads require a paid plan"

            # Check storage limits
            current_usage = self.get_user_storage_usage(user_id)
            max_storage = TIER_CONFIGS[user_tier].max_storage_mb

            if current_usage + file_size_mb > max_storage:
                return False, f"Storage limit exceeded. Used: {current_usage:.1f}MB, Limit: {max_storage}MB"

            return True, "Upload allowed"

        except Exception as e:
            logger.error(f"Error checking upload permissions for user {user_id}: {e}")
            return False, "Error checking permissions"

    def get_user_storage_usage(self, user_id: str) -> float:
        """Get total storage usage for a user in MB."""
        if not supabase:
            return 0.0

        try:
            result = supabase.table("documents").select("file_size").eq("user_id", user_id).execute()
            total_bytes = sum(doc["file_size"] for doc in result.data)
            return total_bytes / (1024 * 1024)  # Convert to MB
        except Exception as e:
            logger.error(f"Error getting storage usage for user {user_id}: {e}")
            return 0.0

    def process_pdf_document(self, file_content: bytes, metadata: DocumentMetadata) -> List[Document]:
        """Process a PDF document and extract text chunks."""
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_content))

            # Update page count
            metadata.page_count = len(pdf_reader.pages)

            # Extract text from all pages
            full_text = ""
            for page_num, page in enumerate(pdf_reader.pages, 1):
                try:
                    page_text = page.extract_text()
                    if page_text.strip():
                        full_text += f"[Page {page_num}]\n{page_text}\n\n"
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num}: {e}")
                    continue

            if not full_text.strip():
                raise ValueError("No text could be extracted from the PDF")

            # Split text into chunks
            chunks = self.text_splitter.split_text(full_text)

            # Create Document objects with metadata
            documents = []
            for i, chunk in enumerate(chunks):
                doc_metadata = {
                    "document_id": metadata.id,
                    "user_id": metadata.user_id,
                    "title": metadata.title,
                    "document_type": metadata.document_type.value,
                    "car_make": metadata.car_make,
                    "car_model": metadata.car_model,
                    "car_year": metadata.car_year,
                    "car_engine": metadata.car_engine,
                    "chunk_index": i,
                    "tags": ",".join(metadata.tags),
                    "is_public": metadata.is_public
                }
                documents.append(Document(page_content=chunk, metadata=doc_metadata))

            return documents

        except Exception as e:
            logger.error(f"Error processing PDF document {metadata.id}: {e}")
            raise

    def store_document_chunks(self, documents: List[Document], collection_name: str = "documents"):
        """Store document chunks in ChromaDB."""
        try:
            embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

            # Create or get collection
            chroma_path = os.path.join(CHROMA_PATH, collection_name)
            vectorstore = Chroma.from_documents(
                documents,
                embeddings,
                persist_directory=chroma_path,
                collection_name=collection_name
            )

            logger.info(f"Stored {len(documents)} document chunks in ChromaDB")
            return True

        except Exception as e:
            logger.error(f"Error storing document chunks: {e}")
            return False

    def upload_document(self, user_id: str, file_content: bytes, filename: str,
                       upload_request: 'DocumentUploadRequest') -> DocumentMetadata:
        """Handle complete document upload process."""
        try:
            file_size = len(file_content)
            file_size_mb = file_size / (1024 * 1024)

            # Check upload permissions
            can_upload, message = self.can_user_upload_document(user_id, file_size_mb)
            if not can_upload:
                raise HTTPException(status_code=403, detail=message)

            # Create document metadata
            doc_id = str(uuid.uuid4())
            storage_path = self._get_storage_path(user_id, doc_id, filename)

            metadata = DocumentMetadata(
                id=doc_id,
                user_id=user_id,
                title=upload_request.title,
                filename=filename,
                document_type=DocumentType.USER_UPLOAD,
                car_make=upload_request.car_make,
                car_model=upload_request.car_model,
                car_year=upload_request.car_year,
                car_engine=upload_request.car_engine,
                file_size=file_size,
                status=DocumentStatus.PROCESSING,
                upload_date=datetime.utcnow(),
                tags=upload_request.tags,
                is_public=upload_request.is_public
            )

            # Store metadata in database (including storage_path)
            if supabase:
                metadata_dict = metadata.dict()
                metadata_dict["storage_path"] = storage_path
                supabase.table("documents").insert(metadata_dict).execute()

            # Upload file to Supabase Storage
            storage_success = self._upload_file_to_storage(file_content, storage_path)
            if not storage_success:
                # Clean up metadata if file upload failed
                if supabase:
                    supabase.table("documents").delete().eq("id", doc_id).execute()
                raise Exception("Failed to upload file to cloud storage")

            # Process document for vector search
            try:
                documents = self.process_pdf_document(file_content, metadata)

                # Store in vector database
                vector_success = self.store_document_chunks(documents, f"user_{user_id}")

                if vector_success:
                    # Update status to ready
                    metadata.status = DocumentStatus.READY
                    metadata.processed_date = datetime.utcnow()

                    if supabase:
                        supabase.table("documents").update({
                            "status": DocumentStatus.READY.value,
                            "processed_date": metadata.processed_date.isoformat(),
                            "page_count": metadata.page_count
                        }).eq("id", doc_id).execute()

                    logger.info(f"Successfully processed document {doc_id} for user {user_id}")
                else:
                    raise Exception("Failed to store document in vector database")

            except Exception as e:
                # Update status to error but keep file in storage
                metadata.status = DocumentStatus.ERROR
                metadata.error_message = str(e)

                if supabase:
                    supabase.table("documents").update({
                        "status": DocumentStatus.ERROR.value,
                        "error_message": str(e)
                    }).eq("id", doc_id).execute()

                raise

            return metadata

        except Exception as e:
            logger.error(f"Error uploading document for user {user_id}: {e}")
            raise

    def delete_document(self, user_id: str, document_id: str) -> bool:
        """Delete a document and its associated files."""
        try:
            if not supabase:
                return False

            # Get document metadata
            result = supabase.table("documents").select("storage_path").eq("id", document_id).eq("user_id", user_id).execute()

            if not result.data:
                logger.warning(f"Document {document_id} not found for user {user_id}")
                return False

            storage_path = result.data[0]["storage_path"]

            # Delete from Supabase Storage
            if storage_path:
                self._delete_file_from_storage(storage_path)

            # Delete from database
            supabase.table("documents").delete().eq("id", document_id).eq("user_id", user_id).execute()

            # TODO: Also delete from ChromaDB vector store
            # This is more complex as we need to identify and remove specific chunks

            logger.info(f"Document {document_id} deleted for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting document {document_id} for user {user_id}: {e}")
            return False

    def search_documents(self, query: str, user_id: str, car_make: Optional[str] = None,
                        car_model: Optional[str] = None, car_year: Optional[int] = None,
                        document_types: List[DocumentType] = None, limit: int = 5) -> List[DocumentSearchResult]:
        """Search through user's documents and system documents."""
        try:
            if not OPENAI_API_KEY:
                return []

            embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
            results = []

            # Search user's personal documents
            user_chroma_path = os.path.join(CHROMA_PATH, f"user_{user_id}")
            if os.path.exists(user_chroma_path):
                try:
                    user_vectorstore = Chroma(
                        persist_directory=user_chroma_path,
                        embedding_function=embeddings,
                        collection_name=f"user_{user_id}"
                    )
                    user_results = user_vectorstore.similarity_search_with_score(query, k=limit)

                    for doc, score in user_results:
                        # Filter by car information if provided
                        if self._matches_car_criteria(doc.metadata, car_make, car_model, car_year):
                            results.append(DocumentSearchResult(
                                content=doc.page_content,
                                metadata=DocumentMetadata(**doc.metadata),
                                relevance_score=1.0 - score  # Convert distance to similarity
                            ))
                except Exception as e:
                    logger.warning(f"Error searching user documents for {user_id}: {e}")

            # Search system documents (Bentley/Haynes manuals, etc.)
            system_chroma_path = os.path.join(CHROMA_PATH, "system_documents")
            if os.path.exists(system_chroma_path):
                try:
                    system_vectorstore = Chroma(
                        persist_directory=system_chroma_path,
                        embedding_function=embeddings,
                        collection_name="system_documents"
                    )
                    system_results = system_vectorstore.similarity_search_with_score(query, k=limit)

                    for doc, score in system_results:
                        if self._matches_car_criteria(doc.metadata, car_make, car_model, car_year):
                            results.append(DocumentSearchResult(
                                content=doc.page_content,
                                metadata=DocumentMetadata(**doc.metadata),
                                relevance_score=1.0 - score
                            ))
                except Exception as e:
                    logger.warning(f"Error searching system documents: {e}")

            # Sort by relevance score and limit results
            results.sort(key=lambda x: x.relevance_score, reverse=True)
            return results[:limit]

        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []

    def _matches_car_criteria(self, metadata: dict, car_make: Optional[str],
                             car_model: Optional[str], car_year: Optional[int]) -> bool:
        """Check if document metadata matches car criteria."""
        if not any([car_make, car_model, car_year]):
            return True  # No criteria specified, include all

        # Check make
        if car_make and metadata.get("car_make"):
            if metadata["car_make"].lower() != car_make.lower():
                return False

        # Check model
        if car_model and metadata.get("car_model"):
            if metadata["car_model"].lower() != car_model.lower():
                return False

        # Check year (allow some tolerance)
        if car_year and metadata.get("car_year"):
            year_diff = abs(metadata["car_year"] - car_year)
            if year_diff > 3:  # Allow 3 years tolerance
                return False

        return True

# Global document manager instance
document_manager = DocumentManager()

def retrieve_fsm(query: str, car=None, user_id=None):
    """Enhanced FSM retrieval with document search capabilities."""
    try:
        # Parse car information if provided
        car_make, car_model, car_year = None, None, None
        if car:
            car_parts = car.split()
            if len(car_parts) >= 2:
                car_make = car_parts[0]
                car_model = " ".join(car_parts[1:-1]) if len(car_parts) > 2 else car_parts[1]
                try:
                    car_year = int(car_parts[-1])
                except ValueError:
                    car_model = " ".join(car_parts[1:])

        # Search documents using the enhanced document manager
        search_results = document_manager.search_documents(
            query=query,
            user_id=user_id or "anonymous",
            car_make=car_make,
            car_model=car_model,
            car_year=car_year,
            limit=3
        )

        # Combine results into context
        context_parts = []

        if search_results:
            for i, result in enumerate(search_results, 1):
                doc_type = result.metadata.document_type.value.replace("_", " ").title()
                source_info = f"[{doc_type}"
                if result.metadata.title:
                    source_info += f": {result.metadata.title}"
                source_info += f"] (Score: {result.relevance_score:.2f})"

                context_parts.append(f"Source {i}: {source_info}")
                context_parts.append(result.content)
                context_parts.append("")  # Empty line for separation

        # Add recent conversation history for context
        if supabase and user_id:
            try:
                history = supabase.table("queries").select("question, response").eq("user_id", user_id).order("created_at", desc=True).limit(3).execute()
                if history.data and context_parts:
                    context_parts.append("Recent conversation history:")
                    for i, conv in enumerate(reversed(history.data)):
                        context_parts.append(f"Q{i+1}: {conv['question']}")
                        context_parts.append(f"A{i+1}: {conv['response']}")
            except Exception as e:
                logger.warning(f"Failed to retrieve conversation history for user {user_id}: {e}")

        return "\n".join(context_parts) if context_parts else None

    except Exception as e:
        logger.error(f"Error in retrieve_fsm: {e}")
        return None

def call_gpt4o(question: str, car=None, engine=None, notes=None, unit_preferences=None):
    if not OPENAI_API_KEY:
        return "OPENAI_API_KEY not set"

    # Create TTS-friendly system prompt with unit preferences
    system_prompt_parts = [
        "You are GreaseMonkey AI, an expert automotive assistant.",
        "Provide concise, direct answers optimized for text-to-speech.",
        "Be quick and punctual - get straight to the point.",
        "IMPORTANT: Keep responses under 800 characters for optimal TTS performance.",
        "Break up very long answers into multiple shorter responses if needed.",
        "DO NOT repeat the car name or details in your answer - the user already knows what car they're asking about.",
        "Focus only on answering the specific question asked."
    ]

    # Add unit preferences if provided
    if unit_preferences:
        system_prompt_parts.append(create_unit_instructions(unit_preferences))
    else:
        # Default TTS-friendly formatting rules
        system_prompt_parts.extend([
            "",
            "FORMATTING RULES:",
            "- Never use abbreviations for units (spell them out completely)",
            "- Use full unit names like 'newton meters' instead of 'Nm'",
            "- Use 'pound feet' instead of 'lb-ft'",
            "- Use 'pounds per square inch' instead of 'PSI'",
            "- Be concise but clear for voice reading"
        ])

    system_prompt = "\n".join(system_prompt_parts)

    user_content = question
    if car or engine or notes:
        user_content += f"\nCar: {car or ''}\nEngine: {engine or ''}\nNotes: {notes or ''}"

    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    # Add organization and project headers if available
    if OPENAI_ORGANIZATION:
        headers["OpenAI-Organization"] = OPENAI_ORGANIZATION
    if OPENAI_PROJECT:
        headers["OpenAI-Project"] = OPENAI_PROJECT

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=payload
    )
    if response.status_code != 200:
        return f"OpenAI error: {response.text}"
    data = response.json()
    return data["choices"][0]["message"]["content"]

def call_elevenlabs_tts(text: str) -> str:
    # Return a URL that works with the POST endpoint
    # The frontend will need to make a POST request with the text
    return f"/tts?text={text.replace(' ', '%20')}"

supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_query(user_id: str, question: str, response: str):
    if not supabase:
        return
    try:
        # Try to insert the query
        supabase.table("queries").insert({
            "user_id": user_id,
            "question": question,
            "response": response
        }).execute()
        logger.info(f"Query logged for user {user_id}")
    except Exception as e:
        # If user doesn't exist, create them and try again
        if "queries_user_id_fkey" in str(e):
            try:
                logger.info(f"Creating new user {user_id}")
                supabase.table("users").insert({
                    "user_id": user_id,  # Fixed: use user_id instead of id
                    "email": None,  # Optional field
                    "garage": [],   # Default empty garage
                    "tier": "free_tier"  # Default tier
                }).execute()

                # Now try logging the query again
                supabase.table("queries").insert({
                    "user_id": user_id,
                    "question": question,
                    "response": response
                }).execute()
                logger.info(f"Query logged for new user {user_id}")
            except Exception as create_error:
                logger.warning(f"Failed to create user and log query for {user_id}: {create_error}")
        else:
            logger.warning(f"Failed to log query for user {user_id}: {e}")

class PricingService:
    """Service for managing user usage, pricing, and tier enforcement."""

    def __init__(self):
        self.supabase = supabase

    def get_user_tier(self, user_id: str) -> UserTier:
        """Get user's current tier, considering any active overrides."""
        if not self.supabase:
            return UserTier.FREE_TIER

        try:
            # Check for active tier override first
            override_result = self.supabase.table("tier_overrides").select("*").eq("user_id", user_id).gte("expires_at", datetime.now().isoformat()).execute()

            if override_result.data:
                # Use the most recent override
                override = sorted(override_result.data, key=lambda x: x['created_at'])[-1]
                logger.info(f"Using tier override for user {user_id}: {override['override_tier']}")
                return UserTier(override['override_tier'])

            # Get regular user tier
            user_result = self.supabase.table("users").select("tier").eq("user_id", user_id).execute()
            if user_result.data:
                return UserTier(user_result.data[0]["tier"])
            else:
                # Create user with default tier if doesn't exist
                self.supabase.table("users").insert({
                    "user_id": user_id,  # Fixed: use user_id instead of id
                    "email": None,  # Optional field
                    "garage": [],   # Default empty garage
                    "tier": "free_tier"  # Default tier
                }).execute()
                return UserTier.FREE_TIER

        except Exception as e:
            logger.error(f"Error getting user tier for {user_id}: {e}")
            return UserTier.FREE_TIER

    def get_tier_limits(self, tier: UserTier) -> TierLimits:
        """Get the limits for a specific tier."""
        return TIER_CONFIGS.get(tier, TIER_CONFIGS[UserTier.FREE_TIER])

    def track_usage(self, user_id: str, usage_type: UsageType, details: Optional[Dict] = None) -> bool:
        """Track a usage event and calculate cost if applicable."""
        if not self.supabase:
            return True  # If no DB, allow usage

        try:
            tier = self.get_user_tier(user_id)
            tier_limits = self.get_tier_limits(tier)

            # No cost calculation needed for subscription-only model
            cost_cents = 0

            # Record usage for analytics only (no billing)
            usage_record = {
                "user_id": user_id,
                "usage_type": usage_type.value,
                "timestamp": datetime.now().isoformat(),
                "details": details or {},
                "cost_cents": cost_cents
            }

            self.supabase.table("usage_records").insert(usage_record).execute()

            # Update daily stats
            self._update_daily_stats(user_id, usage_type, cost_cents)

            logger.info(f"Tracked usage for user {user_id}: {usage_type.value} (cost: ${cost_cents/100:.2f})")
            return True

        except Exception as e:
            logger.error(f"Error tracking usage for user {user_id}: {e}")
            return False

    def _update_daily_stats(self, user_id: str, usage_type: UsageType, cost_cents: int):
        """Update daily usage statistics."""
        today = date.today().isoformat()

        try:
            # Get existing daily stats
            stats_result = self.supabase.table("daily_usage_stats").select("*").eq("user_id", user_id).eq("date", today).execute()

            if stats_result.data:
                # Update existing record
                stats = stats_result.data[0]
                stats_id = stats["id"]

                # Increment the appropriate counter
                if usage_type == UsageType.ASK_QUERY:
                    stats["ask_queries"] += 1
                elif usage_type == UsageType.DOCUMENT_UPLOAD:
                    stats["document_uploads"] += 1
                elif usage_type == UsageType.DOCUMENT_SEARCH:
                    stats["document_searches"] += 1
                elif usage_type == UsageType.TTS_REQUEST:
                    stats["tts_requests"] += 1
                elif usage_type == UsageType.STT_REQUEST:
                    stats["stt_requests"] += 1

                stats["total_cost_cents"] += cost_cents

                self.supabase.table("daily_usage_stats").update(stats).eq("id", stats_id).execute()
            else:
                # Create new daily stats record
                new_stats = {
                    "user_id": user_id,
                    "date": today,
                    "ask_queries": 1 if usage_type == UsageType.ASK_QUERY else 0,
                    "document_uploads": 1 if usage_type == UsageType.DOCUMENT_UPLOAD else 0,
                    "document_searches": 1 if usage_type == UsageType.DOCUMENT_SEARCH else 0,
                    "tts_requests": 1 if usage_type == UsageType.TTS_REQUEST else 0,
                    "stt_requests": 1 if usage_type == UsageType.STT_REQUEST else 0,
                    "total_cost_cents": cost_cents
                }

                self.supabase.table("daily_usage_stats").insert(new_stats).execute()

        except Exception as e:
            logger.error(f"Error updating daily stats for user {user_id}: {e}")

    def _get_monthly_usage(self, user_id: str, year_month: str) -> MonthlyUsageStats:
        """Get monthly usage statistics for a user."""
        try:
            # Try to get existing monthly stats
            stats_result = self.supabase.table("monthly_usage_stats").select("*").eq("user_id", user_id).eq("year_month", year_month).execute()

            if stats_result.data:
                stats_data = stats_result.data[0]
                return MonthlyUsageStats(
                    user_id=user_id,
                    year_month=year_month,
                    ask_queries=stats_data.get("ask_queries", 0),
                    document_uploads=stats_data.get("document_uploads", 0),
                    document_searches=stats_data.get("document_searches", 0),
                    tts_requests=stats_data.get("tts_requests", 0),
                    stt_requests=stats_data.get("stt_requests", 0),
                    total_cost_cents=stats_data.get("total_cost_cents", 0)
                )
            else:
                # Calculate from daily stats if monthly doesn't exist
                year, month = year_month.split("-")
                daily_stats = self.supabase.table("daily_usage_stats").select("*").eq("user_id", user_id).like("date", f"{year}-{month}-%").execute()

                total_asks = sum(day.get("ask_queries", 0) for day in daily_stats.data)
                total_uploads = sum(day.get("document_uploads", 0) for day in daily_stats.data)
                total_searches = sum(day.get("document_searches", 0) for day in daily_stats.data)
                total_tts = sum(day.get("tts_requests", 0) for day in daily_stats.data)
                total_stt = sum(day.get("stt_requests", 0) for day in daily_stats.data)
                total_cost = sum(day.get("total_cost_cents", 0) for day in daily_stats.data)

                return MonthlyUsageStats(
                    user_id=user_id,
                    year_month=year_month,
                    ask_queries=total_asks,
                    document_uploads=total_uploads,
                    document_searches=total_searches,
                    tts_requests=total_tts,
                    stt_requests=total_stt,
                    total_cost_cents=total_cost
                )

        except Exception as e:
            logger.error(f"Error getting monthly usage for user {user_id}: {e}")
            return MonthlyUsageStats(user_id=user_id, year_month=year_month)

    def _get_total_document_count(self, user_id: str) -> int:
        """Get total number of documents uploaded by user."""
        try:
            result = self.supabase.table("documents").select("id", count="exact").eq("user_id", user_id).execute()
            return result.count or 0
        except Exception as e:
            logger.error(f"Error getting document count for user {user_id}: {e}")
            return 0

    def check_usage_limit(self, user_id: str, usage_type: UsageType) -> Tuple[bool, str]:
        """Check if user can perform an action based on their tier limits."""
        if not self.supabase:
            return True, "OK"  # If no DB, allow usage

        try:
            tier = self.get_user_tier(user_id)
            tier_limits = self.get_tier_limits(tier)

            # For Master Tech tier, no limits apply
            if tier == UserTier.MASTER_TECH:
                return True, "OK"

            # Check daily limits for free tier
            if tier == UserTier.FREE_TIER:
                today = date.today().isoformat()
                stats_result = self.supabase.table("daily_usage_stats").select("*").eq("user_id", user_id).eq("date", today).execute()
                current_usage = stats_result.data[0] if stats_result.data else None

                if usage_type == UsageType.ASK_QUERY:
                    max_asks = tier_limits.max_daily_asks
                    if max_asks is not None:
                        used_asks = current_usage["ask_queries"] if current_usage else 0
                        if used_asks >= max_asks:
                            return False, f"Daily limit reached ({used_asks}/{max_asks} questions used). Upgrade to Weekend Warrior for 50 questions/month."

            # Check monthly limits for Weekend Warrior tier
            elif tier == UserTier.WEEKEND_WARRIOR:
                if usage_type == UsageType.ASK_QUERY:
                    max_monthly_asks = tier_limits.max_monthly_asks
                    if max_monthly_asks is not None:
                        # Get current month's usage
                        current_month = date.today().strftime("%Y-%m")
                        monthly_stats = self._get_monthly_usage(user_id, current_month)
                        used_asks = monthly_stats.ask_queries

                        if used_asks >= max_monthly_asks:
                            return False, f"Monthly limit reached ({used_asks}/{max_monthly_asks} questions used). Upgrade to Master Tech for 200 questions/month."

            # Check document upload limits (applies to all paid tiers)
            if usage_type == UsageType.DOCUMENT_UPLOAD:
                max_uploads = tier_limits.max_document_uploads
                if max_uploads is not None:
                    # Get total document count for user
                    total_docs = self._get_total_document_count(user_id)
                    if total_docs >= max_uploads:
                        if tier == UserTier.FREE_TIER:
                            return False, f"Document upload limit reached. Upgrade to Weekend Warrior for document uploads."
                        elif tier == UserTier.WEEKEND_WARRIOR:
                            return False, f"Document upload limit reached ({total_docs}/{max_uploads}). Upgrade to Master Tech for unlimited documents."

            return True, "OK"

        except Exception as e:
            logger.error(f"Error checking usage limit for user {user_id}: {e}")
            return True, "OK"  # Allow usage if check fails

    def get_user_usage_stats(self, user_id: str, date_str: Optional[str] = None) -> UserUsageResponse:
        """Get comprehensive usage statistics for a user."""
        if date_str is None:
            date_str = date.today().isoformat()

        tier = self.get_user_tier(user_id)
        tier_limits = self.get_tier_limits(tier)

        # Get daily stats
        daily_stats = DailyUsageStats(user_id=user_id, date=date_str)

        if self.supabase:
            try:
                stats_result = self.supabase.table("daily_usage_stats").select("*").eq("user_id", user_id).eq("date", date_str).execute()
                if stats_result.data:
                    stats_data = stats_result.data[0]
                    daily_stats = DailyUsageStats(
                        user_id=user_id,
                        date=date_str,
                        ask_queries=stats_data.get("ask_queries", 0),
                        document_uploads=stats_data.get("document_uploads", 0),
                        document_searches=stats_data.get("document_searches", 0),
                        tts_requests=stats_data.get("tts_requests", 0),
                        stt_requests=stats_data.get("stt_requests", 0),
                        total_cost_cents=stats_data.get("total_cost_cents", 0)
                    )
            except Exception as e:
                logger.error(f"Error getting daily stats for user {user_id}: {e}")

        # Calculate remaining asks for free tier only
        remaining_asks = None
        if tier == UserTier.FREE_TIER and tier_limits.max_daily_asks is not None:
            remaining_asks = max(0, tier_limits.max_daily_asks - daily_stats.ask_queries)

        # No cost estimation needed for subscription-only model
        estimated_monthly_cost_cents = None

        can_make_requests, _ = self.check_usage_limit(user_id, UsageType.ASK_QUERY)

        return UserUsageResponse(
            user_id=user_id,
            tier=tier,
            date=date_str,
            daily_stats=daily_stats,
            tier_limits=tier_limits,
            can_make_requests=can_make_requests,
            remaining_asks=remaining_asks,
            estimated_monthly_cost_cents=estimated_monthly_cost_cents
        )

    def check_vehicle_limit(self, user_id: str, current_vehicle_count: int) -> Tuple[bool, str]:
        """Check if user can add more vehicles based on their tier."""
        tier = self.get_user_tier(user_id)
        tier_limits = self.get_tier_limits(tier)

        if tier_limits.max_vehicles is not None:
            if current_vehicle_count >= tier_limits.max_vehicles:
                return False, f"Vehicle limit reached ({current_vehicle_count}/{tier_limits.max_vehicles}). Upgrade for unlimited vehicles."

        return True, "OK"

    def set_tier_override(self, user_id: str, override_tier: UserTier, expires_at: Optional[datetime] = None) -> bool:
        """Set a temporary tier override for testing/development."""
        if not self.supabase:
            return False

        try:
            if expires_at is None:
                # Default to 24 hours from now
                expires_at = datetime.now() + timedelta(hours=24)

            override_data = {
                "user_id": user_id,
                "override_tier": override_tier.value,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now().isoformat()
            }

            self.supabase.table("tier_overrides").insert(override_data).execute()
            logger.info(f"Set tier override for user {user_id}: {override_tier.value} until {expires_at}")
            return True

        except Exception as e:
            logger.error(f"Error setting tier override for user {user_id}: {e}")
            return False

# Global pricing service instance
pricing_service = PricingService()

# =============================================================================
# SUBSCRIPTION MANAGEMENT SERVICE
# =============================================================================

class SubscriptionService:
    def __init__(self):
        self.supabase: Client = create_client(
            SUPABASE_URL,
            os.getenv("SUPABASE_SERVICE_KEY")  # Use service role key for admin operations
        )

        # App Store Connect API credentials (optional - for server-to-server verification)
        self.app_store_shared_secret = os.getenv("APP_STORE_SHARED_SECRET")

        # Play Store API credentials (optional)
        self.play_store_service_account = os.getenv("PLAY_STORE_SERVICE_ACCOUNT_JSON")

    async def verify_receipt(self, request: ReceiptVerificationRequest) -> ReceiptVerificationResponse:
        """Verify purchase receipt from App Store or Play Store"""

        try:
            if request.platform == Platform.IOS:
                return await self._verify_ios_receipt(request)
            elif request.platform == Platform.ANDROID:
                return await self._verify_android_receipt(request)
            else:
                return ReceiptVerificationResponse(
                    success=False,
                    tier=NewSubscriptionTier.GARAGE_VISITOR,
                    error_message="Unsupported platform"
                )
        except Exception as e:
            return ReceiptVerificationResponse(
                success=False,
                tier=NewSubscriptionTier.GARAGE_VISITOR,
                error_message=f"Receipt verification failed: {str(e)}"
            )

    async def _verify_ios_receipt(self, request: ReceiptVerificationRequest) -> ReceiptVerificationResponse:
        """Verify iOS App Store receipt"""

        # For production, use https://buy.itunes.apple.com/verifyReceipt
        # For testing, use https://sandbox.itunes.apple.com/verifyReceipt
        verification_url = "https://buy.itunes.apple.com/verifyReceipt"

        payload = {
            "receipt-data": request.receipt_data,
            "password": self.app_store_shared_secret,
            "exclude-old-transactions": True
        }

        try:
            response = requests.post(verification_url, json=payload, timeout=30)
            result = response.json()

            # If production verification fails with status 21007, try sandbox
            if result.get("status") == 21007:
                verification_url = "https://sandbox.itunes.apple.com/verifyReceipt"
                response = requests.post(verification_url, json=payload, timeout=30)
                result = response.json()

            if result.get("status") == 0:  # Success
                # Extract subscription info from receipt
                latest_receipt_info = result.get("latest_receipt_info", [])
                if latest_receipt_info:
                    latest_transaction = latest_receipt_info[-1]

                    # Parse subscription details
                    product_id = latest_transaction.get("product_id")
                    expires_date_ms = int(latest_transaction.get("expires_date_ms", 0))
                    expires_date = datetime.fromtimestamp(expires_date_ms / 1000) if expires_date_ms else None
                    purchase_date_ms = int(latest_transaction.get("purchase_date_ms", 0))
                    purchase_date = datetime.fromtimestamp(purchase_date_ms / 1000) if purchase_date_ms else None

                    # Update subscription in database
                    tier = self._get_tier_from_product_id(product_id)
                    subscription_id = await self._update_subscription_in_db(
                        request.user_id,
                        request.platform,
                        request.transaction_id,
                        product_id,
                        request.receipt_data,
                        purchase_date,
                        expires_date
                    )

                    return ReceiptVerificationResponse(
                        success=True,
                        subscription_id=subscription_id,
                        tier=tier,
                        expires_at=expires_date
                    )

            return ReceiptVerificationResponse(
                success=False,
                tier=NewSubscriptionTier.GARAGE_VISITOR,
                error_message=f"App Store verification failed with status: {result.get('status')}"
            )

        except Exception as e:
            return ReceiptVerificationResponse(
                success=False,
                tier=NewSubscriptionTier.GARAGE_VISITOR,
                error_message=f"iOS receipt verification error: {str(e)}"
            )

    async def _verify_android_receipt(self, request: ReceiptVerificationRequest) -> ReceiptVerificationResponse:
        """Verify Android Play Store receipt"""

        try:
            # For Android, you'd typically use Google Play Developer API
            # This is a simplified implementation - you'd need to implement proper Google API integration

            tier = self._get_tier_from_product_id(request.product_id)

            # For now, set a default expiration (this should come from Play Store API)
            expires_date = datetime.now() + timedelta(days=30)  # Placeholder
            purchase_date = datetime.now()

            subscription_id = await self._update_subscription_in_db(
                request.user_id,
                request.platform,
                request.transaction_id,
                request.product_id,
                request.receipt_data,
                purchase_date,
                expires_date
            )

            return ReceiptVerificationResponse(
                success=True,
                subscription_id=subscription_id,
                tier=tier,
                expires_at=expires_date
            )

        except Exception as e:
            return ReceiptVerificationResponse(
                success=False,
                tier=NewSubscriptionTier.GARAGE_VISITOR,
                error_message=f"Android receipt verification error: {str(e)}"
            )

    def _get_tier_from_product_id(self, product_id: str) -> NewSubscriptionTier:
        """Map product ID to subscription tier"""
        if product_id in ["gearhead_monthly_499", "gearhead_yearly_4990"]:
            return NewSubscriptionTier.GEARHEAD
        elif product_id in ["mastertech_monthly_2999", "mastertech_yearly_29990"]:
            return NewSubscriptionTier.MASTER_TECH
        else:
            return NewSubscriptionTier.GARAGE_VISITOR

    async def _update_subscription_in_db(
        self,
        user_id: str,
        platform: Platform,
        transaction_id: str,
        product_id: str,
        receipt_data: str,
        purchase_date: datetime,
        expires_date: datetime
    ) -> str:
        """Update user subscription in Supabase database"""

        # Call the database function to update subscription
        result = self.supabase.rpc(
            "update_subscription_from_receipt",
            {
                "p_user_id": user_id,
                "p_platform": platform.value,
                "p_transaction_id": transaction_id,
                "p_product_id": product_id,
                "p_receipt_data": receipt_data,
                "p_purchase_date": purchase_date.isoformat(),
                "p_expires_date": expires_date.isoformat()
            }
        ).execute()

        if result.data:
            return str(result.data)
        else:
            raise Exception("Failed to update subscription in database")

    async def get_user_subscription_status(self, user_id: str) -> SubscriptionStatusResponse:
        """Get user's current subscription status and permissions"""

        try:
            # Get user's current tier
            tier_result = self.supabase.rpc(
                "get_user_subscription_tier",
                {"p_user_id": user_id}
            ).execute()

            current_tier = NewSubscriptionTier(tier_result.data or "garage_visitor")

            # Get subscription details
            subscription_result = self.supabase.table("user_subscriptions").select("*").eq(
                "user_id", user_id
            ).eq("status", "active").order("created_at", desc=True).limit(1).execute()

            subscription = None
            if subscription_result.data:
                sub_data = subscription_result.data[0]
                subscription = UserSubscription(
                    id=sub_data["id"],
                    user_id=sub_data["user_id"],
                    subscription_tier=NewSubscriptionTier(sub_data["subscription_tier"]),
                    platform=Platform(sub_data["platform"]),
                    platform_subscription_id=sub_data.get("platform_subscription_id"),
                    product_id=sub_data["product_id"],
                    status=SubscriptionStatus(sub_data["status"]),
                    current_period_start=sub_data.get("current_period_start"),
                    current_period_end=sub_data.get("current_period_end"),
                    cancel_at_period_end=sub_data.get("cancel_at_period_end", False),
                    created_at=sub_data["created_at"],
                    updated_at=sub_data["updated_at"]
                )

            # Determine permissions based on tier
            can_ask_questions = await self._can_user_perform_action(user_id, "ask_question")
            can_upload_documents = await self._can_user_perform_action(user_id, "upload_document")
            can_add_vehicles = await self._can_user_perform_action(user_id, "add_vehicle")

            # Calculate remaining usage for free tier
            questions_remaining = None
            documents_remaining = None

            if current_tier == NewSubscriptionTier.GARAGE_VISITOR:
                # Get today's usage
                usage_result = self.supabase.table("subscription_usage").select("*").eq(
                    "user_id", user_id
                ).gte("period_start", datetime.now().date()).limit(1).execute()

                if usage_result.data:
                    usage = usage_result.data[0]
                    questions_remaining = max(0, 3 - usage.get("questions_used", 0))
                else:
                    questions_remaining = 3

            elif current_tier == NewSubscriptionTier.GEARHEAD:
                # Get current period usage for documents
                usage_result = self.supabase.table("subscription_usage").select("*").eq(
                    "user_id", user_id
                ).gte("period_start", datetime.now().date()).limit(1).execute()

                if usage_result.data:
                    usage = usage_result.data[0]
                    documents_remaining = max(0, 20 - usage.get("documents_uploaded", 0))
                else:
                    documents_remaining = 20

            return SubscriptionStatusResponse(
                user_id=user_id,
                current_tier=current_tier,
                subscription=subscription,
                can_ask_questions=can_ask_questions,
                can_upload_documents=can_upload_documents,
                can_add_vehicles=can_add_vehicles,
                questions_remaining=questions_remaining,
                documents_remaining=documents_remaining
            )

        except Exception as e:
            # Return default free tier status on error
            return SubscriptionStatusResponse(
                user_id=user_id,
                current_tier=NewSubscriptionTier.GARAGE_VISITOR,
                subscription=None,
                can_ask_questions=False,
                can_upload_documents=False,
                can_add_vehicles=False,
                questions_remaining=0
            )

    async def _can_user_perform_action(self, user_id: str, action: str) -> bool:
        """Check if user can perform a specific action"""
        try:
            result = self.supabase.rpc(
                "can_user_perform_action",
                {
                    "p_user_id": user_id,
                    "p_action": action
                }
            ).execute()

            return bool(result.data)
        except:
            return False

    async def handle_webhook(self, platform: Platform, payload: Dict[str, str]) -> bool:
        """Handle webhook notifications from app stores"""

        try:
            # Store webhook event
            self.supabase.table("webhook_events").insert({
                "platform": platform.value,
                "event_type": payload.get("notification_type", "unknown"),
                "raw_payload": payload,
                "processed": False
            }).execute()

            # Process webhook based on platform
            if platform == Platform.IOS:
                return await self._process_ios_webhook(payload)
            elif platform == Platform.ANDROID:
                return await self._process_android_webhook(payload)

            return False

        except Exception as e:
            logger.error(f"Webhook processing error: {str(e)}")
            return False

    async def _process_ios_webhook(self, payload: Dict[str, str]) -> bool:
        """Process iOS App Store Server Notifications"""
        # Implementation for iOS webhook processing
        # This would handle subscription cancellations, renewals, etc.
        return True

    async def _process_android_webhook(self, payload: Dict[str, str]) -> bool:
        """Process Android Play Store Developer Notifications"""
        # Implementation for Android webhook processing
        return True

# Initialize subscription service
subscription_service = SubscriptionService()
