"""
Smart Geographic & Entity Reasoner using:
- ChromaDB Vector Store (for fast semantic geographic retrieval & persistent memory)
- LangChain / LangGraph StateGraph (for retrieval -> LLM reasoning -> vector indexing pipeline)
- Google Gemini LLM (gemini-3.5-flash-lite) for real-world geographic intelligence

100% dynamic: NO hardcoded personal or location dictionaries.
Learns and caches geographic entities into ChromaDB automatically.
"""

import os
import json
import re
import logging
from typing import Dict, Any, Optional, TypedDict
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from google import genai

load_dotenv()
logger = logging.getLogger("geographic_reasoner")
logging.basicConfig(level=logging.INFO)

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_geo")
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

# Initialize ChromaDB Client
try:
    import chromadb
    chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    geo_collection = chroma_client.get_or_create_collection(
        name="world_geography",
        metadata={"description": "Global geographic reasoner vector database"}
    )
    CHROMA_AVAILABLE = True
except Exception as e:
    logger.warning(f"ChromaDB initialization note: {e}")
    CHROMA_AVAILABLE = False
    geo_collection = None


class GeoState(TypedDict):
    query: str
    api_key: Optional[str]
    vector_match: Optional[Dict[str, Any]]
    llm_reasoning: Optional[Dict[str, Any]]
    final_result: Dict[str, Any]


def vector_search_node(state: GeoState) -> Dict[str, Any]:
    """Node 1: Search ChromaDB vector store for existing learned geographic knowledge."""
    query = state.get("query", "").strip()
    if not query or not CHROMA_AVAILABLE or not geo_collection:
        return {"vector_match": None}

    try:
        results = geo_collection.query(
            query_texts=[query],
            n_results=1
        )
        
        if results and results.get("documents") and len(results["documents"][0]) > 0:
            distance = results["distances"][0][0] if results.get("distances") else 0.0
            metadata = results["metadatas"][0][0] if results.get("metadatas") else {}
            
            # Require high similarity and non-empty country/state to be a valid vector hit
            if distance < 0.35 and metadata.get("country") and (metadata.get("state") or metadata.get("countryPhoneCode")):
                logger.info(f"📍 Vector DB hit for '{query}': {metadata.get('city')}, {metadata.get('state')}, {metadata.get('country')}")
                return {"vector_match": metadata}
    except Exception as err:
        logger.debug(f"Vector search note: {err}")

    return {"vector_match": None}


def llm_reasoning_node(state: GeoState) -> Dict[str, Any]:
    """Node 2: Use Google Gemini LLM to reason geographic context if not cached in Vector DB."""
    # If vector store already has a high-confidence match, skip LLM call
    if state.get("vector_match"):
        return {"llm_reasoning": state["vector_match"]}

    query = state.get("query", "").strip()
    if not query:
        return {"llm_reasoning": {}}

    api_key = state.get("api_key") or os.environ.get("GEMINI_API_KEY")

    reasoned = {}
    if api_key:
        prompt = f"""You are an expert global geographic entity resolver.
Given the location query: "{query}"

Determine the complete, accurate real-world geographic details:
- city: Standard name of the city/town/municipality (or "" if only a country/state was provided).
- state: State, province, prefecture, region, or administrative division.
- country: Official standard country name in English (e.g. India, United States of America, United Kingdom, Germany, Japan, Canada, Australia).
- countryPhoneCode: Standard Workday phone code format with country name and dial code, e.g.: "India (+91)", "United States (+1)", "United Kingdom (+44)", "Germany (+49)", "Japan (+81)".
- dialCode: International dial code starting with +, e.g.: "+91", "+1", "+44", "+81".
- postalCode: Standard representative postal code / zip code for this specific city or region.
- addressLine1: Standard "City, State" or just "City" if state is not applicable.

Return ONLY a valid JSON object matching this schema:
{{
  "city": "string",
  "state": "string",
  "country": "string",
  "countryPhoneCode": "string",
  "dialCode": "string",
  "postalCode": "string",
  "addressLine1": "string"
}}"""

        for model_name in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]:
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                text = response.text.strip()
                # Parse JSON, cleaning any markdown fences if present
                clean_json = re.sub(r"^```json\s*", "", text, flags=re.MULTILINE)
                clean_json = re.sub(r"^```\s*$", "", clean_json, flags=re.MULTILINE).strip()
                reasoned = json.loads(clean_json)
                logger.info(f"🧠 LLM Geographic Reasoning ({model_name}) for '{query}': {reasoned.get('city')}, {reasoned.get('state')}, {reasoned.get('country')}")
                break
            except Exception as e:
                logger.debug(f"LLM Reasoning with {model_name} note: {e}")
                continue

    # Heuristic fallback if LLM is unavailable or unkeyed
    if not reasoned or not reasoned.get("country"):
        tokens = [t.strip() for t in query.split(",") if t.strip()]
        if len(tokens) >= 2:
            reasoned = {
                "city": tokens[0],
                "state": tokens[1],
                "country": tokens[2] if len(tokens) >= 3 else "",
                "countryPhoneCode": "",
                "dialCode": "",
                "postalCode": "",
                "addressLine1": f"{tokens[0]}, {tokens[1]}"
            }
        elif len(tokens) == 1:
            reasoned = {
                "city": tokens[0],
                "state": "",
                "country": "",
                "countryPhoneCode": "",
                "dialCode": "",
                "postalCode": "",
                "addressLine1": tokens[0]
            }

    return {"llm_reasoning": reasoned}


