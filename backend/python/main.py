import os
import sys

# Ensure local python directory is in sys.path regardless of working directory
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from resume_graph import extract_text_from_bytes, process_resume_pipeline
from vector_store import SimpleVectorStore

app = FastAPI(
    title="Workday AI Automation Backend (LangGraph & Vector DB)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory vector store instance for application session
vector_store = SimpleVectorStore()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "engine": "Python LangGraph + Vector DB + Google Gemini",
        "version": "1.0.0"
    }

@app.post("/api/resume/parse")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    x_gemini_key: Optional[str] = Header(None)
):
    try:
        content = await file.read()
        raw_text = extract_text_from_bytes(content, file.filename)
        
        if not raw_text or len(raw_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Could not extract readable text from document.")

        key = api_key or x_gemini_key or os.getenv("GEMINI_API_KEY", "")
        profile = process_resume_pipeline(raw_text, key)

        return {
            "success": True,
            "filename": file.filename,
            "profile": profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ParseTextRequest(BaseModel):
    text: str
    api_key: Optional[str] = None

@app.post("/api/resume/parse-text")
def parse_resume_text_endpoint(req: ParseTextRequest):
    key = req.api_key or os.getenv("GEMINI_API_KEY", "")
    profile = process_resume_pipeline(req.text, key)
    return {
        "success": True,
        "profile": profile
    }

class VectorQueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3
    section: Optional[str] = None

@app.post("/api/ai/vector-query")
def query_vector_store(req: VectorQueryRequest):
    results = vector_store.search(req.query, top_k=req.top_k, section_filter=req.section)
    return {
        "success": True,
        "query": req.query,
        "matches": results
    }

class GeoReasoningRequest(BaseModel):
    location: str
    api_key: Optional[str] = None

@app.post("/api/ai/infer-location")
def infer_location_endpoint(req: GeoReasoningRequest):
    from geographic_reasoner import infer_geographic_details
    key = req.api_key or os.getenv("GEMINI_API_KEY", "")
    geo_data = infer_geographic_details(req.location, key)
    return {
        "success": True,
        "location": req.location,
        "data": geo_data
    }

class MapFieldsRequest(BaseModel):
    formFields: List[Dict[str, Any]]
    resumeData: Dict[str, Any]

@app.post("/api/ai/map-fields")
def map_fields_endpoint(req: MapFieldsRequest):
    p = req.resumeData.get("personalInfo", {})
    addr = p.get("address", {})
    exps = req.resumeData.get("workExperience", [])
    edus = req.resumeData.get("education", [])
    skills = req.resumeData.get("skills", {}).get("technical", [])
    work_auth = req.resumeData.get("workAuthorization", {})

    mappings = []
    for field in req.formFields:
        label = (field.get("label") or "").lower()
        auto_id = (field.get("automationId") or "").lower()
        sig = f"{label} {auto_id}"

        val = ""
        conf = 0.0
        reason = ""

        if "authorized to work" in sig or "legal authorization" in sig or "workauth" in sig or "legally authorized" in sig:
            val = "Yes" if work_auth.get("authorizedInTargetCountry") is not False else "No"
            conf = 0.95
            reason = "Legal work authorization"
        elif "sponsorship" in sig or "visa" in sig:
            val = "Yes" if work_auth.get("requiresSponsorship") is True else "No"
            conf = 0.95
            reason = "Visa sponsorship status"
        elif "first name" in sig or "given name" in sig or "firstname" in auto_id:
            val = p.get("firstName", "")
            conf = 0.99 if val else 0.0
            reason = "First name from resume"
        elif "last name" in sig or "family name" in sig or "lastname" in auto_id:
            val = p.get("lastName", "")
            conf = 0.99 if val else 0.0
            reason = "Last name from resume"
        elif "full name" in sig or "fullname" in auto_id:
            val = p.get("fullName") or f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
            conf = 0.98 if val else 0.0
            reason = "Full name from resume"
        elif "email" in sig or field.get("type") == "email":
            val = p.get("email", "")
            conf = 0.99 if val else 0.0
            reason = "Email from resume"
        elif "phone" in sig or "mobile" in sig or field.get("type") == "tel":
            val = p.get("phone", "")
            conf = 0.98 if val else 0.0
            reason = "Phone number from resume"
        elif "device type" in sig or "phone-device-type" in auto_id:
            val = "Mobile"
            conf = 0.95
            reason = "Phone device type"
        elif "address line 1" in sig or "street" in sig:
            val = addr.get("street") or (f"{addr.get('city', '')}, {addr.get('state', '')}".strip(" ,"))
            conf = 0.95 if val else 0.0
            reason = "Street address from resume"
        elif "city" in sig:
            val = addr.get("city", "")
            conf = 0.95 if val else 0.0
            reason = "City from resume"
        elif "state" in sig or "province" in sig or "countryregion" in auto_id:
            val = addr.get("state", "")
            conf = 0.92 if val else 0.0
            reason = "State / Region from resume"
        elif "postal" in sig or "zip" in sig:
            val = addr.get("postalCode", "")
            conf = 0.95 if val else 0.0
            reason = "Postal code from resume"
        elif "country" in sig:
            val = addr.get("country", "")
            conf = 0.92 if val else 0.0
            reason = "Country from resume"
        elif "linkedin" in sig:
            val = p.get("linkedIn", "")
            conf = 0.98 if val else 0.0
            reason = "LinkedIn profile from resume"
        elif "github" in sig:
            val = p.get("github", "")
            conf = 0.98 if val else 0.0
            reason = "GitHub profile from resume"
        elif ("job title" in sig or "title" in sig) and exps:
            val = exps[0].get("jobTitle", "")
            conf = 0.90 if val else 0.0
            reason = "Recent job title from resume"
        elif ("company" in sig or "employer" in sig) and exps:
            val = exps[0].get("company", "")
            conf = 0.90 if val else 0.0
            reason = "Recent company from resume"
        elif ("school" in sig or "university" in sig or "institution" in sig) and edus:
            val = edus[0].get("institution", "")
            conf = 0.92 if val else 0.0
            reason = "Educational institution from resume"
        elif "degree" in sig and edus:
            val = edus[0].get("degree", "")
            conf = 0.90 if val else 0.0
            reason = "Degree from resume"
        elif "gender" in sig or "race" in sig or "ethnicity" in sig:
            val = "I choose not to self-identify"
            conf = 0.90
            reason = "Voluntary self-identification"
        elif "veteran" in sig:
            val = "I am not a protected veteran"
            conf = 0.90
            reason = "Veteran status"
        elif "disability" in sig:
            val = "I do not wish to answer"
            conf = 0.90
            reason = "Disability disclosure"

        mappings.append({
            "id": field.get("id"),
            "label": field.get("label"),
            "type": field.get("type"),
            "automationId": field.get("automationId"),
            "value": val,
            "confidence": conf,
            "reasoning": reason,
            "source": "vector_heuristic" if conf > 0 else "none"
        })

    return {"success": True, "data": {"mappings": mappings}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
