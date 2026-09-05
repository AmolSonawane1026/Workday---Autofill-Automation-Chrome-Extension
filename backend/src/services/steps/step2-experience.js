/**
 * Workday Puppeteer Automation - Step 2: My Experience & Education
 */

import { selectorExists, withOptSelector, parseDateToMonthYear, NEXT_BUTTON } from './common.js';

export async function fillExperience(page, profile, resumeFilePath) {
  console.log('Filling experience (Step 2)...');
  const experiences = profile.workExperience || profile.experience || [];
  const education = profile.education || [];
  const p = profile.personalInfo || {};

  // ─── Work Experience ───
  let addedWorks = 0;
  for (const work of experiences) {
    addedWorks += 1;

    // Check if indexed work section exists; if not, create it
    if (!(await selectorExists(page, `div[data-automation-id="workExperience-${addedWorks}"]`))) {
      if (addedWorks === 1) {
        await withOptSelector(
          page,
          'div[data-automation-id="workExperienceSection"] button[data-automation-id*="add"]',
          async (el) => el.click(),
          5000
        );
      } else {
        await withOptSelector(
          page,
          'div[data-automation-id="workExperienceSection"] button[data-automation-id*="Add"]',
          async (el) => el.click(),
          5000
        );
      }
    }

    // Job Title
    await withOptSelector(
      page,
      `div[data-automation-id="workExperience-${addedWorks}"] input[data-automation-id="jobTitle"]`,
      async (el) => el.fill(work.jobTitle || '')
    );

    // Company
    await withOptSelector(
      page,
      `div[data-automation-id="workExperience-${addedWorks}"] input[data-automation-id="company"]`,
      async (el) => el.fill(work.company || '')
    );

    // Location
    await withOptSelector(
      page,
      `div[data-automation-id="workExperience-${addedWorks}"] input[data-automation-id="location"]`,
      async (el) => el.fill(work.location || '')
    );

    // Start Date - Split month/year inputs
    const startParts = parseDateToMonthYear(work.startDate);
    if (startParts.month) {
      await withOptSelector(
        page,
        `div[data-automation-id="workExperience-${addedWorks}"] div[data-automation-id="formField-startDate"] input[data-automation-id="dateSectionMonth-input"]`,
        async (el) => {
          await (await el.waitHandle()).focus();
          await page.keyboard.type(startParts.month, { delay: 100 });
        }
      );
    }
    if (startParts.year) {
      await withOptSelector(
        page,
        `div[data-automation-id="workExperience-${addedWorks}"] div[data-automation-id="formField-startDate"] input[data-automation-id="dateSectionYear-input"]`,
        async (el) => {
          await (await el.waitHandle()).focus();
          await page.keyboard.type(startParts.year, { delay: 100 });
        }
      );
    }

    // End Date - Split month/year inputs
    if (!work.isCurrent) {
      const endParts = parseDateToMonthYear(work.endDate);
      if (endParts.month) {
        await withOptSelector(
          page,
          `div[data-automation-id="workExperience-${addedWorks}"] div[data-automation-id="formField-endDate"] input[data-automation-id="dateSectionMonth-input"]`,
          async (el) => {
            await (await el.waitHandle()).focus();
            await page.keyboard.type(endParts.month, { delay: 100 });
          }
        );
      }
      if (endParts.year) {
        await withOptSelector(
          page,
          `div[data-automation-id="workExperience-${addedWorks}"] div[data-automation-id="formField-endDate"] input[data-automation-id="dateSectionYear-input"]`,
          async (el) => {
            await (await el.waitHandle()).focus();
            await page.keyboard.type(endParts.year, { delay: 100 });
          }
        );
      }
    }

    // Role Description
    const descText = work.description || (work.highlights && work.highlights.length ? work.highlights.join('\n') : '');
    if (descText) {
      await withOptSelector(
        page,
        `div[data-automation-id="workExperience-${addedWorks}"] textarea[data-automation-id="description"]`,
        async (el) => el.fill(descText)
      );
    }
  }

  // ─── Education ───
  if (education.length > 0) {
    await withOptSelector(
      page,
      'div[data-automation-id="educationSection"] button[data-automation-id="Add"]',
      (el) => el.click()
    );

    const edu = education[0];

    // School input with double Enter confirmation
    if (edu.institution) {
      await withOptSelector(
        page,
        'div[data-automation-id="formField-schoolItem"] input',
        async (el) => {
          await el.fill(edu.institution);
          await page.keyboard.press('Enter');
          await page.keyboard.press('Enter', { delay: 1000 });
        }
      );
    }

    // Degree dropdown
    if (edu.degree) {
      await withOptSelector(
        page,
        'button[data-automation-id="degree"]',
        async (el) => {
          await el.click();
          await page.keyboard.type(edu.degree, { delay: 100 });
          await page.keyboard.press('Enter');
        }
      );
    }

    // Field of Study
    const fieldOfStudy = edu.fieldOfStudy || edu.field_of_study || 'Computer Science';
    await withOptSelector(
      page,
      'div[data-automation-id="formField-field-of-study"] input, div[data-automation-id="formField-fieldOfStudy"] input',
      async (el) => {
        await el.fill(fieldOfStudy);
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter', { delay: 1000 });
      }
    );

    // GPA
    if (edu.gpa) {
      await withOptSelector(
        page,
        'div[data-automation-id="formField-gradeAverage"] input',
        async () => {
          await page.locator('input[data-automation-id="gpa"]').fill(edu.gpa);
        }
      );
    }

    // Start & End Years
    if (edu.startDate) {
      const startYear = edu.startDate.match(/\d{4}/)?.[0] || '';
      await withOptSelector(
        page,
        'div[data-automation-id="formField-firstYearAttended"] input',
        async (el) => el.fill(startYear)
      );
    }

    if (edu.endDate) {
      const endYear = edu.endDate.match(/\d{4}/)?.[0] || '';
      await withOptSelector(
        page,
        'div[data-automation-id="formField-lastYearAttended"] input',
        async (el) => el.fill(endYear)
      );
    }
  }

  // ─── Resume Upload ───
  if (resumeFilePath) {
    const fileSelector = 'input[data-automation-id="file-upload-input-ref"], input[type="file"]';
    if (await selectorExists(page, fileSelector)) {
      const uploadElementHandle = await page.$(fileSelector);
      if (uploadElementHandle) {
        await uploadElementHandle.uploadFile(resumeFilePath);
        console.log(`📄 Uploaded resume: ${resumeFilePath}`);
      }
    }
  }

  // ─── Website Links ───
  let addedWebs = 0;
  const linkedInLink = p.linkedIn || '';
  const githubLink = p.github || '';

  if (linkedInLink) {
    const linkedInInput = 'input[data-automation-id="linkedinQuestion"]';
    if (await selectorExists(page, linkedInInput)) {
      await page.locator(linkedInInput).fill(linkedInLink);
    } else {
      addedWebs += 1;
      if (!(await selectorExists(page, `div[data-automation-id="websitePanelSet-${addedWebs}"] input`))) {
        await withOptSelector(
          page,
          'div[data-automation-id="websiteSection"] button[data-automation-id="Add"]',
          async (el) => el.click()
        );
      }
      await page.locator(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`).fill(linkedInLink);
    }
  }

  if (githubLink) {
    addedWebs += 1;
    if (!(await selectorExists(page, `div[data-automation-id="websitePanelSet-${addedWebs}"] input`))) {
      await withOptSelector(
        page,
        'div[data-automation-id="websiteSection"] button[data-automation-id="Add"]',
        async (el) => el.click()
      );
    }
    await page.locator(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`).fill(githubLink);
  }

  await page.locator(NEXT_BUTTON).click();
}
