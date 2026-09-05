import React, { useState, useEffect } from 'react';
import { UploadCloud, User, Settings, Play } from 'lucide-react';
import ResumeUpload from './components/ResumeUpload.jsx';
import ProfileEditor from './components/ProfileEditor.jsx';
import FieldReview from './components/FieldReview.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import { getProfile, getSettings } from '../core/security/storage.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('resume');
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const loadedProfile = await getProfile();
    const loadedSettings = await getSettings();
    setProfile(loadedProfile);
    setSettings(loadedSettings);
  };

  const handleConfirmSubmit = () => {
    setIsConfirmOpen(false);
    alert('Application submitted successfully!');
  };

  return (
    <div className="flex flex-col h-full min-h-[520px] bg-white text-slate-900 p-4 select-none">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            W
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">Workday Assistant</h1>
            <p className="text-[11px] text-slate-500">Auto-fill & Application Helper</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="font-medium text-slate-700">Active</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex p-1 my-3 bg-slate-100 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab('resume')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'resume'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Resume</span>
        </button>

        <button
          onClick={() => setActiveTab('autofill')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'autofill'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Autofill</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'profile'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'settings'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'resume' && (
          <ResumeUpload
            profile={profile}
            onProfileUpdated={(newProfile) => setProfile(newProfile)}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileEditor
            profile={profile}
            onProfileSaved={(newProfile) => setProfile(newProfile)}
          />
        )}

        {activeTab === 'autofill' && (
          <FieldReview
            profile={profile}
            onTriggerAutofill={() => setIsConfirmOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModal
            onSettingsSaved={loadData}
          />
        )}
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirmSubmit={handleConfirmSubmit}
      />
    </div>
  );
}
