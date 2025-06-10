#!/usr/bin/env python3
"""
Manual Ingestion Script for GreaseMonkey AI

This script helps you ingest Bentley and Haynes manuals into the system
for automatic reference during user queries.

Usage:
    python manual_ingestion.py --help
    python manual_ingestion.py --ingest-folder /path/to/manuals
    python manual_ingestion.py --list-manuals
    python manual_ingestion.py --validate
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Optional
import json
import uuid
from datetime import datetime

# Add the parent directory to the path so we can import from services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services import document_manager, OPENAI_API_KEY, supabase
from models import DocumentMetadata, DocumentType, DocumentStatus

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ManualIngestionManager:
    def __init__(self):
        self.system_manuals_path = os.path.join(os.path.dirname(__file__), "system_manuals")
        os.makedirs(self.system_manuals_path, exist_ok=True)

        # Common car manufacturers and patterns for auto-detection
        self.car_patterns = {
            'bentley': {
                'continental': ['Continental GT', 'Continental Flying Spur'],
                'mulsanne': ['Mulsanne'],
                'bentayga': ['Bentayga'],
                'arnage': ['Arnage'],
                'azure': ['Azure'],
                'brooklands': ['Brooklands']
            },
            'audi': {
                'a3': ['A3'], 'a4': ['A4'], 'a5': ['A5'], 'a6': ['A6'], 'a7': ['A7'], 'a8': ['A8'],
                'q3': ['Q3'], 'q5': ['Q5'], 'q7': ['Q7'], 'q8': ['Q8'],
                'tt': ['TT'], 'r8': ['R8'], 'rs3': ['RS3'], 'rs4': ['RS4'], 'rs5': ['RS5'], 'rs6': ['RS6']
            },
            'bmw': {
                '1series': ['1 Series'], '2series': ['2 Series'], '3series': ['3 Series'],
                '4series': ['4 Series'], '5series': ['5 Series'], '6series': ['6 Series'],
                '7series': ['7 Series'], '8series': ['8 Series'],
                'x1': ['X1'], 'x2': ['X2'], 'x3': ['X3'], 'x4': ['X4'], 'x5': ['X5'], 'x6': ['X6'], 'x7': ['X7']
            },
            'mercedes': {
                'a-class': ['A-Class'], 'b-class': ['B-Class'], 'c-class': ['C-Class'],
                'e-class': ['E-Class'], 's-class': ['S-Class'],
                'cla': ['CLA'], 'cls': ['CLS'], 'glc': ['GLC'], 'gle': ['GLE'], 'gls': ['GLS']
            },
            'volkswagen': {
                'golf': ['Golf'], 'jetta': ['Jetta'], 'passat': ['Passat'], 'tiguan': ['Tiguan'],
                'atlas': ['Atlas'], 'arteon': ['Arteon']
            },
            'porsche': {
                '911': ['911'], 'cayenne': ['Cayenne'], 'macan': ['Macan'],
                'panamera': ['Panamera'], 'boxster': ['Boxster'], 'cayman': ['Cayman']
            }
        }

    def parse_filename_for_car_info(self, filename: str) -> Dict[str, Optional[str]]:
        """
        Parse filename to extract car information.
        Expected patterns:
        - Bentley_Continental_GT_2003-2012_Service_Manual.pdf
        - Haynes_BMW_3Series_E46_1998-2006.pdf
        - VW_Golf_MK7_2013-2020_Repair_Manual.pdf
        """
        filename_lower = filename.lower().replace('_', ' ').replace('-', ' ')

        car_info = {
            'make': None,
            'model': None,
            'year_start': None,
            'year_end': None,
            'engine': None,
            'manual_type': DocumentType.FSM_OFFICIAL
        }

        # Detect manual type
        if 'bentley' in filename_lower:
            car_info['manual_type'] = DocumentType.BENTLEY_MANUAL
            car_info['make'] = 'Bentley'
        elif 'haynes' in filename_lower:
            car_info['manual_type'] = DocumentType.HAYNES_MANUAL

        # Extract make if not already set
        if not car_info['make']:
            for make, models in self.car_patterns.items():
                if make in filename_lower:
                    car_info['make'] = make.title()
                    break

        # Extract model
        if car_info['make']:
            make_key = car_info['make'].lower()
            if make_key in self.car_patterns:
                for model_key, model_names in self.car_patterns[make_key].items():
                    for model_name in model_names:
                        if model_name.lower() in filename_lower:
                            car_info['model'] = model_name
                            break
                    if car_info['model']:
                        break

        # Extract years (pattern: YYYY-YYYY or YYYY)
        import re
        year_pattern = r'(\d{4})(?:\s*-\s*(\d{4}))?'
        year_match = re.search(year_pattern, filename)
        if year_match:
            car_info['year_start'] = int(year_match.group(1))
            if year_match.group(2):
                car_info['year_end'] = int(year_match.group(2))

        return car_info

    def ingest_manual(self, file_path: Path, force_reprocess: bool = False) -> Optional[DocumentMetadata]:
        """Ingest a single manual file."""
        try:
            if not file_path.suffix.lower() == '.pdf':
                logger.warning(f"Skipping non-PDF file: {file_path}")
                return None

            logger.info(f"Processing manual: {file_path.name}")

            # Parse filename for car information
            car_info = self.parse_filename_for_car_info(file_path.name)

            # Read file content
            with open(file_path, 'rb') as f:
                file_content = f.read()

            file_size = len(file_content)

            # Check if already processed (unless force reprocess)
            if not force_reprocess and supabase:
                existing = supabase.table("documents").select("id").eq("filename", file_path.name).eq("user_id", None).execute()
                if existing.data:
                    logger.info(f"Manual already exists: {file_path.name}")
                    return None

            # Create document metadata
            doc_id = str(uuid.uuid4())
            metadata = DocumentMetadata(
                id=doc_id,
                user_id=None,  # System document
                title=self.generate_title(file_path.name, car_info),
                filename=file_path.name,
                document_type=car_info['manual_type'],
                car_make=car_info['make'],
                car_model=car_info['model'],
                car_year=car_info['year_start'],
                file_size=file_size,
                status=DocumentStatus.PROCESSING,
                upload_date=datetime.utcnow(),
                tags=self.generate_tags(car_info),
                is_public=True
            )

            # Store metadata in database
            if supabase:
                supabase.table("documents").insert(metadata.dict()).execute()

            # Process document
            try:
                documents = document_manager.process_pdf_document(file_content, metadata)

                # Store in system documents collection
                success = document_manager.store_document_chunks(documents, "system_documents")

                if success:
                    metadata.status = DocumentStatus.READY
                    metadata.processed_date = datetime.utcnow()

                    if supabase:
                        supabase.table("documents").update({
                            "status": DocumentStatus.READY.value,
                            "processed_date": metadata.processed_date.isoformat(),
                            "page_count": metadata.page_count
                        }).eq("id", doc_id).execute()

                    logger.info(f"Successfully processed manual: {file_path.name}")
                    return metadata
                else:
                    raise Exception("Failed to store manual in vector database")

            except Exception as e:
                # Update status to error
                metadata.status = DocumentStatus.ERROR
                metadata.error_message = str(e)

                if supabase:
                    supabase.table("documents").update({
                        "status": DocumentStatus.ERROR.value,
                        "error_message": str(e)
                    }).eq("id", doc_id).execute()

                raise

        except Exception as e:
            logger.error(f"Error processing manual {file_path}: {e}")
            return None

    def generate_title(self, filename: str, car_info: Dict) -> str:
        """Generate a readable title for the manual."""
        base_name = filename.replace('.pdf', '').replace('_', ' ')

        if car_info['make'] and car_info['model']:
            title = f"{car_info['make']} {car_info['model']}"
            if car_info['year_start']:
                if car_info['year_end'] and car_info['year_end'] != car_info['year_start']:
                    title += f" ({car_info['year_start']}-{car_info['year_end']})"
                else:
                    title += f" ({car_info['year_start']})"
            title += " Service Manual"
            return title

        return base_name

    def generate_tags(self, car_info: Dict) -> List[str]:
        """Generate tags for the manual."""
        tags = []

        if car_info['manual_type'] == DocumentType.BENTLEY_MANUAL:
            tags.append('bentley')
        elif car_info['manual_type'] == DocumentType.HAYNES_MANUAL:
            tags.append('haynes')

        tags.append('service-manual')
        tags.append('repair-guide')

        if car_info['make']:
            tags.append(car_info['make'].lower())

        if car_info['model']:
            tags.append(car_info['model'].lower().replace(' ', '-'))

        return tags

    def ingest_folder(self, folder_path: str, force_reprocess: bool = False) -> Dict[str, int]:
        """Ingest all PDF manuals from a folder."""
        folder = Path(folder_path)
        if not folder.exists():
            raise FileNotFoundError(f"Folder not found: {folder_path}")

        results = {
            'processed': 0,
            'skipped': 0,
            'errors': 0
        }

        pdf_files = list(folder.glob("*.pdf"))
        logger.info(f"Found {len(pdf_files)} PDF files in {folder_path}")

        for pdf_file in pdf_files:
            try:
                result = self.ingest_manual(pdf_file, force_reprocess)
                if result:
                    results['processed'] += 1
                else:
                    results['skipped'] += 1
            except Exception as e:
                logger.error(f"Error processing {pdf_file}: {e}")
                results['errors'] += 1

        return results

    def list_system_manuals(self) -> List[Dict]:
        """List all system manuals in the database."""
        if not supabase:
            logger.error("Supabase not configured")
            return []

        try:
            result = supabase.table("documents").select("*").is_("user_id", None).order("upload_date", desc=True).execute()
            return result.data
        except Exception as e:
            logger.error(f"Error listing system manuals: {e}")
            return []

    def validate_system(self) -> Dict[str, any]:
        """Validate the system configuration and manual availability."""
        validation = {
            'openai_configured': bool(OPENAI_API_KEY),
            'supabase_configured': bool(supabase),
            'vector_db_path': document_manager.get_chroma_path() if hasattr(document_manager, 'get_chroma_path') else 'Unknown',
            'system_manuals_count': 0,
            'document_types': {},
            'errors': []
        }

        if validation['supabase_configured']:
            try:
                manuals = self.list_system_manuals()
                validation['system_manuals_count'] = len(manuals)

                # Count by document type
                for manual in manuals:
                    doc_type = manual.get('document_type', 'unknown')
                    validation['document_types'][doc_type] = validation['document_types'].get(doc_type, 0) + 1

            except Exception as e:
                validation['errors'].append(f"Database error: {e}")

        return validation

def main():
    parser = argparse.ArgumentParser(description='GreaseMonkey AI Manual Ingestion Tool')
    parser.add_argument('--ingest-folder', type=str, help='Folder containing PDF manuals to ingest')
    parser.add_argument('--list-manuals', action='store_true', help='List all system manuals')
    parser.add_argument('--validate', action='store_true', help='Validate system configuration')
    parser.add_argument('--force-reprocess', action='store_true', help='Force reprocessing of existing manuals')
    parser.add_argument('--manual-file', type=str, help='Process a single manual file')

    args = parser.parse_args()

    manager = ManualIngestionManager()

    if args.validate:
        validation = manager.validate_system()
        print("\n=== System Validation ===")
        print(f"OpenAI Configured: {validation['openai_configured']}")
        print(f"Supabase Configured: {validation['supabase_configured']}")
        print(f"System Manuals Count: {validation['system_manuals_count']}")
        print(f"Document Types: {validation['document_types']}")
        if validation['errors']:
            print(f"Errors: {validation['errors']}")
        return

    if args.list_manuals:
        manuals = manager.list_system_manuals()
        print(f"\n=== System Manuals ({len(manuals)} total) ===")
        for manual in manuals:
            status = manual.get('status', 'unknown')
            title = manual.get('title', manual.get('filename', 'Unknown'))
            doc_type = manual.get('document_type', 'unknown')
            print(f"[{status.upper()}] {title} ({doc_type})")
        return

    if args.manual_file:
        file_path = Path(args.manual_file)
        if not file_path.exists():
            print(f"Error: File not found: {args.manual_file}")
            sys.exit(1)

        result = manager.ingest_manual(file_path, args.force_reprocess)
        if result:
            print(f"Successfully processed: {result.title}")
        else:
            print("Failed to process manual")
        return

    if args.ingest_folder:
        if not OPENAI_API_KEY:
            print("Error: OPENAI_API_KEY not configured")
            sys.exit(1)

        try:
            results = manager.ingest_folder(args.ingest_folder, args.force_reprocess)
            print(f"\n=== Ingestion Results ===")
            print(f"Processed: {results['processed']}")
            print(f"Skipped: {results['skipped']}")
            print(f"Errors: {results['errors']}")
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
        return

    parser.print_help()

if __name__ == "__main__":
    main()
