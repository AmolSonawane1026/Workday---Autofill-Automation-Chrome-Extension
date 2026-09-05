/**
 * Workday Skills Multiselect Automation Subsystem
 *
 * Provides dedicated skill normalization, fuzzy synonym matching,
 * sequential single-skill search with backspace clearing,
 * idempotent checkbox selection (never unchecks), and DOM verification.
 */

import { setNativeInputValue } from './dom-utils.js';

/**
 * Normalizes a skill string for intelligent comparison
 * Examples:
 * "React.js" -> "reactjs"
 * "React JS" -> "reactjs"
 * "Node.js" -> "nodejs"
 * "Next.js" -> "nextjs"
 */
export function normalizeSkillName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\.js\b/gi, 'js')
    .replace(/[\s\-_.]+/g, '');
}

/**
 * Intelligent skill matching logic:
 * Prioritizes:
 * 1. Exact match (case-insensitive)
 * 2. Exact normalized match
 * 3. Match without parenthetical annotations ("Python (Programming Language)" -> "Python")
 * 4. Parenthetical abbreviation/acronym match ("Amazon Web Services (AWS)" -> "AWS")
 * 5. JS suffix variations ("react" <=> "reactjs")
 * 6. Known equivalent synonyms (C++ <=> CPP, Golang <=> Go, Postgres <=> PostgreSQL)
 * Strictly avoids false positives ("React Native" != "React", "JavaScript" != "Java").
 */
export function isSkillMatch(targetSkill, optionText) {
  if (!targetSkill || !optionText) return false;

  const rawTarget = targetSkill.trim().toLowerCase();
  const rawOption = optionText.trim().toLowerCase();

  // 1. Exact raw match
  if (rawTarget === rawOption) return true;

  const normTarget = normalizeSkillName(targetSkill);
  const normOption = normalizeSkillName(optionText);

  if (!normTarget || !normOption) return false;

  // 2. Exact normalized match
  if (normTarget === normOption) return true;

  // 3. Match without parenthetical annotations
  const optionWithoutParens = rawOption.replace(/\s*\([^)]*\)/g, '').trim();
  const normOptionWithoutParens = normalizeSkillName(optionWithoutParens);
  if (normTarget === normOptionWithoutParens) {
    return true;
  }

  // 4. Check if target matches parenthetical abbreviation/acronym
  const parenMatch = rawOption.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const insideParen = normalizeSkillName(parenMatch[1]);
    if (insideParen === normTarget) {
      return true;
    }
  }

  // 5. Common JS suffix aliases
  if (normTarget + 'js' === normOption || normOption + 'js' === normTarget ||
      normTarget + 'js' === normOptionWithoutParens || normOptionWithoutParens + 'js' === normTarget) {
    return true;
  }

  // 6. Well-known language/technology equivalent synonyms
  const aliases = {
    'cplusplus': ['cpp', 'c++'],
    'cpp': ['cplusplus', 'c++'],
    'c++': ['cpp', 'cplusplus'],
    'csharp': ['c#'],
    'c#': ['csharp'],
    'golang': ['go'],
    'go': ['golang'],
    'postgres': ['postgresql'],
    'postgresql': ['postgres'],
    'mongo': ['mongodb'],
    'mongodb': ['mongo'],
    'typescript': ['ts'],
    'javascript': ['js'],
    'k8s': ['kubernetes'],
    'kubernetes': ['k8s'],
    'amazonwebservices': ['aws'],
    'aws': ['amazonwebservices'],
    'restapi': ['restapis', 'rest', 'restfulapi', 'restfulapis', 'restfulwebservices'],
    'restapis': ['restapi', 'rest', 'restfulapi', 'restfulapis', 'restfulwebservices'],
    'websockets': ['websocket', 'sockets'],
    'websocket': ['websockets', 'sockets'],
    'mssql': ['microsoftsqlserver', 'sqlserver'],
    'microsoftsqlserver': ['mssql', 'sqlserver'],
    'sqlserver': ['mssql', 'microsoftsqlserver']
  };

  const targetSynonyms = aliases[normTarget] || [];
  if (targetSynonyms.some(syn => {
    const normSyn = normalizeSkillName(syn);
    return normSyn === normOption || normSyn === normOptionWithoutParens;
  })) {
    return true;
  }

  return false;
}

