FROM python:3.11-slim

# Create a non-root user and group
# Using existing 'nogroup' for simplicity, or create a new one like in frontend
RUN adduser --system --no-create-home --group appuser

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt ./
RUN pip install --upgrade pip
# It's good practice to ensure pip install doesn't require root for user-site packages if not using a venv in container
# However, with a dedicated WORKDIR and USER, this should be fine.
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
# Give ownership to appuser before switching, or use COPY --chown
COPY . .
RUN chown -R appuser:appuser /app

# Switch to the non-root user
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
