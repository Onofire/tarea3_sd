FROM python:3.10-slim

WORKDIR /app

COPY main.py .

RUN pip install --no-cache-dir pymongo elasticsearch==8.13.1 requests


CMD ["python", "main.py"]