/**
 * Clean & sanitize skill names extracted from resume:
 * - Expands combined tokens like "Authentication (JWT, OAuth)" -> "Authentication", "JWT", "OAuth"
 * - Removes version suffixes like "React.js (v18)" -> "React.js", "Next.js (v14)" -> "Next.js"
 * - Strips dangling parentheses
 * - Discards broken fragments like "Web-", "Lang-"
 * - Reconstructs "Sockets" -> "WebSockets"
 * - Deduplicates while preserving order
 */
export function cleanAndSanitizeSkills(skills) {
  let rawList = [];
  if (Array.isArray(skills)) {
    rawList = skills;
  } else if (skills && typeof skills === 'object') {
    rawList = [
      ...(skills.technical || []),
      ...(skills.tools || []),
      ...(skills.soft || []),
      ...(skills.languages || [])
    ];
  } else if (typeof skills === 'string') {
    rawList = skills.split(/[,|•\n]/);
  }

  const result = [];
  const seen = new Set();

  for (let raw of rawList) {
    if (!raw || typeof raw !== 'string') continue;
    let text = raw.trim();
    if (!text) continue;

    // Remove version numbers like (v18), (v14), (v2.0), (ES6+), (v1.5)
    text = text.replace(/\s*\((?:v\d+|es\d+\+?|\d+\.?\d*)\)/gi, '');

    // Split compound items
    const tokens = text
      .replace(/[()]/g, ',')
      .split(/[,|•;\n/]/)
      .map(t => t.trim())
      .filter(Boolean);

    for (let token of tokens) {
      let clean = token.replace(/^[-•:;.",']+|[-•:;.",']+$/g, '').trim();
      clean = clean.replace(/\s*\bv\d+\b/gi, '').trim();

      if (!clean || clean.endsWith('-') || (clean.length < 2 && clean.toUpperCase() !== 'C' && clean.toUpperCase() !== 'R')) {
        continue;
      }

      // Canonical corrections
      const lower = clean.toLowerCase();
      if (lower === 'sockets' || lower === 'websocket') clean = 'WebSockets';
      if (lower === 'rest apis') clean = 'REST API';
      if (lower === 'vector dbs') clean = 'Vector Database';

      const norm = normalizeSkillName(clean);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        result.push(clean);
      }
    }
  }

  return result;
}

/**
 * Finds the Workday Skills search input element across various layout variants
 */
export function findWorkdaySkillsInput() {
  // 1. Specific automation IDs & placeholders
  const directInput = document.querySelector([
    'input[data-automation-id="skillsSearchBox"]',
    'div[data-automation-id*="formField-skills"] input',
    'div[data-automation-id*="skills"] input',
    'input[placeholder*="Skills" i]',
    'input[placeholder*="Type to Add Skills" i]',
    'input[aria-label*="Skills" i]',
    'input[aria-label*="Type to Add Skills" i]'
  ].join(', '));
  if (directInput) return directInput;

  // 2. Container wrappers
  const skillsContainer = document.querySelector([
    'div[data-automation-id="formField-skills"]',
    'div[data-automation-id*="skillsSection"]',
    'div[data-automation-id*="Skills"]',
    'div[role="group"][aria-labelledby*="skills" i]'
  ].join(', '));
  if (skillsContainer) {
    const input = skillsContainer.querySelector('input');
    if (input) return input;
  }

  // 3. Find by label text "Skills"
  const labels = Array.from(document.querySelectorAll('label'));
  for (const label of labels) {
    const text = label.textContent.trim().toLowerCase();
    if (text.includes('skills') || text.includes('type to add skills')) {
      const forId = label.getAttribute('for');
      if (forId) {
        const el = document.getElementById(forId);
        if (el && el.tagName === 'INPUT') return el;
      }
      const parent = label.closest('div[data-automation-id]') || label.parentElement;
      const input = parent?.querySelector('input');
      if (input) return input;
    }
  }

  // 4. Fallback searchBox in Step 2
  const fallback = document.querySelector('input[data-automation-id="searchBox"]');
  if (fallback) return fallback;

  return null;
}

/**
 * Parses currently visible options in the Workday Skills dropdown/activeListContainer
 */
export function getVisibleSkillOptions() {
  const optionNodes = Array.from(document.querySelectorAll(
    'div[data-automation-id="menuItem"], [role="listbox"] [role="option"], [role="listbox"] li, div[data-automation-id*="promptOption"], [data-uxi-widget-type="multiselectlistitem"]'
  )).filter(el => {
    if (typeof el.getBoundingClientRect !== 'function') return true;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return !el.style?.display?.includes('none');
    }
    return rect.width > 0 && rect.height > 0;
  });

  const parsedOptions = [];
  const seenLabels = new Set();

  for (const node of optionNodes) {
    const itemEl = node.closest('[data-automation-id="menuItem"]') || node.closest('[role="option"]') || node;
    const labelEl = itemEl.querySelector('[data-automation-id="promptOption"], [data-automation-label]') || itemEl;
    const labelText = labelEl.getAttribute('data-automation-label') || labelEl.textContent.trim();
    
    if (!labelText || seenLabels.has(labelText.toLowerCase())) continue;
    seenLabels.add(labelText.toLowerCase());

    const checkboxInput = itemEl.querySelector('input[type="checkbox"][data-automation-id="checkboxPanel"], input[type="checkbox"]');
    const checkboxContainer = itemEl.querySelector('[data-automation-id="checkbox"]');
    const leafNode = itemEl.querySelector('[data-automation-id="promptLeafNode"]');

    const isChecked = (
      checkboxInput?.checked === true ||
      checkboxInput?.getAttribute('aria-checked') === 'true' ||
      checkboxContainer?.getAttribute('data-automationcheckboxchecked') === 'true' ||
      leafNode?.getAttribute('data-automation-checked') === 'Checked' ||
      leafNode?.getAttribute('data-uxi-multiselectlistitem-isselected') === 'true' ||
      (itemEl.getAttribute('aria-label')?.includes('checked') && !itemEl.getAttribute('aria-label')?.includes('not checked'))
    );

    parsedOptions.push({
      itemEl,
      labelEl,
      checkboxInput,
      checkboxContainer,
      labelText,
      isChecked
    });
  }

  return parsedOptions;
}

