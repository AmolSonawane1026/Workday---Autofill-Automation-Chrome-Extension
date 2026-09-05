/**
 * Workday multi-section form filler for experience, education, links, and disclosures.
 */

import {
  setNativeInputValue,
  parseDateParts,
  closeWorkdayPopup,
  simulateWorkdayOptionSelect,
  dispatchChangeEvents
} from './dom-utils.js';

import { handleWorkdayCustomSelect } from './select-handler.js';

let _resumeUploadInProgress = false;
let _resumeUploadTimeout = null;

/**
 * Converts a base64 data URL to a binary Blob directly without triggering network or CSP violations
 */
function safeDataUrlToBlob(dataUrl, defaultType = 'application/pdf') {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const base64Data = parts[1];
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : defaultType;
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch (err) {
    console.debug('Direct base64 conversion note:', err.message);
    return null;
  }
}

/**
 * Finds the Workday Resume/CV file input and corresponding drop zone container
 */
function findWorkdayResumeDropZoneAndInput() {
  // 1. Check direct standard Workday selectors
  const directInput = document.querySelector(
    'input[data-automation-id="file-upload-input-ref"], ' +
    '[data-automation-id*="resume"] input[type="file"], ' +
    '[data-automation-id*="file-upload"] input[type="file"], ' +
    '[data-automation-id*="drop-zone"] input[type="file"], ' +
    '[data-automation-id*="dropZone"] input[type="file"]'
  );

  // 2. Find drop zone container by text or attributes
  // Matches "Drop files here" or "Select files" or "Resume/CV"
  let matchedDropZone = null;
  const candidateDropZones = Array.from(document.querySelectorAll(
    '[data-automation-id*="file-upload-drop-zone"], [data-automation-id*="dropZone"], [data-automation-id*="drop-zone"], [data-automation-id*="fileUpload"], [data-automation-id*="resume"], div, section'
  ));

  for (const el of candidateDropZones) {
    const text = (el.textContent || '').trim();
    if (
      (text.includes('Drop files here') || text.includes('Select files')) &&
      el.children.length > 0 &&
      el.children.length < 15
    ) {
      matchedDropZone = el;
      break;
    }
  }

  // If container was found, find input inside or adjacent
  let matchedInput = directInput;
  if (!matchedInput && matchedDropZone) {
    matchedInput = matchedDropZone.querySelector('input[type="file"]') ||
                   matchedDropZone.parentElement?.querySelector('input[type="file"]') ||
                   matchedDropZone.closest('section, div[data-automation-id*="resume"], div')?.querySelector('input[type="file"]');
  }

  // 3. Fallback: Search all file inputs on page, prioritizing ones in Resume/CV context
  if (!matchedInput) {
    const allFileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    for (const input of allFileInputs) {
      const container = input.closest('section, div, fieldset') || input.parentElement;
      const text = (container?.textContent || '').toLowerCase();
      if (text.includes('resume') || text.includes('cv') || text.includes('upload a file') || text.includes('drop files')) {
        matchedInput = input;
        if (!matchedDropZone) matchedDropZone = container;
        break;
      }
    }
    // If no context matched, take first file input
    if (!matchedInput && allFileInputs.length > 0) {
      matchedInput = allFileInputs[0];
    }
  }

  // Determine the best drop zone container
  const finalDropZone = matchedDropZone ||
    (matchedInput && (
      matchedInput.closest('[data-automation-id*="file-upload-drop-zone"], [data-automation-id*="dropZone"], [data-automation-id*="drop-zone"], [data-automation-id*="attachment"], div[data-automation-id*="file"], div[data-automation-id*="resume"]') ||
      matchedInput.parentElement
    )) ||
    document.querySelector('[data-automation-id*="file-upload-drop-zone"], [data-automation-id*="drop-zone"], [data-automation-id="resume-section"], div[data-automation-id*="file"]');

  return { fileInput: matchedInput, dropZone: finalDropZone };
}

/**
 * Automatically uploads saved Resume PDF into Workday's file dropzone (without opening file dialog)
 */
export async function autoUploadResumeFile() {
  if (_resumeUploadInProgress) {
    console.debug('Resume upload already in progress, skipping');
    return false;
  }

  const { fileInput, dropZone } = findWorkdayResumeDropZoneAndInput();

  if (!fileInput) {
    console.debug('Resume file input not found in DOM');
    return false;
  }

  // Check if a file is already uploaded in the drop zone
  if (dropZone) {
    const dropZoneText = (dropZone.innerText || dropZone.textContent || '');
    const hasUploadedItem = dropZoneText.includes('Successfully Uploaded') ||
      dropZoneText.includes('successfully uploaded') ||
      dropZone.querySelector(
        '[data-automation-id*="uploadedFile"], [data-automation-id*="file-upload-item"], [data-automation-id*="fileDeleteButton"], [data-automation-id*="file-item"], [data-automation-id*="delete-file"]'
      ) !== null;
    if (hasUploadedItem) {
      console.log('📄 Resume already uploaded in drop zone, skipping');
      return true;
    }
  }

  _resumeUploadInProgress = true;
  if (_resumeUploadTimeout) clearTimeout(_resumeUploadTimeout);
  _resumeUploadTimeout = setTimeout(() => { _resumeUploadInProgress = false; }, 6000);

  try {
    // 1. Retrieve raw resume file from chrome storage, background message, or localStorage
    let resumeFile = null;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      resumeFile = await new Promise((resolve) => {
        chrome.storage.local.get(['workday_raw_resume_file'], (res) => {
          resolve(res?.workday_raw_resume_file || null);
        });
      });
    }

    if (!resumeFile && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const bgRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'GET_RESUME_FILE' }, (res) => resolve(res));
        });
        if (bgRes?.resumeFile) {
          resumeFile = bgRes.resumeFile;
        }
      } catch (bgErr) {
        console.debug('Background GET_RESUME_FILE fallback notice:', bgErr);
      }
    }

    if (!resumeFile && typeof localStorage !== 'undefined') {
      try {
        const localVal = localStorage.getItem('workday_raw_resume_file');
        if (localVal) resumeFile = JSON.parse(localVal);
      } catch {}
    }

    let dataUrl = resumeFile?.dataUrl;
    if (!dataUrl && resumeFile?.base64) {
      const mime = resumeFile.type || 'application/pdf';
      dataUrl = `data:${mime};base64,${resumeFile.base64}`;
    }

    if (!resumeFile || !dataUrl) {
      console.debug('No raw resume file found in extension storage');
      return false;
    }

    // 2. Convert DataURL to Blob safely (immune to CSP connect-src restrictions)
    let blob = safeDataUrlToBlob(dataUrl, resumeFile.type || 'application/pdf');
    if (!blob) {
      try {
        const res = await fetch(dataUrl);
        blob = await res.blob();
      } catch (fetchErr) {
        console.warn('Fetch dataUrl fallback failed:', fetchErr);
        return false;
      }
    }

    const fileName = resumeFile.name || 'Resume.pdf';
    const file = new File([blob], fileName, {
      type: resumeFile.type || blob.type || 'application/pdf',
      lastModified: Date.now()
    });

    // 3. Create DataTransfer container
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    // 4. Populate file input via React-aware property descriptor setter
    try {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
      if (descriptor && descriptor.set) {
        descriptor.set.call(fileInput, dataTransfer.files);
      } else {
        fileInput.files = dataTransfer.files;
      }
    } catch (descErr) {
      fileInput.files = dataTransfer.files;
    }

    // Dispatch input & change events on file input
    fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true, composed: true }));

    // 5. Dispatch Drag and Drop simulation to drop targets
    const dropTargets = new Set();
    if (dropZone) dropTargets.add(dropZone);
    if (dropZone?.parentElement) dropTargets.add(dropZone.parentElement);
    if (fileInput) dropTargets.add(fileInput);

    // Add any element inside dropZone containing "Drop files here" or "Select files"
    if (dropZone) {
      const innerBoxes = dropZone.querySelectorAll('div, label, span, button');
      for (const inner of innerBoxes) {
        const t = (inner.textContent || '').trim();
        if (t.includes('Drop files here') || t.includes('Select files')) {
          dropTargets.add(inner);
        }
      }
    }

    for (const target of dropTargets) {
      try {
        const dragEnterEvt = new DragEvent('dragenter', { bubbles: true, cancelable: true, composed: true, dataTransfer });
        target.dispatchEvent(dragEnterEvt);

        const dragOverEvt = new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true, dataTransfer });
        target.dispatchEvent(dragOverEvt);

        const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer });
        target.dispatchEvent(dropEvt);
      } catch (dropErr) {
        console.debug('Drop dispatch notice for target:', dropErr);
      }
    }

    console.log('📄 Auto-attached resume file to Workday:', fileName);
    return true;
  } catch (err) {
    console.warn('Auto-upload resume failed:', err);
    return false;
  } finally {
    _resumeUploadInProgress = false;
    if (_resumeUploadTimeout) {
      clearTimeout(_resumeUploadTimeout);
      _resumeUploadTimeout = null;
    }
  }
}

