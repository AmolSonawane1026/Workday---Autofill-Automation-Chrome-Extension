/**
 * Workday DOM Field Extractor
 * Identifies form fields, labels, types, options, and data-automation-id attributes
 */

export function extractFormFields(container = document) {
  const fields = [];
  let fieldCounter = 0;
  const processedElements = new Set();

  // 1. Workday Multi-Select / Searchable Prompt Containers (e.g. Source, Country Phone Code, Skills)
  const multiSelectContainers = container.querySelectorAll(
    'div[data-uxi-widget-type="multiselect"], div[data-automation-id="multiSelectContainer"], div[data-automation-id*="multiSelect"], div[data-automation-id*="formField-source"], div[data-automation-id*="formField-countryPhoneCode"], div[data-automation-id*="formField-skills"]'
  );

  multiSelectContainers.forEach(msContainer => {
    if (processedElements.has(msContainer)) return;
    processedElements.add(msContainer);

    const input = msContainer.querySelector('input[data-automation-id="searchBox"], input[enterkeyhint="search"], input') || msContainer;
    if (input !== msContainer) {
      processedElements.add(input);
    }

    const label = findLabelForElement(input !== msContainer ? input : msContainer);
    const parentField = msContainer.closest('[data-automation-id*="formField-"]');
    const automationId = parentField?.getAttribute('data-automation-id') || input.getAttribute('data-automation-id') || input.id || input.name || 'multiselect';
    const isRequired = input.required || input.getAttribute('aria-required') === 'true' || msContainer.getAttribute('aria-required') === 'true' || label.includes('*');

    // Extract current value from selected pill / chip if present
    let currentValue = '';
    const selectedItem = msContainer.querySelector(
      '[data-automation-id="selectedItem"], [data-automation-id="promptOption"], [data-automation-id="composite-tag"], [aria-label*="Remove"], [data-automation-id="tag"]'
    );
    if (selectedItem && selectedItem.textContent.trim()) {
      currentValue = selectedItem.textContent.trim().replace(/^[✕x×]\s*/, '').replace(/,\s*press delete to clear value\.?/i, '');
    } else if (input.value) {
      currentValue = input.value.trim();
    }

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: input.id || msContainer.id || '',
      name: input.name || msContainer.getAttribute('name') || '',
      type: 'multiselect',
      label: cleanLabel(label),
      automationId: automationId,
      required: isRequired,
      currentValue: currentValue,
      placeholder: input.placeholder || '',
      element: input !== msContainer ? input : msContainer,
      container: msContainer
    });
  });

  // 2. Split Month/Year Date Inputs (from reference apply.js: dateSectionMonth-input / dateSectionYear-input)
  const splitDateInputs = container.querySelectorAll(
    'input[data-automation-id="dateSectionMonth-input"], input[data-automation-id="dateSectionYear-input"]'
  );
  splitDateInputs.forEach(input => {
    if (processedElements.has(input)) return;
    processedElements.add(input);

    const autoId = input.getAttribute('data-automation-id') || '';
    const isMonth = autoId.includes('Month');
    const parentField = input.closest('[data-automation-id*="formField-"]');
    const parentAutoId = parentField?.getAttribute('data-automation-id') || '';
    
    let fieldPrefix = '';
    if (parentAutoId.includes('startDate')) fieldPrefix = 'Start Date ';
    else if (parentAutoId.includes('endDate')) fieldPrefix = 'End Date ';
    else if (parentAutoId.includes('firstYear')) fieldPrefix = 'First Year Attended ';
    else if (parentAutoId.includes('lastYear')) fieldPrefix = 'Last Year Attended ';

    const label = fieldPrefix ? `${fieldPrefix}${isMonth ? 'Month' : 'Year'}` : (isMonth ? 'Month' : 'Year');
    const automationId = parentAutoId ? `${parentAutoId}-${autoId}` : autoId;

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: input.id || '',
      name: input.name || '',
      type: 'text',
      label: cleanLabel(label),
      automationId: automationId,
      required: input.required || false,
      currentValue: input.value || '',
      element: input
    });
  });

  // 3. Text Inputs and Textareas (excluding already processed multiselect & date inputs)
  const textInputs = container.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea, input[role="combobox"]'
  );

  textInputs.forEach(input => {
    if (input.type === 'password' || input.type === 'hidden') return;
    if (processedElements.has(input)) return;
    if (input.closest('div[data-uxi-widget-type="multiselect"], div[data-automation-id="multiSelectContainer"]')) return;
    if (input.parentElement && input.parentElement.querySelector('button[aria-haspopup], button[role="combobox"], [data-automation-id*="select"]')) return;
    processedElements.add(input);

    const label = findLabelForElement(input);
    const automationId = input.getAttribute('data-automation-id') || input.id || input.name || '';
    const isRequired = input.required || input.getAttribute('aria-required') === 'true' || label.includes('*');

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: input.id || '',
      name: input.name || '',
      type: input.tagName.toLowerCase() === 'textarea' ? 'textarea' : (input.type || 'text'),
      label: cleanLabel(label),
      automationId: automationId,
      required: isRequired,
      currentValue: input.value || '',
      placeholder: input.placeholder || '',
      element: input
    });
  });

  // 4. Custom Workday Selects / Buttons / Dropdowns (e.g. Gender, Race, Country, Phone Device Type, Degree)
  const customSelects = container.querySelectorAll(
    'div[data-automation-id*="select"], div[data-automation-id*="dropdown"], button[aria-haspopup="listbox"], button[aria-haspopup="true"], button[aria-haspopup], button[role="combobox"], div[role="combobox"], div[role="button"][aria-haspopup], [data-automation-id*="select-container"], select, [data-automation-id*="formField-"] button, [data-automation-id*="question"] button, [data-automation-id*="formField"] button, button[data-automation-id*="prompt"], button[data-automation-id*="select"], button[data-automation-id*="dropdown"], div[data-uxi-widget-type="select"], [role="group"] button, fieldset button'
  );

  customSelects.forEach(selectElem => {
    if (processedElements.has(selectElem)) return;
    if (selectElem.tagName.toLowerCase() === 'input') return; // already handled
    if (selectElem.closest('div[data-uxi-widget-type="multiselect"], div[data-automation-id="multiSelectContainer"]')) return;

    const autoIdRaw = (selectElem.getAttribute('data-automation-id') || '').toLowerCase();
    const ariaLbl = (selectElem.getAttribute('aria-label') || '').toLowerCase();
    const btnText = selectElem.textContent.toLowerCase().trim();

    // Skip navigation and utility action buttons (Save and Continue, Back, Next, Submit, Kebab menu, Delete, Upload)
    if (
      autoIdRaw === 'utilitymenubutton' || autoIdRaw.includes('utilitymenu') ||
      autoIdRaw.includes('delete') || ariaLbl.includes('delete') || ariaLbl.includes('remove') ||
      btnText === 'save and continue' || btnText === 'save & continue' || btnText === 'back' ||
      btnText === 'next' || btnText === 'submit' || btnText === 'cancel' || btnText === 'sign in' ||
      btnText === 'apply' || btnText.startsWith('delete') || btnText.startsWith('remove') ||
      btnText.includes('upload a file') || btnText === 'add' || btnText.startsWith('add ')
    ) {
      return;
    }
    if (selectElem.closest('[data-automation-id*="file-upload"], [data-automation-id*="fileUpload"], [data-automation-id*="attachments"]')) {
      return;
    }

    processedElements.add(selectElem);

    const label = findLabelForElement(selectElem);
    const parentField = selectElem.closest('[data-automation-id*="formField-"], [data-automation-id*="formField"], [data-automation-id*="question"], [role="group"]');
    const automationId = parentField?.getAttribute('data-automation-id') || selectElem.getAttribute('data-automation-id') || selectElem.id || selectElem.getAttribute('name') || '';
    const isRequired = selectElem.getAttribute('aria-required') === 'true' || selectElem.getAttribute('required') !== null || label.includes('*');

    let options = [];
    let currentValue = '';

    if (selectElem.tagName.toLowerCase() === 'select') {
      options = Array.from(selectElem.options).map(o => o.text.trim()).filter(Boolean);
      currentValue = selectElem.options[selectElem.selectedIndex]?.text?.trim() || '';
    } else {
      // Check for Workday selected chip / tag (e.g. [✕ Google Advertisement])
      const parentContainer = selectElem.closest('[data-automation-id*="formField"], div') || selectElem;
      const selectedItem = parentContainer.querySelector(
        '[data-automation-id*="selectedItem"], [data-automation-id*="promptOption"], [data-automation-id*="composite-tag"], [aria-label*="Remove"], button[aria-label*="delete"], [data-automation-id*="tag"]'
      );

      if (selectedItem && selectedItem.textContent.trim()) {
        currentValue = selectedItem.textContent.trim().replace(/^[✕x×]\s*/, '').replace(/,\s*press delete to clear value\.?/i, '');
      } else {
        const rawText = selectElem.textContent.trim();
        const cleanedLbl = cleanLabel(label).toLowerCase();
        const placeholders = [
          'select one', 'select', 'search', 'choose one', 'choose', 'select option', 'prompt',
          'country phone code', 'phone code', 'country/region', 'country / region',
          'state', 'province', 'state / province', 'country', 'device type', 'phone device type',
          'source', 'how did you hear about us', 'select a value', 'type to search'
        ];
        if (rawText && !placeholders.includes(rawText.toLowerCase()) && rawText.toLowerCase() !== cleanedLbl) {
          currentValue = rawText;
        }
      }
    }

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: selectElem.id || '',
      name: selectElem.getAttribute('name') || '',
      type: 'select',
      label: cleanLabel(label),
      automationId: automationId,
      required: isRequired,
      currentValue: currentValue,
      options: options,
      element: selectElem
    });
  });

  // 3. Radio Button Groups
  const radioButtons = container.querySelectorAll('input[type="radio"]');
  const processedRadioGroups = new Set();

  radioButtons.forEach(radio => {
    const groupName = radio.name || radio.getAttribute('data-automation-id') || 'unnamed_group';
    if (processedRadioGroups.has(groupName)) return;
    processedRadioGroups.add(groupName);

    const groupRadios = Array.from(container.querySelectorAll(`input[type="radio"][name="${radio.name}"]`));
    const groupOptions = groupRadios.map(r => {
      const radioLabel = findLabelForElement(r);
      return cleanLabel(radioLabel) || r.value;
    });

    const groupQuestionLabel = findGroupQuestionLabel(radio);

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: radio.id || '',
      name: radio.name || '',
      type: 'radio',
      label: cleanLabel(groupQuestionLabel) || cleanLabel(findLabelForElement(radio)),
      automationId: radio.getAttribute('data-automation-id') || '',
      required: radio.required || false,
      options: groupOptions.length > 0 ? groupOptions : ['Yes', 'No'],
      currentValue: groupRadios.find(r => r.checked)?.value || '',
      groupElements: groupRadios,
      element: radio
    });
  });

  // 4. Checkboxes
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (processedElements.has(cb)) return;
    processedElements.add(cb);

    const label = findLabelForElement(cb);
    const automationId = cb.getAttribute('data-automation-id') || cb.id || '';

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: cb.id || '',
      name: cb.name || '',
      type: 'checkbox',
      label: cleanLabel(label),
      automationId: automationId,
      required: cb.required || false,
      currentValue: cb.checked,
      element: cb
    });
  });

  // 6. Website Panel Set containers (from reference apply.js: websitePanelSet-N)
  const websitePanels = container.querySelectorAll('div[data-automation-id^="websitePanelSet-"] input');
  websitePanels.forEach(input => {
    if (processedElements.has(input)) return;
    processedElements.add(input);

    const panelContainer = input.closest('div[data-automation-id^="websitePanelSet-"]');
    const panelAutoId = panelContainer?.getAttribute('data-automation-id') || '';
    const label = findLabelForElement(input) || `Website URL (${panelAutoId})`;

    fields.push({
      id: `field_${++fieldCounter}`,
      domId: input.id || '',
      name: input.name || '',
      type: 'text',
      label: cleanLabel(label),
      automationId: panelAutoId,
      required: false,
      currentValue: input.value || '',
      element: input
    });
  });

  return fields;
}

