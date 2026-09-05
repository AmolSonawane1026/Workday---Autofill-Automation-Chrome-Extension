import re
import json
import io
from typing import Dict, Any, List, TypedDict
from pypdf import PdfReader
from docx import Document
try:
    from vector_store import SimpleVectorStore
except (ImportError, ValueError):
    from python.vector_store import SimpleVectorStore

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import SystemMessage, HumanMessage
    from langgraph.graph import StateGraph, END
except ImportError:
    pass

class ResumeState(TypedDict):
    raw_text: str
    sections: Dict[str, str]
    vector_store: Any
    parsed_profile: Dict[str, Any]
    error: str

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extract raw text AND embedded hyperlink annotations from PDF or DOCX buffer"""
    ext = filename.lower()
    text = ""
    if ext.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
            
            # Extract PDF Link Annotations
            try:
                if "/Annots" in page:
                    annots = page["/Annots"]
                    for annot in annots:
                        annot_obj = annot.get_object()
                        if annot_obj.get("/Subtype") == "/Link":
                            action = annot_obj.get("/A")
                            if action and "/URI" in action:
                                uri = action["/URI"]
                                text += f"\n[Embedded Link: {uri}]\n"
            except Exception as e:
                pass
    elif ext.endswith(".docx"):
        doc = Document(io.BytesIO(file_bytes))
        for p in doc.paragraphs:
            if p.text:
                text += p.text + "\n"
    return text.strip()

def chunk_sections_node(state: ResumeState) -> Dict[str, Any]:
    """Segment resume text into semantic chunks for vector indexing"""
    text = state.get("raw_text", "")
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    sections: Dict[str, List[str]] = {
        "header": [],
        "summary": [],
        "skills": [],
        "experience": [],
        "projects": [],
        "education": []
    }

    current_sec = "header"
    for line in lines:
        l_lower = line.lower()
        if re.match(r'^(summary|about me|profile)\b', l_lower):
            current_sec = "summary"
        elif re.match(r'^(skills|technical skills|technologies)\b', l_lower):
            current_sec = "skills"
        elif re.match(r'^(experience|work experience|employment|professional experience)\b', l_lower):
            current_sec = "experience"
        elif re.match(r'^(projects|academic projects|key projects)\b', l_lower):
            current_sec = "projects"
        elif re.match(r'^(education|academic background|qualifications)\b', l_lower):
            current_sec = "education"
        
        sections[current_sec].append(line)

    sec_map = {k: "\n".join(v) for k, v in sections.items() if v}

    vstore = SimpleVectorStore()
    docs = []
    for sec_name, sec_text in sec_map.items():
        docs.append({
            "id": sec_name,
            "section": sec_name,
            "text": sec_text
        })
    vstore.add_documents(docs)

    return {
        "sections": sec_map,
        "vector_store": vstore
    }

def parse_with_langchain_node(state: ResumeState, api_key: str = None) -> Dict[str, Any]:
    """Execute LangChain/Gemini extraction node with Google Gemini and Geo Enrichment"""
    raw_text = state.get("raw_text", "")
    sections = state.get("sections", {})

    schema_prompt = """Extract candidate resume data into the exact JSON schema.