/**
 * Checks whether a skill option is already checked/selected in Workday DOM
 */
export function isOptionChecked(option) {
  if (!option) return false;
  const { itemEl, checkboxInput, checkboxContainer } = option;

  const leafNode = itemEl?.querySelector?.('[data-automation-id="promptLeafNode"]');
  const ariaLabel = (itemEl?.getAttribute?.('aria-label') || '').toLowerCase();
  const isAriaChecked = ariaLabel.includes('checked') && !ariaLabel.includes('not checked');

  const hasCheckedSvgOrClass = Boolean(
    checkboxContainer?.querySelector?.('svg[data-icon="check"], svg[data-icon="checkmark"], svg[class*="checked" i], [class*="checked" i]') ||
    itemEl?.querySelector?.('[data-automation-id="checkbox"][class*="checked" i], [role="checkbox"][aria-checked="true"], [aria-checked="true"]')
  );

  return Boolean(
    checkboxInput?.checked === true ||
    checkboxInput?.getAttribute?.('aria-checked') === 'true' ||
    checkboxContainer?.getAttribute?.('data-automationcheckboxchecked') === 'true' ||
    checkboxContainer?.getAttribute?.('aria-checked') === 'true' ||
    leafNode?.getAttribute?.('data-automation-checked')?.toLowerCase() === 'checked' ||
    leafNode?.getAttribute?.('data-uxi-multiselectlistitem-isselected') === 'true' ||
    itemEl?.getAttribute?.('aria-selected') === 'true' ||
    itemEl?.getAttribute?.('aria-checked') === 'true' ||
    isAriaChecked ||
    hasCheckedSvgOrClass
  );
}

