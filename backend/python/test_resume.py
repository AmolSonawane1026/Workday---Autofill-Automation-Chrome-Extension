from resume_graph import process_resume_pipeline

sample_resume_text = """
Alex Rivers
Senior Platform Engineer
San Francisco, CA, USA | alex.rivers@example.com | +1 (408) 555-0142
Portfolio Link | LinkedIn | GitHub

Summary
Senior Platform Engineer with 5+ years of experience in distributed systems, Python, Node.js, and cloud architectures.

Skills
Backend & Databases: Node.js, Express.js, MongoDB, SQL, PostgreSQL, REST APIs, Redis, Microservices, Python (FastAPI, Flask), Vector DBs
Frontend: React.js (v18), Next.js (v14), Redux Toolkit, Tailwind CSS, HTML5, CSS3, JavaScript (ES6+)
AI & Development Tools: LangChain, LangGraph, Docker, Kubernetes, Git

Experience
1. Acme Cloud Technologies, San Francisco       Jan 2022 – Present
Lead Systems Engineer
• Built distributed microservices handling 20k RPS with zero downtime.
• Integrated LLM pipelines using LangChain and vector retrieval databases.

Education
Master of Science in Computer Science     Stanford University, California
"""

parsed = process_resume_pipeline(sample_resume_text)
print("=== PARSED RESULT ===")
import json
print(json.dumps(parsed, indent=2))