/**
 * Maps any candidate degree string to the exact standard options available in Workday's listbox
 */
export function mapDegreeToWorkdayStandard(degreeStr) {
  if (!degreeStr) return 'Bachelors level degree';
  const d = degreeStr.toLowerCase();
  
  if (d.includes('phd') || d.includes('doctor')) {
    return 'Doctorate level degree';
  }
  if (d.includes('master') || d.includes('mca') || d.includes('m.tech') || d.includes('mtech') || d.includes('ms') || d.includes('mba') || d.includes('m.sc') || d.includes('msc')) {
    return 'Masters level degree';
  }
  if (d.includes('bachelor') || d.includes('bca') || d.includes('b.tech') || d.includes('btech') || d.includes('b.e') || d.includes('be') || d.includes('b.sc') || d.includes('bsc') || d.includes('b.com') || d.includes('bcom') || d.includes('ba') || d.includes('bba')) {
    return 'Bachelors level degree';
  }
  if (d.includes('diploma') || d.includes('associate') || d.includes('2 year') || d.includes('polytechnic')) {
    return '2 year college degree';
  }
  if (d.includes('high school') || d.includes('hsc') || d.includes('12th') || d.includes('secondary') || d.includes('intermediate')) {
    return 'High school graduate or equivalent';
  }
  return 'Bachelors level degree';
}

/**
 * Infers Field of Study from degree if not explicitly provided
 */
export function inferFieldOfStudy(degreeStr) {
  if (!degreeStr) return 'Computer Science';
  const d = degreeStr.toLowerCase();
  if (d.includes('bca') || d.includes('mca') || d.includes('computer application')) {
    return 'Computer Science';
  }
  if (d.includes('computer') || d.includes('software') || d.includes('it') || d.includes('information tech')) {
    return 'Computer Science';
  }
  if (d.includes('accounting') || d.includes('accountancy')) {
    return 'Accounting';
  }
  if (d.includes('commerce') || d.includes('b.com') || d.includes('bcom')) {
    return 'Accounting';
  }
  if (d.includes('business') || d.includes('mba') || d.includes('bba')) {
    return 'Business Administration and Management';
  }
  return 'Computer Science';
}

/**
 * Selects the Degree from Workday's standard Degree listbox dropdown
 */
export async function fillWorkdayDegreeDropdown(container, degreeRaw) {
  const targetStandardDegree = mapDegreeToWorkdayStandard(degreeRaw);
  console.log(`🎓 Selecting Workday Degree: raw="${degreeRaw}" -> mapped="${targetStandardDegree}"`);

  const searchScope = container || document;
  const degreeBtn = searchScope.querySelector(
    'button[data-automation-id="degree"], [data-automation-id="degree"] button, [data-automation-id*="formField-degree"] button, div[data-automation-id*="degree"] button'
  ) || document.querySelector('button[data-automation-id="degree"]');

  if (!degreeBtn) {
    console.debug('Degree button not found');
    return false;
  }

  const currentText = degreeBtn.textContent.trim().toLowerCase();
  if (currentText.includes(targetStandardDegree.toLowerCase())) {
    console.log(`  ✅ Degree already set to "${degreeBtn.textContent.trim()}"`);
    return true;
  }

  try {
    degreeBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    simulateWorkdayOptionSelect(degreeBtn);
    degreeBtn.click();
    await new Promise(r => setTimeout(r, 450));

    const options = Array.from(document.querySelectorAll(
      'ul[role="listbox"] li[role="option"], [role="listbox"] [role="option"], li[role="option"], [data-automation-id*="promptOption"]'
    )).filter(el => {
      const rect = el.getBoundingClientRect?.() || { width: 1, height: 1 };
      return (rect.width > 0 && rect.height > 0) && !el.getAttribute('aria-disabled');
    });

    let match = options.find(o => o.textContent.trim().toLowerCase() === targetStandardDegree.toLowerCase());
    if (!match) {
      match = options.find(o => o.textContent.trim().toLowerCase().includes(targetStandardDegree.toLowerCase()));
    }
    if (!match) {
      const firstWord = targetStandardDegree.toLowerCase().split(' ')[0];
      match = options.find(o => o.textContent.trim().toLowerCase().includes(firstWord));
    }

    if (match) {
      simulateWorkdayOptionSelect(match);
      console.log(`  ✅ Selected Workday Degree option: "${match.textContent.trim()}"`);
      await new Promise(r => setTimeout(r, 300));
      return true;
    } else {
      degreeBtn.focus();
      degreeBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
      degreeBtn.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      degreeBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      degreeBtn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      return false;
    }
  } catch (err) {
    console.debug('Degree selection error:', err.message);
    return false;
  }
}

/**
 * Resolves search terms to try for a given candidate's Field of Study
 */
function getFieldOfStudyCandidates(rawFieldOfStudy) {
  const candidates = [];
  const raw = (rawFieldOfStudy && typeof rawFieldOfStudy === 'string') ? rawFieldOfStudy.trim() : '';
  if (raw) {
    candidates.push(raw);
  }

  const lower = raw.toLowerCase();
  if (lower.includes('computer application') || lower.includes('bca') || lower.includes('mca')) {
    candidates.push('Computer Science', 'Computer and Information Sciences', 'Information Technology');
  } else if (lower.includes('computer') || lower.includes('software')) {
    candidates.push('Computer Science', 'Computer Engineering', 'Information Technology');
  } else if (lower.includes('data science') || lower.includes('ai') || lower.includes('machine learning')) {
    candidates.push('Computer Science', 'Statistics', 'Mathematics');
  } else if (lower.includes('it') || lower.includes('information tech')) {
    candidates.push('Information Technology', 'Computer Science');
  } else if (lower.includes('accounting') || lower.includes('accountancy')) {
    candidates.push('Accounting', 'Finance');
  } else if (lower.includes('commerce') || lower.includes('bcom') || lower.includes('b.com')) {
    candidates.push('Accounting', 'Finance', 'Business Administration and Management');
  } else if (lower.includes('business') || lower.includes('mba') || lower.includes('bba') || lower.includes('management')) {
    candidates.push('Business Administration and Management', 'Business Administration');
  } else if (lower.includes('mechanical')) {
    candidates.push('Mechanical Engineering');
  } else if (lower.includes('electrical') || lower.includes('electronics')) {
    candidates.push('Electrical and Electronics Engineering', 'Electrical Engineering');
  } else if (lower.includes('civil')) {
    candidates.push('Civil Engineering');
  } else if (lower.includes('bio') || lower.includes('biomedical')) {
    candidates.push('Agricultural/Biological Engineering and Bioengineering', 'Biology');
  }

  if (candidates.length === 0) {
    candidates.push('Computer Science');
  }

  return Array.from(new Set(candidates));
}