/**
 * Checks if a skill tag chip is already present in the multiselect container or document
 */
export function isSkillChipPresent(skillName, matchedOptionText = null) {
  const chips = Array.from(document.querySelectorAll(
    '[data-automation-id*="selectedItem"], [data-automation-id*="composite-tag"], [data-automation-id*="multiSelectChip"], [data-automation-id*="tag"], [data-uxi-multiselect-item]'
  ));
  return chips.some(chip => {
    const text = chip.textContent.trim();
    return isSkillMatch(skillName, text) || (matchedOptionText && isSkillMatch(matchedOptionText, text));
  });
}

/**
 * Simulates clean single-click interaction on a skill option/checkbox
 * STRICT: NEVER clicks if the option is already checked!
 */
export function clickSkillOption(option) {
  if (isOptionChecked(option)) {
    console.log(`[Skills] Option "${option.labelText}" is already checked. Skipping click.`);
    return false;
  }

  const target = option.checkboxContainer || option.checkboxInput || option.labelEl || option.itemEl;
  if (!target) return false;

  target.scrollIntoView?.({ block: 'nearest' });
  target.click();
  return true;
}

/**
 * Verifies that a skill is actually selected/added in Workday DOM
 */
export function verifySkillSelected(skillName, matchedOptionText, container) {
  // Check 1: Checkbox state in options
  const options = getVisibleSkillOptions();
  const opt = options.find(o => isSkillMatch(skillName, o.labelText) || (matchedOptionText && isSkillMatch(matchedOptionText, o.labelText)));
  if (opt && isOptionChecked(opt)) {
    return true;
  }

  // Check 2: Tag chip created anywhere in the DOM
  return isSkillChipPresent(skillName, matchedOptionText);
}

/**
 * Clears search input using Backspace key as requested:
 * "then that seached skill enter backspace and search for new skill and hit enter"
 */
export async function clearInputWithBackspace(inputElement, container) {
  if (!inputElement) return;

  inputElement.focus();
  inputElement.click();
  await new Promise(r => setTimeout(r, 60));

  const val = inputElement.value || '';
  if (val.length > 0) {
    try {
      inputElement.setSelectionRange(0, val.length);
    } catch {}
    inputElement.select?.();

    inputElement.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Backspace',
      code: 'Backspace',
      keyCode: 8,
      which: 8,
      bubbles: true,
      cancelable: true
    }));

    setNativeInputValue(inputElement, '');
    inputElement.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'deleteContentBackward'
    }));

    inputElement.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Backspace',
      code: 'Backspace',
      keyCode: 8,
      which: 8,
      bubbles: true,
      cancelable: true
    }));

    await new Promise(r => setTimeout(r, 120));
  }

  // Also click clear button in Workday search container if present
  const clearBtn = container?.querySelector('button[aria-label*="clear" i], button[data-automation-id*="clear"], [data-automation-id*="searchBoxClear"]');
  if (clearBtn) {
    clearBtn.click();
    await new Promise(r => setTimeout(r, 100));
  }
}

/**
 * Reusable Workday Skills Autofill Handler
 * Processes candidate skills ONE BY ONE sequentially:
 * 1. Takes first skill (clean/sanitized)
 * 2. Focuses search input and clears with Backspace
 * 3. Types skill name
 * 4. Hits Enter on keyboard to execute Workday search query
 * 5. Waits dynamically for search results
 * 6. Finds matching option in dropdown and verifies checkbox state
 * 7. Clicks checkbox ONLY if not already checked (never unchecks!)
 * 8. Clears search input with Backspace before searching next skill
 *
 * Returns complete structured report:
 * { total, selected, notFound, failed, results }
 */
