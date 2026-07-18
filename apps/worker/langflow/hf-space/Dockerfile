# Langflow di Hugging Face Spaces (SDK: Docker).
# Salin folder ini ke repo Space Anda (Settings HF: Space SDK = Docker).
#
# HF Spaces WAJIB expose port 7860 dan filesystem-nya EPHEMERAL — jangan
# mengandalkan SQLite lokal. State (flow, credential) HARUS di Postgres
# eksternal lewat LANGFLOW_DATABASE_URL (lihat README di folder ini).

FROM langflowai/langflow:latest

# HF menjalankan container sebagai user non-root (uid 1000). Beri Langflow
# direktori cache/config yang bisa ditulis.
ENV HOME=/app \
    LANGFLOW_HOST=0.0.0.0 \
    LANGFLOW_PORT=7860

WORKDIR /app

EXPOSE 7860

CMD ["langflow", "run", "--host", "0.0.0.0", "--port", "7860"]
