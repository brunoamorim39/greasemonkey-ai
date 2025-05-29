# GreaseMonkey AI - Data Ingestion Tools

This directory contains tools for ingesting FSM (Factory Service Manual) documents and other automotive data into the GreaseMonkey AI knowledge base.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables (copy from backend/.env):
```bash
export OPENAI_API_KEY=your-openai-api-key
```

## FSM Ingestion Tool

The `fsm_ingestion.py` tool processes PDF files and other documents to create embeddings for the RAG system.

### Usage

Basic usage:
```bash
python fsm_ingestion.py path/to/manual.pdf --car "2008 Subaru WRX" --engine "EJ255"
```

With all options:
```bash
python fsm_ingestion.py manual.pdf \
  --car "2008 Subaru WRX" \
  --year "2008" \
  --engine "EJ255" \
  --chroma-path "./custom_chroma_db" \
  --verbose
```

### Supported File Types

- PDF files (.pdf)
- Text files (.txt)
- Markdown files (.md)

### Examples

Ingest a BMW E36 service manual:
```bash
python fsm_ingestion.py bmw_e36_manual.pdf \
  --car "1995 BMW E36" \
  --engine "M50B25" \
  --year "1995"
```

Ingest a Miata manual:
```bash
python fsm_ingestion.py miata_na_manual.pdf \
  --car "1990 Mazda Miata" \
  --engine "B6ZE" \
  --year "1990"
```

## Data Organization

The tool automatically:
- Splits documents into 1000-character chunks with 200-character overlap
- Adds metadata for car model, year, engine, and source file
- Stores embeddings in ChromaDB for fast retrieval
- Persists the vector store for use by the backend API

## Best Practices

1. **Consistent naming**: Use consistent car model names (e.g., "2008 Subaru WRX" not "08 WRX")
2. **Include engine codes**: Always specify engine codes when available
3. **Organize by model**: Keep related manuals together
4. **Test retrieval**: After ingestion, test queries to ensure good retrieval

## Troubleshooting

### Common Issues

1. **OpenAI API key not set**:
   ```
   Error: OPENAI_API_KEY environment variable is required
   ```
   Solution: Set your OpenAI API key in the environment

2. **File not found**:
   ```
   Error: File not found: manual.pdf
   ```
   Solution: Check the file path and ensure the file exists

3. **Unsupported file type**:
   ```
   Error: Unsupported file type: .docx
   ```
   Solution: Convert to PDF or text format first
