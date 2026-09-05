/**
 * Workday High-Accuracy DOM Form Filler (Coordinator)
 *
 * Orchestrates form field injection with React native prototype setters, custom combobox handling,
 * phone formatting, skills multiselect tag creation, dynamic section expansion,
 * and automated Resume PDF attachment without provoking browser file chooser dialogs.
 *
 * Decomposed into domain-focused submodules:
 * - ./filler/dom-utils.js: Native prototype setters, React synthetic event dispatchers, field detection
 * - ./filler/select-handler.js: Custom dropdowns, popups, and multiselect containers
 * - ./filler/skills-filler.js: Sequential itemized skills search & checkbox selection
 * - ./filler/sections-filler.js: Work experience, education, resume upload, and disclosures
 */

import {
  setNativeInputValue,
  dispatchChangeEvents,
  cleanPhoneNumber,
  isFieldAlreadyFilled,
  highlightField,
  findElementByMapping,
  formatDateForWorkday,
  handleRadioField
} from './filler/dom-utils.js';

import {
  handleWorkdayCustomSelect,
  handleWorkdayMultiSelect
} from './filler/select-handler.js';

import {
  fillWorkdayDegreeDropdown
} from './filler/sections-filler.js';

// Re-export all submodules for complete backward compatibility and unit test access
export * from './filler/dom-utils.js';
export * from './filler/select-handler.js';
export * from './filler/skills-filler.js';
export * from './filler/sections-filler.js';

/**
 * Iterates over extracted form field mappings and fills them sequentially.
 * Sorts country fields first to allow dependent region/state dropdowns to populate properly.
 */
