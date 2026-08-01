import httpx
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from typing import Dict, List
import re
import time


class WebsiteParser:
    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    async def parse_single(self, url: str) -> Dict:
        start_time = time.time()
        result = {
            "url": url,
            "domain": urlparse(url).netloc,
            "company_name": None,
            "page_title": None,
            "meta_description": None,
            "emails": [],
            "phones": [],
            "ssl_valid": url.startswith("https"),
            "load_time_ms": 0,
            "has_mobile_friendly": None,
            "detected_pains": [],
            "raw_html": "",
            "status": "pending",
            "error": None
        }

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers=self.headers
            ) as client:
                response = await client.get(url)
                load_time = int((time.time() - start_time) * 1000)
                result["load_time_ms"] = load_time
                result["status"] = "fetched"

                html = response.text
                result["raw_html"] = html[:50000]

                soup = BeautifulSoup(html, "html.parser")

                title_tag = soup.find("title")
                result["page_title"] = title_tag.get_text(strip=True) if title_tag else None

                meta_desc = soup.find("meta", attrs={"name": "description"})
                if meta_desc:
                    result["meta_description"] = meta_desc.get("content", "")

                jsonld = soup.find("script", type="application/ld+json")
                if jsonld:
                    try:
                        import json
                        data = json.loads(jsonld.string)
                        if isinstance(data, dict):
                            result["company_name"] = data.get("name") or data.get("legalName")
                    except:
                        pass

                if not result["company_name"]:
                    h1 = soup.find("h1")
                    result["company_name"] = h1.get_text(strip=True)[:100] if h1 else result["page_title"]

                text = soup.get_text(separator=" ", strip=True)
                result["emails"] = list(set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)))[:5]
                result["phones"] = list(set(re.findall(r'[\+]?[1-9][\d\s\-\(\)]{8,}\d', text)))[:3]

                pains = []

                if load_time > 3000:
                    pains.append("slow_speed")
                if not url.startswith("https"):
                    pains.append("no_ssl")

                viewport = soup.find("meta", attrs={"name": "viewport"})
                if not viewport:
                    pains.append("not_mobile_friendly")
                else:
                    result["has_mobile_friendly"] = True

                analytics_patterns = ["google-analytics", "gtag", "googletagmanager", "ymaps", "metrika"]
                has_analytics = any(p in html.lower() for p in analytics_patterns)
                if not has_analytics:
                    pains.append("no_analytics")

                chat_patterns = ["jivoscript", "chatra", "intercom", "crisp", "tawk", "livechat"]
                has_chat = any(p in html.lower() for p in chat_patterns)
                if not has_chat:
                    pains.append("no_chat_widget")

                old_tech = ["jquery-1.", "jquery-2.", "bootstrap/3", "font-awesome/4"]
                for tech in old_tech:
                    if tech in html.lower():
                        pains.append("outdated_stack")
                        break

                og = soup.find("meta", property=re.compile(r"^og:"))
                if not og:
                    pains.append("poor_social_presence")

                result["detected_pains"] = pains
                result["status"] = "completed"

        except httpx.TimeoutException:
            result["status"] = "failed"
            result["error"] = "Timeout"
            result["detected_pains"] = ["site_unavailable"]
        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)[:200]

        return result

    async def parse_batch(self, urls: List[str], max_concurrent: int = 5) -> List[Dict]:
        semaphore = asyncio.Semaphore(max_concurrent)

        async def parse_with_limit(url):
            async with semaphore:
                await asyncio.sleep(0.5)
                return await self.parse_single(url)

        tasks = [parse_with_limit(url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
