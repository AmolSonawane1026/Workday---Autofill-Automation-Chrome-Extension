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

  it('extracts all 3 work experiences with companies, titles, dates, current status, and role descriptions', () => {
    const rawResume = `
Tasiana Ukura
Senior Software Engineer
tukura@email.com (123) 456-7890 Seattle, WA https://linkedin.com/in/tukura

WORK EXPERIENCE
Fast - Senior Software Engineer
October 2022 - current Seattle, WA
• Architected core checkout services handling payment authorization and order validation, supporting ~9k checkout requests daily across partner merchant platforms.
• Streamlined authentication and session management logic in Go, reducing average checkout completion latency by 41% during peak traffic periods.
• Implemented reliability safeguards for payment processing workflows, decreasing transaction retry incidents across 6 critical service endpoints.
• Guided cross-team feature delivery with product and infrastructure engineers on a two-week sprint cadence, enabling faster rollout of merchant onboarding capabilities.

Adaptiva - Software Engineer
May 2015 - October 2022 Seattle, WA
• Developed backend components for endpoint patch distribution systems, enabling secure delivery of updates to 30k+ managed devices across enterprise clients.
• Refactored deployment orchestration services in C#, shortening average patch rollout duration by 27 minutes per update cycle.
• Integrated monitoring hooks and logging pipelines that surfaced configuration anomalies across 4 internal platform modules used by IT administrators.
• Collaborated with QA and product teams to ship configuration management improvements that lifted customer platform satisfaction scores to 4.5 / 5.

Expedia Group - Software Engineer Intern
May 2014 - May 2015 Seattle, WA
• Built internal dashboards to track travel inventory and booking performance, enabling analysts to monitor 140+ active hotel listings across regional markets.
• Automated data transformation scripts in Python, cutting manual reporting preparation by ~5 hours per week for the analytics team.
• Investigated discrepancies in booking data pipelines, resolving issues affecting three partner integration feeds used for inventory updates.
• Documented onboarding and deployment procedures that reduced ramp-up time for new engineering interns by one training cycle.

EDUCATION
University of Washington - B.S., Computer Science
August 2010 - May 2014 Seattle, WA

SKILLS
• Go, C#, Python, REST API Development
• System Design, Cross-functional Collaboration, Agile Development
    `;

    const profile = parseResumeHeuristically(rawResume);

    expect(profile.personalInfo.fullName).toBe('Tasiana Ukura');
    expect(profile.workExperience).toHaveLength(3);

    // Job 1
    expect(profile.workExperience[0].company).toBe('Fast');
    expect(profile.workExperience[0].jobTitle).toBe('Senior Software Engineer');
    expect(profile.workExperience[0].isCurrent).toBe(true);
    expect(profile.workExperience[0].startDate).toContain('October 2022');
    expect(profile.workExperience[0].highlights.length).toBe(4);
    expect(profile.workExperience[0].description).toContain('Architected core checkout services');

    // Job 2
    expect(profile.workExperience[1].company).toBe('Adaptiva');
    expect(profile.workExperience[1].jobTitle).toBe('Software Engineer');
    expect(profile.workExperience[1].isCurrent).toBe(false);
    expect(profile.workExperience[1].startDate).toContain('May 2015');
    expect(profile.workExperience[1].endDate).toContain('October 2022');
    expect(profile.workExperience[1].highlights.length).toBe(4);

    // Job 3
    expect(profile.workExperience[2].company).toBe('Expedia Group');
    expect(profile.workExperience[2].jobTitle).toBe('Software Engineer Intern');
    expect(profile.workExperience[2].highlights.length).toBe(4);

    // Education
    expect(profile.education).toHaveLength(1);
    expect(profile.education[0].institution).toBe('University of Washington');
    expect(profile.education[0].fieldOfStudy).toContain('Computer Science');
  });
});

