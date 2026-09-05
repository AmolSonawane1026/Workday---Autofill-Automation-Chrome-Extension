/**
 * Workday Step 4: Voluntary Disclosures & Self-Identification Automation Module
 *
 * Handles:
 * - Equal Employment Opportunity (EEO) voluntary disclosures (Gender, Ethnicity, Veteran Status)
 * - Self-Identification signature and date picker ("Today" button)
 * - Disability status selection
 * - Terms & conditions / voluntary agreement checkbox
 */

import {
  fillVoluntaryAgreement,
  fillSelfIdentification
} from '../filler/sections-filler.js';

import { fillFormFields } from '../filler.js';
import { ACTIONS } from '../../core/constants.js';

/**
 * Executes complete Step 4 (Voluntary Disclosures) automation flow
 */
export async function handleStep4(profile, currentFields, sendToBackground, overlayAssistant) {
  overlayAssistant?.updateState({ statusMessage: 'Step 4: Processing voluntary disclosures & EEO...' });

  // 1. Map demographic disclosure questions via background mapper
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
      const executableMappings = response.mappings.map(m => {
        const matchingField = currentFields.find(f => f.id === m.id || f.automationId === m.automationId);
        return {
          ...m,
          currentValue: matchingField?.currentValue,
          element: matchingField?.element,
          groupElements: matchingField?.groupElements
        };
      });

      await fillFormFields(executableMappings);
    }
  } catch (err) {
    console.debug('Step 4 AI disclosures notice:', err.message);
  }

  // 2. Click voluntary agreement checkbox
  await fillVoluntaryAgreement();

  // 3. Complete Self-Identification (name, today's date, disability status)
  await fillSelfIdentification(profile);

  const message = 'Step 4: Disclosures and self-identification filled successfully.';
  overlayAssistant?.updateState({
    isProcessing: false,
    statusMessage: message
  });

  return {
    success: true,
    step: 4,
    stepName: 'Voluntary Disclosures',
    message
  };
}
