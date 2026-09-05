import re
import math
from typing import List, Dict, Any

class SimpleVectorStore:
    """
    Lightweight, high-performance in-memory Vector Database
    for embedding and semantic similarity search over resume sections.
    """
    def __init__(self):
        self.documents: List[Dict[str, Any]] = []
        self.vocabulary: Dict[str, int] = {}

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\b[a-zA-Z0-9_+#.-]{2,}\b', text.lower())

    def add_documents(self, docs: List[Dict[str, str]]):
        """
        Add documents with text and metadata into vector store
        """
        for doc in docs:
            tokens = self._tokenize(doc.get("text", ""))
            tf: Dict[str, float] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0.0) + 1.0
            
            # Normalize TF
            total = len(tokens) or 1
            tf = {k: v / total for k, v in tf.items()}

            self.documents.append({
                "id": doc.get("id", str(len(self.documents))),
                "text": doc.get("text", ""),
                "section": doc.get("section", "general"),
                "tf": tf,
                "metadata": doc.get("metadata", {})
            })

    def search(self, query: str, top_k: int = 3, section_filter: str = None) -> List[Dict[str, Any]]:
        """
        Search documents by cosine similarity against query vector
        """
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return self.documents[:top_k]

        q_tf: Dict[str, float] = {}
        for t in query_tokens:
            q_tf[t] = q_tf.get(t, 0.0) + 1.0
        q_len = len(query_tokens) or 1
        q_tf = {k: v / q_len for k, v in q_tf.items()}

        scored = []
        for doc in self.documents:
            if section_filter and doc.get("section") != section_filter:
                continue

            # Dot product
            score = 0.0
            doc_tf = doc["tf"]
            for token, q_val in q_tf.items():
                if token in doc_tf:
                    score += q_val * doc_tf[token]

            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]
