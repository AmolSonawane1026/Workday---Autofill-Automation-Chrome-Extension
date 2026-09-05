/**
 * Workday Custom Select & MultiSelect Dropdown Automation Handlers
 */

import {
  setNativeInputValue,
  isFieldAlreadyFilled,
  closeWorkdayPopup,
  simulateWorkdayOptionSelect
} from './dom-utils.js';

/**
 * Handles Workday single-select custom popup buttons and listboxes
 */
export async function handleWorkdayCustomSelect(selectContainer, targetValue) {
  if (!targetValue || !selectContainer) return false;

  // If already filled with the target value, skip
  if (isFieldAlreadyFilled(selectContainer, 'select', { value: targetValue })) {
    return true;
  }

  let popupOpened = false;

  try {
    // Resolve best interactive trigger inside container
    const trigger = (selectContainer.tagName?.toLowerCase() === 'button' || selectContainer.tagName?.toLowerCase() === 'input')
      ? selectContainer
      : selectContainer.querySelector('button[aria-haspopup="listbox"], button, [role="button"], [role="combobox"], [data-automation-id*="prompt-icon"], [data-automation-id*="icon"], input') || selectContainer;

    trigger.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    
    // If trigger is directly an input (searchbox / prompt input)
    const isDirectInput = trigger.tagName?.toLowerCase() === 'input';
    if (isDirectInput) {
      trigger.focus();
      setNativeInputValue(trigger, targetValue);
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      popupOpened = true;
    } else {
      trigger.focus();
      trigger.click();
      popupOpened = true;
    }
    
    await new Promise(r => setTimeout(r, 350));

    // Check if trigger has aria-controls referencing a listbox id
    const listboxId = trigger.getAttribute('aria-controls');
    const specificListbox = listboxId ? document.getElementById(listboxId) : null;

    const getOptions = () => {
      const scope = specificListbox || document;
      return Array.from(scope.querySelectorAll(
        'ul[role="listbox"] li, [role="listbox"] [role="option"], [role="listbox"] li, li[role="option"], [role="option"], .wd-popup [role="option"], [data-automation-id*="promptOption"], [data-automation-id*="select-option"], div[data-uxi-multiselect-item]'
      )).filter(el => {
        const rect = el.getBoundingClientRect?.() || { width: 1, height: 1 };
        return (rect.width > 0 && rect.height > 0) || specificListbox !== null;
      }).filter(el => el.textContent.trim().length > 0 && !el.getAttribute('aria-disabled'));
    };

    let options = getOptions();
    const targetLower = String(targetValue).toLowerCase().trim();

    const findMatch = (opts) => {
      // 1. Exact match
      let match = opts.find(opt => opt.textContent.trim().toLowerCase() === targetLower);
      if (match) return match;

      // 2. Starts with / Contains match
      match = opts.find(opt => opt.textContent.trim().toLowerCase().includes(targetLower));
      if (match) return match;

      // 3. Option contained inside target
      match = opts.find(opt => targetLower.includes(opt.textContent.trim().toLowerCase()));
      if (match) return match;

      // 4. Dial code match for phone codes (e.g. "+91" or "+1")
      const dialCodeMatch = targetLower.match(/\+\d+/);
      if (dialCodeMatch) {
        match = opts.find(opt => opt.textContent.includes(dialCodeMatch[0]));
        if (match) return match;
      }

      // 5. Country name match for phone codes
      const countryMatch = targetLower.match(/^([a-z\s]+)/i);
      if (countryMatch && countryMatch[1].trim().length > 2) {
        const cName = countryMatch[1].trim().toLowerCase();
        match = opts.find(opt => opt.textContent.toLowerCase().includes(cName));
        if (match) return match;
      }

      return null;
    };

    let bestOption = findMatch(options);

    const clickOption = (opt) => {
      opt.scrollIntoView?.({ block: 'nearest' });
      const targetEl = opt.querySelector('div, span') || opt;
      targetEl.click();
    };

    if (bestOption) {
      clickOption(bestOption);
      popupOpened = false;
      await new Promise(r => setTimeout(r, 200));
      return true;
    }

    // Handle nested hierarchical categories (e.g. "Job Board" -> "Naukri")
    if (targetLower.includes('naukri') || targetLower.includes('job board')) {
      const categoryOpt = options.find(opt => opt.textContent.trim().toLowerCase().includes('job board'));
      if (categoryOpt) {
        clickOption(categoryOpt);
        await new Promise(r => setTimeout(r, 350));
        options = getOptions();
        bestOption = findMatch(options) || options.find(opt => opt.textContent.toLowerCase().includes('naukri'));
        if (bestOption) {
          clickOption(bestOption);
          popupOpened = false;
          await new Promise(r => setTimeout(r, 200));
          return true;
        }
      }
    }

    // If options not immediately matched, search in popup search input
    const searchInput = document.querySelector('[role="listbox"] input, .wd-popup input, input[aria-haspopup="listbox"], [data-automation-id*="searchBox"] input');
    if (searchInput && searchInput !== trigger) {
      setNativeInputValue(searchInput, targetValue);
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      await new Promise(r => setTimeout(r, 400));

      options = getOptions();
      bestOption = findMatch(options);
      
      if (!bestOption && targetLower.includes('naukri')) {
        bestOption = options.find(opt => opt.textContent.toLowerCase().includes('naukri') || opt.textContent.toLowerCase().includes('job board'));
      }
      if (!bestOption && options.length > 0) {
        bestOption = options[0];
      }

      if (bestOption) {
        clickOption(bestOption);
        popupOpened = false;
        await new Promise(r => setTimeout(r, 200));
        return true;
      }
    }

    return false;
  } catch (err) {
    console.debug('Custom select error:', err);
    return false;
  } finally {
    if (popupOpened) {
      closeWorkdayPopup();
    }
  }
}

