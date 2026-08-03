import os, httpx, json
from typing import Dict

class EmailGenerator:
    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"

    def _prompt(self, niche: str, tone: str) -> str:
        return f"""You are an expert B2B copywriter for {niche}.
Write a personalized cold email based on the audit data.
RULES:
1. Subject under 60 chars, mention a specific pain point.
2. First line references the company name and a SPECIFIC finding.
3. Body: 2-3 short paragraphs. Focus on pain, not solution.
4. Soft CTA (question), not hard sell.
5. Tone: {tone}.
6. NEVER use "I hope this email finds you well".
7. Output ONLY valid JSON: {{"subject":"...","body":"...","hook":"..."}}"""

    def _user(self, lead: Dict, niche: str) -> str:
        pains = ", ".join(lead.get("detected_pains", [])) or "no issues"
        return f"""Website: {lead.get('url') or lead.get('domain', 'Unknown')}
Company: {lead.get('company_name', 'Unknown')}
Load time: {lead.get('load_time_ms', 0)}ms
SSL: {'Yes' if lead.get('ssl_valid') else 'No'}
Issues: {pains}
Niche: {niche}"""

    async def _gemini(self, lead, niche, tone):
        payload = {
            "contents": [{"parts": [{"text": self._prompt(niche, tone)}, {"text": self._user(lead, niche)}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 800, "responseMimeType": "application/json"}
        }
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{self.gemini_url}?key={self.gemini_key}", headers={"Content-Type": "application/json"}, json=payload)
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(text)
            return {"subject": data.get("subject", "Quick question"), "body": data.get("body", ""), "hook": data.get("hook", ""), "model": "gemini-2.0-flash"}

    async def _groq(self, lead, niche, tone):
        payload = {
            "model": "llama-3.1-70b-versatile",
            "messages": [{"role": "system", "content": self._prompt(niche, tone)}, {"role": "user", "content": self._user(lead, niche)}],
            "temperature": 0.7, "max_tokens": 800,
            "response_format": {"type": "json_object"}
        }
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(self.groq_url, headers={"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}, json=payload)
            r.raise_for_status()
            data = json.loads(r.json()["choices"][0]["message"]["content"])
            return {"subject": data.get("subject", "Quick question"), "body": data.get("body", ""), "hook": data.get("hook", ""), "model": "llama-3.1-70b"}

    async def generate(self, lead_data: Dict, niche: str, tone: str = "professional", prefer: str = "gemini") -> Dict:
        try:
            if prefer == "gemini" and self.gemini_key:
                return await self._gemini(lead_data, niche, tone)
            elif self.groq_key:
                return await self._groq(lead_data, niche, tone)
            raise ValueError("No AI keys")
        except Exception:
            if prefer == "gemini" and self.groq_key:
                return await self._groq(lead_data, niche, tone)
            raise
