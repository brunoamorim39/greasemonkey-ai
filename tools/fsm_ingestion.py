#!/usr/bin/env python3
"""
FSM Ingestion Tool for GreaseMonkey AI

This tool processes PDF files and other documents to create embeddings
for the RAG system.
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Optional

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FSMIngestionTool:
    def __init__(self, chroma_path: str = "./chroma_db"):
        self.chroma_path = chroma_path
        self.embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

    def load_documents(self, file_path: str) -> List:
        """Load documents from various file types"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        if file_path.suffix.lower() == '.pdf':
            loader = PyPDFLoader(str(file_path))
        elif file_path.suffix.lower() in ['.txt', '.md']:
            loader = TextLoader(str(file_path))
        else:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")

        documents = loader.load()
        logger.info(f"Loaded {len(documents)} documents from {file_path}")
        return documents

    def process_documents(self, documents: List, metadata: Optional[dict] = None) -> List:
        """Split documents into chunks and add metadata"""
        chunks = self.text_splitter.split_documents(documents)

        # Add custom metadata to all chunks
        if metadata:
            for chunk in chunks:
                chunk.metadata.update(metadata)

        logger.info(f"Split into {len(chunks)} chunks")
        return chunks

    def ingest_to_vectorstore(self, chunks: List):
        """Add chunks to the vector store"""
        if os.path.exists(self.chroma_path):
            # Load existing vectorstore
            vectorstore = Chroma(
                persist_directory=self.chroma_path,
                embedding_function=self.embeddings
            )
            vectorstore.add_documents(chunks)
        else:
            # Create new vectorstore
            vectorstore = Chroma.from_documents(
                chunks,
                self.embeddings,
                persist_directory=self.chroma_path
            )

        vectorstore.persist()
        logger.info(f"Added {len(chunks)} chunks to vectorstore at {self.chroma_path}")

    def ingest_file(self, file_path: str, car_model: Optional[str] = None,
                   year: Optional[str] = None, engine: Optional[str] = None):
        """Complete ingestion pipeline for a single file"""
        try:
            # Load documents
            documents = self.load_documents(file_path)

            # Prepare metadata
            metadata = {
                "source": str(Path(file_path).name),
                "file_path": str(file_path)
            }
            if car_model:
                metadata["car"] = car_model
            if year:
                metadata["year"] = year
            if engine:
                metadata["engine"] = engine

            # Process and ingest
            chunks = self.process_documents(documents, metadata)
            self.ingest_to_vectorstore(chunks)

            logger.info(f"Successfully ingested {file_path}")

        except Exception as e:
            logger.error(f"Failed to ingest {file_path}: {e}")
            raise

def main():
    parser = argparse.ArgumentParser(description="Ingest FSM documents into GreaseMonkey AI")
    parser.add_argument("file_path", help="Path to the document to ingest")
    parser.add_argument("--car", help="Car model (e.g., '2008 Subaru WRX')")
    parser.add_argument("--year", help="Model year")
    parser.add_argument("--engine", help="Engine code (e.g., 'EJ255')")
    parser.add_argument("--chroma-path", default="./chroma_db",
                       help="Path to Chroma vector store")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Check for required environment variables
    if not os.getenv("OPENAI_API_KEY"):
        logger.error("OPENAI_API_KEY environment variable is required")
        sys.exit(1)

    try:
        tool = FSMIngestionTool(args.chroma_path)
        tool.ingest_file(
            args.file_path,
            car_model=args.car,
            year=args.year,
            engine=args.engine
        )
        logger.info("Ingestion completed successfully!")

    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
