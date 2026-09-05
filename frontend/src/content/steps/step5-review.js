/**
 * Workday Step 5: Review & Confirmation Module
 *
 * Handles:
 * - Application final review screen validation
 * - Inspecting required fields to verify completeness
 * - Enforcing explicit user confirmation before submission
 *   (Strict compliance with assignment requirement: "submit only after explicit user confirmation")
 */

import { findSubmitButton, validateRequiredFields } from '../navigator.js';

/**
 * Handles Step 5 review screen inspection and safety verification
 */
export async function handleStep5(currentFields, overlayAssistant) {
  overlayAssistant?.updateState({ statusMessage: 'Step 5: Reviewing application for submission...' });

  const missingFields = validateRequiredFields(currentFields);
  const submitBtn = findSubmitButton();

  if (missingFields.length > 0) {
    const errorMsg = `Review Alert: ${missingFields.length} required fields appear empty. Please check: ${missingFields.map(f => f.label || f.name).join(', ')}`;
    overlayAssistant?.updateState({
      isProcessing: false,
      statusMessage: errorMsg
    });

    return {
      success: false,
      step: 5,
      stepName: 'Review',
      missingFields: missingFields.map(f => f.label || f.name),
      hasSubmitButton: Boolean(submitBtn),
      message: errorMsg
    };
  }

  const successMsg = 'Step 5: Review complete. All required fields are valid. Ready for candidate submission confirmation.';
  overlayAssistant?.updateState({
    isProcessing: false,
    statusMessage: successMsg
  });

  return {
    success: true,
    step: 5,
    stepName: 'Review',
    missingFields: [],
    hasSubmitButton: Boolean(submitBtn),
    requiresUserConfirmation: true,
    message: successMsg
  };
}