/**
 * Checks if a prompt option text matches the desired target term
 */
function isFieldOfStudyMatch(optionText, targetTerm) {
  if (!optionText || !targetTerm) return false;
  const o = optionText.trim().toLowerCase();
  const t = targetTerm.trim().toLowerCase();
  if (o === t) return true;
  if (o.startsWith(t) || t.startsWith(o)) return true;
  if (o.includes(t) || t.includes(o)) return true;
  return false;
}

/**
 * Extracts visible Workday Field of Study prompt options from DOM
 * Specifically targets data-automation-id="menuItem", data-automation-id="promptLeafNode",
 * and input[data-automation-id="radioBtn"] as used in Workday singleSelectPrompt
 */
function getVisiblePromptOptions() {
  const items = Array.from(document.querySelectorAll(
    '[data-automation-id="menuItem"], [data-automation-id="promptLeafNode"], [data-automation-id="activeListContainer"] [role="option"], [role="listbox"] [role="option"], [data-uxi-widget-type="multiselectlistitem"]'
  ));

  const options = [];
  const seen = new Set();

  for (const el of items) {
    const labelEl = el.querySelector?.('[data-automation-id="promptOption"]') ||
                    (el.getAttribute?.('data-automation-id') === 'promptOption' ? el : null);
    const labelText = (labelEl?.getAttribute?.('data-automation-label') || labelEl?.textContent || el.textContent || '').trim();
    if (!labelText || seen.has(labelText.toLowerCase())) continue;
    seen.add(labelText.toLowerCase());

    const radioInput = el.querySelector?.('input[type="radio"][data-automation-id="radioBtn"], input[type="radio"]');
    const leafNode = el.querySelector?.('[data-automation-id="promptLeafNode"]') || el;
    const menuItem = el.closest?.('[data-automation-id="menuItem"]') || el;

    options.push({
      element: menuItem,
      leafNode,
      radioInput,
      labelEl: labelEl || el,
      text: labelText
    });
  }

  return options;
}

/**
 * Dispatches realistic selection interaction onto a Workday single-select radio prompt option
 */
function selectWorkdayPromptOption(option) {
  const { element, leafNode, radioInput, labelEl, text } = option;
  console.log(`🎓 Selecting Field of Study option: "${text}"`);

  const target = radioInput || leafNode || labelEl || element;
  target?.scrollIntoView?.({ block: 'nearest' });

  if (radioInput && !radioInput.checked) {
    radioInput.checked = true;
    radioInput.setAttribute('aria-checked', 'true');
    radioInput.dispatchEvent(new Event('change', { bubbles: true }));
    radioInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const evtOpts = { bubbles: true, cancelable: true, view: window };
  target?.dispatchEvent(new PointerEvent('pointerdown', evtOpts));
  target?.dispatchEvent(new MouseEvent('mousedown', evtOpts));
  target?.dispatchEvent(new PointerEvent('pointerup', evtOpts));
  target?.dispatchEvent(new MouseEvent('mouseup', evtOpts));
  target?.click();

  if (leafNode && leafNode !== target) {
    leafNode.click();
  }
}

/**
 * Fills Field of Study in Workday's education prompt/multiselect widget
 */
export async function fillWorkdayFieldOfStudy(container, rawFieldOfStudy) {
  const searchScope = container || document;
  const fieldContainer = searchScope.querySelector(
    'div[data-automation-id="formField-field-of-study"], ' +
    'div[data-automation-id="formField-fieldOfStudy"], ' +
    'div[data-automation-id*="field-of-study"], ' +
    'div[data-automation-id*="fieldOfStudy"]'
  ) || searchScope;

  const candidates = getFieldOfStudyCandidates(rawFieldOfStudy);

  // 1. Check if a pill is already selected and whether it matches the candidate's field
  const existingPill = fieldContainer.querySelector(
    '[data-automation-id="selectedItem"], [data-automation-id="composite-tag"], [data-automation-id="multiSelectChip"]'
  );
  if (existingPill && existingPill.textContent.trim()) {
    const currentVal = existingPill.textContent.trim().toLowerCase();
    const isMatching = candidates.some(c => isFieldOfStudyMatch(currentVal, c));
    if (isMatching) {
      console.log('  ✅ Field of Study already correctly selected:', existingPill.textContent.trim());
      return true;
    } else {
      console.log(`  🔄 Replacing incorrect Field of Study "${existingPill.textContent.trim()}" with resume value...`);
      const removeBtn = existingPill.querySelector('button, [data-automation-id*="delete"], [aria-label*="Remove" i], [aria-label*="Delete" i]');
      if (removeBtn) {
        removeBtn.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  const searchInput = fieldContainer.querySelector(
    'input[data-automation-id="searchBox"], ' +
    'input[data-automation-id*="fieldOfStudy" i], ' +
    'input[data-automation-id*="field-of-study" i], ' +
    'input[placeholder*="Search" i], ' +
    'input'
  );

  if (!searchInput) {
    console.warn('Field of Study search input not found');
    return false;
  }

  let selected = false;

  for (const term of candidates) {
    console.log(`🎓 Searching Field of Study: "${term}"...`);

    searchInput.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    searchInput.focus();
    searchInput.click();

    setNativeInputValue(searchInput, '');
    await new Promise(r => setTimeout(r, 80));

    setNativeInputValue(searchInput, term);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: term, inputType: 'insertText' }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Press Enter to trigger search query in Workday (do NOT click promptSearchButton, which forces browse mode)
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));

    // Poll for matching option in the popup listbox
    for (let wait = 0; wait < 7; wait++) {
      await new Promise(r => setTimeout(r, 250));
      const options = getVisiblePromptOptions();
      if (options.length === 0) continue;

      const matchedOption = options.find(o => o.text.toLowerCase() === term.toLowerCase())
                         || options.find(o => isFieldOfStudyMatch(o.text, term));

      if (matchedOption) {
        selectWorkdayPromptOption(matchedOption);
        selected = true;
        console.log(`  ✅ Selected Field of Study: "${matchedOption.text}"`);
        break;
      }
    }

    if (selected) break;

    // Check if the prompt list is virtualized (e.g. 328 items in ReactVirtualized listbox)
    const listContainer = document.querySelector('[data-automation-id="activeListContainer"], div.ReactVirtualized__List');
    if (listContainer && listContainer.scrollHeight > 500) {
      for (let scrollStep = 0; scrollStep < 12; scrollStep++) {
        listContainer.scrollTop += 320;
        await new Promise(r => setTimeout(r, 80));
        const currentOptions = getVisiblePromptOptions();
        const match = currentOptions.find(o => isFieldOfStudyMatch(o.text, term));
        if (match) {
          selectWorkdayPromptOption(match);
          selected = true;
          console.log(`  ✅ Selected Field of Study via virtualized scroll: "${match.text}"`);
          break;
        }
      }
    }

    if (selected) break;
  }

  await new Promise(r => setTimeout(r, 200));
  closeWorkdayPopup();
  return selected;
}

/**
 * Fills month/year date inputs inside a Workday container
 * Supports BOTH single MM/YYYY inputs and split month/year inputs
 */
export function fillWorkdayDateInput(container, dateFieldAutoId, dateStr, directMonth, directYear) {
  if (!container) return;
  const isStart = String(dateFieldAutoId).toLowerCase().includes('start') || String(dateFieldAutoId).toLowerCase().includes('from');
  const isEnd = String(dateFieldAutoId).toLowerCase().includes('end') || String(dateFieldAutoId).toLowerCase().includes('to');

  const parts = parseDateParts(dateStr || '');
  const rawMonth = directMonth || parts.month;
  const rawYear = directYear || parts.year;

  if (!rawYear && !dateStr) return;

  let sanitizedMonth = '01';
  const mNum = parseInt(rawMonth, 10);
  if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
    sanitizedMonth = String(mNum).padStart(2, '0');
  } else if (dateStr) {
    const dLower = String(dateStr).toLowerCase();
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    for (const [m, n] of Object.entries(monthMap)) {
      if (dLower.includes(m)) { sanitizedMonth = n; break; }
    }
  }

  let sanitizedYear = '';
  if (rawYear) {
    const yMatch = String(rawYear).match(/\b(19\d{2}|20\d{2})\b/);
    sanitizedYear = yMatch ? yMatch[1] : String(rawYear).trim();
  } else if (dateStr) {
    const yMatch = String(dateStr).match(/\b(19\d{2}|20\d{2})\b/);
    if (yMatch) sanitizedYear = yMatch[1];
  }

  if (!sanitizedYear) return;

  // Find the specific date container using labels ("From" vs "To")
  let searchCtx = null;
  const labels = Array.from(container.querySelectorAll('label'));
  const targetLabel = labels.find(l => {
    const t = l.textContent.trim().toLowerCase();
    return isStart ? /^from\b/i.test(t) : /^to\b/i.test(t);
  });

  if (targetLabel) {
    const targetId = targetLabel.htmlFor || targetLabel.getAttribute('for');
    if (targetId) {
      const inputById = document.getElementById(targetId);
      if (inputById) searchCtx = inputById.parentElement;
    }
    if (!searchCtx) {
      searchCtx = targetLabel.closest('div[data-automation-id*="formField"], div.css-1utp272, div');
    }
  }

  if (!searchCtx) {
    const fieldSelector = isStart
      ? 'div[data-automation-id*="startDate" i], div[data-automation-id*="from" i]'
      : 'div[data-automation-id*="endDate" i], div[data-automation-id*="to" i]';
    searchCtx = container.querySelector(fieldSelector);
  }

  const scope = searchCtx || container;
  const monthInput = scope.querySelector('input[data-automation-id="dateSectionMonth-input"]');
  const yearInput = scope.querySelector('input[data-automation-id="dateSectionYear-input"]');

  if (monthInput || yearInput) {
    if (monthInput) {
      setNativeInputValue(monthInput, sanitizedMonth);
      monthInput.dispatchEvent(new Event('input', { bubbles: true }));
      monthInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (yearInput && sanitizedYear) {
      setNativeInputValue(yearInput, sanitizedYear);
      yearInput.dispatchEvent(new Event('input', { bubbles: true }));
      yearInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  const dateInputs = Array.from(scope.querySelectorAll(
    'input[data-automation-id="dateWidgetInput"], ' +
    'input[placeholder*="YYYY" i], ' +
    'input[placeholder*="MM" i], ' +
    'input[type="text"]'
  )).filter(inp => {
    const id = (inp.getAttribute('data-automation-id') || '').toLowerCase();
    return !id.includes('title') && !id.includes('company') && !id.includes('location') && !id.includes('search');
  });

  const singleInput = (isStart ? dateInputs[0] : (dateInputs[1] || dateInputs[0]));

  if (singleInput && sanitizedYear) {
    const formatted = `${sanitizedMonth}/${sanitizedYear}`;
    singleInput.focus();
    singleInput.value = '';
    setNativeInputValue(singleInput, formatted);
    singleInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: formatted, inputType: 'insertText' }));
    singleInput.dispatchEvent(new Event('change', { bubbles: true }));
    singleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true }));
    singleInput.blur();
    singleInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    console.log(`  ✅ Date field "${dateFieldAutoId}" set to: "${formatted}"`);
  }
}

