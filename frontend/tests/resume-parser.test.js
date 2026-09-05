import { describe, it, expect } from 'vitest';
import { parseResumeHeuristically } from '../src/core/ai/resume-parser.js';

describe('Resume Parsing Logic', () => {
  it('extracts candidate contact info and name from unstructured text', () => {
    const rawResume = `
      Sarah Connor
      sarah.connor@cyberdyne.io | (555) 019-2834
      https://linkedin.com/in/sarahconnor https://github.com/sarahconnor
      
      Summary:
      Passionate DevOps and Infrastructure Architect with 6 years experience.
    `;

    const profile = parseResumeHeuristically(rawResume);

    expect(profile.personalInfo.email).toBe('sarah.connor@cyberdyne.io');
    expect(profile.personalInfo.phone).toBe('(555) 019-2834');
    expect(profile.personalInfo.linkedIn).toContain('linkedin.com/in/sarahconnor');
    expect(profile.personalInfo.github).toContain('github.com/sarahconnor');
    expect(profile.personalInfo.firstName).toBe('Sarah');
    expect(profile.personalInfo.lastName).toBe('Connor');
  });
});
