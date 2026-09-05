/**
 * Low-level DOM utilities and React synthetic event adapters for Workday form automation.
 */

/**
 * Sets an input or textarea value using the native HTML prototype descriptor setter
 * and dispatches all necessary React synthetic and native events (pointer, mouse, focus,
 * input, change, blur/focusout).
 */
export function setNativeInputValue(element, value) {
  if (!element) return;
  const strVal = String(value ?? '');

  element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });

  // 1. Full Pointer & Mouse events sequence to emulate real user click
  const rect = element.getBoundingClientRect?.() || { left: 0, top: 0, width: 20, height: 20 };
  const clickInit = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + 5,
    clientY: rect.top + 5,
    button: 0,
    buttons: 1
  };

  if (typeof PointerEvent !== 'undefined') {
    element.dispatchEvent(new PointerEvent('pointerdown', clickInit));
  }
  element.dispatchEvent(new MouseEvent('mousedown', clickInit));
  if (typeof PointerEvent !== 'undefined') {
    element.dispatchEvent(new PointerEvent('pointerup', { ...clickInit, buttons: 0 }));
  }
  element.dispatchEvent(new MouseEvent('mouseup', { ...clickInit, buttons: 0 }));
  element.dispatchEvent(new MouseEvent('click', { ...clickInit, buttons: 0 }));

  // 2. Focus events
  element.focus();
  if (typeof FocusEvent !== 'undefined') {
    element.dispatchEvent(new FocusEvent('focus', { bubbles: false, cancelable: true }));
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true, cancelable: true }));
  } else {
    element.dispatchEvent(new Event('focus', { bubbles: false }));
    element.dispatchEvent(new Event('focusin', { bubbles: true }));
  }

  // 3. Reset React internal value tracker
  const previousValue = element.value || '';
  const tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(previousValue === strVal ? (strVal ? '' : ' ') : previousValue);
  }

  // 4. Native prototype setter invocation
  const prototype = element.tagName.toLowerCase() === 'textarea' 
    ? window.HTMLTextAreaElement.prototype 
    : window.HTMLInputElement.prototype;

  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;

  if (valueSetter) {
    valueSetter.call(element, strVal);
  } else {
    element.value = strVal;
  }

  // 5. Dispatch keyboard events
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a' }));
  element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'a' }));

  // 6. Dispatch beforeinput and input events (React & Workday listen to these)
  if (typeof InputEvent !== 'undefined') {
    try {
      element.dispatchEvent(new InputEvent('beforeinput', { 
        bubbles: true, 
        cancelable: true, 
        data: strVal, 
        inputType: 'insertText' 
      }));
    } catch {}
    try {
      element.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        cancelable: true, 
        data: strVal, 
        inputType: 'insertText' 
      }));
    } catch {}
  }
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'a' }));

  // 7. Dispatch change event
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  // 8. Trigger blur & focusout (Workday validates required fields on blur)
  if (typeof FocusEvent !== 'undefined') {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new FocusEvent('blur', { bubbles: false, cancelable: true }));
  } else {
    element.dispatchEvent(new Event('focusout', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: false }));
  }
  element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  element.blur();
}

/**
 * Dispatches input, change, and blur events on custom inputs/checkboxes
 */
export function dispatchChangeEvents(element, value = '') {
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  if (typeof InputEvent !== 'undefined') {
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      cancelable: true, 
      data: value, 
      inputType: 'insertText' 
    }));
  }
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  if (typeof FocusEvent !== 'undefined') {
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new FocusEvent('blur', { bubbles: false, cancelable: true }));
  }
  element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
  element.blur();
}

/**
 * Normalizes phone numbers to digits only, stripping country dialing prefixes
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits || phone;
}

/**
 * Closes any open Workday popups / listboxes cleanly via Escape
 */
