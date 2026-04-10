# Backend Dockerfile pour FastAPI
FROM python:3.11-slim

# Empêche la génération de fichiers .pyc et permet d'afficher les logs en direct
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Installation des paquets système nécessaires pour certaines librairies (comme psycopg2 et ML)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copie des requirements et installation
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copie du reste du code
COPY . .

# Exposition du port
EXPOSE 8000

# Commande pour lancer Uvicorn géré par Gunicorn en production (Worker Class)
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