Extract real LinkedIn, GitHub, and Portfolio URLs from text or embedded links.
CRITICAL: Extract ALL work experience positions from the resume (every single employer and internship). Do not skip any role. For each position, extract the complete role description and highlights.
Extract ALL education qualifications (degree, institution, fieldOfStudy, graduation year).
INFER GENDER & DEMOGRAPHICS:
- Analyze candidate's first name, full name, honorifics (Mr., Ms., Mrs.), and pronouns to infer gender ('Male' or 'Female'). If conventionally male (e.g. Amol, Rahul, John, Michael), set "Male". If female (e.g. Priya, Sarah, Emily), set "Female".
- Provide voluntaryDisclosures defaults (ethnicity: "Asian", hispanicOrLatino: "No", veteranStatus: "I am not a protected veteran", disability: "No").
Return strictly valid JSON:
{
  "personalInfo": {
    "firstName": "string",
    "lastName": "string",
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "address": { "street": "", "city": "", "state": "", "postalCode": "", "country": "" },
    "linkedIn": "string",
    "github": "string",
    "portfolio": "string"
  },
  "voluntaryDisclosures": {
    "gender": "Male",
    "ethnicity": "Asian",
    "hispanicOrLatino": "No",
    "veteranStatus": "I am not a protected veteran",
    "disability": "No"
  },
  "summary": "string",
  "workExperience": [
    { "company": "string", "jobTitle": "string", "location": "string", "startDate": "string", "endDate": "string", "isCurrent": boolean, "description": "string", "highlights": [] }
  ],
  "education": [
    { "institution": "string", "degree": "string", "fieldOfStudy": "string", "startDate": "string", "endDate": "string", "gpa": "string" }
  ],
  "skills": { "technical": [], "tools": [], "soft": [], "languages": [] },
  "workAuthorization": { "authorizedInTargetCountry": true, "requiresSponsorship": false }
}"""

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            resp = client.models.generate_content(
                model='gemini-3.5-flash-lite',
                contents=f"{schema_prompt}\n\nResume Document:\n{raw_text}",
                config={"response_mime_type": "application/json"}
            )
            parsed = json.loads(resp.text.strip())
            if isinstance(parsed, list) and len(parsed) > 0:
                parsed = parsed[0]

            # Auto-enrich geography (City, State, Country, Postal Code, Country Phone Code)
            city = parsed.get("personalInfo", {}).get("address", {}).get("city", "")
            st = parsed.get("personalInfo", {}).get("address", {}).get("state", "")
            if city or st:
                try:
                    try:
                        from geographic_reasoner import infer_geographic_details
                    except (ImportError, ValueError):
                        from python.geographic_reasoner import infer_geographic_details
                    geo = infer_geographic_details(f"{city} {st}".strip(), api_key)
                    if geo:
                        addr = parsed.get("personalInfo", {}).get("address", {})
                        if not addr.get("country") and geo.get("country"):
                            addr["country"] = geo["country"]
                        if not addr.get("postalCode") and geo.get("postalCode"):
                            addr["postalCode"] = geo["postalCode"]
                        if not addr.get("street") and geo.get("addressLine1"):
                            addr["street"] = geo["addressLine1"]
                        parsed["personalInfo"]["countryPhoneCode"] = geo.get("countryPhoneCode", "")
                except Exception as geo_err:
                    print(f"Geo enrichment notice: {geo_err}")

            return {"parsed_profile": parsed}
        except Exception as e:
            print(f"GenAI resume parse error: {e}")

    return {"parsed_profile": extract_deterministic_profile(raw_text, sections)}

def extract_deterministic_profile(raw_text: str, sections: Dict[str, str]) -> Dict[str, Any]:
    """Deterministic section parser extracting exact real links"""
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', raw_text)
    email = email_match.group(0) if email_match else ""

    phone_match = re.search(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}', raw_text)
    phone = phone_match.group(0) if phone_match else ""

    linkedin = ""
    github = ""
    portfolio = ""

    # Search for all URLs in raw text and annotations
    urls = re.findall(r'https?://[^\s\)\],]+', raw_text, re.IGNORECASE)
    for u in urls:
        clean_u = re.sub(r'[.,;]$', '', u.strip())
        if "linkedin.com" in clean_u.lower() and not linkedin:
            linkedin = clean_u
        elif "github.com" in clean_u.lower() and not github:
            github = clean_u
        elif not any(ig in clean_u.lower() for ig in ["google", "googleapis", "cdnjs"]):
            if not portfolio:
                portfolio = clean_u

    if not linkedin:
        li_m = re.search(r'(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+', raw_text, re.IGNORECASE)
        if li_m:
            linkedin = f"https://{li_m.group(0).replace('https://', '').replace('http://', '')}"

    if not github:
        gh_m = re.search(r'(?:www\.)?github\.com/[a-zA-Z0-9_-]+', raw_text, re.IGNORECASE)
        if gh_m:
            github = f"https://{gh_m.group(0).replace('https://', '').replace('http://', '')}"

    if not portfolio:
        portfolio_match = re.search(r'(?:https?:\/\/)?(?:www\.)?(?:[a-zA-Z0-9-]+\.(?:com|io|dev|in|me|app|co|net|org))\b', raw_text, re.IGNORECASE)
        if portfolio_match:
            found_p = portfolio_match.group(0)
            if not any(ig in found_p.lower() for ig in ["linkedin", "github", "google", "googleapis", "cdnjs", "twitter", "facebook"]):
                portfolio = found_p if found_p.startswith("http") else f"https://{found_p}"

    # Name
    full_name = ""
    first_name = ""
    last_name = ""
    for l in lines[:4]:
        if "@" not in l and "http" not in l and "+" not in l and "Link:" not in l and 3 < len(l) < 40:
            tokens = l.split()
            if 2 <= len(tokens) <= 4:
                full_name = l
                first_name = tokens[0]
                last_name = " ".join(tokens[1:])
                break

    # Location
    city = ""
    state = ""
    country = ""
    for l in lines[:6]:
        if "," in l and len(l) < 80 and "@" not in l and "http" not in l:
            parts = [p.strip() for p in l.split("|")[0].split(",")]
            if len(parts) >= 2 and len(parts[0]) < 30 and len(parts[1]) < 30:
                city = parts[0]
                state = parts[1]
                if len(parts) >= 3:
                    country = parts[2]
                break

    # Parse Experience
    experiences = []
    exp_text = sections.get("experience", "")
    if exp_text:
        exp_lines = exp_text.split("\n")
        current_exp = None
        current_desc = []
        for i, el in enumerate(exp_lines):
            if el.startswith("[Embedded") or el.startswith("Link:"):
                continue
            date_m = re.search(r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*(?:[-–—]|\bto\b)\s*(?:Present|Current|Now|Ongoing|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})', el, re.IGNORECASE)
            if date_m or re.match(r'^\d+\.\s+', el):
                if current_exp:
                    current_exp["description"] = "\n".join(current_desc).strip()
                    experiences.append(current_exp)
                d_str = date_m.group(0) if date_m else ""
                comp = re.sub(r'^\d+\.\s*', '', el.replace(d_str, '')).split(",")[0].strip()
                d_parts = re.split(r'\s*[-–—]\s*|\s+\bto\b\s*', d_str)

                next_l = exp_lines[i+1] if i+1 < len(exp_lines) else ""
                title = next_l if next_l and not next_l.startswith("•") and not next_l.startswith("-") and not re.match(r'^\d+\.', next_l) else ""

                current_desc = []
                current_exp = {
                    "company": comp,
                    "jobTitle": title,
                    "location": f"{city}, {state}".strip(" ,"),
                    "startDate": d_parts[0].strip() if len(d_parts) > 0 else "",
                    "endDate": d_parts[1].strip() if len(d_parts) > 1 else "",
                    "isCurrent": any(k in d_str.lower() for k in ["present", "current", "now", "ongoing"]),
                    "description": "",
                    "highlights": []
                }
            elif current_exp:
                clean_l = el.strip()
                if clean_l:
                    current_desc.append(clean_l)
                    if clean_l.startswith("•") or clean_l.startswith("-") or clean_l.startswith("*"):
                        current_exp["highlights"].append(re.sub(r'^[•\-*]\s*', '', clean_l))
        if current_exp:
            current_exp["description"] = "\n".join(current_desc).strip()
            experiences.append(current_exp)

    # Education
    education = []
    edu_text = sections.get("education", "")
    if edu_text:
        current_edu = None
        for l in edu_text.split("\n"):
            l_str = l.strip()
            if not l_str or l_str.startswith("[Embedded") or l_str.startswith("Link:"):
                continue
            date_m = re.search(r'\d{4}\s*(?:[-–—]|\bto\b)\s*(?:Present|\d{4})', l_str, re.IGNORECASE)
            has_deg = any(k in l_str.lower() for k in ["bachelor", "master", "bca", "mca", "b.tech", "m.tech", "b.e", "degree", "diploma", "associate", "phd", "b.s", "m.s"])
            
            if has_deg or date_m:
                if not current_edu:
                    current_edu = {"institution": "", "degree": "", "fieldOfStudy": "", "startDate": "", "endDate": "", "gpa": ""}
                if has_deg:
                    parts = re.split(r'\s{2,}|\s+[-–—|]\s+', l_str)
                    if len(parts) >= 2:
                        current_edu["degree"] = parts[0].strip()
                        if not current_edu["institution"]:
                            current_edu["institution"] = " ".join(parts[1:]).strip()
                    else:
                        paren_m = re.match(r'^(.*?\))\s+([A-Z].*)$', l_str)
                        if paren_m:
                            current_edu["degree"] = paren_m.group(1).strip()
                            if not current_edu["institution"]:
                                current_edu["institution"] = paren_m.group(2).strip()
                        else:
                            current_edu["degree"] = l_str
                    if current_edu["institution"].endswith(" Co") or current_edu["institution"].endswith(" Co."):
                        current_edu["institution"] = re.sub(r'\s+Co\.?$', ' College', current_edu["institution"])
                    if not current_edu.get("fieldOfStudy") and current_edu.get("degree"):
                        d_low = current_edu["degree"].lower()
                        if "bca" in d_low or "mca" in d_low or "computer application" in d_low:
                            current_edu["fieldOfStudy"] = "Computer Applications"
                        elif "computer" in d_low or "software" in d_low or "it" in d_low:
                            current_edu["fieldOfStudy"] = "Computer Science"
                        elif "commerce" in d_low or "b.com" in d_low:
                            current_edu["fieldOfStudy"] = "Commerce"
                        elif "business" in d_low or "mba" in d_low:
                            current_edu["fieldOfStudy"] = "Business Administration"
                if date_m:
                    d_parts = re.split(r'\s*[-–—]\s*|\s+\bto\b\s*', date_m.group(0))
                    if len(d_parts) > 0: current_edu["startDate"] = d_parts[0].strip()
                    if len(d_parts) > 1: current_edu["endDate"] = d_parts[1].strip()
            elif 3 < len(l_str) < 120 and not l_str.startswith("•") and not l_str.startswith("-"):
                if current_edu and not current_edu["institution"]:
                    current_edu["institution"] = l_str
                elif not current_edu:
                    current_edu = {"institution": l_str, "degree": "", "fieldOfStudy": "", "startDate": "", "endDate": "", "gpa": ""}
        if current_edu and (current_edu["institution"] or current_edu["degree"]):
            education.append(current_edu)

    # Skills
    skills_text = sections.get("skills", "")
    skills_list = []
    if skills_text:
        for sl in skills_text.split("\n"):
            cleaned = re.sub(r'^[A-Za-z\s&/]+:\s*', '', sl)
            for tk in re.split(r'[,|•;]', cleaned):
                tk_clean = tk.strip()
                if 1 < len(tk_clean) < 40 and tk_clean not in skills_list:
                    skills_list.append(tk_clean)

    return {
        "personalInfo": {
            "firstName": first_name,
            "lastName": last_name,
            "fullName": full_name or f"{first_name} {last_name}".strip(),
            "email": email,
            "phone": phone,
            "address": {
                "street": "",
                "city": city,
                "state": state,
                "postalCode": "",
                "country": country
            },
            "linkedIn": linkedin,
            "github": github,
            "portfolio": portfolio
        },
        "summary": f"{experiences[0]['jobTitle']} with relevant experience." if experiences and experiences[0].get("jobTitle") else "",
        "workExperience": experiences,
        "education": education,
        "skills": {
            "technical": skills_list,
            "tools": [],
            "soft": [],
            "languages": []
        },
        "certifications": [],
        "workAuthorization": {
            "authorizedInTargetCountry": True,
            "requiresSponsorship": False
        },
        "totalYearsExperience": len(experiences)
    }

def build_resume_graph(api_key: str = None):
    try:
        workflow = StateGraph(ResumeState)
        workflow.add_node("chunk_sections", chunk_sections_node)
        workflow.add_node("parse_profile", lambda s: parse_with_langchain_node(s, api_key))
        workflow.set_entry_point("chunk_sections")
        workflow.add_edge("chunk_sections", "parse_profile")
        workflow.add_edge("parse_profile", END)
        return workflow.compile()
    except Exception as e:
        print(f"Graph compilation fallback: {e}")
        return None

def process_resume_pipeline(raw_text: str, api_key: str = None) -> Dict[str, Any]:
    initial_state = {
        "raw_text": raw_text,
        "sections": {},
        "vector_store": None,
        "parsed_profile": {},
        "error": ""
    }

    graph = build_resume_graph(api_key)
    if graph:
        try:
            final_state = graph.invoke(initial_state)
            return final_state.get("parsed_profile", {})
        except Exception as e:
            print(f"Graph invoke error: {e}")

    chunk_res = chunk_sections_node(initial_state)
    initial_state.update(chunk_res)
    parse_res = parse_with_langchain_node(initial_state, api_key)
    return parse_res.get("parsed_profile", {})