export const fillSplitDateInputs = fillWorkdayDateInput;

/**
 * Locates the Add or Add Another button for Work Experience
 */
export function findWorkExpAddButton(sectionIdx = 1) {
  // 1. If looking to add a second or subsequent work experience (sectionIdx > 1):
  if (sectionIdx > 1) {
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
      const rect = b.getBoundingClientRect?.() || { width: 1, height: 1 };
      return (rect.width > 0 && rect.height > 0) && !b.disabled;
    });

    const addAnother = allButtons.find(b => {
      const text = (b.textContent || '').trim().toLowerCase();
      const id = (b.getAttribute('data-automation-id') || '').toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (text.includes('another') || id.includes('another') || aria.includes('another')) &&
             !text.includes('delete') && !id.includes('delete');
    });
    if (addAnother) return addAnother;

    const expSection = document.querySelector(
      'div[data-automation-id="workExperienceSection"], ' +
      'div[role="group"][aria-labelledby*="Work-Experience" i], ' +
      'div[role="group"][aria-labelledby*="experience" i]'
    );
    if (expSection) {
      const sectionButtons = Array.from(expSection.querySelectorAll('button, [role="button"]')).filter(b => !b.disabled);
      const lastAdd = sectionButtons.reverse().find(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        const id = (b.getAttribute('data-automation-id') || '').toLowerCase();
        return (t.includes('add') || id.includes('add')) && !t.includes('delete') && !id.includes('delete');
      });
      if (lastAdd) return lastAdd;
    }
  }

  // 2. If adding the first work experience (sectionIdx === 1):
  const workExpHeading = document.getElementById('Work-Experience-section') ||
    document.querySelector('[id="Work-Experience-section"], [id*="Work-Experience" i], [aria-labelledby*="Work-Experience" i]');

  if (workExpHeading) {
    const group = workExpHeading.closest('div[role="group"], [role="group"], section, fieldset') ||
                  workExpHeading.parentElement;
    if (group) {
      const btn = group.querySelector(
        'button[data-automation-id="add-button"], ' +
        'button[data-automation-id="Add"], ' +
        'button[data-automation-id*="add" i], ' +
        'button'
      );
      if (btn) {
        const text = (btn.textContent || '').trim().toLowerCase();
        const id = (btn.getAttribute('data-automation-id') || '').toLowerCase();
        if (!id.includes('delete') && !text.includes('delete') && (id.includes('add') || text.includes('add') || text === 'add')) {
          return btn;
        }
      }
    }
  }

  // 3. Fallback: Search all buttons in workExperienceSection
  const expSection = document.querySelector(
    'div[data-automation-id="workExperienceSection"], ' +
    'div[data-automation-id*="workExperience" i], ' +
    'div[role="group"][aria-labelledby*="Work-Experience" i], ' +
    'div[role="group"][aria-labelledby*="experience" i]'
  ) || document;

  const buttons = Array.from(expSection.querySelectorAll('button, [role="button"]')).filter(b => !b.disabled);
  const found = buttons.find(b => {
    const id = (b.getAttribute('data-automation-id') || '').toLowerCase();
    const label = (b.getAttribute('aria-label') || '').toLowerCase();
    const text = b.textContent.trim().toLowerCase();
    return (id.includes('add') || label.includes('add') || text.includes('add')) &&
           !id.includes('delete') && !text.includes('delete');
  });

  return found || document.querySelector(
    'button[data-automation-id="add-button"], ' +
    'div[data-automation-id="workExperienceSection"] button, ' +
    'button[data-automation-id="Add"], button[data-automation-id="add"], button[data-automation-id*="add" i]'
  );
}

