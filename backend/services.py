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
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional, Tuple
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

# Storage tier limits
STORAGE_LIMITS = {
    UserTier.FREE: 0,  # Free users can't upload documents
    UserTier.USAGE_PAID: MAX_STORAGE_PAID_MB,
    UserTier.FIXED_RATE: MAX_STORAGE_PAID_MB
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
            if user_tier == UserTier.FREE:
                return False, "Document uploads require a paid plan"

            # Check storage limits
            current_usage = self.get_user_storage_usage(user_id)
            max_storage = STORAGE_LIMITS[user_tier]

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
                    "tier": "free"  # Default tier
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
