/**
 * Workday Step 1: My Information Automation Module
 * 
 * Handles:
 * - Resume PDF dropzone auto-attachment
 * - Personal contact fields (First Name, Last Name, Email, Phone Number)
 * - Geographic normalization (City, State, Country, Postal Code, Address Line 1)
 * - Country dropdown selection
 * - State / Province region dropdown
 * - Phone Device Type (Mobile/Home/Work)
 * - Country Phone Code (+91, +1, etc.)
 * - "How Did You Hear About Us?" (Source / Job Board)
 * - Secondary heuristic & AI field mappings for step 1
 */

import {
  setNativeInputValue,
  simulateWorkdayOptionSelect
} from '../filler/dom-utils.js';

import {
  handleWorkdayMultiSelect
} from '../filler/select-handler.js';

import {
  autoUploadResumeFile
} from '../filler/sections-filler.js';

import {
  fillFormFields
} from '../filler.js';

import { ACTIONS } from '../../core/constants.js';

/**
 * Fills all core personal, contact, and address fields on Step 1 (My Information)
 */
export async function fillStep1Fields(profile) {
  const pi = profile?.personalInfo || {};
  const p = profile?.personal || {};

  const firstName = pi.firstName || p.first_name || p.firstName || '';
  const lastName = pi.lastName || p.last_name || p.lastName || '';
  const email = pi.email || p.email || '';
  const rawPhone = pi.phone || p.phone || '';
  const rawLocation = p.location || pi.location || '';
  const addr = pi.address || p.address || {};

  // Parse location tokens
  const locParts = rawLocation.split(',').map(s => s.trim()).filter(Boolean);
  let city = addr.city || pi.city || p.city || (locParts.length >= 1 ? locParts[0] : '');
  let state = addr.state || pi.state || p.state || (locParts.length >= 2 ? locParts[1] : '');
  let country = addr.country || pi.country || p.country || (locParts.length >= 3 ? locParts[2] : '');
  const postal = addr.postalCode || addr.postal_code || pi.postalCode || p.postalCode || '';
  const street = addr.street || addr.addressLine1 || pi.street || p.street || '';

  // Smart geographic validation & normalization
  const cityLower = (city || '').toLowerCase();
  if (cityLower.includes('mumbai') || cityLower.includes('pune') || cityLower.includes('nagpur') || cityLower.includes('nashik')) {
    state = 'Maharashtra';
    country = 'India';
  } else if (cityLower.includes('bangalore') || cityLower.includes('bengaluru')) {
    state = 'Karnataka';
    country = 'India';
  } else if (cityLower.includes('hyderabad')) {
    state = 'Telangana';
    country = 'India';
  } else if (cityLower.includes('delhi') || cityLower.includes('new delhi')) {
    state = 'Delhi';
    country = 'India';
  } else if (cityLower.includes('chennai')) {
    state = 'Tamil Nadu';
    country = 'India';
  } else if (cityLower.includes('kolkata')) {
    state = 'West Bengal';
    country = 'India';
  } else if (cityLower.includes('ahmedabad')) {
    state = 'Gujarat';
    country = 'India';
  }
  if (!country && (state || city)) country = 'India';

  // Clean phone number (strip country code)
  let cleanPhone = rawPhone.replace(/\D/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.slice(2);
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
    cleanPhone = cleanPhone.slice(1);
  }

  let filledCount = 0;
  console.log('🤖 Step 1 data:', { firstName, lastName, email, cleanPhone, city, state, country, postal, street });

  function selectOptionCleanly(el) {
    if (!el) return false;
    el.scrollIntoView?.({ block: 'nearest' });
    const rect = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 20, height: 20 };
    const evtInit = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + (rect.width > 0 ? rect.width / 2 : 10),
      clientY: rect.top + (rect.height > 0 ? rect.height / 2 : 10),
      button: 0,
      buttons: 1
    };
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(new PointerEvent('pointerdown', { ...evtInit, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    }
    el.dispatchEvent(new MouseEvent('mousedown', evtInit));
    if (typeof PointerEvent !== 'undefined') {
      el.dispatchEvent(new PointerEvent('pointerup', { ...evtInit, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    }
    el.dispatchEvent(new MouseEvent('mouseup', { ...evtInit, buttons: 0 }));
    el.click();
    return true;
  }

  function getActivePopupContainer() {
    const popups = Array.from(document.querySelectorAll(
      'div[data-automation-widget="wd-popup"], div[data-automation-id*="popup"], .wd-popup, ul[role="listbox"], div[role="listbox"], div[role="dialog"]'
    )).filter(el => {
      const rect = el.getBoundingClientRect?.() || { width: 0, height: 0 };
      return rect.width > 0 && rect.height > 0;
    });
    return popups[popups.length - 1] || null;
  }

  async function fillTextInput(autoId, value) {
    if (!value) return false;
    const input = document.querySelector(`input[data-automation-id="${autoId}"], [data-automation-id*="${autoId}"] input, input[name="${autoId}"]`);
    if (!input) return false;
    try {
      setNativeInputValue(input, String(value));
      console.log(`  ✅ Filled ${autoId}: "${value}"`);
      await new Promise(r => setTimeout(r, 100));
      return true;
    } catch (err) {
      console.debug(`  Fill ${autoId} error:`, err.message);
      return false;
    }
  }

  function findCountryDropdownButton() {
    const directBtn = document.querySelector([
      'button[data-automation-id="addressSection_country"]',
      'button[data-automation-id="countryDropdown"]',
      'button[name="country"]',
      'button[id="country--country"]',
      'button[id*="country--"]',
      'button[data-automation-id="formField-country"]'
    ].join(', '));
    if (directBtn) return directBtn;

    const container = document.querySelector([
      'div[data-automation-id="formField-country"]',
      'div[data-automation-id="addressSection_country"]',
      'div[data-automation-id*="countryDropdown"]',
      'div[data-fkit-id*="country--country"]',
      'div[data-fkit-id*="country--null"]',
      '[role="group"][aria-labelledby*="country"]'
    ].join(', '));
    if (container) {
      const btn = container.querySelector('button');
      if (btn) return btn;
    }

    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      const text = label.textContent.trim().toLowerCase();
      if (text.startsWith('country') && !text.includes('phone') && !text.includes('region') && !text.includes('code')) {
        const forId = label.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el && el.tagName === 'BUTTON') return el;
          if (el) {
            const btn = el.querySelector('button') || el.closest('div')?.querySelector('button');
            if (btn) return btn;
          }
        }
        const parent = label.closest('div[data-automation-id]') || label.parentElement;
        if (parent) {
          const btn = parent.querySelector('button');
          if (btn) return btn;
        }
      }
    }
    return null;
  }

  function findWorkdayDropdownButton(autoId) {
    const cleanId = (autoId || '').toLowerCase();

    if (cleanId.includes('country') && !cleanId.includes('phone') && !cleanId.includes('region')) {
      return findCountryDropdownButton();
    }

    if (cleanId.includes('region') || cleanId.includes('state') || cleanId.includes('province')) {
      const stateContainer = document.querySelector(
        'div[data-automation-id="formField-countryRegion"], div[data-automation-id="addressSection_countryRegion"], div[data-automation-id*="countryRegion"]'
      );
      if (stateContainer) {
        const btn = stateContainer.querySelector('button');
        if (btn) return btn;
      }
      const directStateBtn = document.querySelector(
        'button[data-automation-id="addressSection_countryRegion"], button[name="countryRegion"], button[id*="countryRegion"]'
      );
      if (directStateBtn) return directStateBtn;
    }

    if (cleanId.includes('device') || cleanId.includes('phonetype') || cleanId.includes('phone-device-type')) {
      const deviceContainer = document.querySelector(
        'div[data-automation-id="formField-phoneType"], div[data-automation-id*="phoneType"], div[data-automation-id*="phone-device-type"]'
      );
      if (deviceContainer) {
        const btn = deviceContainer.querySelector('button');
        if (btn) return btn;
      }
      const directDeviceBtn = document.querySelector(
        'button[data-automation-id="phone-device-type"], button[name="phoneType"], button[id*="phoneType"]'
      );
      if (directDeviceBtn) return directDeviceBtn;
    }

    let btn = document.querySelector(`button[data-automation-id="${autoId}"]`);
    if (btn) return btn;

    const parent = document.querySelector(`div[data-automation-id="${autoId}"], div[data-automation-id="formField-${autoId}"]`);
    if (parent) {
      btn = parent.querySelector('button');
      if (btn) return btn;
    }

    return null;
  }

  async function fillCountryDropdown(targetCountry) {
    if (!targetCountry) return false;
    const isIndia = targetCountry.toLowerCase().includes('india');
    const countryName = isIndia ? 'India' : targetCountry;

    const selectEl = document.querySelector('select[data-automation-id="addressSection_country"], select[name="country"], select[id*="country"]');
    if (selectEl) {
      const matchOpt = Array.from(selectEl.options).find(o => {
        const text = o.text.trim().toLowerCase();
        if (isIndia && (text.includes('british') || text.includes('ocean'))) return false;
        return text === countryName.toLowerCase() || (isIndia && text.includes('india'));
      });
      if (matchOpt && selectEl.value !== matchOpt.value) {
        selectEl.value = matchOpt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`  ✅ Country (select): "${matchOpt.text}"`);
        return true;
      }
      return false;
    }

    const button = findCountryDropdownButton();
    if (!button) return false;

    const currentText = button.textContent.trim();
    if (currentText.toLowerCase() === countryName.toLowerCase()) {
      console.log(`  Country dropdown already set to: "${currentText}"`);
      return true;
    }

    try {
      button.scrollIntoView?.({ block: 'center' });
      button.click();
      await new Promise(r => setTimeout(r, 600));

      const popup = getActivePopupContainer();
      let searchInput = popup ? popup.querySelector('input[type="text"], input[data-automation-id="searchBox"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])') : null;

      if (searchInput) {
        searchInput.focus();
        setNativeInputValue(searchInput, countryName);
        searchInput.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: true, data: countryName, inputType: 'insertText'
        }));
        await new Promise(r => setTimeout(r, 600));
      }

      const searchRoot = popup || document;
      const allOptions = Array.from(searchRoot.querySelectorAll(
        '[role="option"], li, div[data-automation-id*="promptOption"], div[data-automation-id*="selectOption"]'
      )).filter(el => {
        const rect = el.getBoundingClientRect?.() || { width: 0, height: 0 };
        return rect.width > 0 && rect.height > 0 && el.textContent.trim().length > 0;
      });

      const targetLower = countryName.toLowerCase().trim();
      let matchOption = allOptions.find(o => o.textContent.trim().toLowerCase() === targetLower);

      if (!matchOption && isIndia) {
        matchOption = allOptions.find(o => {
          const text = o.textContent.trim().toLowerCase();
          if (text.includes('british') || text.includes('ocean')) return false;
          return text === 'india' || text.startsWith('india ') || text.startsWith('india(') || /\bindia\b/i.test(text);
        });
      }

      if (!matchOption) {
        matchOption = allOptions.find(o => {
          const text = o.textContent.trim().toLowerCase();
          if (isIndia && (text.includes('british') || text.includes('ocean'))) return false;
          return text.startsWith(targetLower) || text.includes(targetLower);
        });
      }

      if (matchOption) {
        const optionToClick = matchOption.closest('[role="option"]') || matchOption.closest('li') || matchOption;
        selectOptionCleanly(optionToClick);

        if (searchInput) {
          searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }

        console.log(`  ✅ Country selected: "${matchOption.textContent.trim()}"`);
        await new Promise(r => setTimeout(r, 400));
        return true;
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        return false;
      }
    } catch (err) {
      console.debug('  Country dropdown error:', err.message);
      return false;
    }
  }

  async function fillWorkdayDropdown(autoId, value) {
    if (!value) return false;
    const button = findWorkdayDropdownButton(autoId);
    if (!button) return false;

    const currentText = button.textContent.trim();
    if (currentText.toLowerCase() === value.toLowerCase()) return true;

    try {
      button.scrollIntoView?.({ block: 'center' });
      button.click();
      await new Promise(r => setTimeout(r, 600));

      const popup = getActivePopupContainer();
      let searchInput = popup ? (
        popup.querySelector('input[data-automation-id="searchBox"]')
        || popup.querySelector('input[type="text"]')
        || popup.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')
      ) : null;

      if (searchInput) {
        searchInput.focus();
        setNativeInputValue(searchInput, value);
        searchInput.dispatchEvent(new InputEvent('input', { 
          bubbles: true, cancelable: true, data: value, inputType: 'insertText' 
        }));
        await new Promise(r => setTimeout(r, 600));
      }

      const searchRoot = popup || document;
      const allOptions = Array.from(searchRoot.querySelectorAll(
        '[role="option"], li, div[data-automation-id*="promptOption"], div[data-automation-id*="selectOption"]'
      )).filter(el => {
        const rect = el.getBoundingClientRect?.() || { width: 0, height: 0 };
        return rect.width > 0 && rect.height > 0 && el.textContent.trim().length > 0;
      });

      const valLower = value.toLowerCase().trim();
      let matchOption = allOptions.find(o => o.textContent.trim().toLowerCase() === valLower);

      if (!matchOption) {
        matchOption = allOptions.find(o => {
          const text = o.textContent.trim().toLowerCase();
          if (valLower === 'india' && (text.includes('british') || text.includes('ocean'))) return false;
          return text === valLower || text.startsWith(valLower) || text.includes(valLower);
        });
      }

      if (matchOption) {
        const optionToClick = matchOption.closest('[role="option"]') || matchOption.closest('li') || matchOption;
        selectOptionCleanly(optionToClick);

        if (searchInput) {
          searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }

        console.log(`  ✅ Dropdown ${autoId} selected: "${matchOption.textContent.trim()}"`);
        await new Promise(r => setTimeout(r, 400));
        return true;
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        return false;
      }
    } catch (err) {
      console.debug(`  Dropdown ${autoId} error:`, err.message);
      return false;
    }
  }

  async function fillCountryPhoneCode(targetCountry) {
    let container = document.querySelector('[data-automation-id="formField-countryPhoneCode"], [data-automation-id*="countryPhoneCode"]');
    if (!container) {
      const labels = Array.from(document.querySelectorAll('label'));
      const phoneCodeLabel = labels.find(l => l.textContent.toLowerCase().includes('country phone code'));
      if (phoneCodeLabel) {
        container = phoneCodeLabel.closest('div[data-automation-id]') || phoneCodeLabel.parentElement;
      }
    }
    if (!container) return false;

    const isIndia = !targetCountry || targetCountry.toLowerCase().includes('india');
    const searchValue = isIndia ? 'India' : targetCountry;
    const phoneDisplayMatch = isIndia ? '+91' : '+1';

    const existingTags = Array.from(container.querySelectorAll(
      '[data-automation-id*="selectedItem"], [data-automation-id*="composite-tag"], [data-automation-id*="tag"], [data-uxi-multiselect-item]'
    ));

    const alreadyCorrect = existingTags.some(tag => {
      const text = tag.textContent || '';
      return text.includes(phoneDisplayMatch) || (isIndia && text.toLowerCase().includes('india') && !text.toLowerCase().includes('british'));
    });

    if (alreadyCorrect) {
      console.log('  ✅ Country Phone Code already set to India (+91)');
      return true;
    }

    for (const tag of existingTags) {
      const removeBtn = tag.querySelector('button, [role="button"], [data-automation-id*="delete"], [data-automation-id*="remove"], [aria-label*="delete"], [aria-label*="Remove"], svg') || tag;
      removeBtn.click();
      await new Promise(r => setTimeout(r, 300));
    }

    const clearBtn = container.querySelector('button[aria-label*="clear" i], button[data-automation-id*="clear"], [data-automation-id*="searchBoxClear"]');
    if (clearBtn) {
      clearBtn.click();
      await new Promise(r => setTimeout(r, 150));
    }

    let searchInput = container.querySelector('input');
    if (!searchInput) {
      container.click();
      await new Promise(r => setTimeout(r, 250));
      searchInput = container.querySelector('input') || document.querySelector('[data-automation-id*="countryPhoneCode"] input');
    }
    if (!searchInput) return false;

    try {
      searchInput.focus();
      setNativeInputValue(searchInput, '');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));

      setNativeInputValue(searchInput, searchValue);
      searchInput.dispatchEvent(new InputEvent('input', { 
        bubbles: true, cancelable: true, data: searchValue, inputType: 'insertText' 
      }));
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 700));

      const popup = getActivePopupContainer();
      const searchRoot = popup || document;
      const options = Array.from(searchRoot.querySelectorAll(
        '[role="option"], li, div[data-automation-id*="promptOption"], div[data-automation-id*="selectOption"]'
      )).filter(el => {
        const rect = el.getBoundingClientRect?.() || { width: 0, height: 0 };
        return rect.width > 0 && rect.height > 0 && el.textContent.trim().length > 0;
      });

      let match = options.find(o => {
        const text = o.textContent.trim().toLowerCase();
        if (isIndia) {
          if (text.includes('british') || text.includes('ocean')) return false;
          return text.includes('+91') || text === 'india' || text.startsWith('india');
        }
        return text.includes(searchValue.toLowerCase());
      });

      if (match) {
        const row = match.closest('[role="option"]') || match.closest('li') || match;
        const rowInput = row.querySelector('input');
        if (rowInput) {
          rowInput.click();
        } else {
          selectOptionCleanly(row);
        }
        await new Promise(r => setTimeout(r, 350));
      }

      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      searchInput.blur();
      return true;
    } catch (err) {
      console.debug('  Country Phone Code error:', err.message);
      return false;
    }
  }

  async function fillHowDidYouHearAboutUs() {
    const sourceContainer = document.querySelector([
      'div[data-automation-id="formField-source"]',
      'div[data-automation-id="source"]',
      'div[data-automation-id*="source"]',
      'div[data-automation-id*="hearAboutUs"]',
      'div[data-automation-id*="hear-about-us"]'
    ].join(', ')) || (() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const l = labels.find(lbl => lbl.textContent.toLowerCase().includes('how did you hear') || lbl.textContent.toLowerCase().includes('hear about us'));
      return l ? (l.closest('div[data-automation-id]') || l.parentElement) : null;
    })();

    if (!sourceContainer) return false;

    const existingTags = Array.from(sourceContainer.querySelectorAll(
      '[data-automation-id*="selectedItem"], [data-automation-id*="composite-tag"], [data-automation-id*="tag"], [data-uxi-multiselect-item]'
    ));
    if (existingTags.length > 0 && existingTags.some(t => t.textContent.trim().length > 0)) {
      return true;
    }

    try {
      return await handleWorkdayMultiSelect(sourceContainer, 'Job Board');
    } catch (e) {
      return false;
    }
  }

  if (await fillHowDidYouHearAboutUs()) filledCount++;
  if (await fillTextInput('legalNameSection_firstName', firstName)) filledCount++;
  if (await fillTextInput('legalNameSection_lastName', lastName)) filledCount++;
  if (await fillTextInput('addressSection_addressLine1', street || city || '')) filledCount++;
  if (await fillTextInput('addressSection_city', city)) filledCount++;
  if (await fillTextInput('addressSection_postalCode', postal)) filledCount++;
  if (await fillTextInput('phone-number', cleanPhone)) filledCount++;

  if (email) {
    const emailInput = document.querySelector('input[data-automation-id*="email"], input[type="email"]');
    if (emailInput) {
      setNativeInputValue(emailInput, email);
      filledCount++;
    }
  }

  if (country && await fillCountryDropdown(country)) filledCount++;
  if (state && await fillWorkdayDropdown('addressSection_countryRegion', state)) filledCount++;
  if (await fillWorkdayDropdown('phone-device-type', 'Mobile')) filledCount++;
  if (await fillCountryPhoneCode(country)) filledCount++;

  return filledCount;
}