/**
 * Locates the Add button for Education
 */
export function findEduAddButton(eduIdx = 1) {
  const section = document.querySelector(
    'div[data-automation-id="educationSection"], ' +
    'div[data-automation-id*="education" i], ' +
    'div[role="group"][aria-labelledby*="education" i]'
  ) || document;

  const buttons = Array.from(section.querySelectorAll('button')).filter(b => {
    const rect = b.getBoundingClientRect?.() || { width: 1, height: 1 };
    return (rect.width > 0 && rect.height > 0) && !b.disabled;
  });

  if (eduIdx === 1) {
    const exactAdd = buttons.find(b => {
      const id = (b.getAttribute('data-automation-id') || '').toLowerCase();
      const text = b.textContent.trim().toLowerCase();
      return (id === 'add' || text === 'add') && !id.includes('delete') && !text.includes('another');
    });
    if (exactAdd) return exactAdd;
  } else {
    const addAnother = buttons.find(b => {
      const id = (b.getAttribute('data-automation-id') || '').toLowerCase();
      const text = b.textContent.trim().toLowerCase();
      return text === 'add another' || id.includes('addanother') || text.includes('another');
    });
    if (addAnother) return addAnother;
  }

  const found = buttons.find(b => {
    const id = (b.getAttribute('data-automation-id') || '').toLowerCase();
    const label = (b.getAttribute('aria-label') || '').toLowerCase();
    const text = b.textContent.trim().toLowerCase();
    return (id.includes('add') || label.includes('add') || text.includes('add')) && !id.includes('delete');
  });

  return found || document.querySelector(
    'div[data-automation-id="educationSection"] button[data-automation-id="Add"], ' +
    'div[data-automation-id="educationSection"] button[data-automation-id*="add" i], ' +
    'div[data-automation-id="educationSection"] button'
  );
}

/**
 * Deletes any extra empty sections on Workday that exceed candidate's real profile entries
 */
export async function removeExtraWorkdayPanels(sectionPrefix, maxAllowed) {
  for (let idx = 10; idx > maxAllowed; idx--) {
    const container = document.querySelector(
      `div[data-automation-id="${sectionPrefix}-${idx}"], ` +
      `div[data-automation-id*="${sectionPrefix}-${idx}"], ` +
      `div[data-automation-id*="${sectionPrefix}"][data-automation-id*="${idx}"]`
    );
    if (!container) continue;

    console.log(`🗑️ Deleting extra Workday ${sectionPrefix} #${idx}...`);
    const deleteBtn = container.querySelector(
      'button[data-automation-id*="delete" i], button[aria-label*="Delete" i], [data-automation-id="panel-header"] button, [data-automation-id="panel-delete-button"]'
    );
    if (deleteBtn) {
      deleteBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      simulateWorkdayOptionSelect(deleteBtn);
      deleteBtn.click();
      await new Promise(r => setTimeout(r, 450));

      const confirmBtn = Array.from(document.querySelectorAll(
        'button[data-automation-id="confirmButton"], button[data-automation-id="delete"], .wd-popup button, [role="dialog"] button'
      )).find(b => {
        const t = b.textContent.trim().toLowerCase();
        return t === 'delete' || t === 'confirm' || t === 'ok' || t === 'remove';
      });

      if (confirmBtn) {
        simulateWorkdayOptionSelect(confirmBtn);
        confirmBtn.click();
        await new Promise(r => setTimeout(r, 450));
      }
    }
  }
}

/**
 * STEP 2: Fill Work Experience and Education sections
 */