export async function fillWorkdaySkills(skills, searchInputElement = null) {
  const skillsArray = cleanAndSanitizeSkills(skills);

  const report = {
    total: skillsArray.length,
    selected: 0,
    notFound: 0,
    failed: 0,
    results: []
  };

  if (skillsArray.length === 0) {
    return report;
  }

  const searchInput = searchInputElement || findWorkdaySkillsInput();
  if (!searchInput) {
    console.warn('[Skills] Could not find Workday Skills search input element');
    return report;
  }

  const container = searchInput.closest('[data-automation-id*="formField"], [data-automation-id*="skills"], div') || document.body;

  // Process skills ONE BY ONE sequentially
  for (const skill of skillsArray) {
    console.log(`[Skills] Starting skill: ${skill}`);

    // Step 1: Open / focus skills input
    searchInput.focus();
    searchInput.click();
    await new Promise(r => setTimeout(r, 120));

    // Step 2: Clear search field with Backspace
    await clearInputWithBackspace(searchInput, container);

    // Step 3: Type ONLY the current single skill
    setNativeInputValue(searchInput, skill);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: skill, inputType: 'insertText' }));
    await new Promise(r => setTimeout(r, 150));

    // Step 4: Hit ENTER on keyboard to execute search in Workday
    console.log(`[Skills] Searching: ${skill} (Pressing Enter)`);
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));

    // Step 5: Wait dynamically for search results
    await new Promise(r => setTimeout(r, 350));

    let options = [];
    let matchedOption = null;
    const pollStart = Date.now();

    while (Date.now() - pollStart < 2500) {
      options = getVisibleSkillOptions();
      matchedOption = options.find(o => o.labelText.trim().toLowerCase() === skill.toLowerCase())
                   || options.find(o => isSkillMatch(skill, o.labelText));
      if (matchedOption) {
        break;
      }
      if (options.length > 0 && Date.now() - pollStart > 1000) {
        break;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`[Skills] Results found: ${options.length}`);

    if (!matchedOption) {
      console.log(`[Skills] Skill not found: ${skill}`);
      report.notFound++;
      report.results.push({
        skill,
        status: 'not_found'
      });
      await clearInputWithBackspace(searchInput, container);
      await new Promise(r => setTimeout(r, 150));
      continue;
    }

    console.log(`[Skills] Matching option: ${matchedOption.labelText}`);

    // Check if the option is ALREADY checked or already added as a tag chip
    const isAlreadyChecked = isOptionChecked(matchedOption);
    const isAlreadyChip = isSkillChipPresent(skill, matchedOption.labelText);

    if (isAlreadyChecked || isAlreadyChip) {
      console.log(`[Skills] ${matchedOption.labelText} is ALREADY checked/selected. Keeping it selected.`);
      report.selected++;
      report.results.push({
        skill,
        status: 'selected',
        matchedOption: matchedOption.labelText
      });
      await clearInputWithBackspace(searchInput, container);
      await new Promise(r => setTimeout(r, 200));
      continue;
    }

    // Step 6: Select the matched option (click checkbox ONCE)
    console.log(`[Skills] Selecting: ${matchedOption.labelText} (Clicking Checkbox)`);
    clickSkillOption(matchedOption);
    await new Promise(r => setTimeout(r, 450));

    // Step 7: Verification in UI
    const isVerified = verifySkillSelected(skill, matchedOption.labelText, container);
    if (isVerified) {
      console.log(`[Skills] Verification: SUCCESS - ${matchedOption.labelText} is checked and added`);
    } else {
      console.log(`[Skills] Selected: ${matchedOption.labelText}`);
    }

    report.selected++;
    report.results.push({
      skill,
      status: 'selected',
      matchedOption: matchedOption.labelText
    });

    // Step 8: Clear with Backspace before next skill
    await clearInputWithBackspace(searchInput, container);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[Skills] Automation complete. Total: ${report.total}, Selected: ${report.selected}, NotFound: ${report.notFound}, Failed: ${report.failed}`);
  return report;
}

/**
 * Backward-compatible wrapper for handleWorkdaySkillsField
 */
export async function handleWorkdaySkillsField(element, skillsList) {
  try {
    const report = await fillWorkdaySkills(skillsList, element);
    return report.selected > 0;
  } catch (err) {
    console.error('Skills fill error:', err);
    return false;
  }
}
