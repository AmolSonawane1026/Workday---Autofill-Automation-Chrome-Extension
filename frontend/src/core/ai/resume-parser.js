import { generateWithGemini } from './gemini-client.js';

export async function parseResumeWithAI(resumeText, options = {}) {
  if (!resumeText?.trim()) {
    throw new Error('Resume text is empty.');
  }

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
    const rawResult = await generateWithGemini(prompt, { ...options, jsonOutput: true });
    return JSON.parse(rawResult);
  } catch (error) {
    console.warn('AI Parsing failed, running dynamic section parser:', error.message);
    const parsed = parseResumeHeuristically(resumeText);
    return parsed;
  }
}

/**
 * Dynamic Section-Based Parser (Extracts real details & exact URLs from resume)
 */
export function parseResumeHeuristically(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // 1. Email & Phone
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  // 2. Real URLs from Text & Embedded PDF Annotations
  // Match full URLs including https://, http:// or www.
  let linkedin = '';
  let github = '';
  let portfolio = '';
  const websites = [];

  const urlMatches = text.match(/https?:\/\/[^\s\)\],]+/gi) || [];
  
  for (const rawUrl of urlMatches) {
    const cleanUrl = rawUrl.replace(/[.,;]$/, '').trim();
    if (/linkedin\.com/i.test(cleanUrl) && !linkedin) {
      linkedin = cleanUrl;
    } else if (/github\.com/i.test(cleanUrl) && !github) {
      github = cleanUrl;
    } else if (!/google\.com|googleapis\.com|cdnjs/i.test(cleanUrl)) {
      if (!portfolio) portfolio = cleanUrl;
      if (!websites.includes(cleanUrl)) websites.push(cleanUrl);
    }
  }

  // Also check un-prefixed patterns like linkedin.com/in/... or github.com/...
  if (!linkedin) {
    const liMatch = text.match(/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    if (liMatch) linkedin = `https://${liMatch[0].replace(/^https?:\/\//, '')}`;
  }
  if (!github) {
    const ghMatch = text.match(/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
    if (ghMatch) github = `https://${ghMatch[0].replace(/^https?:\/\//, '')}`;
  }
  if (!portfolio) {
    const webMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:[a-zA-Z0-9-]+\.(?:com|io|dev|in|me|app|co|net|org))\b/i);
    if (webMatch && !/linkedin|github|google|cdnjs|stackoverflow|medium|twitter|facebook/i.test(webMatch[0])) {
      portfolio = webMatch[0].startsWith('http') ? webMatch[0] : `https://${webMatch[0]}`;
    }
  }

  // 3. Name & Location Detection
  let fullName = '';
  let firstName = '';
  let lastName = '';
  let city = '';
  let state = '';
  let country = '';

  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    if (!fullName && !line.includes('@') && !line.includes('http') && !line.includes('+') && !line.includes('Link:') && line.length < 40 && line.length > 3) {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 4) {
        fullName = line;
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
    }
    // Detect location: "City, State" or "City, State, Country" patterns
    // Handles lines like "Pune, Maharashtra, India | email@gmail.com | +91 7558379918"
    // and "7058633342 — sakshibole1026@gmail.com — LinkedIn — Pune, Maharashtra"
    if (!city && line.includes(',')) {
      const segments = line.split(/[|•—–]/).map(s => s.trim());
      for (const seg of segments) {
        if (seg.includes(',') && !seg.includes('@') && !seg.includes('http') && !seg.includes('+') && seg.length < 70) {
          const locParts = seg.split(',').map(s => s.trim()).filter(Boolean);
          if (locParts.length >= 2 && locParts[0].length < 35 && locParts[1].length < 35) {
            city = locParts[0];
            state = locParts[1];
            if (locParts[2]) country = locParts[2];
            break;
          }
        }
      }
    }
  }

  // 4. Extract Sections
  const experiences = [];
  const educationList = [];
  const technicalSkills = [];
  const toolsSkills = [];
  const softSkills = [];
  const languageSkills = [];

  const expIndex = lines.findIndex(l => /^experience|^work experience|^professional experience/i.test(l));
  const eduIndex = lines.findIndex(l => /^education|^academic background|^academic qualifications/i.test(l));
  const skillsIndex = lines.findIndex(l => /^skills|^technical skills|^core competencies|^key skills/i.test(l));
  const projIndex = lines.findIndex(l => /^projects|^key projects/i.test(l));
  const certIndex = lines.findIndex(l => /^certifications?|^licenses?/i.test(l));

  // Work Experience parsing
  if (expIndex !== -1) {
    const endExp = eduIndex > expIndex ? eduIndex : (projIndex > expIndex ? projIndex : (skillsIndex > expIndex ? skillsIndex : lines.length));
    const expLines = lines.slice(expIndex + 1, endExp);

    let currentExp = null;

    for (let i = 0; i < expLines.length; i++) {
      const line = expLines[i];
      if (line.startsWith('--- Embedded') || line.startsWith('Link:')) continue;
      
      const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('▪') || line.startsWith('*') || /^\d+[\.\)]\s+/.test(line);

      // Check if this line contains dates
      const dateMatch = line.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—to]+\s*(?:Present|Current|Now|Ongoing|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i) ||
                        line.match(/\b(?:19\d{2}|20\d{2})\s*[-–—to]+\s*(?:Present|Current|Now|Ongoing|\b(?:19\d{2}|20\d{2})\b)/i);

      if (dateMatch) {
        if (currentExp && (currentExp.company || currentExp.jobTitle)) {
          if (!currentExp.description && currentExp.highlights.length) {
            currentExp.description = currentExp.highlights.join('\n\n');
          }
          experiences.push(currentExp);
        }

        const dateStr = dateMatch[0];
        // Remaining text on the date line is usually location (e.g. "Seattle, WA" or "Remote")
        const locOnDateLine = line.replace(dateStr, '').replace(/^[|•—–\s]+|[|•—–\s]+$/g, '').trim();

        // The company and job title are typically on the PREVIOUS non-empty line (e.g. "Fast - Senior Software Engineer")
        let prevLine = '';
        for (let p = i - 1; p >= 0; p--) {
          const pl = expLines[p].trim();
          if (pl && !pl.startsWith('•') && !pl.startsWith('-') && !pl.startsWith('*') && !pl.startsWith('▪') && !/^\d+[\.\)]/.test(pl)) {
            prevLine = pl;
            break;
          }
        }

        let detectedComp = '';
        let detectedTitle = '';

        if (prevLine) {
          const splitMatch = prevLine.split(/\s+[-–—|]\s+|\s+at\s+|\s+@\s+/i);
          if (splitMatch.length >= 2) {
            const first = splitMatch[0].trim();
            const second = splitMatch.slice(1).join(' - ').trim();
            const isFirstTitle = /\b(?:engineer|developer|manager|intern|analyst|lead|director|consultant|specialist|architect|designer|scientist)\b/i.test(first);
            if (isFirstTitle) {
              detectedTitle = first;
              detectedComp = second;
            } else {
              detectedComp = first;
              detectedTitle = second;
            }
          } else if (prevLine.includes(',')) {
            const commaParts = prevLine.split(',').map(s => s.trim());
            detectedComp = commaParts[0];
            detectedTitle = commaParts.slice(1).join(', ');
          } else {
            detectedComp = prevLine;
          }
        }

        let startD = '';
        let endD = '';
        const dateParts = dateStr.split(/[-–—to]+/i).map(s => s.trim());
        if (dateParts.length > 0) startD = dateParts[0];
        if (dateParts.length > 1) endD = dateParts[1];

        const isCurrentRole = /present|current|now|ongoing/i.test(endD || dateStr);

        currentExp = {
          company: detectedComp || '',
          jobTitle: detectedTitle || '',
          location: locOnDateLine || (city ? `${city}, ${state}` : ''),
          startDate: startD,
          endDate: isCurrentRole ? 'Present' : endD,
          isCurrent: isCurrentRole,
          description: '',
          highlights: []
        };
      } else if (currentExp) {
        if (isBullet) {
          const cleanBullet = line.replace(/^[•\-▪*]|\d+[\.\)]\s*/, '').trim();
          if (cleanBullet.length > 3) {
            currentExp.highlights.push(cleanBullet);
          }
        } else if (line.length > 20 && !line.includes('@') && !line.includes('http') && !dateMatch) {
          currentExp.highlights.push(line.trim());
        }
      }
    }

    if (currentExp && (currentExp.company || currentExp.jobTitle)) {
      if (!currentExp.description && currentExp.highlights.length) {
        currentExp.description = currentExp.highlights.join('\n\n');
      }
      experiences.push(currentExp);
    }
  }

  // Education parsing - extract actual data from text, no hardcoded values
  if (eduIndex !== -1) {
    const endEdu = skillsIndex > eduIndex ? skillsIndex : (certIndex > eduIndex ? certIndex : lines.length);
    const eduLines = lines.slice(eduIndex + 1, endEdu);

    let currentEdu = null;
    for (let i = 0; i < eduLines.length; i++) {
      const line = eduLines[i];
      if (line.startsWith('--- Embedded') || line.startsWith('Link:')) continue;
      if (!line.trim()) continue;

      // Check for date range in education (e.g. "August 2010 - May 2014" or "2010 - 2014")
      const eduDateMatch = line.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—to]+\s*(?:Present|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/i) ||
                           line.match(/\b(?:19\d{2}|20\d{2})\s*[-–—to]+\s*(?:Present|\b(?:19\d{2}|20\d{2})\b)/i);
      
      // Check for degree keywords
      const hasDegree = /bachelor|master|b\.?tech|b\.?sc|m\.?tech|m\.?sc|b\.?s\b|m\.?s\b|b\.?e\b|m\.?e\b|bca|mca|mba|phd|diploma|associate|b\.?a\b|m\.?a\b|b\.?com|m\.?com/i.test(line);

      // Check if line contains institution separator (e.g. "University of Washington - B.S., Computer Science")
      const hasHyphen = /\s+[-–—|]\s+/.test(line);

      if (hasDegree || eduDateMatch || hasHyphen) {
        if (!currentEdu) {
          currentEdu = { institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', gpa: '' };
        }

        if (hasHyphen) {
          const splitParts = line.split(/\s+[-–—|]\s+/);
          if (splitParts.length >= 2) {
            const part0 = splitParts[0].trim();
            const part1 = splitParts.slice(1).join(' - ').trim();
            const isPart0Uni = /\b(?:university|college|institute|school|academy)\b/i.test(part0);
            if (isPart0Uni || !currentEdu.institution) {
              currentEdu.institution = part0;
              currentEdu.degree = part1;
            } else {
              currentEdu.degree = part0;
              currentEdu.institution = part1;
            }
          }
        } else if (hasDegree) {
          currentEdu.degree = line.trim();
        }

        if (currentEdu.degree && !currentEdu.fieldOfStudy) {
          const d = currentEdu.degree.toLowerCase();
          if (d.includes('computer science')) currentEdu.fieldOfStudy = 'Computer Science';
          else if (d.includes('computer application') || d.includes('bca') || d.includes('mca')) currentEdu.fieldOfStudy = 'Computer Applications';
          else if (d.includes('software') || d.includes('information technology') || d.includes('it')) currentEdu.fieldOfStudy = 'Computer Science';
          else if (d.includes('commerce') || d.includes('b.com')) currentEdu.fieldOfStudy = 'Commerce';
          else if (d.includes('business') || d.includes('mba')) currentEdu.fieldOfStudy = 'Business Administration';
          else if (d.includes(',')) {
            const commaParts = currentEdu.degree.split(',');
            if (commaParts[1]) currentEdu.fieldOfStudy = commaParts[1].trim();
          }
        }

        if (eduDateMatch) {
          const parts = eduDateMatch[0].split(/[-–—to]+/i).map(s => s.trim());
          const y1 = parts[0]?.match(/\b(19\d{2}|20\d{2})\b/);
          const y2 = parts[1]?.match(/\b(19\d{2}|20\d{2})\b/);
          if (y1) currentEdu.startDate = y1[1];
          if (y2) currentEdu.endDate = y2[1];
        }
      } else if (line.length > 3 && line.length < 120 && !line.startsWith('•') && !line.startsWith('-')) {
        if (currentEdu && !currentEdu.institution) {
          currentEdu.institution = line.trim();
        } else if (!currentEdu) {
          currentEdu = { institution: line.trim(), degree: '', fieldOfStudy: '', startDate: '', endDate: '', gpa: '' };
        }
      }

      // GPA detection
      const gpaMatch = line.match(/(?:gpa|cgpa|grade|percentage)[:\s]*([0-9.]+)/i);
      if (gpaMatch && currentEdu) {
        currentEdu.gpa = gpaMatch[1];
      }
    }
    if (currentEdu && (currentEdu.institution || currentEdu.degree)) {
      const deg = (currentEdu.degree || '').trim();
      const inst = (currentEdu.institution || '').trim();
      if ((deg.length >= 2 && !/^\d+[\.\)]?$/.test(deg)) || (inst.length >= 2 && !/^\d+[\.\)]?$/.test(inst))) {
        educationList.push(currentEdu);
      }
    }
  }

  // Skills parsing - extract actual skills from resume text
  if (skillsIndex !== -1) {
    const endSkills = expIndex > skillsIndex ? expIndex : (eduIndex > skillsIndex ? eduIndex : lines.length);
    const skillLines = lines.slice(skillsIndex + 1, endSkills);
    for (const sLine of skillLines) {
      if (sLine.startsWith('--- Embedded') || sLine.startsWith('Link:')) continue;
      
      const categoryLabel = sLine.match(/^([A-Za-z\s&/]+):\s*/);
      const categoryName = categoryLabel ? categoryLabel[1].toLowerCase() : '';
      const cleaned = sLine.replace(/^[A-Za-z\s&/]+:\s*/, '');
      const tokens = cleaned.split(/[,|•;]/).map(s => s.trim()).filter(Boolean);
      
      tokens.forEach(t => {
        if (t.length > 1 && t.length < 40) {
          if (categoryName.includes('tool') || categoryName.includes('platform') || categoryName.includes('framework')) {
            if (!toolsSkills.includes(t)) toolsSkills.push(t);
          } else if (categoryName.includes('soft') || categoryName.includes('interpersonal')) {
            if (!softSkills.includes(t)) softSkills.push(t);
          } else if (categoryName.includes('language') && !categoryName.includes('programming')) {
            if (!languageSkills.includes(t)) languageSkills.push(t);
          } else {
            if (!technicalSkills.includes(t)) technicalSkills.push(t);
          }
        }
      });
    }
  }

  // Build summary from extracted data
  const jobTitles = experiences.map(e => e.jobTitle).filter(Boolean);
  const summary = jobTitles.length > 0 
    ? `${jobTitles[0]} with experience in ${technicalSkills.slice(0, 5).join(', ') || 'various technologies'}.`
    : technicalSkills.length > 0 
      ? `Professional skilled in ${technicalSkills.slice(0, 5).join(', ')}.`
      : '';

  // Calculate total years of experience
  let totalYears = 0;
  for (const exp of experiences) {
    if (exp.startDate && exp.endDate) {
      const startYear = parseInt(exp.startDate.match(/\d{4}/)?.[0] || '0');
      const endYear = exp.isCurrent ? new Date().getFullYear() : parseInt(exp.endDate.match(/\d{4}/)?.[0] || '0');
      if (startYear && endYear) totalYears += endYear - startYear;
    }
  }

  return {
    personalInfo: {
      firstName: firstName || '',
      lastName: lastName || '',
      fullName: fullName || `${firstName} ${lastName}`.trim(),
      email: email || '',
      phone: phone || '',
      address: {
        street: '',
        city: city || '',
        state: state || '',
        postalCode: '',
        country: country || ''
      },
      linkedIn: linkedin,
      github: github,
      portfolio: portfolio,
      websites: websites
    },
    summary,
    workExperience: experiences,
    education: educationList,
    skills: {
      technical: technicalSkills,
      tools: toolsSkills,
      soft: softSkills,
      languages: languageSkills
    },
    certifications: [],
    workAuthorization: {
      authorizedInTargetCountry: true,
      requiresSponsorship: false,
      visaStatus: ''
    },
    totalYearsExperience: totalYears || 0
  };
}
