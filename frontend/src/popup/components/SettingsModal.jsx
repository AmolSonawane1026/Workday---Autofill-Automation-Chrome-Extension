import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Trash2, CheckCircle2 } from 'lucide-react';
import { getSettings, saveSettings, clearAllData } from '../../core/security/storage.js';

export default function SettingsModal({ onSettingsSaved }) {
  const [settings, setSettings] = useState({
    highlightFilledFields: true,
    skipPrefilledFields: true,
    autoScrollToFields: true,
    showInPageAssistant: true
  });

  const [isSaved, setIsSaved] = useState(false);
  const [clearedMessage, setClearedMessage] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await getSettings();
    setSettings({
      highlightFilledFields: loaded.highlightFilledFields ?? true,
      skipPrefilledFields: loaded.skipPrefilledFields ?? true,
      autoScrollToFields: loaded.autoScrollToFields ?? true,
      showInPageAssistant: loaded.showInPageAssistant ?? true
    });
  };

  const handleToggle = async (key) => {
    const updated = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(updated);
    await saveSettings(updated);
    setIsSaved(true);
    if (onSettingsSaved) onSettingsSaved();
    setTimeout(() => setIsSaved(false), 1500);
  };

  const handleClear = async () => {
    if (window.confirm('Clear all stored profile details from this device?')) {
      await clearAllData();
      if (onSettingsSaved) onSettingsSaved();
      setClearedMessage(true);
      setTimeout(() => setClearedMessage(false), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Privacy & Automation banner */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-slate-900">Privacy & Data Security</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Your candidate information stays completely private on your machine and is only used to fill your job applications.
          </p>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 px-1">
          <Sliders className="w-3.5 h-3.5 text-slate-600" />
          <span>Autofill Preferences</span>
        </div>

        <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-xs font-medium text-slate-800">Highlight Filled Fields</p>
              <p className="text-[10px] text-slate-500">Adds visual blue glow around filled Workday inputs</p>
            </div>
            <input
              type="checkbox"
              checked={settings.highlightFilledFields}
              onChange={() => handleToggle('highlightFilledFields')}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between pt-2 border-t border-slate-200 cursor-pointer">
            <div>
              <p className="text-xs font-medium text-slate-800">Skip Pre-filled Fields</p>
              <p className="text-[10px] text-slate-500">Do not overwrite inputs that already have values</p>
            </div>
            <input
              type="checkbox"
              checked={settings.skipPrefilledFields}
              onChange={() => handleToggle('skipPrefilledFields')}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between pt-2 border-t border-slate-200 cursor-pointer">
            <div>
              <p className="text-xs font-medium text-slate-800">Auto-Scroll to Fields</p>
              <p className="text-[10px] text-slate-500">Smoothly scroll to each field as it is filled</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoScrollToFields}
              onChange={() => handleToggle('autoScrollToFields')}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {isSaved && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium px-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Preferences updated</span>
        </div>
      )}

      {/* Data Management */}
      <div className="pt-2 border-t border-slate-200">
        <button
          onClick={handleClear}
          className="w-full py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium flex items-center justify-center gap-1.5 border border-rose-200 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Stored Profile & Cache</span>
        </button>
        {clearedMessage && (
          <p className="text-[11px] text-emerald-600 text-center mt-1.5">Profile data cleared successfully.</p>
        )}
      </div>
    </div>
  );
}
