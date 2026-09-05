import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, HelpCircle, Play, RefreshCw, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { ACTIONS } from '../../core/constants.js';
import { mapFormFields } from '../../core/ai/field-mapper.js';

export default function FieldReview({ profile, onTriggerAutofill }) {
  const [mappings, setMappings] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [isAutofillingStep, setIsAutofillingStep] = useState(false);
  const [stepStatusMessage, setStepStatusMessage] = useState(null);
  const [pageInfo, setPageInfo] = useState({ isWorkday: false, stepName: 'Detecting...', company: 'Workday', isAuthStep: false });
  const [fillSummary, setFillSummary] = useState(null);
  const [isOnWorkdayTab, setIsOnWorkdayTab] = useState(true);

  useEffect(() => {
    scanCurrentPage();
  }, [profile]);

  const scanCurrentPage = async () => {
    setIsScanning(true);
    setFillSummary(null);

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!activeTab?.id || !activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('chrome-extension://')) {
          setIsOnWorkdayTab(false);
          setIsScanning(false);
          return;
        }

        setIsOnWorkdayTab(true);

        chrome.tabs.sendMessage(activeTab.id, { action: ACTIONS.DETECT_PAGE }, async (detectRes) => {
          if (chrome.runtime.lastError) {
            try {
              if (chrome.scripting?.executeScript) {
                await chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ['content.js']
                });
                setTimeout(() => {
                  chrome.tabs.sendMessage(activeTab.id, { action: ACTIONS.DETECT_PAGE }, (retryRes) => {
                    const _ = chrome.runtime.lastError;
                    if (retryRes?.success) {
                      setPageInfo({
                        isWorkday: retryRes.isWorkday,
                        stepName: retryRes.stepInfo?.name || 'Application Step',
                        company: retryRes.company || 'Workday',
                        isAuthStep: Boolean(retryRes.stepInfo?.isAuthStep)
                      });
                      scanFieldsOnTab(activeTab.id);
                    } else {
                      setIsScanning(false);
                    }
                  });
                }, 300);
                return;
              }
            } catch {
              const _ = chrome.runtime.lastError;
              setIsScanning(false);
              return;
            }
            setIsScanning(false);
            return;
          }

          if (detectRes?.success) {
            setPageInfo({
              isWorkday: detectRes.isWorkday,
              stepName: detectRes.stepInfo?.name || 'Application Step',
              company: detectRes.company || 'Workday',
              isAuthStep: Boolean(detectRes.stepInfo?.isAuthStep)
            });
          }

          scanFieldsOnTab(activeTab.id);
        });
      } else {
        const mockFields = [
          { id: 'f1', label: 'First Name', automationId: 'legalNameSection_firstName', type: 'text', required: true },
          { id: 'f2', label: 'Last Name', automationId: 'legalNameSection_lastName', type: 'text', required: true },
          { id: 'f3', label: 'Email', automationId: 'email', type: 'email', required: true },
          { id: 'f4', label: 'Phone Number', automationId: 'phoneNumber', type: 'tel', required: true },
          { id: 'f5', label: 'City', automationId: 'addressSection_city', type: 'text', required: true },
          { id: 'f6', label: 'Are you legally authorized to work?', automationId: 'workAuthQuestion', type: 'radio', required: true }
        ];
        setPageInfo({ isWorkday: true, stepName: 'Create Account / Sign In', company: 'Target', isAuthStep: true });
        setIsScanning(false);
      }
    } catch (err) {
      console.debug('Scan error:', err);
      setIsScanning(false);
    }
  };

  const scanFieldsOnTab = (tabId) => {
    chrome.tabs.sendMessage(tabId, { action: ACTIONS.SCAN_FIELDS }, async (scanRes) => {
      const _ = chrome.runtime.lastError;
      if (scanRes?.success && scanRes.fields?.length) {
        if (profile) {
          await runFieldMapping(scanRes.fields);
        }
      }
      setIsScanning(false);
    });
  };

  const runFieldMapping = async (fields) => {
    setIsMapping(true);
    try {
      const mapped = await mapFormFields(fields, profile);
      setMappings(mapped);
    } catch (err) {
      console.debug('Mapping error:', err);
    } finally {
      setIsMapping(false);
    }
  };

  const updateMappingValue = (fieldId, newValue) => {
    setMappings(prev => prev.map(m => m.id === fieldId ? { ...m, value: newValue, source: 'user_override' } : m));
  };

  const handleAutofillStep = async () => {
    setIsAutofillingStep(true);
    setStepStatusMessage(null);
    setFillSummary(null);

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: ACTIONS.AUTOFILL_STEP
          }, (res) => {
            const err = chrome.runtime.lastError;
            setIsAutofillingStep(false);
            if (err) {
              setStepStatusMessage({
                success: false,
                text: err.message?.includes('Receiving end does not exist')
                  ? 'Please refresh the Workday page (press F5) and try again.'
                  : (err.message || 'Failed to communicate with Workday tab.')
              });
              return;
            }

            if (res?.success) {
              const msg = res.message || (res.result?.message) || 'Step autofilled successfully!';
              setStepStatusMessage({ success: true, text: msg });
              if (res.stepInfo?.name) {
                setPageInfo(prev => ({ ...prev, stepName: res.stepInfo.name }));
              }
              scanCurrentPage();
            } else {
              setStepStatusMessage({
                success: false,
                text: res?.error || res?.result?.error || 'Could not complete step autofill.'
              });
            }
          });
        }
      } else {
        setTimeout(() => {
          setIsAutofillingStep(false);
          setStepStatusMessage({ success: true, text: 'Simulated Step Autofill complete.' });
        }, 800);
      }
    } catch (err) {
      console.debug('Autofill step error:', err);
      setIsAutofillingStep(false);
      setStepStatusMessage({ success: false, text: err.message });
    }
  };

  const handleFillAll = async () => {
    if (!mappings.length) return;
    setIsFilling(true);

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: ACTIONS.FILL_FIELDS,
            data: { mappings }
          }, (res) => {
            const _ = chrome.runtime.lastError;
            setIsFilling(false);
            if (res?.success) {
              setFillSummary({ filled: res.filledCount, skipped: res.skippedCount });
            }
          });
        }
      } else {
        setTimeout(() => {
          setIsFilling(false);
          setFillSummary({ filled: mappings.length, skipped: 0 });
        }, 500);
      }
    } catch (err) {
      console.debug('Fill error:', err);
      setIsFilling(false);
    }
  };

  const handleFillEmailOnly = async () => {
    if (!profile?.personalInfo?.email) return;
    setIsFilling(true);

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: ACTIONS.FILL_FIELDS,
            data: {
              mappings: [
                { automationId: 'email', label: 'Email', value: profile.personalInfo.email, type: 'email' },
                { automationId: 'userName', label: 'Username', value: profile.personalInfo.email, type: 'email' },
                { automationId: 'createAccount_email', label: 'Email Address', value: profile.personalInfo.email, type: 'email' }
              ]
            }
          }, (res) => {
            const _ = chrome.runtime.lastError;
            setIsFilling(false);
            if (res?.success) {
              setFillSummary({ filled: 1, skipped: 0 });
            }
          });
        }
      }
    } catch {
      setIsFilling(false);
    }
  };

  const isAuthPage = pageInfo.isAuthStep || pageInfo.stepName.toLowerCase().includes('create account') || pageInfo.stepName.toLowerCase().includes('sign in');

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.85) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-2.5 h-2.5" /> High
        </span>
      );
    }
    if (confidence >= 0.5) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-2.5 h-2.5" /> Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <HelpCircle className="w-2.5 h-2.5" /> Review
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Context Banner */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-800">{pageInfo.company} Careers Portal</p>
          <p className="text-[11px] text-slate-500">Step: {pageInfo.stepName}</p>
        </div>

        <button
          onClick={scanCurrentPage}
          disabled={isScanning}
          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1.5 border border-slate-200 shadow-2xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>Re-scan</span>
        </button>
      </div>

      {fillSummary && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Filled <strong>{fillSummary.filled}</strong> field(s).</span>
        </div>
      )}

      {stepStatusMessage && (
        <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
          stepStatusMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {stepStatusMessage.success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed font-medium">{stepStatusMessage.text}</span>
        </div>
      )}

      {/* Case 1: User is on Create Account / Sign In Step */}
      {isAuthPage ? (
        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-blue-950">Please Sign In or Create an Account</h4>
              <p className="text-[11px] text-blue-900 mt-1 leading-relaxed">
                Workday requires an account to apply. Please choose a password and sign in on the page to begin.
              </p>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>Autofill will activate immediately once signed in!</span>
              </div>
            </div>
          </div>

          {profile?.personalInfo?.email && (
            <button
              onClick={handleFillEmailOnly}
              disabled={isFilling}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-2xs transition"
            >
              <span>Autofill Email ({profile.personalInfo.email})</span>
            </button>
          )}
        </div>
      ) : (
        /* Case 2: User is on Application Form Steps */
        <div className="space-y-3">
          {/* Primary Action Card: Step-Aware Autofill */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Smart Step Automation</span>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                {pageInfo.stepName}
              </span>
            </div>
            <p className="text-[11px] text-blue-100 leading-snug">
              Autofills this step (including Country, Phone Code, Work Experience, Education, and Skills one-by-one).
            </p>
            <button
              onClick={handleAutofillStep}
              disabled={isAutofillingStep || isScanning || !isOnWorkdayTab}
              className="w-full py-2.5 px-3 rounded-lg bg-white hover:bg-slate-50 active:scale-[0.99] text-blue-700 font-semibold text-xs flex items-center justify-center gap-2 shadow transition disabled:opacity-60"
            >
              {isAutofillingStep ? (
                <>
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>Autofilling {pageInfo.stepName}...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-blue-700 text-blue-700" />
                  <span>Autofill Form Step</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Detected Fields</span>
              <span>Mapped Values</span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {isMapping ? (
                <div className="py-8 text-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Mapping form fields...</p>
                </div>
              ) : mappings.length > 0 ? (
                mappings.map((mapping, idx) => (
                  <div key={mapping.id || idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-800">
                        {mapping.label} {mapping.required && <span className="text-red-500">*</span>}
                      </span>
                      {getConfidenceBadge(mapping.confidence)}
                    </div>

                    <input
                      type="text"
                      value={mapping.value !== undefined ? mapping.value : ''}
                      onChange={(e) => updateMappingValue(mapping.id, e.target.value)}
                      placeholder="Empty value"
                      className="w-full px-2.5 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))
              ) : (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-600 font-medium">
                    {!isOnWorkdayTab ? 'Open a Workday job application tab and click Re-scan.' : (profile ? 'Please sign in or navigate to an application step (e.g. My Information).' : 'Upload your resume in the Resume tab first.')}
                  </p>
                </div>
              )}
            </div>

            {mappings.length > 0 && (
              <button
                onClick={handleFillAll}
                disabled={!mappings.length || isFilling || isAutofillingStep}
                className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-2 border border-slate-200 transition"
              >
                {isFilling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Filling fields...</span>
                  </>
                ) : (
                  <>
                    <span>Fill Standard Mapped Fields Only ({mappings.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