/**
 * Locate descriptive label text for a given DOM element
 */
function findLabelForElement(element) {
  // 1. Explicit label with for="id"
  if (element.id) {
    const labelElem = document.querySelector(`label[for="${element.id}"]`);
    if (labelElem && labelElem.textContent.trim()) {
      return labelElem.textContent.trim();
    }
  }

  // 2. aria-labelledby
  if (element.getAttribute('aria-labelledby')) {
    const ids = element.getAttribute('aria-labelledby').split(/\s+/);
    const texts = ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if (texts.length > 0) return texts.join(' ');
  }

  // 3. aria-label (skip generic placeholders / utility words)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && !['prompt', 'delete', 'remove', 'clear', 'search', 'select one', 'select', 'choose one', 'options'].includes(ariaLabel.toLowerCase().trim())) {
    return ariaLabel.trim();
  }

  // 4. Preceding sibling in DOM (e.g. <label>, <h4>, <h3>, <p>)
  let prev = element.previousElementSibling;
  while (prev) {
    const tag = prev.tagName.toLowerCase();
    if (['label', 'h3', 'h4', 'h5', 'legend', 'p', 'span', 'div'].includes(tag)) {
      const txt = prev.textContent.trim();
      if (txt && txt.length < 150 && !txt.toLowerCase().includes('select one')) {
        return txt;
      }
    }
    prev = prev.previousElementSibling;
  }

  // 5. Parent's preceding sibling (Workday 2-column flex/grid row pattern)
  let parent = element.parentElement;
  if (parent) {
    let pPrev = parent.previousElementSibling;
    while (pPrev) {
      const tag = pPrev.tagName.toLowerCase();
      if (['label', 'h3', 'h4', 'h5', 'legend', 'p', 'span', 'div'].includes(tag)) {
        const txt = pPrev.textContent.trim();
        if (txt && txt.length < 150 && !txt.toLowerCase().includes('select one')) {
          return txt;
        }
      }
      pPrev = pPrev.previousElementSibling;
    }
  }

  // 6. Closest Workday formField / group wrapper
  const parentContainer = element.closest('[data-automation-id*="formField"], [data-automation-id*="formLabel"], [data-automation-id*="field"], [data-automation-id*="question"], .form-group, fieldset, [data-fkit-id], [role="group"]');
  if (parentContainer) {
    const wdLabel = parentContainer.querySelector('[data-automation-id*="formLabel"], [data-automation-id*="promptLabel"], label, legend');
    if (wdLabel && wdLabel.textContent.trim()) {
      return wdLabel.textContent.trim();
    }
  }

  // 7. Scoped walk up parent hierarchy (up to 4 levels) looking for immediate label/heading
  let curr = element.parentElement;
  for (let i = 0; i < 4 && curr; i++) {
    const directLabel = curr.querySelector(':scope > label, :scope > legend, :scope > h3, :scope > h4, :scope > [data-automation-id*="formLabel"]');
    if (directLabel && directLabel.textContent.trim()) {
      return directLabel.textContent.trim();
    }
    curr = curr.parentElement;
  }

  return element.getAttribute('placeholder') || element.getAttribute('data-automation-id') || element.name || 'Application Field';
}

