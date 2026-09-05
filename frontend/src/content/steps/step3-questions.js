/**
 * Workday Step 3: Application Questions Automation Module
 *
 * Handles:
 * - Dynamic questionnaire discovery and label analysis
 * - AI-driven semantic question-answer resolution (Work Auth, Visa Sponsorship, Prior Employment, EEO)
 * - Radio button selection and custom screening prompt completion
 */

import { fillFormFields } from '../filler.js';
import { ACTIONS } from '../../core/constants.js';

/**
 * Executes complete Step 3 (Application Questions) automation flow
 */
export async function handleStep3(profile, currentFields, sendToBackground, overlayAssistant) {
  overlayAssistant?.updateState({ statusMessage: 'Step 3: Mapping application questions with AI...' });

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
    overlayAssistant?.updateState({ statusMessage: 'Step 3: Answering application questions...' });

    const executableMappings = response.mappings.map(m => {
      const matchingField = currentFields.find(f => f.id === m.id || f.automationId === m.automationId);
      return {
        ...m,
        currentValue: matchingField?.currentValue,
        element: matchingField?.element,
        groupElements: matchingField?.groupElements
      };
    });

    const fillResult = await fillFormFields(executableMappings);
    const message = `Step 3: Filled ${fillResult.filledCount} application questions.`;

    overlayAssistant?.updateState({
      isProcessing: false,
      statusMessage: message
    });

    return {
      success: true,
      step: 3,
      stepName: 'Application Questions',
      filledCount: fillResult.filledCount,
      message
    };
  } else {
    const errorMsg = response?.error || 'Step 3: No mappings could be generated.';
    overlayAssistant?.updateState({
      isProcessing: false,
      statusMessage: errorMsg
    });

    return {
      success: false,
      step: 3,
      stepName: 'Application Questions',
      error: errorMsg
    };
  }
}