export function closeWorkdayPopup() {
  try {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));

    if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName?.toLowerCase() === 'input') {
      document.activeElement.blur();
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Simulates full mouse interaction on Workday option elements (pointerdown, mousedown, mouseup, click)
 */
export function simulateWorkdayOptionSelect(optionEl) {
  if (!optionEl) return false;
  optionEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  
  const evtOpts = { bubbles: true, cancelable: true, view: window };
  
  const checkbox = optionEl.querySelector?.('input[type="checkbox"]');
  if (checkbox && !checkbox.checked) {
    checkbox.checked = true;
    checkbox.click();
  }

  if (typeof PointerEvent !== 'undefined') {
    optionEl.dispatchEvent(new PointerEvent('pointerdown', evtOpts));
  }
  optionEl.dispatchEvent(new MouseEvent('mousedown', evtOpts));
  
  if (optionEl.firstElementChild) {
    optionEl.firstElementChild.dispatchEvent(new MouseEvent('mousedown', evtOpts));
  }

  if (typeof PointerEvent !== 'undefined') {
    optionEl.dispatchEvent(new PointerEvent('pointerup', evtOpts));
  }
  optionEl.dispatchEvent(new MouseEvent('mouseup', evtOpts));
  optionEl.click();
  return true;
}

/**
 * Checks if a Workday form field is already filled with a matching value
 */
export function isFieldAlreadyFilled(element, type, mapping = {}) {
  if (!element) return false;

  const targetVal = mapping.value !== undefined && mapping.value !== null ? String(mapping.value).trim().toLowerCase() : '';
  if (!targetVal) return false;

  // 1. Checkbox & Radio
  if (type === 'radio' || element.type === 'radio') {
    if (mapping.groupElements && mapping.groupElements.length > 0) {
      const checked = mapping.groupElements.find(r => r.checked);
      if (!checked) return false;
      const checkedVal = (checked.value || '').toLowerCase();
      return (targetVal === 'no' && (checkedVal === '0' || checkedVal === 'false')) ||
             (targetVal === 'yes' && (checkedVal === '1' || checkedVal === 'true')) ||
             checkedVal === targetVal;
    }
    return Boolean(element.checked);
  }

  if (type === 'checkbox' || element.type === 'checkbox') {
    const shouldCheck = Boolean(mapping.value) && mapping.value !== 'false' && mapping.value !== '0';
    return element.checked === shouldCheck;
  }

  // 2. Custom Workday Select / Prompt / MultiSelect / Button Dropdown
  const container = (element.closest && element.closest('[data-automation-id*="formField"], [data-automation-id*="prompt"], [role="combobox"], div.form-group')) || element;
  const selectedTag = container.querySelector?.(
    '[data-automation-id*="selectedItem"], [data-automation-id*="composite-tag"], [data-automation-id*="promptOption"], [data-automation-id*="selectedOption"]'
  );
  if (selectedTag && selectedTag.textContent.trim().length > 0) {
    const tagText = selectedTag.textContent.trim().toLowerCase();
    return tagText === targetVal || tagText.includes(targetVal) || targetVal.includes(tagText);
  }

  const buttonOrSelect = (container.querySelector && container.querySelector('button[aria-haspopup="listbox"], button, [role="combobox"], [data-automation-id*="select"]')) || element;
  if (buttonOrSelect && buttonOrSelect.tagName?.toLowerCase() === 'button') {
    const text = buttonOrSelect.textContent.trim().toLowerCase();
    return text === targetVal || text.includes(targetVal);
  }

  // 3. Standard text / email / tel / number / textarea with .value
  if (element.value !== undefined && element.value !== null && typeof element.value === 'string') {
    const val = element.value.trim().toLowerCase();
    return val === targetVal;
  }

  return false;
}

/**
 * Applies a visual outline/glow on successfully filled elements
 */
export function highlightField(element) {
  const container = element.closest?.('[data-automation-id*="formField"], .form-group') || element;
  if (!container || !container.style) return;
  container.style.transition = 'all 0.3s ease';
  container.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.4)';
  container.style.borderColor = '#2563eb';

  setTimeout(() => {
    if (container && container.style) {
      container.style.boxShadow = 'none';
    }
  }, 1500);
}

/**
 * Resolves a DOM element using mapping metadata (automationId, domId, name, labels, aria-labels)
 */
export function findElementByMapping(mapping) {
  if (mapping.automationId) {
    let el = document.querySelector(`[data-automation-id="${mapping.automationId}"]`);
    if (el) return el;
    el = document.querySelector(`[data-automation-id*="${mapping.automationId}"]`);
    if (el) return el;
  }
  if (mapping.domId) {
    const el = document.getElementById(mapping.domId);
    if (el) return el;
  }
  if (mapping.name) {
    const el = document.querySelector(`[name="${mapping.name}"]`);
    if (el) return el;
  }
  
  // Find by label text proximity
  if (mapping.label) {
    const cleanLbl = mapping.label.toLowerCase().trim().replace(/\*$/, '').trim();
    const allLabels = Array.from(document.querySelectorAll('label, [data-automation-id*="formLabel"], legend'));
    const matchedLabel = allLabels.find(l => {
      const t = l.textContent.toLowerCase().trim().replace(/\*$/, '').trim();
      return t === cleanLbl || t.includes(cleanLbl) || cleanLbl.includes(t);
    });
    if (matchedLabel) {
      const container = matchedLabel.closest('[data-automation-id*="formField"], [data-automation-id*="field"], fieldset, div') || matchedLabel.parentElement;
      if (container) {
        const inputOrBtn = container.querySelector('input:not([type="hidden"]), select, textarea, button[aria-haspopup="listbox"], button[data-automation-id*="prompt"], [role="combobox"], button');
        if (inputOrBtn) return inputOrBtn;
      }
    }
  }

  // Find by aria-label
  if (mapping.label) {
    const cleanLbl = mapping.label.toLowerCase().trim().replace(/\*$/, '').trim();
    const el = document.querySelector(`[aria-label*="${cleanLbl}" i]`);
    if (el) return el;
  }

  return null;
}