function findGroupQuestionLabel(element) {
  // 1. Check aria-labelledby on radio group container
  const groupContainer = element.closest('[aria-labelledby], fieldset, [role="radiogroup"], [data-automation-id*="formField-"], [data-fkit-id]');
  if (groupContainer) {
    const labelledById = groupContainer.getAttribute('aria-labelledby');
    if (labelledById) {
      const labelElem = document.getElementById(labelledById);
      if (labelElem && labelElem.textContent.trim()) {
        return labelElem.textContent.trim();
      }
    }
  }

  // 2. Check fieldset legend or group heading
  const fieldset = element.closest('fieldset, [role="radiogroup"], [data-automation-id*="formField-"]');
  if (fieldset) {
    const legend = fieldset.querySelector('legend, [data-automation-id*="formLabel"], h3, h4, p, [data-automation-id*="promptLabel"]');
    if (legend && legend.textContent.trim()) {
      return legend.textContent.trim();
    }
  }

  // 3. Check parent section wrapper
  const section = element.closest('[role="group"], [data-fkit-id], div.css-gvoll6, div.css-1obf64m');
  if (section) {
    const heading = section.querySelector('legend, label:not([for]), h3, h4, [data-automation-id*="formLabel"]');
    if (heading && heading.textContent.trim()) {
      return heading.textContent.trim();
    }
  }

  return '';
}

function cleanLabel(label) {
  if (!label) return '';
  return label
    .replace(/\s*\*\s*$/, '')
    .replace(/\s*\(optional\)\s*$/i, '')
    .replace(/\s*\(required\)\s*$/i, '')
    .trim();
}
