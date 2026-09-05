/**
 * Workday Multi-Step Navigator Helper
 * Identifies Next, Save and Continue, and Review buttons without bypassing user confirmation
 */

export function findNextButton() {
  const selectors = [
    'button[data-automation-id="pageFooterNextButton"]',
    'button[data-automation-id="bottom-navigation-next-button"]',
    'button[data-automation-id="saveAndContinueButton"]',
    'button[data-automation-id*="next"]',
    'button[data-automation-id*="continue"]',
    'button:not([disabled])'
  ];

  for (const selector of selectors) {
    const buttons = Array.from(document.querySelectorAll(selector));
    for (const btn of buttons) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('next') || text.includes('continue') || text.includes('save & continue') || text.includes('save and continue')) {
        return btn;
      }
    }
  }

  return null;
}

export function findSubmitButton() {
  const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
  for (const btn of buttons) {
    const text = btn.textContent.trim().toLowerCase();
    const autoId = (btn.getAttribute('data-automation-id') || '').toLowerCase();
    if (autoId.includes('submit') || text === 'submit' || text === 'submit application') {
      return btn;
    }
  }
  return null;
}

export function validateRequiredFields(fields) {
  const missing = [];
  for (const field of fields) {
    if (field.required) {
      const el = field.element || document.querySelector(`[data-automation-id="${field.automationId}"]`);
      if (el) {
        const val = el.value || (el.type === 'checkbox' ? el.checked : '');
        if (!val || String(val).trim() === '') {
          missing.push(field);
        }
      }
    }
  }
  return missing;
}
