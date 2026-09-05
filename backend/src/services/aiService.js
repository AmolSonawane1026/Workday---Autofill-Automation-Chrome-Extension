import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { spawn } from 'child_process';
import path from 'path';

function getGeminiModel(apiKey, modelName = 'gemini-1.5-flash', jsonOutput = true) {
  const key = apiKey || config.geminiApiKey;
  if (!key) {
    throw new Error('Google Gemini API key is missing. Please provide your key in settings.');
  }

  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: jsonOutput ? { responseMimeType: 'application/json', temperature: 0.1 } : { temperature: 0.1 }
  });
}

/**
 * Executes Python LangChain + LangGraph StateGraph pipeline via FastAPI or child process
 */
export async function parseWithPythonLangGraph(resumeText, apiKey) {
  const key = apiKey || config.geminiApiKey || '';

  // 1. First attempt via fast HTTP bridge to running Python server on port 8000
  try {
    const res = await fetch('http://127.0.0.1:8000/api/resume/parse-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: resumeText, api_key: key })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.profile && data.profile.personalInfo) {
        return data.profile;
      }
    }
  } catch (httpErr) {
    console.debug('FastAPI parse-text unavailable, falling back to CLI bridge:', httpErr.message);
  }

  // 2. Child process fallback
  return new Promise((resolve, reject) => {
    try {
      const pyPath = path.resolve('python');
      const py = spawn('python', ['-c', `
import sys, json, os
from resume_graph import process_resume_pipeline
text = sys.stdin.read()
key = os.environ.get('RESUME_GEMINI_KEY', '')
res = process_resume_pipeline(text, key)
print(json.dumps(res))
      `], {
        cwd: pyPath,
        env: { ...process.env, RESUME_GEMINI_KEY: key }
      });

      let stdout = '';
      let stderr = '';

      py.stdout.on('data', (d) => { stdout += d; });
      py.stderr.on('data', (d) => { stderr += d; });

      py.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed && parsed.personalInfo) {
              return resolve(parsed);
            }
          } catch (e) {
            console.debug('Python stdout parse warning, falling back to JS SDK');
          }
        }
        reject(new Error(stderr || `Python exit code ${code}`));
      });

      py.stdin.write(resumeText);
      py.stdin.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function parseResumeWithAI(resumeText, apiKey, model = 'gemini-1.5-flash') {
  if (!resumeText?.trim()) {
    throw new Error('Resume text is empty');
  }

  // 1. First attempt with Python LangGraph & Vector DB Engine
  try {
    const pythonResult = await parseWithPythonLangGraph(resumeText, apiKey);
    if (pythonResult && pythonResult.personalInfo) {
      return pythonResult;
    }
  } catch (pyErr) {
    console.debug('Python LangGraph bridge info:', pyErr.message);
  }

  // 2. Direct Gemini Generative AI SDK fallback
  const generativeModel = getGeminiModel(apiKey, model, true);

  const prompt = `You are a world-class AI Resume Understanding and Information Extraction Engine powered by Google Gemini.
Your task is to analyze the provided resume text—regardless of its layout, structure, formatting, or length—and extract rich, structured candidate intelligence into strictly valid JSON matching the schema.

INTELLIGENCE & EXTRACTION DIRECTIVES:
1. RESUME LAYOUT ADAPTABILITY:
   - Resumes may be single-column, two-column, table-based, or ATS-formatted. Text extracted from PDFs may have headers, sidebars, or contact details interspersed. Intelligently reconstruct the natural reading order and flow.
   - If contact details, skills, or links are in sidebars or headers/footers, accurately associate them with the candidate.

2. WORK EXPERIENCE & BULLET POINTS UNDERSTANDING:
   - Extract EVERY work experience, employment, internship, and professional engagement. Never omit any role.
   - "company": Official name of company or organization.
   - "jobTitle": Exact title/designation (e.g., "Senior Software Engineer", "Full Stack Intern", "Product Analyst").
   - "location": City, state/province, and country if mentioned.
   - "startDate" & "endDate": Month and 4-digit year (e.g. "Nov 2023", "04/2022", "May 2021", or "Present" / "Current").
   - "isCurrent": true if currently employed there or endDate is "Present"/"Current", false otherwise.
   - "highlights": Extract EVERY bullet point, responsibility, or achievement into an array of clean strings. Strip bullet markers like •, -, *, ▪, ➢, or numbers. Retain all technical keywords, metrics, percentages, dollar amounts, and accomplishments.
   - "description": Synthesize a comprehensive summary combining the main role responsibilities, projects, and impact for this employer.

3. EDUCATION & WORKDAY TAXONOMY:
   - Extract ALL degrees, diplomas, and certifications.
   - "institution": University, college, or school name.
   - "degree": Degree title (e.g., "Bachelor of Technology", "Bachelor in Computer Applications", "Master of Science").
   - "fieldOfStudy": Academic major/discipline (e.g. "Computer Science", "Information Technology", "Business Administration", "Electrical Engineering", "Commerce").
   - "startDate": Starting year (e.g., "2020").
   - "endDate": Graduation year (e.g., "2024").
   - "gpa": GPA, percentage, or CGPA if present.

4. SKILLS CATEGORIZATION:
   - Deeply classify skills from across the entire resume:
     • "technical": Programming languages, frameworks, databases, architectures (e.g. React, Node.js, Python, SQL, REST APIs, Microservices).
     • "tools": Developer tools, DevOps, platforms (e.g. Git, Docker, Kubernetes, AWS, Postman, Vite, Linux, Puppeteer).
     • "soft": Interpersonal and professional abilities (e.g. Problem Solving, Team Leadership, Agile/Scrum).
     • "languages": Spoken languages if listed (e.g. English, Hindi, Spanish).

5. PERSONAL & WEB PRESENCE:
   - "firstName", "lastName", "fullName": Detect full legal name.
   - "email" & "phone": Detect primary email and complete phone number (including country code if present).
   - "address": Extract street, city, state, postal code, and country.
   - "linkedIn", "github", "portfolio": Extract canonical profile URLs.

6. GENDER & VOLUNTARY DISCLOSURE INTELLIGENCE:
   - Analyze the candidate's first name, full name, honorifics (Mr., Ms., Mrs.), and any pronoun references in the text to infer their gender ('Male' or 'Female'). If conventionally male (e.g. Amol, Rahul, John, Michael), set "Male". If female (e.g. Priya, Sarah, Emily), set "Female".
   - Set "ethnicity" (e.g. "Asian", "White", "Black or African American", "Hispanic or Latino", "Two or More Races"), "hispanicOrLatino" ("No" or "Yes"), "veteranStatus" ("I am not a protected veteran"), and "disability" ("No").

Resume Content:
--------------------
${resumeText}
--------------------

JSON Output Schema:
{
  "personalInfo": {
    "firstName": "string",
    "lastName": "string",
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "postalCode": "string",
      "country": "string"
    },
    "linkedIn": "string",
    "github": "string",
    "portfolio": "string",
    "websites": ["string"]
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
    {
      "company": "string",
      "jobTitle": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "isCurrent": boolean,
      "description": "string",
      "highlights": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "fieldOfStudy": "string",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string"
    }
  ],
  "skills": {
    "technical": ["string"],
    "tools": ["string"],
    "soft": ["string"],
    "languages": ["string"]
  },
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "year": "string"
    }
  ],
  "workAuthorization": {
    "authorizedInTargetCountry": true,
    "requiresSponsorship": false
  },
  "totalYearsExperience": number
}`;

  try {
    const result = await generativeModel.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    if (error.message?.includes('API_KEY_INVALID') || error.status === 400) {
      throw new Error('Invalid Google Gemini API Key. Please verify your key in Settings.');
    }
    throw new Error(`AI Parsing failed: ${error.message}`);
  }
}

