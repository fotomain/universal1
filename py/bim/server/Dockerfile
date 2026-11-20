# The BIM converter service (phase 2). Build from this folder:  docker build -t bim-server .   Run:  docker run -p 8765:8765 -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... bim-server
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./
EXPOSE 8765
CMD ["python", "server.py"]
