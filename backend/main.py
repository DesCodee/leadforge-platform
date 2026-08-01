from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os
from dotenv import load_dotenv

from services.parser import WebsiteParser
from services.email_generator import EmailGenerator

load_dotenv()

app = FastAPI(title="LeadForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = WebsiteParser()
generator = EmailGenerator()


class ParseRequest(BaseModel):
    urls: List[str]
    niche: str
    tone: str = "professional"
    max_concurrent: int = 5


class GenerateRequest(BaseModel):
    lead_data: dict
    niche: str
    tone: str = "professional"
    model: str = "gemini"


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/parse")
async def parse_websites(req: ParseRequest):
    if len(req.urls) > 100:
        raise HTTPException(status_code=400, detail="Max 100 URLs per batch")

    valid_urls = []
    for url in req.urls:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        valid_urls.append(url)

    results = await parser.parse_batch(valid_urls, req.max_concurrent)
    successful = [r for r in results if isinstance(r, dict)]
    failed = [str(r) for r in results if isinstance(r, Exception)]

    return {
        "processed": len(successful),
        "failed": len(failed),
        "results": successful,
        "errors": failed[:5]
    }


@app.post("/api/generate-email")
async def generate_email(req: GenerateRequest):
    try:
        email = await generator.generate(
            req.lead_data,
            req.niche,
            req.tone,
            req.model
        )
        return {"success": True, "data": email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