/**
 * Step 1 Main Entry Point:
 * Attaches Resume -> Fills Personal Info & Addresses -> Runs Secondary Heuristic/AI Mappings
 */
export async function handleStep1(profile, currentFields, sendToBackground, overlayAssistant) {
  overlayAssistant?.updateState({ statusMessage: 'Step 1: Attaching resume & filling personal information...' });

  // 1. Auto-upload resume file into dropzone
  await autoUploadResumeFile();

  // 2. High-precision Step 1 DOM filling
  const step1Count = await fillStep1Fields(profile);

  // 3. Fallback: Secondary field mapping sweep for any custom fields on Step 1
  try {
    const response = await sendToBackground({
      action: ACTIONS.MAP_FIELDS,
      data: {
        fields: currentFields.map(f => ({
          id: f.id,
          label: f.label,
          name: f.name,
          type: f.type,
          required: f.required,
          currentValue: f.currentValue,
          options: f.options,
          automationId: f.automationId
        }))
      }
    });

    if (response?.success && response?.mappings) {
      const step1Mappings = response.mappings.filter(m => {
        const autoId = (m.automationId || '').toLowerCase();
        const label = (m.label || '').toLowerCase();
        return !autoId.includes('skill') && !label.includes('skill') &&
               !autoId.includes('jobtitle') && !autoId.includes('school');
      });

      const executable = step1Mappings.map(m => {
        const field = currentFields.find(f => f.id === m.id || f.automationId === m.automationId);
        return {
          ...m,
          currentValue: field?.currentValue,
          element: field?.element,
          groupElements: field?.groupElements
        };
      });

      await fillFormFields(executable);
    }
  } catch (err) {
    console.debug('Step 1 secondary mapping notice:', err.message);
  }

  overlayAssistant?.updateState({
    isProcessing: false,
    statusMessage: `Step 1: Filled ${step1Count} fields.`
  });

  return {
    success: true,
    step: 1,
    stepName: 'My Information',
    filledCount: step1Count,
    message: `Step 1: Filled ${step1Count} fields.`
  };
}