def index_vector_node(state: GeoState) -> Dict[str, Any]:
    """Node 3: Index newly reasoned locations into ChromaDB Vector Store for instant future recall."""
    reasoned = state.get("llm_reasoning") or {}
    query = state.get("query", "").strip()

    # If this was already a vector match or missing country info, skip indexing
    if state.get("vector_match") or not reasoned.get("country") or not CHROMA_AVAILABLE or not geo_collection:
        return {"final_result": reasoned}

    try:
        doc_id = f"geo_{query.lower().replace(' ', '_').replace(',', '_')}"
        doc_content = f"{reasoned.get('city', '')} {reasoned.get('state', '')} {reasoned.get('country', '')} {query}".strip()
        
        clean_metadata = {
            "city": str(reasoned.get("city", "")),
            "state": str(reasoned.get("state", "")),
            "country": str(reasoned.get("country", "")),
            "countryPhoneCode": str(reasoned.get("countryPhoneCode", "")),
            "dialCode": str(reasoned.get("dialCode", "")),
            "postalCode": str(reasoned.get("postalCode", "")),
            "addressLine1": str(reasoned.get("addressLine1", ""))
        }

        geo_collection.upsert(
            ids=[doc_id],
            documents=[doc_content],
            metadatas=[clean_metadata]
        )
        logger.info(f"💾 Indexed '{query}' into ChromaDB Vector Store")
    except Exception as err:
        logger.debug(f"Vector indexing notice: {err}")

    return {"final_result": reasoned}


def build_geographic_graph():
    """Builds and compiles the LangGraph state machine for geographic reasoning."""
    workflow = StateGraph(GeoState)
    
    workflow.add_node("vector_search", vector_search_node)
    workflow.add_node("llm_reasoning", llm_reasoning_node)
    workflow.add_node("index_vector", index_vector_node)
    
    workflow.set_entry_point("vector_search")
    workflow.add_edge("vector_search", "llm_reasoning")
    workflow.add_edge("llm_reasoning", "index_vector")
    workflow.add_edge("index_vector", END)
    
    return workflow.compile()


# Global compiled LangGraph workflow instance
geo_graph = build_geographic_graph()


def infer_geographic_details(location_str: str, api_key: Optional[str] = None) -> Dict[str, str]:
    """
    Public entry point: executes LangGraph workflow (Vector Search -> Gemini LLM -> Chroma Indexing).
    Fully dynamic: works for ANY location globally.
    """
    if not location_str or not location_str.strip():
        return {}

    try:
        initial_state: GeoState = {
            "query": location_str.strip(),
            "api_key": api_key,
            "vector_match": None,
            "llm_reasoning": None,
            "final_result": {}
        }
        
        final_state = geo_graph.invoke(initial_state)
        return final_state.get("final_result", {})
    except Exception as e:
        logger.error(f"Geographic graph execution error: {e}")
        return {}


if __name__ == "__main__":
    test_queries = ["Pune", "San Jose", "Tokyo", "Berlin", "Bengaluru"]
    print("Testing Smart Vector + LangGraph + LLM Geographic Reasoner:")
    for q in test_queries:
        res = infer_geographic_details(q)
        print(f"[{q}] -> City: {res.get('city')}, State: {res.get('state')}, Country: {res.get('country')}, Phone Code: {res.get('countryPhoneCode')}")