export async function fillFormFields(mappings, options = {}) {
  const skipPrefilled = options.skipPrefilled !== false;
  let filledCount = 0;
  let skippedCount = 0;
  const errors = [];

  // Sort mappings so country dropdown changes happen first before dependent fields (State/Zip/Region)
  const sortedMappings = [...mappings].sort((a, b) => {
    const aAutoId = (a.automationId || '').toLowerCase();
    const bAutoId = (b.automationId || '').toLowerCase();
    const aIsCountry = aAutoId.includes('country') && !aAutoId.includes('phone') && !aAutoId.includes('code');
    const bIsCountry = bAutoId.includes('country') && !bAutoId.includes('phone') && !bAutoId.includes('code');
    if (aIsCountry && !bIsCountry) return -1;
    if (!aIsCountry && bIsCountry) return 1;
    return 0;
  });

  // Process field mappings sequentially
  for (const mapping of sortedMappings) {
    try {
      if (mapping.value === undefined || mapping.value === null) {
        skippedCount++;
        continue;
      }

      const autoId = (mapping.automationId || '').toLowerCase();
      const label = (mapping.label || '').toLowerCase();

      // Only skip source if no value provided
      if ((autoId.includes('source') || label.includes('how did you hear')) && !mapping.value) {
        skippedCount++;
        continue;
      }

      // Do not fill phone extension unless explicitly set
      if ((autoId.includes('extension') || label.includes('extension')) && !mapping.value) {
        continue;
      }

      let element = mapping.element;
      if (!element || !document.contains(element)) {
        element = findElementByMapping(mapping);
      }

      if (!element) {
        skippedCount++;
        continue;
      }

      if (skipPrefilled && isFieldAlreadyFilled(element, mapping.type, mapping)) {
        skippedCount++;
        continue;
      }

      const success = await fillSingleField(element, mapping.value, mapping.type, mapping);
      if (success) {
        filledCount++;
        highlightField(element);
      } else {
        skippedCount++;
      }

      // Small throttle between fields so React synthetic state updates settle cleanly
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error filling field ${mapping.label}:`, err);
      errors.push(`${mapping.label}: ${err.message}`);
    }
  }

  return { filledCount, skippedCount, errors };
}

/**
 * Inspects field type/attributes and dispatches the appropriate automation handler.
 */
export async function fillSingleField(element, value, type, mapping = {}) {
  const t = (type || element.type || element.tagName).toLowerCase();
  const autoId = (mapping.automationId || element.getAttribute('data-automation-id') || element.id || '').toLowerCase();
  const label = (mapping.label || '').toLowerCase();

  // 1. Phone Extension - Leave empty unless specified
  if (autoId.includes('extension') || label.includes('extension')) {
    return true;
  }

  // 2. Phone Number (digits only)
  if (autoId.includes('phone') && !autoId.includes('device') && !autoId.includes('code') && !autoId.includes('extension') && !label.includes('device') && !label.includes('code') && t !== 'select' && t !== 'multiselect') {
    const cleanNum = cleanPhoneNumber(String(value));
    setNativeInputValue(element, cleanNum);
    return true;
  }

  // 3. Workday Skills multiselect (Handled specifically in Step 2 via fillWorkdaySkills)
  if (autoId.includes('skill') || label.includes('skill')) {
    console.log('[Autofill] Skipping skills field in single field sweep.');
    return false;
  }

  // 4. Workday Multi-Select / Searchable Comboboxes (Source, Country Phone Code, etc.)
  if (t === 'multiselect' || autoId.includes('source') || autoId.includes('countryphonecode') || autoId.includes('phonecode') || label.includes('how did you hear') || label.includes('country phone code') || (element.closest && element.closest('div[data-uxi-widget-type="multiselect"], div[data-automation-id="multiSelectContainer"]'))) {
    return await handleWorkdayMultiSelect(element, String(value));
  }

  // 5. Degree dropdown
  if (autoId.includes('degree') || label.includes('degree')) {
    const parentContainer = element.closest('[data-automation-id*="education"], [data-automation-id*="formField-degree"], div') || document;
    return await fillWorkdayDegreeDropdown(parentContainer, String(value));
  }

  // 6. School / University with Workday autocomplete confirmation
  if (autoId.includes('school') || label.includes('school') || label.includes('university') || autoId.includes('institution')) {
    setNativeInputValue(element, String(value));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return true;
  }

  // 7. Field of Study
  if (autoId.includes('fieldofstudy') || autoId.includes('field-of-study') || label.includes('field of study') || label.includes('major')) {
    setNativeInputValue(element, String(value));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    return true;
  }

  // 8. Split Month/Year inputs
  if (autoId.includes('datesectionmonth') || label.endsWith('month') || label === 'month') {
    const monthNum = String(value).padStart(2, '0');
    setNativeInputValue(element, monthNum);
    return true;
  }
  if (autoId.includes('datesectionyear') || label.endsWith('year') || label === 'year') {
    setNativeInputValue(element, String(value));
    return true;
  }

  // 9. Radio Buttons (e.g. Previous employee, Work Authorization, 18+ age)
  if (t === 'radio' || autoId.includes('radio') || element.type === 'radio' || element.getAttribute('role') === 'radio') {
    return handleRadioField(element, value, mapping);
  }

  // 10. Custom Workday Select / Prompt Combobox / Dropdowns (e.g. Country, Phone Device Type)
  if (t === 'select' || autoId.includes('select') || autoId.includes('prompt') || autoId.includes('dropdown') || element.getAttribute('role') === 'combobox' || element.tagName?.toLowerCase() === 'button' || element.getAttribute?.('aria-haspopup') === 'listbox') {
    if (element.tagName?.toLowerCase() === 'select') {
      const stringVal = String(value).toLowerCase();
      let matchedOpt = Array.from(element.options).find(o => 
        o.text.toLowerCase().includes(stringVal) || o.value.toLowerCase().includes(stringVal)
      );
      if (matchedOpt) {
        element.value = matchedOpt.value;
        dispatchChangeEvents(element);
        return true;
      }
    } else {
      return await handleWorkdayCustomSelect(element, String(value));
    }
  }

  // 11. Checkbox (e.g. Terms & Conditions, Acknowledgment, Currently Work Here)
  if (t === 'checkbox' || element.type === 'checkbox' || element.getAttribute('role') === 'checkbox') {
    const shouldCheck = Boolean(value) && value !== 'false' && value !== '0';
    if (element.checked !== shouldCheck) {
      element.checked = shouldCheck;
      element.click();
      dispatchChangeEvents(element);
    }
    return true;
  }

  // 12. Date Inputs
  if (t === 'date' || autoId.includes('date') || label.includes('date')) {
    setNativeInputValue(element, formatDateForWorkday(value));
    return true;
  }

  // 13. Standard Text, Email, Tel, Textarea
  if (t === 'text' || t === 'email' || t === 'tel' || t === 'number' || t === 'password' || t === 'textarea' || element.tagName?.toLowerCase() === 'textarea' || element.tagName?.toLowerCase() === 'input') {
    setNativeInputValue(element, Array.isArray(value) ? value.join(', ') : String(value));
    return true;
  }

  return false;
}
