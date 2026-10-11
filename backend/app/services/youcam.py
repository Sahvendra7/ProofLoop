import httpx
import uuid
import asyncio
from typing import Optional
from app.core.config import settings
from app.models.schemas import SkinMeasurements, ScanResult

class YouCamService:
    def __init__(self):
        self.api_key = settings.YOUCAM_API_KEY
        self.api_url = settings.YOUCAM_API_URL
        self.demo_mode = settings.DEMO_MODE
        self.client = httpx.AsyncClient(
            base_url=self.api_url,
            headers={"Authorization": f"Bearer {self.api_key}"}
        )

    async def analyze_skin(self, image_bytes: bytes) -> ScanResult:
        if self.demo_mode:
            return self._generate_demo_result()
            
        try:
            # 1. Get Presigned URL
            file_id, upload_url = await self._get_presigned_url(len(image_bytes))
            
            # 2. Upload Image
            await self._upload_image(upload_url, image_bytes)
            
            # 3. Create Task
            task_id = await self._create_task(file_id)
            
            # 4. Poll for Result
            raw_result = await self._poll_task_result(task_id)
            
            # 5. Parse Result
            return self._parse_result(raw_result)
            
        except Exception as e:
            # Fallback to demo mode on failure if allowed, or raise.
            # As per instructions, "Never implement silent mock fallback in the real product flow."
            # So if NOT in demo mode, raise the error.
            print(f"YouCam API Error: {str(e)}")
            raise Exception(str(e))

    async def _get_presigned_url(self, file_size: int) -> tuple[str, str]:
        payload = {
            "files": [
                {
                    "content_type": "image/jpeg",
                    "file_name": "scan.jpg",
                    "file_size": file_size
                }
            ]
        }
        response = await self.client.post("/s2s/v2.0/file", json=payload)
        response.raise_for_status()
        res_json = response.json()
        data = res_json.get("data", res_json).get("files", [])[0]
        return data.get("file_id"), data.get("requests", [])[0].get("url")

    async def _upload_image(self, url: str, image_bytes: bytes):
        async with httpx.AsyncClient() as upload_client:
            response = await upload_client.put(url, content=image_bytes, headers={"Content-Type": "image/jpeg"})
            response.raise_for_status()

    async def _create_task(self, file_id: str) -> str:
        payload = {
            "src_file_id": file_id,
            "dst_actions": ["moisture", "oiliness", "redness", "texture", "pore", "acne", "dark_circle_v2"]
        }
        response = await self.client.post("/s2s/v2.0/task/skin-analysis", json=payload)
        response.raise_for_status()
        res_json = response.json()
        return res_json.get("data", res_json).get("task_id")

    async def _poll_task_result(self, task_id: str, max_retries: int = 15, delay: int = 2) -> dict:
        import zipfile
        import io
        import json

        for _ in range(max_retries):
            response = await self.client.get(f"/s2s/v2.0/task/skin-analysis/{task_id}")
            response.raise_for_status()
            res_json = response.json()
            data = res_json.get("data", res_json)
            status = data.get("task_status")
            if status == "success":
                zip_url = data.get("results", {}).get("url") or data.get("result", {}).get("url")
                if not zip_url:
                    return {}
                
                # Download and extract the zip file
                async with httpx.AsyncClient() as session:
                    zip_resp = await session.get(zip_url)
                    zip_resp.raise_for_status()
                    zip_bytes = zip_resp.content
                
                with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
                    for filename in z.namelist():
                        if filename.endswith("score_info.json"):
                            with z.open(filename) as f:
                                return json.loads(f.read().decode('utf-8'))
                return {}
            elif status == "error":
                raise Exception(f"YouCam API Error: {data.get('error_message', 'Unknown error')}")
            await asyncio.sleep(delay)
        raise Exception("Timeout waiting for YouCam Skin Analysis result.")

    def _safe_int(self, val) -> int:
        try:
            if not val:
                return 0
            return int(float(val))
        except (ValueError, TypeError):
            return 0

    def _parse_result(self, raw: dict) -> ScanResult:
        measurements = SkinMeasurements(
            hydration=self._safe_int(raw.get("moisture", {}).get("ui_score", 0)),
            oiliness=self._safe_int(raw.get("oiliness", {}).get("ui_score", 0)),
            redness=self._safe_int(raw.get("redness", {}).get("ui_score", 0)),
            texture=self._safe_int(raw.get("texture", {}).get("ui_score", 0)),
            pores=self._safe_int(raw.get("pore", {}).get("ui_score", 0)),
            acne=self._safe_int(raw.get("acne", {}).get("ui_score", 0)),
            dark_circles=self._safe_int(raw.get("dark_circle_v2", {}).get("ui_score", 0)),
        )
        return ScanResult(
            id=str(uuid.uuid4()),
            measurements=measurements,
            raw_response=raw,
            is_demo=False
        )
        
    def _generate_demo_result(self) -> ScanResult:
        measurements = SkinMeasurements(
            hydration=34,
            oiliness=74,
            redness=68,
            texture=53,
            pores=61,
            acne=42,
            dark_circles=55
        )
        return ScanResult(
            id=str(uuid.uuid4()),
            measurements=measurements,
            raw_response={"note": "Generated by Demo Mode"},
            is_demo=True
        )

    async def simulate_skin(self, image_bytes: bytes, feature: str, intensity: float = 1.0) -> str:
        if self.demo_mode:
            return ""

        try:
            file_id, upload_url = await self._get_presigned_url(len(image_bytes))
            await self._upload_image(upload_url, image_bytes)
            task_id = await self._create_simulation_task(file_id, feature, intensity)
            result_url = await self._poll_simulation_result(task_id)
            return result_url
        except Exception as e:
            print(f"YouCam Simulation API Error: {str(e)}")
            raise Exception("Failed to process simulation with YouCam API")

    async def _create_simulation_task(self, file_id: str, feature: str, intensity: float) -> str:
        api_feature = "texture" # Default fallback
        feature_lower = feature.lower()
        if "redness" in feature_lower:
            api_feature = "redness"
        elif "pore" in feature_lower:
            api_feature = "pore"
        elif "oil" in feature_lower:
            api_feature = "oiliness"
        elif "hydration" in feature_lower:
            api_feature = "texture"
        elif "texture" in feature_lower:
            api_feature = "texture"
            
        payload = {
            "src_file_id": file_id,
            "simulation": {
                api_feature: intensity
            }
        }
        response = await self.client.post("/s2s/v2.0/task/skin-simulation", json=payload)
        response.raise_for_status()
        res_json = response.json()
        return res_json.get("data", res_json).get("task_id")

    async def _poll_simulation_result(self, task_id: str, max_retries: int = 20, delay: int = 2) -> str:
        for _ in range(max_retries):
            response = await self.client.get(f"/s2s/v2.0/task/skin-simulation/{task_id}")
            response.raise_for_status()
            res_json = response.json()
            data = res_json.get("data", res_json)
            status = data.get("task_status")
            if status == "success":
                return data.get("result", {}).get("image_url", "")
            elif status == "error":
                raise Exception("YouCam Skin Simulation task failed.")
            await asyncio.sleep(delay)
        raise Exception("Timeout waiting for YouCam Skin Simulation result.")

youcam_service = YouCamService()