export async function fillWorkExperienceAndEducation(profile = {}) {
  // 1. Filter out empty/invalid work experiences (supporting all snake_case and camelCase aliases)
  const rawExperiences = profile?.workExperience ||
                         profile?.workExperiences ||
                         profile?.work_experience ||
                         profile?.work_experiences ||
                         profile?.experience ||
                         profile?.experiences ||
                         profile?.workHistory ||
                         profile?.history || [];

  const validExperiences = rawExperiences.filter(exp => {
    if (!exp) return false;
    const title = String(exp.jobTitle || exp.jobtitle || exp.job_title || exp.title || exp.role || exp.position || '').trim();
    const comp = String(exp.company || exp.employer || exp.organization || exp.company_name || exp.companyName || '').trim();
    const hasValidTitle = title.length >= 2 && !/^\d+[\.\)]?$/.test(title);
    const hasValidComp = comp.length >= 2 && !/^\d+[\.\)]?$/.test(comp);
    return hasValidTitle || hasValidComp;
  });

  const seenExp = new Set();
  const experiences = validExperiences.filter(exp => {
    const title = String(exp.jobTitle || exp.jobtitle || exp.job_title || exp.title || exp.role || exp.position || '').trim();
    const comp = String(exp.company || exp.employer || exp.organization || exp.company_name || exp.companyName || '').trim();
    const key = `${comp.toLowerCase()}|${title.toLowerCase()}`;
    if (seenExp.has(key)) return false;
    seenExp.add(key);
    return true;
  });

  // 2. Filter out empty/invalid educations
  const rawEducations = profile?.education || profile?.educations || [];
  const validEducations = rawEducations.filter(edu => {
    if (!edu) return false;
    const inst = String(edu.institution || edu.school || edu.university || edu.college || '').trim();
    const deg = String(edu.degree || '').trim();
    const hasValidInst = inst.length >= 2 && !/^\d+[\.\)]?$/.test(inst);
    const hasValidDeg = deg.length >= 2 && !/^\d+[\.\)]?$/.test(deg);
    return hasValidInst || hasValidDeg;
  });

  const seenEdu = new Set();
  const educations = validEducations.filter(edu => {
    const inst = String(edu.institution || edu.school || edu.university || edu.college || '').trim();
    const deg = String(edu.degree || '').trim();
    const key = `${inst.toLowerCase()}|${deg.toLowerCase()}`;
    if (seenEdu.has(key)) return false;
    seenEdu.add(key);
    return true;
  });

  console.log(`💼 Step 2 Filtered: ${experiences.length} real work experiences, ${educations.length} real educations`);

  await removeExtraWorkdayPanels('workExperience', experiences.length);
  await removeExtraWorkdayPanels('education', educations.length);

  // --- 1. FILL WORK EXPERIENCE ---
  if (experiences.length > 0) {
    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      if (!exp) continue;

      const sectionIdx = i + 1;
      const jobTitle = exp.jobTitle || exp.jobtitle || exp.job_title || exp.title || exp.role || exp.position || '';
      const company = exp.company || exp.employer || exp.organization || exp.company_name || exp.companyName || '';
      const location = exp.location || exp.city || '';
      const isCurrent = exp.isCurrent ?? (
        exp.end_date === null || exp.endDate === null || 
        exp.endDate === 'Present' || (typeof exp.endDate === 'string' && exp.endDate.toLowerCase().includes('present'))
      );

      console.log(`💼 Processing Work Experience #${sectionIdx}: "${jobTitle}" at "${company}"`);

      // Check if container already exists
      let indexedContainer = document.querySelector(
        `div[data-automation-id="workExperience-${sectionIdx}"], ` +
        `div[data-automation-id*="workExperience-${sectionIdx}"], ` +
        `div[data-automation-id*="workExperience"][data-automation-id*="${sectionIdx}"]`
      );

      // Check if jobTitle input for this index is already mounted in DOM
      const existingTitleInputs = Array.from(document.querySelectorAll(
        'input[data-automation-id="jobTitle"], input[aria-label*="Job Title" i], input[data-automation-id*="jobTitle" i]'
      ));
      if (!indexedContainer && existingTitleInputs[i]) {
        indexedContainer = existingTitleInputs[i].closest('div[data-automation-id*="panel"], div[data-automation-id*="workExperience"], fieldset, div[role="group"], div') ||
                           existingTitleInputs[i].parentElement?.parentElement?.parentElement;
      }

      // If container is not present, find and click the Add / Add Another button
      if (!indexedContainer) {
        const addBtn = findWorkExpAddButton(sectionIdx);
        if (addBtn) {
          console.log(`➕ Clicking Add button to create Work Experience #${sectionIdx}...`);
          addBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          addBtn.focus();
          await new Promise(r => setTimeout(r, 120));

          simulateWorkdayOptionSelect(addBtn);
          addBtn.click();

          // Wait up to 4 seconds for Workday to mount the new card and inputs
          for (let t = 0; t < 20; t++) {
            await new Promise(r => setTimeout(r, 200));
            indexedContainer = document.querySelector(
              `div[data-automation-id="workExperience-${sectionIdx}"], ` +
              `div[data-automation-id*="workExperience-${sectionIdx}"], ` +
              `div[data-automation-id*="workExperience"][data-automation-id*="${sectionIdx}"]`
            );
            if (indexedContainer) break;

            const updatedTitleInputs = Array.from(document.querySelectorAll(
              'input[data-automation-id="jobTitle"], input[aria-label*="Job Title" i], input[data-automation-id*="jobTitle" i]'
            ));
            if (updatedTitleInputs[i] || updatedTitleInputs.length > existingTitleInputs.length) {
              const targetInput = updatedTitleInputs[i] || updatedTitleInputs[updatedTitleInputs.length - 1];
              indexedContainer = targetInput.closest('div[data-automation-id*="panel"], div[data-automation-id*="workExperience"], fieldset') ||
                                 targetInput.closest('div[role="group"][aria-labelledby*="Experience" i], div[role="group"][aria-labelledby*="experience" i], div[role="group"]') ||
                                 targetInput.parentElement?.parentElement?.parentElement;
              if (indexedContainer) break;
            }
          }
        }
      }

      // Fallback: Check all panels or groups if still not resolved
      if (!indexedContainer) {
        const allPanels = Array.from(document.querySelectorAll(
          'div[data-automation-id*="workExperience-"], ' +
          'div[data-automation-id="workExperienceSection"] [data-automation-id*="panel"], ' +
          'div[data-automation-id="workExperienceSection"] [role="group"]'
        ));
        if (allPanels[i]) {
          indexedContainer = allPanels[i];
        }
      }

      // If still not resolved, scope to the work experience role="group" or section
      if (!indexedContainer) {
        indexedContainer = document.querySelector(
          'div[role="group"][aria-labelledby="Work-Experience-section"], ' +
          'div[role="group"][aria-labelledby*="Work-Experience"], ' +
          'div[role="group"][aria-labelledby*="work-experience" i], ' +
          'div[role="group"][aria-labelledby*="experience" i], ' +
          'div[data-automation-id="workExperienceSection"], ' +
          'div[data-automation-id*="workExperience"]'
        ) || document;
      }

      if (indexedContainer) {
        // 1. Job Title
        const titleInputs = Array.from(indexedContainer.querySelectorAll(
          'input[data-automation-id="jobTitle"], input[aria-label*="Job Title" i], div[data-automation-id*="jobTitle" i] input'
        ));
        const titleInput = titleInputs.length === 1 ? titleInputs[0] : (titleInputs[i] || titleInputs[titleInputs.length - 1] || titleInputs[0]);
        if (titleInput && jobTitle) {
          titleInput.focus();
          setNativeInputValue(titleInput, jobTitle);
          titleInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: jobTitle, inputType: 'insertText' }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`  ✅ Experience #${sectionIdx} Title: "${jobTitle}"`);
        }

        // 2. Company / Employer
        const companyInputs = Array.from(indexedContainer.querySelectorAll(
          'input[data-automation-id="company"], input[data-automation-id*="company" i], input[data-automation-id*="employer" i], input[aria-label*="Company" i], input[aria-label*="Employer" i], div[data-automation-id*="company" i] input'
        ));
        const companyInput = companyInputs.length === 1 ? companyInputs[0] : (companyInputs[i] || companyInputs[companyInputs.length - 1] || companyInputs[0]);
        if (companyInput && company) {
          companyInput.focus();
          setNativeInputValue(companyInput, company);
          companyInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: company, inputType: 'insertText' }));
          companyInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`  ✅ Experience #${sectionIdx} Company: "${company}"`);
        }

        // 3. Location
        const locationInputs = Array.from(indexedContainer.querySelectorAll(
          'input[data-automation-id="location"], input[aria-label*="Location" i], div[data-automation-id*="location" i] input'
        ));
        const locationInput = locationInputs.length === 1 ? locationInputs[0] : (locationInputs[i] || locationInputs[locationInputs.length - 1] || locationInputs[0]);
        const resolvedLocation = location || profile?.personal?.location || profile?.personalInfo?.location || profile?.personalInfo?.city || '';
        if (locationInput && resolvedLocation) {
          locationInput.focus();
          setNativeInputValue(locationInput, resolvedLocation);
          locationInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: resolvedLocation, inputType: 'insertText' }));
          locationInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`  ✅ Experience #${sectionIdx} Location: "${resolvedLocation}"`);
        }

        // 4. Currently work here checkbox
        const currentCheckbox = indexedContainer.querySelector(
          'input[type="checkbox"][data-automation-id*="currentlyWorkHere"], ' +
          'input[type="checkbox"][data-automation-id*="current"], ' +
          'div[data-automation-id*="currentlyWorkHere" i] input[type="checkbox"], ' +
          'input[type="checkbox"]'
        );
        if (currentCheckbox) {
          if (isCurrent && !currentCheckbox.checked) {
            currentCheckbox.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            currentCheckbox.click();
            currentCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
          } else if (!isCurrent && currentCheckbox.checked) {
            currentCheckbox.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            currentCheckbox.click();
            currentCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 200));
          }
        }

        // 5. Start Date & End Date
        fillWorkdayDateInput(indexedContainer, 'startDate', exp.startDate || exp.start_date, exp.startDateMonth, exp.startDateYear);
        if (!isCurrent) {
          fillWorkdayDateInput(indexedContainer, 'endDate', exp.endDate || exp.end_date, exp.endDateMonth, exp.endDateYear);
        }

        // 6. Role Description
        const descAreas = Array.from(indexedContainer.querySelectorAll(
          'textarea[data-automation-id="description"], textarea[data-automation-id*="description" i], textarea'
        ));
        const descArea = descAreas.length === 1 ? descAreas[0] : (descAreas[i] || descAreas[descAreas.length - 1] || descAreas[0]);
        let descText = exp.description || '';
        if (exp.highlights && exp.highlights.length) {
          const highlightsText = exp.highlights.map(h => (h.startsWith('•') || h.startsWith('-')) ? h : `• ${h}`).join('\n');
          if (descText && !descText.includes(exp.highlights[0])) {
            descText = `${descText}\n\n${highlightsText}`;
          } else if (!descText) {
            descText = highlightsText;
          }
        }
        if (descArea && descText) {
          descArea.focus();
          setNativeInputValue(descArea, descText);
          descArea.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: descText, inputType: 'insertText' }));
          descArea.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`  ✅ Experience #${sectionIdx} Description filled (${descText.length} chars)`);
        }

        await new Promise(r => setTimeout(r, 350));
      } else {
        console.warn(`  ⚠️ Could not find container for Work Experience #${sectionIdx}`);
      }
    }
  }

  // --- 2. FILL EDUCATION ---
  if (educations.length > 0) {
    for (let i = 0; i < educations.length; i++) {
      const edu = educations[i];
      if (!edu) continue;

      const eduIdx = i + 1;
      const institution = edu.institution || edu.school || '';
      const degree = edu.degree || '';
      const fieldOfStudy = edu.fieldOfStudy || edu.field_of_study || inferFieldOfStudy(degree);
      const gpa = edu.gpa || '';

      console.log(`🎓 Processing Education #${eduIdx}: "${degree}" at "${institution}"`);

      let eduContainer = document.querySelector(
        `div[data-automation-id="education-${eduIdx}"], ` +
        `div[data-automation-id*="education-${eduIdx}"]`
      );

      if (!eduContainer) {
        const eduAddBtn = findEduAddButton(eduIdx);

        if (eduAddBtn) {
          console.log(`➕ Clicking Add button for Education #${eduIdx}...`);
          eduAddBtn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          simulateWorkdayOptionSelect(eduAddBtn);
          eduAddBtn.click();

          for (let t = 0; t < 15; t++) {
            await new Promise(r => setTimeout(r, 250));
            eduContainer = document.querySelector(
              `div[data-automation-id="education-${eduIdx}"], ` +
              `div[data-automation-id*="education-${eduIdx}"], ` +
              `div[data-automation-id*="education"][data-automation-id*="${eduIdx}"]`
            );
            if (eduContainer) break;
          }
        }
      }

      const searchCtx = eduContainer || document.querySelector('div[data-automation-id="educationSection"]') || document;

      // 1. School (institution) with double-Enter for Workday autocomplete
      const schoolInput = searchCtx.querySelector(
        'div[data-automation-id="formField-schoolItem"] input, ' +
        'input[data-automation-id*="school" i], ' +
        'input[data-automation-id*="institution" i]'
      );
      if (schoolInput && institution) {
        schoolInput.focus();
        setNativeInputValue(schoolInput, institution);
        schoolInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: institution, inputType: 'insertText' }));
        schoolInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        await new Promise(r => setTimeout(r, 700));
        schoolInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        console.log(`  ✅ Education #${eduIdx} School: "${institution}"`);
        await new Promise(r => setTimeout(r, 200));
      }

      // 2. Degree dropdown
      if (degree) {
        await fillWorkdayDegreeDropdown(searchCtx, degree);
      }

      // 3. Field of Study
      await fillWorkdayFieldOfStudy(searchCtx, fieldOfStudy);

      // 4. GPA
      const gpaInput = searchCtx.querySelector('input[data-automation-id="gpa"], div[data-automation-id="formField-gradeAverage"] input');
      if (gpaInput && gpa) {
        setNativeInputValue(gpaInput, gpa);
      }

      // 5. Years Attended
      const gradYear = edu.graduation_year ? String(edu.graduation_year) : '';
      const rawStart = edu.startDate || edu.start_date || '';
      const rawEnd = edu.endDate || edu.end_date || '';
      const startYear = (rawStart && typeof rawStart === 'string') ? (rawStart.match(/\d{4}/)?.[0] || '') : '';
      const endYear = gradYear || ((rawEnd && typeof rawEnd === 'string') ? (rawEnd.match(/\d{4}/)?.[0] || '') : '');

      const firstYearInput = searchCtx.querySelector('div[data-automation-id="formField-firstYearAttended"] input');
      const lastYearInput = searchCtx.querySelector('div[data-automation-id="formField-lastYearAttended"] input');

      if (firstYearInput && (startYear || endYear)) setNativeInputValue(firstYearInput, startYear || endYear);
      if (lastYearInput && endYear) setNativeInputValue(lastYearInput, endYear);

      await new Promise(r => setTimeout(r, 350));
    }
  }
}

