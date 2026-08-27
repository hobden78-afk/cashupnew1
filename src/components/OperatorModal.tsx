import React, { useState } from 'react';
import { User, Plus, Trash2, X, Check, Users, Edit2, Save } from 'lucide-react';

interface OperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  operators: string[];
  onAddOperator: (name: string) => void;
  onDeleteOperator: (name: string) => void;
  onEditOperator?: (oldName: string, newName: string) => void;
  selectedOperator?: string;
  onSelectOperator?: (name: string) => void;
}

export const OperatorModal: React.FC<OperatorModalProps> = ({
  isOpen,
  onClose,
  operators,
  onAddOperator,
  onDeleteOperator,
  onEditOperator,
  selectedOperator,
  onSelectOperator,
}) => {
  const [newOperatorName, setNewOperatorName] = useState('');
  const [editingOperator, setEditingOperator] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOperatorName.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a staff / operator name.');
      return;
    }
    if (operators.some((op) => op.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('A staff member with this name already exists.');
      return;
    }

    onAddOperator(trimmed);
    if (onSelectOperator) {
      onSelectOperator(trimmed);
    }
    setNewOperatorName('');
    setErrorMsg('');
  };

  const handleStartEdit = (op: string) => {
    setEditingOperator(op);
    setEditNameValue(op);
    setErrorMsg('');
  };

  const handleCancelEdit = () => {
    setEditingOperator(null);
    setEditNameValue('');
    setErrorMsg('');
  };

  const handleSaveEdit = (oldName: string) => {
    const trimmed = editNameValue.trim();
    if (!trimmed) {
      setErrorMsg('Staff name cannot be empty.');
      return;
    }
    if (
      trimmed.toLowerCase() !== oldName.toLowerCase() &&
      operators.some((op) => op.toLowerCase() === trimmed.toLowerCase())
    ) {
      setErrorMsg('Another staff member with this name already exists.');
      return;
    }

    if (onEditOperator) {
      onEditOperator(oldName, trimmed);
    }
    if (selectedOperator === oldName && onSelectOperator) {
      onSelectOperator(trimmed);
    }
    setEditingOperator(null);
    setEditNameValue('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-400 text-black border border-black font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-lg tracking-wide text-white">
                Staff & Operator Database
              </h2>
              <p className="text-[11px] font-mono text-zinc-400">
                Manage authorised till operators & audit staff
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded cursor-pointer transition-colors border border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to Add Operator */}
        <div className="p-4 bg-amber-50 border-b-2 border-black">
          <label className="block text-xs font-extrabold text-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-600" />
            Add New Staff Member / Operator
          </label>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Sarah Jenkins"
              value={newOperatorName}
              onChange={(e) => {
                setNewOperatorName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              className="flex-1 bg-white border-2 border-black px-3 py-2 text-sm font-mono text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="bg-black hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider px-4 py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-4 h-4 text-amber-400" /> Add Staff
            </button>
          </form>
          {errorMsg && (
            <p className="text-xs font-bold text-rose-600 mt-1.5 font-mono">{errorMsg}</p>
          )}
        </div>

        {/* Existing Operators List */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span>Staff Roster ({operators.length})</span>
            <span>Click name to assign to current sheet</span>
          </div>

          <div className="space-y-2">
            {operators.map((op) => {
              const isSelected = selectedOperator === op;
              const isEditing = editingOperator === op;

              if (isEditing) {
                return (
                  <div
                    key={op}
                    className="flex items-center gap-2 p-2 bg-amber-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <User className="w-4 h-4 text-amber-700 shrink-0" />
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(op);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 bg-white border border-black px-2.5 py-1 text-sm font-mono font-bold text-black focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(op)}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-black cursor-pointer"
                      title="Save Staff Name"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-1.5 bg-zinc-200 hover:bg-zinc-300 text-black border border-black cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={op}
                  className={`flex items-center justify-between p-2.5 border-2 transition-all ${
                    isSelected
                      ? 'bg-amber-100 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-zinc-50 border-zinc-300 hover:border-black'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectOperator) onSelectOperator(op);
                    }}
                    className="flex-1 text-left flex items-center gap-2 text-sm text-black cursor-pointer"
                  >
                    <User className={`w-4 h-4 ${isSelected ? 'text-amber-700' : 'text-zinc-500'}`} />
                    <span className="font-mono font-bold">{op}</span>
                    {isSelected && (
                      <span className="bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 border border-black flex items-center gap-1 ml-auto">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(op)}
                      title={`Edit / Rename ${op}`}
                      className="text-zinc-600 hover:text-black p-1.5 hover:bg-zinc-200 border border-transparent hover:border-zinc-400 rounded cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteOperator(op)}
                      title={`Delete ${op} from roster`}
                      className="text-zinc-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-300 rounded cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-100 p-3 border-t-2 border-black flex items-center justify-between">
          <div className="text-[11px] font-mono text-zinc-500">
            Changes automatically save to Cloud & local storage
          </div>
          <button
            onClick={onClose}
            className="bg-black hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-2 border-2 border-black transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