/**
 * Handles Workday MultiSelect & Searchable Prompt Containers
 * (e.g. Source/How Did You Hear About Us, Country Phone Code, etc.)
 */
export async function handleWorkdayMultiSelect(element, targetValue) {
  if (!targetValue || !element) return false;

  const targetStr = String(targetValue).trim();
  const targetLower = targetStr.toLowerCase();

  // Find the multiselect container
  const container = (element.closest && element.closest(
    'div[data-uxi-widget-type="multiselect"], div[data-automation-id="multiSelectContainer"], div[data-automation-id*="multiSelect"], div[data-automation-id*="formField"], div'
  )) || element.parentElement || element;

  // 1. Check if target is ALREADY selected as a pill
  const existingPills = Array.from(container.querySelectorAll(
    '[data-automation-id="selectedItem"], [data-automation-id="promptOption"], [data-automation-id="composite-tag"], [data-automation-id="multiSelectChip"]'
  ));

  const alreadySelected = existingPills.some(p => {
    const text = p.textContent.trim().toLowerCase();
    return text === targetLower || text.includes(targetLower) || targetLower.includes(text);
  });

  if (alreadySelected) {
    return true;
  }

  // 2. Clear old unwanted pill for single-choice multiselects (Source, Country Phone Code)
  const isSingleChoice = (container.getAttribute('data-automation-id') || '').includes('countryPhoneCode') ||
                         (container.getAttribute('data-automation-id') || '').includes('source') ||
                         (element.id || '').includes('source') ||
                         (element.id || '').includes('countryPhoneCode') ||
                         (container.closest && container.closest('[data-automation-id*="countryPhoneCode"], [data-automation-id*="source"]') !== null);

  if (isSingleChoice && existingPills.length > 0) {
    for (const pill of existingPills) {
      const deleteCharm = pill.querySelector('[data-automation-id="DELETE_charm"], [aria-label*="delete" i], [aria-label*="clear" i], [aria-label*="Remove" i], button');
      if (deleteCharm) {
        deleteCharm.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  // 3. Find search input inside container
  const searchInput = element.tagName?.toLowerCase() === 'input'
    ? element
    : container.querySelector('input[data-automation-id="searchBox"], input[enterkeyhint="search"], input') || element.querySelector?.('input');

  if (!searchInput) {
    console.warn('MultiSelect: Search input not found');
    return false;
  }

  searchInput.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  searchInput.focus();
  setNativeInputValue(searchInput, '');
  await new Promise(r => setTimeout(r, 100));

  // Determine search keyword
  let searchTerm = targetStr;
  const dialCodeMatch = targetStr.match(/\+\d+/);
  if (dialCodeMatch && (container.getAttribute('data-automation-id')?.includes('countryPhoneCode') || searchInput.id.includes('countryPhoneCode'))) {
    searchTerm = dialCodeMatch[0]; // e.g. "+91"
  }

  // Type search term into input
  setNativeInputValue(searchInput, searchTerm);
  searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: searchTerm, inputType: 'insertText' }));
  searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));

  // Also click prompt search icon if available
  const searchBtn = container.querySelector('[data-automation-id="promptSearchButton"], [data-uxi-widget-type="selectinputicon"]');
  if (searchBtn) {
    searchBtn.click();
  }

  function getVisibleOptions() {
    return Array.from(document.querySelectorAll(
      '[role="listbox"] [role="option"], [role="listbox"] li, [data-automation-id*="promptOption"], [data-automation-id*="selectOption"], [data-automation-id*="select-option"], [data-automation-id*="menuItem"], .wd-popup [role="option"], [role="option"], div[data-uxi-multiselect-item]'
    )).filter(el => {
      const rect = el.getBoundingClientRect?.() || { width: 1, height: 1 };
      return rect.width > 0 && rect.height > 0 && el.textContent.trim().length > 0;
    });
  }

  function clickOption(opt) {
    opt.scrollIntoView?.({ block: 'nearest' });
    const targetEl = opt.querySelector('div, span') || opt;
    simulateWorkdayOptionSelect(targetEl);
  }

  let selected = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise(r => setTimeout(r, 400));
    const options = getVisibleOptions();
    if (options.length === 0) continue;

    let bestOption = options.find(o => o.textContent.trim().toLowerCase() === targetLower);
    if (!bestOption) {
      bestOption = options.find(o => o.textContent.trim().toLowerCase().includes(targetLower));
    }
    if (!bestOption) {
      bestOption = options.find(o => targetLower.includes(o.textContent.trim().toLowerCase()));
    }
    if (!bestOption && dialCodeMatch) {
      bestOption = options.find(o => o.textContent.includes(dialCodeMatch[0]));
    }
    // Handle hierarchical categories (e.g. Job Board -> Naukri)
    if (!bestOption && (targetLower.includes('naukri') || targetLower.includes('job board'))) {
      const categoryOpt = options.find(o => o.textContent.toLowerCase().includes('job board'));
      if (categoryOpt) {
        clickOption(categoryOpt);
        await new Promise(r => setTimeout(r, 350));
        const subOpts = getVisibleOptions();
        bestOption = subOpts.find(o => o.textContent.toLowerCase().includes('naukri')) || subOpts[0];
      }
    }
    if (!bestOption && options.length > 0 && isSingleChoice && (targetLower.includes('source') || targetLower.includes('job board'))) {
      bestOption = options[0];
    }

    if (bestOption) {
      clickOption(bestOption);
      selected = true;
      break;
    }
  }

  // Fallback keyboard selection
  if (!selected) {
    searchInput.focus();
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  }

  await new Promise(r => setTimeout(r, 300));
  closeWorkdayPopup();

  // Verification: check if new pill exists in container
  const updatedPills = Array.from(container.querySelectorAll(
    '[data-automation-id="selectedItem"], [data-automation-id="promptOption"], [data-automation-id="composite-tag"]'
  ));
  return updatedPills.length > 0 || selected;
}
