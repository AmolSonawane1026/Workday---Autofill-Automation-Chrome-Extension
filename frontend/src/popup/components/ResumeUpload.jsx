import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, Briefcase, GraduationCap, Award, Trash2 } from 'lucide-react';
import { extractTextFromPdf } from '../../core/parsers/pdf-parser.js';
import { extractTextFromDocx } from '../../core/parsers/docx-parser.js';
import { parseResumeWithAI } from '../../core/ai/resume-parser.js';
import { saveProfile, saveResumeFile, clearProfile, getDecryptedApiKey } from '../../core/security/storage.js';
import { DEFAULT_SETTINGS } from '../../core/constants.js';
import { CONFIG } from '../../core/config.js';

export default function ResumeUpload({ profile, onProfileUpdated, onNavigateToProfile }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processResumeFile(file);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processResumeFile(file);
    }
  };

  const readFileAsDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processResumeFile = async (file) => {
    if (!file) {
      setError('No file selected. Please choose a resume to upload.');
      return;
    }

    if (file.size === 0) {
      setError('The selected file is empty (0 bytes). Please upload a valid resume.');
      return;
    }

    // Workday standard max file size is 5MB ("Upload a file (5MB max)")
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`File size (${sizeMB}MB) exceeds Workday's 5MB limit. Please upload a file smaller than 5MB.`);
      return;
    }

    const filename = file.name.toLowerCase();
    const isPdfExt = filename.endsWith('.pdf');
    const isDocxExt = filename.endsWith('.docx') || filename.endsWith('.doc');

    if (!isPdfExt && !isDocxExt) {
      setError('Unsupported file format. Workday accepts PDF (.pdf) and Word (.docx, .doc) documents only.');
      return;
    }

    // Binary magic bytes header check to reject renamed / disguised corrupted files
    try {
      const headerSlice = await file.slice(0, 4).arrayBuffer();
      const bytes = new Uint8Array(headerSlice);
      const isPdfHeader = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
      const isZipHeader = bytes[0] === 0x50 && bytes[1] === 0x4B; // PK (DOCX container)
      const isDocHeader = bytes[0] === 0xD0 && bytes[1] === 0xCF; // Compound file (.doc)

      if (isPdfExt && !isPdfHeader) {
        setError('Corrupted or invalid PDF file structure. Please upload a valid PDF resume.');
        return;
      }
      if (isDocxExt && !isZipHeader && !isDocHeader) {
        setError('Corrupted or invalid Word document structure. Please upload a valid DOCX/DOC resume.');
        return;
      }
    } catch (headerErr) {
      console.debug('Binary header validation notice:', headerErr);
    }

    setIsParsing(true);
    setError(null);
    setSuccessMessage('');

    try {
      // 1. Save raw file for auto-uploading to Workday file dropzone
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await saveResumeFile({
          name: file.name,
          type: file.type || 'application/pdf',
          dataUrl
        });
      } catch (fileErr) {
        console.warn('Could not cache raw file for auto-upload:', fileErr);
      }

      let parsedData = null;
      const apiKey = await getDecryptedApiKey();
      const rawBackendUrl = DEFAULT_SETTINGS.backendUrl || CONFIG.BACKEND_URL;
      const backendBaseUrl = rawBackendUrl.replace(/\/api\/?$/, '');

      // 2. Try Node.js Backend
      try {
        const formData = new FormData();
        formData.append('resume', file);
        if (apiKey) formData.append('apiKey', apiKey);

        const res = await fetch(`${backendBaseUrl}/api/resume/parse-file`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const json = await res.json();
          parsedData = json.profile || json.data?.profile;
        } else if (res.status === 400) {
          const errData = await res.json().catch(() => null);
          if (errData?.error) {
            throw new Error(errData.error);
          }
        }
      } catch (backendErr) {
        if (backendErr.message && (
          backendErr.message.includes('limit') ||
          backendErr.message.includes('valid') ||
          backendErr.message.includes('format') ||
          backendErr.message.includes('empty')
        )) {
          throw backendErr;
        }
        console.debug('Backend parse unavailable, falling back to local engine:', backendErr.message);
      }

      // 3. Client-side extraction fallback
      if (!parsedData) {
        let extractedText = '';
        const arrayBuffer = await file.arrayBuffer();

        if (filename.endsWith('.pdf')) {
          extractedText = await extractTextFromPdf(new Uint8Array(arrayBuffer));
        } else {
          extractedText = await extractTextFromDocx(arrayBuffer);
        }

        if (!extractedText || extractedText.length < 20) {
          throw new Error('Could not read text from this file.');
        }

        parsedData = await parseResumeWithAI(extractedText);
      }

      if (!parsedData) {
        throw new Error('Could not parse resume data.');
      }

      const pi = parsedData.personalInfo || {};
      const p = parsedData.personal || {};
      const addr = pi.address || p.address || {};
      // Normalize education
      const rawEdus = parsedData.education || [];
      const normalizedEdu = rawEdus.map(edu => {
        let deg = String(edu.degree || '').trim();
        let inst = String(edu.institution || edu.school || '').trim();
        let field = String(edu.fieldOfStudy || edu.field_of_study || '').trim();

        if (!inst && deg) {
          const doubleSpaceParts = deg.split(/\s{2,}/);
          if (doubleSpaceParts.length >= 2) {
            deg = doubleSpaceParts[0].trim();
            inst = doubleSpaceParts.slice(1).join(' ').trim();
          } else {
            const parenMatch = deg.match(/^(.*?\))\s+([A-Z][A-Za-z0-9\s.,&'-]+)$/);
            if (parenMatch) {
              deg = parenMatch[1].trim();
              inst = parenMatch[2].trim();
            } else {
              const instMatch = deg.match(/^(.*?)(?:\s+[-–—|,\s]\s*|\s+)([A-Z][a-zA-Z0-9\s.,&'-]*(?:College|University|Institute|School|Academy|Vidya|Campus|Co\b).*)$/i);
              if (instMatch && instMatch[1].trim() && instMatch[2].trim()) {
                deg = instMatch[1].trim();
                inst = instMatch[2].trim();
              }
            }
          }
        }

        if (inst.endsWith(' Co') || inst.endsWith(' Co.')) {
          inst = inst.replace(/\s+Co\.?$/, ' College');
        }

        if (!field && deg) {
          const d = deg.toLowerCase();
          if (d.includes('bca') || d.includes('mca') || d.includes('computer application')) {
            field = 'Computer Applications';
          } else if (d.includes('computer') || d.includes('software') || d.includes('it')) {
            field = 'Computer Science';
          } else if (d.includes('commerce') || d.includes('b.com')) {
            field = 'Commerce';
          } else if (d.includes('business') || d.includes('mba')) {
            field = 'Business Administration';
          } else {
            field = 'Computer Applications';
          }
        }

        return {
          ...edu,
          degree: deg,
          institution: inst,
          school: inst,
          fieldOfStudy: field
        };
      });

      // Normalize work experience dates
      const monthMap = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const parseDate = (dStr) => {
        if (!dStr) return { month: '', year: '' };
        const s = String(dStr).trim();
        const mMatch = s.match(/^([a-zA-Z]{3,9})\.?\s+(\d{4})$/i);
        if (mMatch && monthMap[mMatch[1].toLowerCase().replace('.', '')]) {
          return { month: monthMap[mMatch[1].toLowerCase().replace('.', '')], year: mMatch[2] };
        }
        const slashMatch = s.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})$/);
        if (slashMatch) return { month: slashMatch[1].padStart(2, '0'), year: slashMatch[2] };
        const yearOnly = s.match(/\b(19\d{2}|20\d{2})\b/);
        return { month: '', year: yearOnly ? yearOnly[1] : '' };
      };

      const rawExps = parsedData.workExperience || parsedData.experience || [];
      const normalizedExp = rawExps.map(exp => {
        const sp = parseDate(exp.startDate || exp.start_date);
        const ep = parseDate(exp.endDate || exp.end_date);
        return {
          ...exp,
          startDateMonth: exp.startDateMonth || sp.month,
          startDateYear: exp.startDateYear || sp.year,
          endDateMonth: exp.endDateMonth || ep.month,
          endDateYear: exp.endDateYear || ep.year
        };
      });

      const normalizedData = {
        ...parsedData,
        personalInfo: {
          firstName: pi.firstName || p.first_name || p.firstName || '',
          lastName: pi.lastName || p.last_name || p.lastName || '',
          fullName: pi.fullName || p.fullName || `${pi.firstName || p.first_name || ''} ${pi.lastName || p.last_name || ''}`.trim(),
          email: pi.email || p.email || '',
          phone: pi.phone || p.phone || '',
          address: {
            street: addr.street || addr.addressLine1 || '',
            city: addr.city || '',
            state: addr.state || '',
            postalCode: addr.postalCode || addr.postal_code || '',
            country: addr.country || 'India'
          },
          linkedIn: pi.linkedIn || p.linkedIn || '',
          github: pi.github || p.github || '',
          portfolio: pi.portfolio || p.portfolio || ''
        },
        personal: {
          first_name: pi.firstName || p.first_name || p.firstName || '',
          last_name: pi.lastName || p.last_name || p.lastName || '',
          fullName: pi.fullName || p.fullName || `${pi.firstName || p.first_name || ''} ${pi.lastName || p.last_name || ''}`.trim(),
          email: pi.email || p.email || '',
          phone: pi.phone || p.phone || '',
          location: [addr.city, addr.state, addr.country].filter(Boolean).join(', '),
          address: { ...addr }
        },
        education: normalizedEdu,
        workExperience: normalizedExp,
        experience: normalizedExp
      };

      await saveProfile(normalizedData);
      onProfileUpdated(normalizedData);
      setSuccessMessage(`Resume parsed successfully for ${normalizedData.personalInfo?.fullName || 'Candidate'}`);
    } catch (err) {
      console.error('Parsing error:', err);
      let safeMsg = err.message || 'Failed to parse resume';
      // Redact sensitive credentials if present in client-side error
      safeMsg = safeMsg
        .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
        .replace(/sk-[0-9A-Za-z-_]{20,}/g, '[REDACTED_API_KEY]')
        .replace(/([?&](?:key|apiKey)=)[^&\s]+/gi, '$1[REDACTED]');

      const lower = safeMsg.toLowerCase();
      if (lower.includes('api_key_invalid') || lower.includes('invalid api key') || lower.includes('unauthenticated')) {
        safeMsg = 'AI authentication failed. Please check your API key in Settings.';
      } else if (lower.includes('quota') || lower.includes('resource_exhausted')) {
        safeMsg = 'AI rate limit or quota exceeded. Please try again in a few moments.';
      }
      setError(safeMsg);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Box */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          isDragging 
            ? 'border-blue-500 bg-blue-50/50' 
            : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2.5">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            {isParsing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-800">
              {isParsing ? 'Processing resume with AI...' : 'Click or drag resume here'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports PDF & DOCX (Max 5MB)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Candidate Profile Summary */}
      {profile && (
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {profile.personalInfo?.fullName || `${profile.personalInfo?.firstName || ''} ${profile.personalInfo?.lastName || ''}`.trim() || 'Parsed Candidate'}
              </h3>
              <p className="text-xs text-slate-500">{profile.personalInfo?.email || 'No email specified'}</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={onNavigateToProfile}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
              >
                Edit Details
              </button>
              <button
                onClick={async () => {
                  await clearProfile();
                  onProfileUpdated(null);
                  setSuccessMessage('');
                }}
                title="Remove uploaded resume"
                className="text-xs p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-600" />
                <span>Experience</span>
              </div>
              <div className="text-xs font-semibold text-slate-800 mt-0.5">
                {profile.workExperience?.length || 0} Roles
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <GraduationCap className="w-3 h-3 text-slate-600" />
                <span>Education</span>
              </div>
              <div className="text-xs font-semibold text-slate-800 mt-0.5">
                {profile.education?.length || 0} Entries
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Award className="w-3 h-3 text-slate-600" />
                <span>Skills</span>
              </div>
              <div className="text-xs font-semibold text-slate-800 mt-0.5">
                {(profile.skills?.technical?.length || 0) + (profile.skills?.tools?.length || 0)} Skills
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
