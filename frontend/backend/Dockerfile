FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY . .

RUN cd backend && uv sync --no-dev

WORKDIR /app/backend

EXPOSE 8000
CMD [".venv/bin/python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
