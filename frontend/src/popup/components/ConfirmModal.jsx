import React from 'react';
import { AlertCircle, Send, ArrowLeft } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirmSubmit, filledSummary }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Confirm Submission</h4>
            <p className="text-xs text-slate-500">Please review before final submit</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Target Platform:</span>
            <span className="font-semibold text-slate-900">Workday Portal</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Verified Fields:</span>
            <span className="font-semibold text-slate-900">{filledSummary?.totalFields || 18} Fields</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>

          <button
            onClick={onConfirmSubmit}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-sm transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Confirm & Submit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