export async function mapFieldsWithAI(formFields, resumeData, apiKey, model = 'gemini-1.5-flash') {
  if (!formFields?.length || !resumeData) return [];

  const heuristicResults = mapFieldsHeuristically(formFields, resumeData);
  const ambiguousFields = formFields.filter(f => !heuristicResults.find(h => h.id === f.id && h.confidence >= 0.85));

  if (!ambiguousFields.length) {
    return heuristicResults;
  }

  try {
    const generativeModel = getGeminiModel(apiKey, model, true);
    const prompt = `Match the form fields from a job application to the candidate profile.

Candidate Profile:
${JSON.stringify(resumeData, null, 2)}

Fields to Match:
${JSON.stringify(ambiguousFields.map(f => ({
  id: f.id,
  label: f.label,
  name: f.name,
  type: f.type,
  required: f.required,
  options: f.options || [],
  placeholder: f.placeholder,
  automationId: f.automationId
})), null, 2)}

Return JSON with format:
{
  "mappings": [
    {
      "id": "field id",
      "value": "string or boolean or option string",
      "confidence": number between 0.0 and 1.0,
      "reasoning": "short explanation"
    }
  ]
}`;

    const result = await generativeModel.generateContent(prompt);
    const aiResult = JSON.parse(result.response.text());
    const aiMappings = aiResult.mappings || [];

    return formFields.map(field => {
      const heuristic = heuristicResults.find(h => h.id === field.id);
      if (heuristic && heuristic.confidence >= 0.85) return heuristic;

      const aiMap = aiMappings.find(m => m.id === field.id);
      if (aiMap && aiMap.confidence > (heuristic?.confidence || 0)) {
        return {
          id: field.id,
          label: field.label,
          type: field.type,
          automationId: field.automationId,
          value: aiMap.value,
          confidence: aiMap.confidence,
          reasoning: aiMap.reasoning,
          source: 'ai'
        };
      }
      return heuristic || {
        id: field.id,
        label: field.label,
        type: field.type,
        automationId: field.automationId,
        value: '',
        confidence: 0,
        reasoning: 'No match found',
        source: 'none'
      };
    });
  } catch (error) {
    console.warn('Gemini field mapping fallback to heuristics:', error.message);
    return heuristicResults;
  }
}

