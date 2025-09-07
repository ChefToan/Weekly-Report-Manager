'use client';

import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { FloatingPortal } from '@floating-ui/react';

interface Resident {
  id: string;
  name: string;
  empl_id: string;
  email?: string;
  room?: string | null;
}

interface InteractionFormData {
  details: string;
  date: string;
}

interface InteractionPopoverProps {
  // Floating UI props
  floatingRefs: any;
  floatingStyles: any;
  getFloatingProps: () => any;
  
  // Mode and data
  mode: 'add' | 'edit';
  showPopover: {residentId: string, column: number} | null;
  editingInteraction: {interactionId: string, residentId: string, column: number, isSubmitted: boolean} | null;
  residents: Resident[];
  
  // Form data
  interactionFormData: InteractionFormData;
  editFormData: InteractionFormData;
  
  // State
  addingInteraction: boolean;
  
  // Event handlers
  onClose: () => void;
  onInteractionFormDataChange: (data: Partial<InteractionFormData>) => void;
  onEditFormDataChange: (data: Partial<InteractionFormData>) => void;
  onAddInteraction: () => void;
  onUpdateInteraction: (markAsSubmitted?: boolean) => void;
}

export default function InteractionPopover({
  floatingRefs,
  floatingStyles,
  getFloatingProps,
  mode,
  showPopover,
  editingInteraction,
  residents,
  interactionFormData,
  editFormData,
  addingInteraction,
  onClose,
  onInteractionFormDataChange,
  onEditFormDataChange,
  onAddInteraction,
  onUpdateInteraction,
}: InteractionPopoverProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when popover opens
  useEffect(() => {
    if (showPopover || editingInteraction) {
      const focusTextarea = (attempt = 0) => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        } else if (attempt < 5) {
          setTimeout(() => focusTextarea(attempt + 1), 50 + (attempt * 50));
        }
      };
      
      const timer = setTimeout(() => focusTextarea(), 150);
      return () => clearTimeout(timer);
    }
  }, [showPopover, editingInteraction]);

  if (!showPopover && !editingInteraction) {
    return null;
  }

  const currentResident = residents.find(r => 
    r.id === (editingInteraction?.residentId || showPopover?.residentId)
  );
  const currentColumn = editingInteraction?.column || showPopover?.column;
  const currentFormData = mode === 'edit' ? editFormData : interactionFormData;

  return (
    <FloatingPortal>
      <div
        ref={floatingRefs.setFloating}
        style={floatingStyles}
        className="z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[400px]"
        {...getFloatingProps()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm text-gray-900 dark:text-gray-100">
            <span className="font-semibold">
              {mode === 'edit' ? 'Edit' : 'Add'} Interaction {currentColumn}
            </span>
            <span className="font-normal text-gray-600 dark:text-gray-400">
              {' '}for {currentResident?.name || 'Unknown'}
            </span>
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          {/* Date Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={currentFormData.date}
              onChange={(e) => {
                if (mode === 'edit') {
                  onEditFormDataChange({ date: e.target.value });
                } else {
                  onInteractionFormDataChange({ date: e.target.value });
                }
              }}
              className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Details Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Interaction Details
            </label>
            <textarea
              ref={textareaRef}
              value={currentFormData.details}
              onChange={(e) => {
                if (mode === 'edit') {
                  onEditFormDataChange({ details: e.target.value });
                } else {
                  onInteractionFormDataChange({ details: e.target.value });
                }
              }}
              placeholder="Describe the interaction..."
              rows={6}
              className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:font-normal"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-4">
          {/* Primary Actions Row */}
          <div className="flex gap-2">
            <button
              onClick={() => mode === 'edit' ? onUpdateInteraction(false) : onAddInteraction()}
              disabled={!currentFormData.details.trim() || addingInteraction}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addingInteraction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {mode === 'edit' ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                mode === 'edit' ? 'Update' : 'Add'
              )}
            </button>

            <button
              onClick={onClose}
              className="px-6 py-2 text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>

          {/* Submit Button (only for edit mode and not already submitted) */}
          {mode === 'edit' && editingInteraction && !editingInteraction.isSubmitted && (
            <button
              onClick={() => onUpdateInteraction(true)}
              disabled={!currentFormData.details.trim() || addingInteraction}
              className="w-full px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title="Update interaction and mark as submitted"
            >
              {addingInteraction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Mark as Submitted
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </FloatingPortal>
  );
}