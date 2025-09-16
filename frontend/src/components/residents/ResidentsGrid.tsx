'use client';
// Updated: Grid width fixes applied - v3.0 with improved interaction cell layout

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Copy, UserPlus, Trash2, X, Edit2, Check } from 'lucide-react';
import { sortResidentsByRoom } from '@/utils/roomSorting';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
} from '@floating-ui/react';
import InteractionPopover from './InteractionPopover';

interface Resident {
  id: string;
  name: string;
  empl_id: string;
  email?: string;
  room?: string | null;
}

interface Interaction {
  id: string;
  resident_id: string;
  details: string;
  date: string;
  created_at?: string;
  column?: number;
  is_submitted?: boolean;
}

interface InteractionFormData {
  details: string;
  date: string;
}

interface ResidentsGridProps {
  onInteractionUpdate?: () => void;
}

// Helper function to get local date string (avoids timezone offset issues)
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to format date string without timezone issues
const formatDateString = (dateString: string) => {
  // Parse date as local time by adding 'T12:00:00' to avoid UTC interpretation
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper function to format created_at timestamp to local date
const formatTimestampToLocalDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const InteractionCell: React.FC<{
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
  onDeleteClick: (id: string) => void;
}> = ({
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
      }) => {
  const cellId = `${resident.id}-${column}`;
  const hasBorder = column < 3;

  if (!interaction) {
    return (
        <td
            className={`${hasBorder ? 'border-r border-gray-300 dark:border-gray-600' : ''} p-3 text-center relative`}
            style={{ width: '250px', maxWidth: '250px' }}
        >
          <button
              onClick={(e) => onAddClick(resident.id, column, e)}
              disabled={isAddingToCell}
              className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Add interaction"
          >
            {isAddingToCell ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 dark:border-gray-300" />
            ) : (
                <Plus className="h-3 w-3" />
            )}
          </button>
        </td>
    );
  }

  const isSubmitted = interaction.is_submitted || false;
  const fullText = interaction.details;

  // Create preview text (first 50 characters)
  const previewText = fullText.length > 25 ? fullText.substring(0, 25) + '...' : fullText;

  return (
      <td
          className={`${hasBorder ? 'border-r border-gray-300 dark:border-gray-600' : ''} p-2 relative group ${
              isSubmitted
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-yellow-50 dark:bg-yellow-900/20'
          }`}
          style={{ width: '250px', maxWidth: '250px' }}
      >
        <div className="flex gap-1">
          {/* Main content area */}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium mb-1 ${
                isSubmitted
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-yellow-700 dark:text-yellow-400'
            }`}>
              {interaction.created_at ? formatTimestampToLocalDate(interaction.created_at) : formatDateString(interaction.date)}
              {isSubmitted && ' • Submitted'}
            </div>
            <div
                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                onClick={() => onToggleExpansion(cellId)}
                title="Click to expand/collapse"
            >
              {isExpanded ? (
                  // Expanded view - allow text to wrap properly
                  <div className="whitespace-pre-wrap break-words">
                    {fullText}
                  </div>
              ) : (
                  // Preview view - truncated text
                  <div className="truncate">
                    {previewText}
                  </div>
              )}
            </div>
            {!isExpanded && fullText.length > 50 && (
                <button
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    onClick={() => onToggleExpansion(cellId)}
                >
                  Show more
                </button>
            )}
            {isExpanded && (
                <button
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    onClick={() => onToggleExpansion(cellId)}
                >
                  Show less
                </button>
            )}
          </div>

          {/* Vertical button group - only visible on hover */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
                onClick={(e) => onEditClick(interaction, resident.id, column, e)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded"
                title="Edit interaction"
            >
              <Edit2 className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            </button>
            <button
                onClick={() => onDeleteClick(interaction.id)}
                disabled={isDeletingInteraction}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded"
                title="Delete interaction"
            >
              {isDeletingInteraction ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 dark:border-gray-400" />
              ) : (
                  <Trash2 className="h-3 w-3 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
                onClick={() => onCopyClick(interaction.details)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded"
                title="Copy interaction"
            >
              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </td>
  );
};

export default function ResidentsGrid({ onInteractionUpdate }: ResidentsGridProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [showPopover, setShowPopover] = useState<{residentId: string, column: number} | null>(null);
  const [interactionFormData, setInteractionFormData] = useState<InteractionFormData>({
    details: '',
    date: getLocalDateString()
  });
  const [showAddResidents, setShowAddResidents] = useState(false);

  // Floating UI setup
  const { refs, floatingStyles, context } = useFloating({
    open: !!showPopover,
    onOpenChange: (open) => {
      if (!open) setShowPopover(null);
    },
    placement: 'bottom',
    strategy: 'fixed',
    middleware: [
      offset(10),
      flip({
        fallbackAxisSideDirection: "start",
        boundary: 'clippingAncestors',
        padding: {
          top: 100,
          bottom: 20,
          left: 10,
          right: 10
        }
      }),
      shift({
        boundary: 'clippingAncestors',
        padding: {
          top: 100,
          bottom: 20,
          left: 10,
          right: 10
        }
      }),
      size({
        apply({ availableHeight, elements }) {
          const headerHeight = 100;
          const maxHeight = Math.max(200, availableHeight - headerHeight);

          Object.assign(elements.floating.style, {
            maxHeight: `${maxHeight}px`,
            overflowY: 'auto',
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [addMode, setAddMode] = useState<'csv' | 'manual'>('csv');
  const [manualResident, setManualResident] = useState({ name: '', empl_id: '', room: '' });
  const [selectedResidents, setSelectedResidents] = useState<Set<string>>(new Set());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [removingResidents, setRemovingResidents] = useState(false);
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [addingToCell, setAddingToCell] = useState<string | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<{interactionId: string, residentId: string, column: number, isSubmitted: boolean} | null>(null);
  const [deletingInteraction, setDeletingInteraction] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<InteractionFormData>({
    details: '',
    date: getLocalDateString()
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleCellExpansion = (cellId: string) => {
    const newExpanded = new Set(expandedCells);
    if (newExpanded.has(cellId)) {
      newExpanded.delete(cellId);
    } else {
      newExpanded.add(cellId);
    }
    setExpandedCells(newExpanded);
  };

  const isCellExpanded = (cellId: string) => {
    return expandedCells.has(cellId);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.error('Failed to copy');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setImportFile(selectedFile);
    } else {
      alert('Please select a CSV file');
    }
  };

  const handleAdditionalImport = async () => {
    if (!importFile) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await fetch('/api/residents/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await fetchResidents();
        onInteractionUpdate?.();
        setImportFile(null);
        setShowAddResidents(false);
        const input = document.getElementById('additional-file-input') as HTMLInputElement;
        if (input) input.value = '';
      } else {
        const data = await response.json();
        console.error('Import failed:', data.error);
      }
    } catch {
      console.error('Network error occurred');
    } finally {
      setImporting(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualResident.name.trim() || !manualResident.empl_id.trim() || !manualResident.room.trim()) {
      alert('Please enter name, student ID, and room number');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('/api/residents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: manualResident.name.trim(),
          empl_id: manualResident.empl_id.trim(),
          room: manualResident.room.trim(),
        }),
      });

      if (response.ok) {
        await fetchResidents();
        onInteractionUpdate?.();
        setManualResident({ name: '', empl_id: '', room: '' });
        setShowAddResidents(false);
      } else {
        const data = await response.json();
        alert('Failed to add resident: ' + (data.error || 'Unknown error'));
      }
    } catch {
      alert('Network error occurred');
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedResidents.size === 0) {
      alert('Please select residents to remove');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${selectedResidents.size} resident(s)?`)) {
      return;
    }

    setRemovingResidents(true);
    try {
      const response = await fetch('/api/residents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedResidents)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete residents');
      }

      const result = await response.json();
      console.log(`Successfully deleted ${result.deletedIds?.length || selectedResidents.size} residents`);

      await fetchResidents();
      onInteractionUpdate?.();
      setSelectedResidents(new Set());
    } catch (error) {
      console.error('Error removing residents:', error);
      alert(`Error removing residents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRemovingResidents(false);
    }
  };

  const toggleResidentSelection = (id: string) => {
    const newSelection = new Set(selectedResidents);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedResidents(newSelection);
  };

  useEffect(() => {
    fetchResidents();
    fetchInteractions();
  }, []);

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

  const fetchResidents = async () => {
    try {
      const response = await fetch('/api/residents');

      if (response.ok) {
        const data = await response.json();
        const sortedResidents = sortResidentsByRoom(data || []);
        setResidents(sortedResidents);
      } else {
        console.error("Error occurred");
      }
    } catch {
      console.error("Error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async () => {
    try {
      const response = await fetch('/api/interactions');
      if (response.ok) {
        const data = await response.json();
        const groupedInteractions: Record<string, Interaction[]> = {};
        data.forEach((interaction: Interaction) => {
          if (!groupedInteractions[interaction.resident_id]) {
            groupedInteractions[interaction.resident_id] = [];
          }
          groupedInteractions[interaction.resident_id].push(interaction);
        });
        setInteractions(groupedInteractions);
      }
    } catch {
      console.error("Error occurred");
    }
  };

  const handlePopoverClick = (residentId: string, column: number, event: React.MouseEvent) => {
    refs.setReference(event.currentTarget as Element);
    setShowPopover({
      residentId,
      column
    });
  };

  const handleEditInteraction = (interaction: Interaction, residentId: string, column: number, event: React.MouseEvent) => {
    refs.setReference(event.currentTarget as Element);
    setEditingInteraction({
      interactionId: interaction.id,
      residentId,
      column,
      isSubmitted: interaction.is_submitted || false
    });
    setEditFormData({
      details: interaction.details || '',
      date: interaction.date
    });
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm('Are you sure you want to delete this interaction?')) {
      return;
    }

    setDeletingInteraction(interactionId);
    try {
      const response = await fetch(`/api/interactions/${interactionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchInteractions();
        onInteractionUpdate?.();
      } else {
        const responseText = await response.text();
        console.error('Failed to delete interaction. Status:', response.status);
        console.error('Response text:', responseText);
        alert('Failed to delete interaction. Please try again.');
      }
    } catch {
      console.error("Error occurred");
      alert('Error occurred while deleting interaction. Please try again.');
    } finally {
      setDeletingInteraction(null);
    }
  };

  const handleUpdateInteraction = async (markAsSubmitted = false) => {
    if (!editingInteraction) return;

    setAddingInteraction(true);
    try {
      const requestBody: {
        details: string;
        date: string;
        isSubmitted?: boolean;
      } = {
        details: editFormData.details,
        date: editFormData.date,
      };

      if (markAsSubmitted) {
        requestBody.isSubmitted = true;
      }

      const response = await fetch(`/api/interactions/${editingInteraction.interactionId}`, {
        method: markAsSubmitted ? 'PUT' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        await fetchInteractions();
        onInteractionUpdate?.();
        setEditingInteraction(null);
        setEditFormData({
          details: '',
          date: getLocalDateString()
        });
        if (markAsSubmitted) {
          alert('Interaction updated and marked as submitted!');
        }
      } else {
        const responseText = await response.text();
        console.error('Failed to update interaction. Status:', response.status);
        console.error('Response text:', responseText);
      }
    } catch {
      console.error("Error occurred");
    } finally {
      setAddingInteraction(false);
    }
  };

  const handleAddInteraction = async () => {
    if (!showPopover) return;

    const cellKey = `${showPopover.residentId}-${showPopover.column}`;
    setAddingToCell(cellKey);

    try {
      const resident = residents.find(r => r.id === showPopover.residentId);
      if (!resident) {
        console.error('Resident not found');
        return;
      }

      const selectedDate = new Date(interactionFormData.date);
      const dayOfWeek = selectedDate.getDay();
      const weekStarting = new Date(selectedDate);
      weekStarting.setDate(selectedDate.getDate() - dayOfWeek);
      const weekStartingStr = weekStarting.toISOString().split('T')[0];

      const requestBody = {
        residentId: showPopover.residentId,
        residentEmplId: resident.empl_id,
        weekStarting: weekStartingStr,
        date: interactionFormData.date,
        details: interactionFormData.details,
        column: showPopover.column
      };

      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        await fetchInteractions();
        onInteractionUpdate?.();
        setShowPopover(null);
        setInteractionFormData({
          details: '',
          date: getLocalDateString()
        });
      } else {
        const responseText = await response.text();
        console.error('Failed to add interaction. Status:', response.status);
        console.error('Response text:', responseText);
      }
    } catch {
      console.error("Error occurred");
    } finally {
      setAddingToCell(null);
    }
  };

  const getInteractionForColumn = (residentId: string, column: number): Interaction | null => {
    const residentInteractions = interactions[residentId] || [];

    const columnInteraction = residentInteractions.find(interaction =>
        interaction.column === column && interaction.column !== null && interaction.column !== undefined
    );
    if (columnInteraction) {
      return columnInteraction;
    }

    const unassignedInteractions = residentInteractions.filter(interaction =>
        !interaction.column || interaction.column === null || interaction.column === undefined
    );

    if (unassignedInteractions.length > 0 && column <= unassignedInteractions.length) {
      return unassignedInteractions[column - 1] || null;
    }

    return null;
  };

  if (loading) {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Loading Residents</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we fetch the resident data...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Residents interaction tracker</h2>
          <div className="flex gap-2">
            {selectedResidents.size > 0 && (
                <button
                    onClick={handleRemoveSelected}
                    disabled={removingResidents}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {removingResidents ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Removing...
                      </>
                  ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Remove ({selectedResidents.size})
                      </>
                  )}
                </button>
            )}
            <button
                onClick={() => setShowAddResidents(!showAddResidents)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              Add Residents
            </button>
          </div>
        </div>

        {showAddResidents && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex rounded-md border border-blue-300 dark:border-blue-600">
                  <button
                      onClick={() => setAddMode('csv')}
                      className={`px-3 py-1 text-xs rounded-l-md ${
                          addMode === 'csv'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800'
                      }`}
                  >
                    Import CSV
                  </button>
                  <button
                      onClick={() => setAddMode('manual')}
                      className={`px-3 py-1 text-xs rounded-r-md ${
                          addMode === 'manual'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800'
                      }`}
                  >
                    Manual Entry
                  </button>
                </div>
              </div>

              {addMode === 'csv' ? (
                  <div className="space-y-3">
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      Upload a CSV file with residents to add to your existing list
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                          id="additional-file-input"
                          type="file"
                          accept=".csv"
                          onChange={handleFileSelect}
                          className="block text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-white dark:file:bg-gray-700 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-50 dark:hover:file:bg-blue-800"
                      />
                      {importFile && (
                          <button
                              onClick={handleAdditionalImport}
                              disabled={importing}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {importing ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                  Importing...
                                </>
                            ) : (
                                'Import CSV'
                            )}
                          </button>
                      )}
                    </div>
                  </div>
              ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Resident Name *
                        </label>
                        <input
                            type="text"
                            value={manualResident.name}
                            onChange={(e) => setManualResident(prev => ({...prev, name: e.target.value}))}
                            placeholder="Enter full name"
                            className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:font-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Room Number *
                        </label>
                        <input
                            type="text"
                            value={manualResident.room}
                            onChange={(e) => setManualResident(prev => ({...prev, room: e.target.value.toUpperCase()}))}
                            placeholder="e.g., TKRA-0123-A1"
                            className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:font-normal"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Student ID *
                        </label>
                        <input
                            type="text"
                            value={manualResident.empl_id}
                            onChange={(e) => setManualResident(prev => ({...prev, empl_id: e.target.value}))}
                            placeholder="Enter student ID"
                            className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:font-normal"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                            onClick={handleManualAdd}
                            disabled={importing || !manualResident.name.trim() || !manualResident.empl_id.trim() || !manualResident.room.trim()}
                            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {importing ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Adding...
                              </>
                          ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                Add Resident
                              </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
              )}

              <div className="flex justify-end mt-4">
                <button
                    onClick={() => setShowAddResidents(false)}
                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
        )}

        {residents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No residents found. Please import resident data first.</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-full">
                <thead>
                <tr className="bg-blue-50 dark:bg-slate-700 border-b-2 border-gray-200 dark:border-gray-600">
                  <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-10">
                    <input
                        type="checkbox"
                        checked={selectedResidents.size === residents.length && residents.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedResidents(new Set(residents.map(r => r.id)));
                          } else {
                            setSelectedResidents(new Set());
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-44">
                    Resident Name
                  </th>
                  <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-32">
                    Room
                  </th>
                  <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-28">
                    ASU ID
                  </th>
                  <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-64">
                    Interaction 1
                  </th>
                  <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-64">
                    Interaction 2
                  </th>
                  <th className="p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-64">
                    Interaction 3
                  </th>
                </tr>
                </thead>
                <tbody>
                {residents.map((resident, index) => {
                  const interaction1 = getInteractionForColumn(resident.id, 1);
                  const interaction2 = getInteractionForColumn(resident.id, 2);
                  const interaction3 = getInteractionForColumn(resident.id, 3);

                  return (
                      <tr key={resident.id} className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} hover:bg-gray-100 dark:hover:bg-gray-600`}>
                        <td className="border-r border-gray-300 dark:border-gray-600 p-3 text-center">
                          <input
                              type="checkbox"
                              checked={selectedResidents.has(resident.id)}
                              onChange={() => toggleResidentSelection(resident.id)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="border-r border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-900 dark:text-gray-100 group">
                          <div className="flex items-center gap-2">
                            <span className="truncate" title={resident.name}>{resident.name}</span>
                            <button
                                onClick={() => copyToClipboard(resident.name)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded flex-shrink-0"
                                title="Copy student name"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        </td>
                        <td className="border-r border-gray-300 dark:border-gray-600 p-3 text-gray-700 dark:text-gray-300 group">
                          <div className="flex items-center gap-2">
                            <span className="truncate" title={resident.room || 'N/A'}>{resident.room || 'N/A'}</span>
                            {resident.room && (
                                <button
                                    onClick={() => copyToClipboard(resident.room!)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded flex-shrink-0"
                                    title="Copy room number"
                                >
                                  <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                </button>
                            )}
                          </div>
                        </td>
                        <td className="border-r border-gray-300 dark:border-gray-600 p-3 text-gray-700 dark:text-gray-300 group">
                          <div className="flex items-center gap-2">
                            <span className="truncate" title={resident.empl_id}>{resident.empl_id}</span>
                            <button
                                onClick={() => copyToClipboard(resident.empl_id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded flex-shrink-0"
                                title="Copy student ID"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        </td>

                        <InteractionCell
                            resident={resident}
                            interaction={interaction1}
                            column={1}
                            isExpanded={isCellExpanded(`${resident.id}-1`)}
                            isAddingToCell={addingToCell === `${resident.id}-1`}
                            isDeletingInteraction={deletingInteraction === interaction1?.id}
                            onToggleExpansion={toggleCellExpansion}
                            onAddClick={handlePopoverClick}
                            onEditClick={handleEditInteraction}
                            onCopyClick={(text) => void copyToClipboard(text)}
                            onDeleteClick={(id) => void handleDeleteInteraction(id)}
                        />

                        <InteractionCell
                            resident={resident}
                            interaction={interaction2}
                            column={2}
                            isExpanded={isCellExpanded(`${resident.id}-2`)}
                            isAddingToCell={addingToCell === `${resident.id}-2`}
                            isDeletingInteraction={deletingInteraction === interaction2?.id}
                            onToggleExpansion={toggleCellExpansion}
                            onAddClick={handlePopoverClick}
                            onEditClick={handleEditInteraction}
                            onCopyClick={(text) => void copyToClipboard(text)}
                            onDeleteClick={(id) => void handleDeleteInteraction(id)}
                        />

                        <InteractionCell
                            resident={resident}
                            interaction={interaction3}
                            column={3}
                            isExpanded={isCellExpanded(`${resident.id}-3`)}
                            isAddingToCell={addingToCell === `${resident.id}-3`}
                            isDeletingInteraction={deletingInteraction === interaction3?.id}
                            onToggleExpansion={toggleCellExpansion}
                            onAddClick={handlePopoverClick}
                            onEditClick={handleEditInteraction}
                            onCopyClick={(text) => void copyToClipboard(text)}
                            onDeleteClick={(id) => void handleDeleteInteraction(id)}
                        />
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}

        {/* Popover for adding/editing interactions */}
        <InteractionPopover
            floatingRefs={refs}
            floatingStyles={floatingStyles}
            getFloatingProps={getFloatingProps}
            mode={editingInteraction ? 'edit' : 'add'}
            showPopover={showPopover}
            editingInteraction={editingInteraction}
            residents={residents}
            interactionFormData={interactionFormData}
            editFormData={editFormData}
            addingInteraction={addingInteraction}
            onClose={() => {
              setShowPopover(null);
              setEditingInteraction(null);
            }}
            onInteractionFormDataChange={(data) =>
                setInteractionFormData(prev => ({...prev, ...data}))
            }
            onEditFormDataChange={(data) =>
                setEditFormData(prev => ({...prev, ...data}))
            }
            onAddInteraction={handleAddInteraction}
            onUpdateInteraction={handleUpdateInteraction}
        />

      </div>
  );
}