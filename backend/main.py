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
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

parser = WebsiteParser()
generator = EmailGenerator()

class ParseReq(BaseModel):
    urls: List[str]
    niche: str
    tone: str = "professional"
    max_concurrent: int = 5

class GenReq(BaseModel):
    lead_data: dict
    niche: str
    tone: str = "professional"
    model: str = "gemini"

@app.get("/health")
async def health(): 
    return {"status": "ok", "version": "0.1.0"}

@app.post("/api/parse")
async def parse(req: ParseReq):
    if len(req.urls) > 100: 
        raise HTTPException(400, "Max 100 URLs")
    urls = [u if u.startswith(("http://", "https://")) else "https://" + u for u in req.urls]
    results = await parser.parse_batch(urls, req.max_concurrent)
    ok = [r for r in results if isinstance(r, dict)]
    fail = [str(r) for r in results if isinstance(r, Exception)]
    return {"processed": len(ok), "failed": len(fail), "results": ok, "errors": fail[:5]}

@app.post("/api/generate-email")
async def gen(req: GenReq):
    try:
        email = await generator.generate(req.lead_data, req.niche, req.tone, req.model)
        return {"success": True, "data": email}
    except Exception as e:
        raise HTTPException(500, str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
