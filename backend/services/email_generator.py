import os
import httpx
from typing import Dict
import json


class EmailGenerator:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"

    def _build_system_prompt(self, niche: str, tone: str = "professional") -> str:
        return f"""You are an expert B2B copywriter specializing in cold outreach for {niche}.
Your task is to write a highly personalized cold email based on the website audit data provided.

RULES:
1. Subject line must be under 60 characters and mention a specific pain point.
2. First line must reference the prospect's company name and a SPECIFIC finding from the audit.
3. Body: 2-3 short paragraphs max. Focus on the pain, not your solution.
4. Include a soft CTA (question), not a hard sell.
5. Tone: {tone}.
6. NEVER use generic phrases like "I hope this email finds you well".
7. Output ONLY valid JSON with keys: "subject", "body", "hook"."""

    def _build_user_prompt(self, lead_data: Dict, niche: str) -> str:
        pains = ", ".join(lead_data.get("detected_pains", [])) or "no major issues"
        return f"""Website: {lead_data['url']}
Company: {lead_data.get('company_name', 'Unknown')}
Title: {lead_data.get('page_title', 'N/A')}
Load time: {lead_data.get('load_time_ms', 0)}ms
SSL: {'Yes' if lead_data.get('ssl_valid') else 'No'}
Issues: {pains}
Niche: {niche}"""

    async def generate_with_gemini(self, lead_data: Dict, niche: str, tone: str) -> Dict:
        headers = {"Content-Type": "application/json", "x-goog-api-key": self.gemini_api_key}
        payload = {
            "contents": [{
                "parts": [
                    {"text": self._build_system_prompt(niche, tone)},
                    {"text": self._build_user_prompt(lead_data, niche)}
                ]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json"
            }
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.gemini_url}?key={self.gemini_api_key}",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            result = json.loads(text)
            return {
                "subject": result.get("subject", "Quick question"),
                "body": result.get("body", ""),
                "hook": result.get("hook", ""),
                "model": "gemini-2.0-flash"
            }

    async def generate_with_groq(self, lead_data: Dict, niche: str, tone: str) -> Dict:
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.1-70b-versatile",
            "messages": [
                {"role": "system", "content": self._build_system_prompt(niche, tone)},
                {"role": "user", "content": self._build_user_prompt(lead_data, niche)}
            ],
            "temperature": 0.7,
            "max_tokens": 800,
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.groq_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            result = json.loads(content)
            return {
                "subject": result.get("subject", "Quick question"),
                "body": result.get("body", ""),
                "hook": result.get("hook", ""),
                "model": "llama-3.1-70b"
            }

    async def generate(self, lead_data: Dict, niche: str, tone: str = "professional", prefer_model: str = "gemini") -> Dict:
        try:
            if prefer_model == "gemini" and self.gemini_api_key:
                return await self.generate_with_gemini(lead_data, niche, tone)
            elif self.groq_api_key:
                return await self.generate_with_groq(lead_data, niche, tone)
            else:
                raise ValueError("No AI API keys configured")
        except Exception as e:
            if prefer_model == "gemini" and self.groq_api_key:
                return await self.generate_with_groq(lead_data, niche, tone)
            raise e
