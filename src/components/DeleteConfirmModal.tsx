import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recordDate: string;
  isOnlyRecord?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  recordDate,
  isOnlyRecord = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
      <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-black text-white p-4 flex items-center justify-between border-b-2 border-black">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 ${isOnlyRecord ? 'bg-amber-400 text-black' : 'bg-red-600 text-white'} border border-black font-bold`}>
              {isOnlyRecord ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <h3 className="font-serif italic text-lg font-bold">
              {isOnlyRecord ? 'Cannot Delete Record' : 'Confirm Record Deletion'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 text-black space-y-4">
          {isOnlyRecord ? (
            <p className="text-sm font-medium text-zinc-800">
              You cannot delete this record because it is the <strong>only remaining sheet</strong> in your database. Create a new record first before deleting this one.
            </p>
          ) : (
            <p className="text-sm font-medium text-zinc-800">
              Are you sure you want to delete the till cashing record for <strong className="font-mono bg-amber-100 px-1 py-0.5 border border-black">{recordDate}</strong>? This action will permanently remove it from Cloud and Local storage.
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-wider border-2 border-black cursor-pointer"
            >
              {isOnlyRecord ? 'OK' : 'Cancel'}
            </button>
            {!isOnlyRecord && (
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete Record
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
