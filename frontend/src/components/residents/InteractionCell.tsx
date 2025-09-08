'use client';

import React from 'react';
import { Plus, Copy, Edit3, Trash, Loader2 } from 'lucide-react';

interface Interaction {
  id: string;
  resident_id: string;
  details: string;
  date: string;
  column?: number;
  is_submitted?: boolean;
}

interface Resident {
  id: string;
  name: string;
  empl_id: string;
  email?: string;
  room?: string | null;
}

interface InteractionCellProps {
  resident: Resident;
  interaction: Interaction | null;
  column: number;
  isExpanded: boolean;
  isAddingToCell: boolean;
  isDeletingInteraction: boolean;
  onToggleExpansion: (cellId: string) => void;
  onAddClick: (residentId: string, column: number, event: React.MouseEvent) => void;
  onEditClick: (interaction: Interaction, residentId: string, column: number, event: React.MouseEvent) => void;
  onCopyClick: (text: string) => void;
  onDeleteClick: (interactionId: string) => void;
}

const getPreviewText = (text: string, maxLength: number = 20) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const getExpandedText = (text: string, maxLength: number = 150) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default function InteractionCell({
  resident,
  interaction,
  column,
  isExpanded,
  isAddingToCell,
  isDeletingInteraction,
  onToggleExpansion,
  onAddClick,
  onEditClick,
  onCopyClick,
  onDeleteClick,
}: InteractionCellProps) {
  const cellId = `${resident.id}-${column}`;
  const isRightmostColumn = column === 3;

  return (
    <td
      className={`${!isRightmostColumn ? 'border-r border-gray-300 dark:border-gray-600' : ''} p-2 text-center relative group ${
        interaction 
          ? interaction.is_submitted 
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-yellow-100 dark:bg-yellow-900/30'
          : ''
      }`}
      style={{minHeight: '100px', height: '100px', width: '270px', minWidth: '270px'}}
    >
      {interaction ? (
        <div className="relative w-full h-full">
          <div 
            className={`text-xs p-2 flex flex-col justify-center relative cursor-pointer w-full h-full ${
              isExpanded ? 'max-h-56' : 'max-h-20'
            } overflow-hidden ${
              interaction.is_submitted 
                ? 'text-green-900 dark:text-green-100'
                : 'text-yellow-900 dark:text-yellow-100'
            }`}
            onClick={() => onToggleExpansion(cellId)}
          >
            <div 
              className={`text-center break-all leading-relaxed w-full overflow-wrap-anywhere max-w-full ${
                interaction.is_submitted 
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-yellow-900 dark:text-yellow-100'
              }`}
              style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}
              title={isExpanded ? 'Click to collapse' : 'Click to expand full text'}
            >
              {isExpanded 
                ? getExpandedText(interaction.details)
                : getPreviewText(interaction.details)
              }
            </div>
            {interaction.details.length > 10 && (
              <span 
                className={`text-xs opacity-60 mt-1 cursor-pointer ${
                  interaction.is_submitted 
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}
                onClick={() => onToggleExpansion(cellId)}
              >
                {isExpanded ? 'Click to collapse' : 'Click to expand'}
              </span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1 z-10">
            {/* Edit Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditClick(interaction, resident.id, column, e);
              }}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs bg-white/90 dark:bg-gray-800/90 shadow-sm backdrop-blur-sm border border-gray-200 dark:border-gray-600 ${
                interaction.is_submitted 
                  ? 'hover:bg-green-200 dark:hover:bg-green-700'
                  : 'hover:bg-yellow-200 dark:hover:bg-yellow-700'
              }`}
              title="Edit interaction"
            >
              <Edit3 className={`h-3.5 w-3.5 ${
                interaction.is_submitted 
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`} />
            </button>
            
            {/* Copy Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyClick(interaction.details);
              }}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs bg-white/90 dark:bg-gray-800/90 shadow-sm backdrop-blur-sm border border-gray-200 dark:border-gray-600 ${
                interaction.is_submitted 
                  ? 'hover:bg-green-200 dark:hover:bg-green-700'
                  : 'hover:bg-yellow-200 dark:hover:bg-yellow-700'
              }`}
              title="Copy interaction details"
            >
              <Copy className={`h-3.5 w-3.5 ${
                interaction.is_submitted 
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`} />
            </button>
            
            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(interaction.id);
              }}
              disabled={isDeletingInteraction}
              className="w-6 h-6 flex items-center justify-center rounded text-xs bg-white/90 dark:bg-gray-800/90 shadow-sm backdrop-blur-sm border border-gray-200 dark:border-gray-600 hover:bg-red-200 dark:hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete interaction"
            >
              {isDeletingInteraction ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600" />
              ) : (
                <Trash className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <button
            onClick={(e) => onAddClick(resident.id, column, e)}
            className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-800 flex items-center justify-center transition-colors duration-200"
            disabled={isAddingToCell}
          >
            {isAddingToCell ? (
              <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            )}
          </button>
        </div>
      )}
    </td>
  );
}