export const autoExpandAndFillSections = fillWorkExperienceAndEducation;
export const autoExpandExperienceAndEducation = fillWorkExperienceAndEducation;

/**
 * Fill website link fields (LinkedIn, GitHub, Portfolio)
 */
export async function fillWebsiteLinks(profile = {}) {
  const links = profile?.links || profile?.personal?.links || profile?.personalInfo?.links || {};
  const personal = profile?.personal || profile?.personalInfo || {};
  const linkedInLink = links.linkedin || links.linkedIn || personal.linkedIn || personal.linkedin || '';
  const githubLink = links.github || personal.github || '';
  const portfolioLink = links.portfolio || personal.portfolio || '';

  if (!linkedInLink && !githubLink && !portfolioLink) return;

  let addedWebs = 0;

  if (linkedInLink) {
    const linkedInInput = document.querySelector('input[data-automation-id="linkedinQuestion"]');
    if (linkedInInput) {
      setNativeInputValue(linkedInInput, linkedInLink);
    } else {
      addedWebs += 1;
      let panelInput = document.querySelector(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`);
      if (!panelInput) {
        const addBtn = document.querySelector('div[data-automation-id="websiteSection"] button[data-automation-id="Add"]');
        if (addBtn) {
          addBtn.click();
          await new Promise(r => setTimeout(r, 500));
          panelInput = document.querySelector(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`);
        }
      }
      if (panelInput) setNativeInputValue(panelInput, linkedInLink);
    }
  }

  if (githubLink) {
    addedWebs += 1;
    let panelInput = document.querySelector(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`);
    if (!panelInput) {
      const addBtn = document.querySelector('div[data-automation-id="websiteSection"] button[data-automation-id="Add"]');
      if (addBtn) {
        addBtn.click();
        await new Promise(r => setTimeout(r, 500));
        panelInput = document.querySelector(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`);
      }
    }
    if (panelInput) setNativeInputValue(panelInput, githubLink);
  }

  if (portfolioLink) {
    addedWebs += 1;
    let panelInput = document.querySelector(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`);
    if (!panelInput) {
      const addBtn = document.querySelector('div[data-automation-id="websiteSection"] button[data-automation-id="Add"]');
      if (addBtn) {
        addBtn.click();
        await new Promise(r => setTimeout(r, 500));
        panelInput = document.querySelector(`div[data-automation-id="websitePanelSet-${addedWebs}"] input`);
      }
    }
    if (panelInput) setNativeInputValue(panelInput, portfolioLink);
  }
}

/**
 * Fill complete Voluntary Disclosures (Gender, Hispanic/Latino, Ethnicity, Veteran)
 * and Self-Identification page fields (Name, Date, Disability, Agreement checkbox)
 */
export async function fillVoluntaryDisclosuresAndSelfId(profile = {}) {
  const personal = profile?.personal || profile?.personalInfo || {};
  const disclosures = profile?.voluntaryDisclosures || profile?.demographics || profile?.eeo || profile?.eeoDefaults || {};
  const firstName = personal.first_name || personal.firstName || '';
  const lastName = personal.last_name || personal.lastName || '';
  const fullName = personal.full_name || personal.fullName || `${firstName} ${lastName}`.trim();

  // 1. Gender Dropdown
  const genderTarget = disclosures.gender || profile?.gender || 'Prefer Not to Answer';
  const genderTrigger = document.querySelector(
    'button[data-automation-id="gender"], ' +
    'div[data-automation-id*="formField-gender"] button, ' +
    'div[data-automation-id*="formField-gender"] [role="combobox"], ' +
    'button[aria-label*="Gender" i]'
  ) || Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim().toLowerCase().startsWith('gender'))?.parentElement?.querySelector('button, [role="combobox"]');

  if (genderTrigger) {
    console.log(`📋 Selecting Gender: "${genderTarget}"`);
    await handleWorkdayCustomSelect(genderTrigger, genderTarget);
    await new Promise(r => setTimeout(r, 250));
  }

  // 2. Hispanic or Latino Dropdown
  const hispanicTarget = disclosures.hispanicOrLatino || disclosures.hispanic || profile?.hispanicOrLatino || 'No';
  const hispanicTrigger = document.querySelector(
    'button[data-automation-id="hispanicOrLatino"], ' +
    'button[data-automation-id="hispanic"], ' +
    'div[data-automation-id*="formField-hispanic"] button, ' +
    'div[data-automation-id*="formField-hispanic"] [role="combobox"]'
  ) || Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim().toLowerCase().includes('hispanic'))?.parentElement?.querySelector('button, [role="combobox"]');

  if (hispanicTrigger) {
    console.log(`📋 Selecting Hispanic/Latino: "${hispanicTarget}"`);
    await handleWorkdayCustomSelect(hispanicTrigger, hispanicTarget);
    await new Promise(r => setTimeout(r, 250));
  }

  // 3. Ethnicity / Race Dropdown
  const ethnicityTarget = disclosures.ethnicity || disclosures.race || profile?.ethnicity || profile?.race || 'Prefer Not to Answer';
  const ethnicityTrigger = document.querySelector(
    'button[data-automation-id="ethnicity"], ' +
    'button[data-automation-id="ethnicityDropdown"], ' +
    'div[data-automation-id*="formField-ethnicity"] button, ' +
    'div[data-automation-id*="formField-race"] button'
  ) || Array.from(document.querySelectorAll('label')).find(l => {
    const t = l.textContent.trim().toLowerCase();
    return t.includes('ethnicity') || t.includes('race');
  })?.parentElement?.querySelector('button, [role="combobox"]');

  if (ethnicityTrigger) {
    console.log(`📋 Selecting Ethnicity: "${ethnicityTarget}"`);
    await handleWorkdayCustomSelect(ethnicityTrigger, ethnicityTarget);
    await new Promise(r => setTimeout(r, 250));
  }

  // 4. Veteran Status Dropdown
  const veteranTarget = disclosures.veteranStatus || disclosures.veteran || profile?.veteranStatus || 'I am not a protected veteran';
  const veteranTrigger = document.querySelector(
    'button[data-automation-id="veteranStatus"], ' +
    'button[data-automation-id="veteran"], ' +
    'div[data-automation-id*="formField-veteran"] button, ' +
    'div[data-automation-id*="formField-veteran"] [role="combobox"]'
  ) || Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim().toLowerCase().includes('veteran'))?.parentElement?.querySelector('button, [role="combobox"]');

  if (veteranTrigger) {
    console.log(`📋 Selecting Veteran Status: "${veteranTarget}"`);
    await handleWorkdayCustomSelect(veteranTrigger, veteranTarget);
    await new Promise(r => setTimeout(r, 250));
  }

  // 5. Voluntary Agreement Checkbox
  const agreementCb = document.querySelector(
    'input[data-automation-id="agreementCheckbox"], ' +
    'input[data-automation-id*="agreement" i], ' +
    'input[type="checkbox"][aria-label*="agree" i], ' +
    'input[type="checkbox"][aria-label*="consent" i], ' +
    'input[type="checkbox"][aria-label*="acknowledge" i]'
  );
  if (agreementCb && !agreementCb.checked) {
    agreementCb.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    agreementCb.click();
    dispatchChangeEvents(agreementCb);
    await new Promise(r => setTimeout(r, 150));
  }

  // 6. Full Name / Signature Input
  const nameInput = document.querySelector(
    'input[data-automation-id="name"], ' +
    'input[data-automation-id="legalName"], ' +
    'input[aria-label*="Your Name" i], ' +
    'input[aria-label*="Full Name" i], ' +
    'input[aria-label*="Signature" i], ' +
    'div[data-automation-id*="formField-name"] input'
  );
  if (nameInput && fullName) {
    nameInput.focus();
    setNativeInputValue(nameInput, fullName);
    nameInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: fullName, inputType: 'insertText' }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(`  ✅ Disclosures Signature Name: "${fullName}"`);
  }

  // 7. Date Picker (Today's Date)
  const dateIcon = document.querySelector('div[data-automation-id="dateIcon"]');
  if (dateIcon) {
    dateIcon.click();
    await new Promise(r => setTimeout(r, 250));
    const todayBtn = document.querySelector('button[data-automation-id="datePickerSelectedToday"]');
    if (todayBtn) {
      todayBtn.click();
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const dateInput = document.querySelector(
    'input[data-automation-id="date"], ' +
    'div[data-automation-id*="formField-date"] input, ' +
    'input[aria-label*="Date" i]'
  );
  if (dateInput && !dateInput.value) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    const formattedDate = `${mm}/${dd}/${yyyy}`;
    setNativeInputValue(dateInput, formattedDate);
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // 8. Disability Status (Semantic Radio Discovery)
  const disabilityPref = (disclosures.disabilityStatus || disclosures.disability || profile?.disability || 'no').toLowerCase();
  const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));

  if (allRadios.length > 0) {
    let targetRadio = null;

    for (const radio of allRadios) {
      const label = radio.labels?.[0] || radio.closest('label') || radio.parentElement;
      const text = (label?.textContent || '').toLowerCase();

      if (disabilityPref === 'yes' || disabilityPref.includes('have a disability')) {
        if (text.includes('yes, i have a disability') || (text.includes('have a disability') && !text.includes('do not'))) {
          targetRadio = radio;
          break;
        }
      } else if (disabilityPref === 'abstain' || disabilityPref.includes('wish') || disabilityPref.includes('prefer not') || disabilityPref.includes('decline')) {
        if (text.includes('do not wish to answer') || text.includes('prefer not') || text.includes('decline') || text.includes('choose not')) {
          targetRadio = radio;
          break;
        }
      } else {
        // default to "No, I do not have a disability" or "No"
        if (text.includes('do not have a disability') || text.includes('no, i') || text.startsWith('no')) {
          targetRadio = radio;
          break;
        }
      }
    }

    // Fallback: If not matched, select the "do not wish / abstain" or "No" radio
    if (!targetRadio) {
      targetRadio = allRadios.find(r => {
        const text = (r.labels?.[0]?.textContent || r.closest('label')?.textContent || r.parentElement?.textContent || '').toLowerCase();
        return text.includes('do not wish') || text.includes('prefer not') || text.includes('do not have');
      }) || allRadios[0];
    }

    if (targetRadio && !targetRadio.checked) {
      targetRadio.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      targetRadio.click();
      targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('  ✅ Selected Disability Status radio');
      await new Promise(r => setTimeout(r, 150));
    }
  }
}

export const fillSelfIdentification = fillVoluntaryDisclosuresAndSelfId;
export const fillVoluntaryAgreement = fillVoluntaryDisclosuresAndSelfId;

