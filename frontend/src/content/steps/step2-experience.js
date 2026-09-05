/**
 * Workday Step 2: My Experience Automation Module
 *
 * Handles:
 * - Dynamically expanding and populating Work Experience cards (titles, companies, dates, current roles, descriptions)
 * - Dynamically expanding and populating Education cards (degree standard listbox, field of study prompt, school double-Enter, GPA, years)
 * - Pruning empty extra panels that exceed resume entries
 * - Website / Portfolio / LinkedIn / GitHub links
 * - Dedicated skills search, autocomplete filtering, and verified checkbox selection
 */

import {
  fillWorkExperienceAndEducation,
  fillWebsiteLinks,
  autoUploadResumeFile
} from '../filler/sections-filler.js';

import {
  fillWorkdaySkills,
  findWorkdaySkillsInput,
  cleanAndSanitizeSkills
} from '../filler/skills-filler.js';

/**
 * Executes complete Step 2 (My Experience) automation flow
 */
export async function handleStep2(profile, currentFields, overlayAssistant) {
  overlayAssistant?.updateState({ statusMessage: 'Step 2: Checking and attaching Resume/CV file...' });

  // 1. Check and auto-upload resume file if drop zone exists on Step 2 (Resume/CV section)
  let resumeAttached = await autoUploadResumeFile();

  // 2. Work Experience & Education
  overlayAssistant?.updateState({ statusMessage: 'Step 2: Expanding and filling work experience & education...' });
  await fillWorkExperienceAndEducation(profile);

  // 3. Website & Social Links (LinkedIn, GitHub, Portfolio)
  overlayAssistant?.updateState({ statusMessage: 'Step 2: Filling website links...' });
  await fillWebsiteLinks(profile);

  // 4. Workday Skills Multiselect Automation
  const candidateSkills = profile?.skills?.technical || profile?.skills || [];
  const skillsInput = findWorkdaySkillsInput();

  let skillsReport = { selected: 0, total: 0 };
  if (skillsInput) {
    overlayAssistant?.updateState({ statusMessage: 'Step 2: Adding candidate skills...' });
    skillsReport = await fillWorkdaySkills(candidateSkills, skillsInput);
  }

  // 5. Re-check resume attachment in case drop zone rendered during section expansions
  if (!resumeAttached) {
    resumeAttached = await autoUploadResumeFile();
  }

  const expCount = (profile?.workExperience || profile?.experience || []).length;
  const eduCount = (profile?.education || []).length;
  const resumeMsg = resumeAttached ? 'Resume attached. ' : '';
  const message = `Step 2: ${resumeMsg}Processed ${expCount} roles, ${eduCount} degrees, ${skillsReport.selected} skills.`;

  overlayAssistant?.updateState({
    isProcessing: false,
    statusMessage: message
  });

  return {
    success: true,
    step: 2,
    stepName: 'My Experience',
    resumeAttached: Boolean(resumeAttached),
    workExperienceFilled: expCount,
    educationFilled: eduCount,
    skillsSelected: skillsReport.selected,
    message
  };
}