/**
 * Formats dates into standard Workday format (MM/DD/YYYY or MM/YYYY)
 */
export function formatDateForWorkday(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();

  // 1. If already MM/DD/YYYY or MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str) || /^\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }

  // 2. YYYY-MM-DD -> MM/DD/YYYY
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`;
  }

  // 3. YYYY-MM -> MM/YYYY
  const ym = str.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ym) {
    const [, y, m] = ym;
    return `${m.padStart(2, '0')}/${y}`;
  }

  // 4. Month Name + Year e.g. "January 2022" or "Jan 2022"
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };
  const monthYearMatch = str.match(/^([a-zA-Z]{3,9})[\s,]+(\d{4})$/i);
  if (monthYearMatch) {
    const monthKey = monthYearMatch[1].toLowerCase();
    const year = monthYearMatch[2];
    if (monthMap[monthKey]) {
      return `${monthMap[monthKey]}/${year}`;
    }
  }

  return str;
}

/**
 * Parses date string into separate { month, year } components for split inputs
 */
export function parseDateParts(dateStr) {
  if (!dateStr) return { month: '', year: '' };
  const str = String(dateStr).trim();

  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    sept: '09'
  };

  // Month Name + Year (e.g. "Nov 2024", "November 2024")
  const monthNameMatch = str.match(/^([a-zA-Z]{3,9})\.?\s+(\d{4})$/i);
  if (monthNameMatch && monthMap[monthNameMatch[1].toLowerCase().replace('.', '')]) {
    return { month: monthMap[monthNameMatch[1].toLowerCase().replace('.', '')], year: monthNameMatch[2] };
  }

  // MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{4})$/);
  if (slashMatch) return { month: slashMatch[1].padStart(2, '0'), year: slashMatch[2] };

  // YYYY-MM-DD or YYYY-MM
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})/);
  if (isoMatch) return { month: isoMatch[2].padStart(2, '0'), year: isoMatch[1] };

  // Scan anywhere in string for month name and 4-digit year
  for (const [name, num] of Object.entries(monthMap)) {
    if (str.toLowerCase().includes(name)) {
      const y = str.match(/\b(19\d{2}|20\d{2})\b/);
      if (y) return { month: num, year: y[1] };
    }
  }

  // Just a year
  const yearOnly = str.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearOnly) return { month: '01', year: yearOnly[1] };

  return { month: '', year: '' };
}

/**
 * Handles radio button group selection based on boolean/semantic value matching
 */
export function handleRadioField(element, value, mapping) {
  const targetVal = String(value).toLowerCase().trim();
  const group = mapping.groupElements || Array.from(document.querySelectorAll(`input[type="radio"][name="${element.name}"]`));

  function getRadioText(radio) {
    const aria = (radio.getAttribute('aria-label') || '').toLowerCase().trim();
    if (aria) return aria;
    const labelEl = radio.labels?.[0] || radio.closest('label') || radio.parentElement?.querySelector('label') || document.querySelector(`label[for="${radio.id}"]`);
    if (labelEl) return labelEl.textContent.toLowerCase().trim();
    const next = radio.nextElementSibling;
    if (next && ['span', 'label', 'div', 'p'].includes(next.tagName.toLowerCase())) {
      return next.textContent.toLowerCase().trim();
    }
    const container = radio.closest('.css-1utp272, [data-automation-id*="formField"], div');
    if (container) {
      const lbl = container.querySelector('label');
      if (lbl) return lbl.textContent.toLowerCase().trim();
    }
    return (radio.value || '').toLowerCase().trim();
  }

  for (const radio of group) {
    const radioText = getRadioText(radio);
    let isMatch = false;

    if (targetVal === 'no' || targetVal === 'false' || targetVal === '0') {
      if (/\bno\b/.test(radioText) || radio.value === '0' || radio.value === 'false') {
        isMatch = true;
      }
    } else if (targetVal === 'yes' || targetVal === 'true' || targetVal === '1') {
      if (/\byes\b/.test(radioText) || radio.value === '1' || radio.value === 'true') {
        isMatch = true;
      }
    } else if (radioText.includes(targetVal) || (radio.value && radio.value.toLowerCase() === targetVal)) {
      isMatch = true;
    }

    if (isMatch) {
      if (!radio.checked) {
        radio.checked = true;
        const labelEl = radio.labels?.[0] || radio.closest('label') || radio.parentElement?.querySelector('label') || document.querySelector(`label[for="${radio.id}"]`);
        if (labelEl) {
          labelEl.click();
        }
        radio.click();
        dispatchChangeEvents(radio);
      }
      return true;
    }
  }

  return false;
}