export function mapFieldsHeuristically(formFields, resumeData) {
  const p = resumeData.personalInfo || {};
  const addr = p.address || {};
  const experiences = resumeData.workExperience || [];
  const education = resumeData.education || [];
  const workAuth = resumeData.workAuthorization || {};

  return formFields.map(field => {
    const rawLabel = (field.label || '').toLowerCase();
    const autoId = (field.automationId || '').toLowerCase();
    const name = (field.name || '').toLowerCase();
    const text = `${rawLabel} ${autoId} ${name}`;

    let value = '';
    let confidence = 0;
    let reasoning = '';

    if (text.includes('authorized to work') || text.includes('legal authorization') || autoId.includes('workauth') || text.includes('legally authorized')) {
      value = workAuth.authorizedInTargetCountry !== false ? 'Yes' : 'No';
      confidence = 0.95;
      reasoning = 'Legal work authorization';
    } else if (text.includes('sponsorship') || text.includes('visa sponsorship') || autoId.includes('sponsorship')) {
      value = workAuth.requiresSponsorship === true ? 'Yes' : 'No';
      confidence = 0.95;
      reasoning = 'Visa sponsorship status';
    } else if (text.includes('hispanic') || text.includes('latino') || autoId.includes('hispanicorlatino')) {
      value = 'No';
      confidence = 0.92;
      reasoning = 'Hispanic/Latino voluntary disclosure';
    } else if (autoId.includes('agreementcheckbox') || (field.type === 'checkbox' && (text.includes('agreement') || text.includes('acknowledge') || text.includes('certify')))) {
      value = true;
      confidence = 0.99;
      reasoning = 'Voluntary disclosure agreement checkbox';
    } else if (text.includes('previous worker') || text.includes('previously worked for') || autoId.includes('previousworker')) {
      value = 'No';
      confidence = 0.95;
      reasoning = 'Previous worker status';
    } else if (text.includes('suffix') || autoId.includes('social') || autoId.includes('suffix')) {
      value = p.suffix || '';
      confidence = value ? 0.90 : 0;
      reasoning = 'Name suffix';
    } else if (text.includes('how did you hear') || autoId.includes('hearaboutus') || autoId.includes('source')) {
      value = 'Naukri';
      confidence = 0.98;
      reasoning = 'Application referral source: Job Board -> Naukri';
    } else if (text.includes('previously worked') || text.includes('prior employee') || autoId.includes('previousemployee')) {
      value = 'No';
      confidence = 0.95;
      reasoning = 'Previous employment status';
    } else if (text.includes('first name') || text.includes('given name') || autoId.includes('firstname') || autoId.includes('legalnamesection_firstname')) {
      value = p.firstName || '';
      confidence = 0.99;
      reasoning = 'First name match';
    } else if (text.includes('last name') || text.includes('family name') || text.includes('surname') || autoId.includes('lastname') || autoId.includes('legalnamesection_lastname')) {
      value = p.lastName || '';
      confidence = 0.99;
      reasoning = 'Last name match';
    } else if (text.includes('full name') || autoId.includes('fullname')) {
      value = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
      confidence = 0.98;
      reasoning = 'Full name match';
    } else if (text.includes('email') || field.type === 'email' || autoId.includes('email')) {
      value = p.email || '';
      confidence = 0.99;
      reasoning = 'Email address match';
    } else if (autoId.includes('phone-device-type') || text.includes('device type') || text.includes('phone type')) {
      value = (field.options?.find(o => o.toLowerCase().includes('mobile'))) || 'Mobile';
      confidence = 0.95;
      reasoning = 'Phone type selection';
    } else if (text.includes('phone') || text.includes('mobile') || field.type === 'tel' || autoId.includes('phonenumber')) {
      value = p.phone || '';
      confidence = 0.98;
      reasoning = 'Phone number match';
    } else if (text.includes('address line 1') || text.includes('street') || autoId.includes('addressline1') || autoId.includes('addresssection_addressline1')) {
      value = addr.street || '';
      confidence = 0.95;
      reasoning = 'Street address match';
    } else if (text.includes('city') || autoId.includes('city') || autoId.includes('addresssection_city')) {
      value = addr.city || '';
      confidence = 0.95;
      reasoning = 'City match';
    } else if (autoId.includes('countryregion') || autoId.includes('addresssection_countryregion') || /\bstate\b/i.test(rawLabel) || /\bprovince\b/i.test(rawLabel)) {
      value = addr.state || '';
      confidence = 0.92;
      reasoning = 'State / Region match';
    } else if (text.includes('postal') || text.includes('zip') || autoId.includes('postalcode') || autoId.includes('addresssection_postalcode')) {
      value = addr.postalCode || '';
      confidence = 0.95;
      reasoning = 'Postal code match';
    } else if (autoId.includes('addresssection_country') || (/\bcountry\b/i.test(rawLabel) && !text.includes('countryregion'))) {
      value = addr.country || 'India';
      confidence = 0.92;
      reasoning = 'Country match';
    } else if (text.includes('linkedin') || autoId.includes('linkedin')) {
      value = p.linkedIn || '';
      confidence = 0.98;
      reasoning = 'LinkedIn URL match';
    } else if (text.includes('github') || autoId.includes('github')) {
      value = p.github || '';
      confidence = 0.98;
      reasoning = 'GitHub URL match';
    } else if (text.includes('website') || text.includes('portfolio') || autoId.includes('portfolio') || autoId.includes('website')) {
      value = p.portfolio || (p.websites && p.websites[0]) || '';
      confidence = 0.95;
      reasoning = 'Portfolio website match';
    } else if ((text.includes('job title') || text.includes('title') || autoId.includes('jobtitle')) && experiences.length) {
      value = experiences[0].jobTitle || '';
      confidence = 0.90;
      reasoning = 'Recent job title';
    } else if ((text.includes('company') || text.includes('employer') || autoId.includes('company')) && experiences.length) {
      value = experiences[0].company || '';
      confidence = 0.90;
      reasoning = 'Recent employer';
    } else if ((text.includes('school') || text.includes('university') || text.includes('institution') || autoId.includes('school')) && education.length) {
      value = education[0].institution || '';
      confidence = 0.92;
      reasoning = 'Educational institution';
    } else if ((text.includes('degree') || autoId.includes('degree')) && education.length) {
      value = education[0].degree || '';
      confidence = 0.90;
      reasoning = 'Degree match';
    } else if (text.includes('18 years') || text.includes('18 or older') || text.includes('at least 18') || (text.includes('age') && (text.includes('legal') || text.includes('over')))) {
      value = 'Yes';
      confidence = 0.98;
      reasoning = 'Age requirement verification';
    } else if (field.type === 'checkbox' && (text.includes('terms') || text.includes('agree') || text.includes('consent') || text.includes('acknowledge') || autoId.includes('consent') || autoId.includes('terms') || autoId.includes('agree'))) {
      value = true;
      confidence = 0.99;
      reasoning = 'Terms and conditions agreement';
    } else if (text.includes('non-compete') || text.includes('restrictive covenant')) {
      value = 'No';
      confidence = 0.95;
      reasoning = 'Non-compete agreement screening';
    } else if (text.includes('notice period') || text.includes('availability') || text.includes('how soon')) {
      value = 'Immediate';
      confidence = 0.90;
      reasoning = 'Candidate availability';
    } else if (text.includes('gender') || autoId.includes('gender')) {
      value = 'I choose not to self-identify';
      confidence = 0.90;
      reasoning = 'Standard voluntary gender disclosure';
    } else if (text.includes('race') || text.includes('ethnicity') || autoId.includes('ethnicity')) {
      value = 'I choose not to self-identify';
      confidence = 0.90;
      reasoning = 'Standard voluntary race/ethnicity disclosure';
    } else if (text.includes('veteran') || autoId.includes('veteran')) {
      value = 'I am not a protected veteran';
      confidence = 0.90;
      reasoning = 'Standard veteran status';
    } else if (text.includes('disability') || autoId.includes('disability')) {
      value = 'I do not wish to answer';
      confidence = 0.90;
      reasoning = 'Standard disability status';
    }

    return {
      id: field.id,
      label: field.label,
      type: field.type,
      automationId: field.automationId,
      value,
      confidence,
      reasoning,
      source: confidence > 0 ? 'heuristic' : 'none'
    };
  });
}

export async function answerQuestionsWithAI(questions, resumeData, apiKey, model = 'gemini-1.5-flash') {
  if (!questions?.length || !resumeData) return [];

  const generativeModel = getGeminiModel(apiKey, model, true);
  const prompt = `Answer these application questions based on the candidate profile.

Candidate Profile:
${JSON.stringify(resumeData, null, 2)}

Questions:
${JSON.stringify(questions, null, 2)}

Return JSON with format:
{
  "answers": [
    {
      "id": "question id",
      "question": "question text",
      "answer": "answer text",
      "confidence": number,
      "reasoning": "short explanation"
    }
  ]
}`;

  try {
    const result = await generativeModel.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return parsed.answers || [];
  } catch (error) {
    throw new Error(`Failed to generate answers: ${error.message}`);
  }
}
