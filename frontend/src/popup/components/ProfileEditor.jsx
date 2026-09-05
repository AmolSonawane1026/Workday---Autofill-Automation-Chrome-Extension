import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, CheckCircle2, User, Briefcase, GraduationCap, ShieldCheck, Award, X } from 'lucide-react';
import { saveProfile } from '../../core/security/storage.js';

export default function ProfileEditor({ profile, onProfileSaved }) {
  const [formData, setFormData] = useState(profile || {
    personalInfo: {
      firstName: '', lastName: '', fullName: '', email: '', phone: '',
      address: { street: '', city: '', state: '', postalCode: '', country: 'India' },
      linkedIn: '', github: '', portfolio: ''
    },
    workExperience: [],
    education: [],
    skills: { technical: [], tools: [], soft: [], languages: [] },
    workAuthorization: { authorizedInTargetCountry: true, requiresSponsorship: false }
  });

  const [activeSubTab, setActiveSubTab] = useState('personal');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      const pi = profile.personalInfo || {};
      const p = profile.personal || {};
      const addr = pi.address || p.address || {};
      const normalized = {
        ...profile,
        personalInfo: {
          firstName: pi.firstName || p.first_name || p.firstName || '',
          lastName: pi.lastName || p.last_name || p.lastName || '',
          fullName: pi.fullName || p.fullName || `${pi.firstName || p.first_name || ''} ${pi.lastName || p.last_name || ''}`.trim(),
          email: pi.email || p.email || '',
          phone: pi.phone || p.phone || '',
          address: {
            street: addr.street || addr.addressLine1 || '',
            city: addr.city || '',
            state: addr.state || '',
            postalCode: addr.postalCode || addr.postal_code || '',
            country: addr.country || 'India'
          },
          linkedIn: pi.linkedIn || p.linkedIn || '',
          github: pi.github || p.github || '',
          portfolio: pi.portfolio || p.portfolio || ''
        }
      };
      setFormData(normalized);
    }
  }, [profile]);

  const handleSave = async () => {
    const pi = formData.personalInfo || {};
    const addr = pi.address || {};
    const updatedProfile = {
      ...formData,
      personalInfo: {
        ...pi,
        fullName: `${pi.firstName || ''} ${pi.lastName || ''}`.trim()
      },
      personal: {
        first_name: pi.firstName || '',
        last_name: pi.lastName || '',
        fullName: `${pi.firstName || ''} ${pi.lastName || ''}`.trim(),
        email: pi.email || '',
        phone: pi.phone || '',
        location: [addr.city, addr.state, addr.country].filter(Boolean).join(', '),
        address: { ...addr }
      },
      lastUpdated: new Date().toISOString()
    };
    await saveProfile(updatedProfile);
    setFormData(updatedProfile);
    setIsSaved(true);
    if (onProfileSaved) onProfileSaved(updatedProfile);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const updatePersonalInfo = (field, value) => {
    setFormData(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value }
    }));
  };

  const updateAddress = (field, value) => {
    setFormData(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        address: { ...prev.personalInfo?.address, [field]: value }
      }
    }));
  };

  const addExperience = () => {
    setFormData(prev => ({
      ...prev,
      workExperience: [
        ...(prev.workExperience || []),
        { company: '', jobTitle: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '', highlights: [] }
      ]
    }));
  };

  const removeExperience = (index) => {
    setFormData(prev => ({
      ...prev,
      workExperience: prev.workExperience.filter((_, i) => i !== index)
    }));
  };

  const updateExperience = (index, field, value) => {
    setFormData(prev => {
      const updated = [...(prev.workExperience || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workExperience: updated };
    });
  };

  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [
        ...(prev.education || []),
        { institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', gpa: '' }
      ]
    }));
  };

  const removeEducation = (index) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };

  const updateEducation = (index, field, value) => {
    setFormData(prev => {
      const updated = [...(prev.education || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
  };

  const addSkill = () => {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    const current = formData.skills?.technical || [];
    if (!current.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        skills: {
          ...prev.skills,
          technical: [...current, trimmed]
        }
      }));
    }
    setNewSkillInput('');
  };

  const removeSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        technical: (prev.skills?.technical || []).filter(s => s !== skillToRemove)
      }
    }));
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200 gap-1 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('personal')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            activeSubTab === 'personal' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Personal</span>
        </button>

        <button
          onClick={() => setActiveSubTab('experience')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            activeSubTab === 'experience' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Experience</span>
        </button>

        <button
          onClick={() => setActiveSubTab('education')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            activeSubTab === 'education' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Education</span>
        </button>

        <button
          onClick={() => setActiveSubTab('skills')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            activeSubTab === 'skills' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Skills ({formData.skills?.technical?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('auth')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            activeSubTab === 'auth' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Work Auth</span>
        </button>
      </div>

      {/* Form Fields Container */}
      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {activeSubTab === 'personal' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600">First Name</label>
                <input
                  type="text"
                  value={formData.personalInfo?.firstName || ''}
                  onChange={(e) => updatePersonalInfo('firstName', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Last Name</label>
                <input
                  type="text"
                  value={formData.personalInfo?.lastName || ''}
                  onChange={(e) => updatePersonalInfo('lastName', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600">Email Address</label>
                <input
                  type="email"
                  value={formData.personalInfo?.email || ''}
                  onChange={(e) => updatePersonalInfo('email', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Phone Number</label>
                <input
                  type="tel"
                  value={formData.personalInfo?.phone || ''}
                  onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600">Street Address</label>
              <input
                type="text"
                value={formData.personalInfo?.address?.street || ''}
                onChange={(e) => updateAddress('street', e.target.value)}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600">City</label>
                <input
                  type="text"
                  value={formData.personalInfo?.address?.city || ''}
                  onChange={(e) => updateAddress('city', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">State / Region</label>
                <input
                  type="text"
                  value={formData.personalInfo?.address?.state || ''}
                  onChange={(e) => updateAddress('state', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">Postal Code</label>
                <input
                  type="text"
                  value={formData.personalInfo?.address?.postalCode || ''}
                  onChange={(e) => updateAddress('postalCode', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600">LinkedIn URL</label>
                <input
                  type="text"
                  value={formData.personalInfo?.linkedIn || ''}
                  onChange={(e) => updatePersonalInfo('linkedIn', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">GitHub URL</label>
                <input
                  type="text"
                  value={formData.personalInfo?.github || ''}
                  onChange={(e) => updatePersonalInfo('github', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'experience' && (
          <div className="space-y-3">
            {(formData.workExperience || []).map((exp, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 relative">
                <button
                  onClick={() => removeExperience(idx)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="grid grid-cols-2 gap-2 pr-6">
                  <div>
                    <label className="text-[10px] text-slate-500">Job Title</label>
                    <input
                      type="text"
                      value={exp.jobTitle || ''}
                      onChange={(e) => updateExperience(idx, 'jobTitle', e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Company</label>
                    <input
                      type="text"
                      value={exp.company || ''}
                      onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Start Date</label>
                    <input
                      type="text"
                      value={exp.startDate || ''}
                      onChange={(e) => updateExperience(idx, 'startDate', e.target.value)}
                      placeholder="e.g. Nov 2024"
                      className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">End Date</label>
                    <input
                      type="text"
                      value={exp.endDate || ''}
                      onChange={(e) => updateExperience(idx, 'endDate', e.target.value)}
                      placeholder="e.g. Present"
                      className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addExperience}
              className="w-full py-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 text-xs text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Work Experience</span>
            </button>
          </div>
        )}

        {activeSubTab === 'education' && (
          <div className="space-y-3">
            {(formData.education || []).map((edu, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 relative">
                <button
                  onClick={() => removeEducation(idx)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div>
                  <label className="text-[10px] text-slate-500">School / University</label>
                  <input
                    type="text"
                    value={edu.institution || ''}
                    onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Degree</label>
                    <input
                      type="text"
                      value={edu.degree || ''}
                      onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Field of Study</label>
                    <input
                      type="text"
                      value={edu.fieldOfStudy || ''}
                      onChange={(e) => updateEducation(idx, 'fieldOfStudy', e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-white border border-slate-300 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addEducation}
              className="w-full py-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 text-xs text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Education</span>
            </button>
          </div>
        )}

        {activeSubTab === 'skills' && (
          <div className="space-y-3">
            {/* Add Skill Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                placeholder="Type skill & press Add..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition"
              >
                Add
              </button>
            </div>

            {/* Skills Tag Pills Grid (Workday Style) */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-medium text-slate-500 mb-2">Itemized Skills for Workday Autocomplete:</p>
              <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
                {(formData.skills?.technical || []).map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-800 shadow-2xs group"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'auth' && (
          <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-800">Legally Authorized to Work</p>
                <p className="text-[11px] text-slate-500">Authorized in country of target job</p>
              </div>
              <input
                type="checkbox"
                checked={formData.workAuthorization?.authorizedInTargetCountry !== false}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  workAuthorization: { ...prev.workAuthorization, authorizedInTargetCountry: e.target.checked }
                }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <p className="text-xs font-medium text-slate-800">Requires Visa Sponsorship</p>
                <p className="text-[11px] text-slate-500">Will require sponsorship now or in the future</p>
              </div>
              <input
                type="checkbox"
                checked={formData.workAuthorization?.requiresSponsorship === true}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  workAuthorization: { ...prev.workAuthorization, requiresSponsorship: e.target.checked }
                }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition"
      >
        {isSaved ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile Saved</span>
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </>
        )}
      </button>
    </div>
  );
}
