'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Copy, UserPlus, Trash2, X } from 'lucide-react';
import { sortResidentsByRoom } from '@/utils/roomSorting';

interface Resident {
  id: string;
  name: string;
  empl_id: string;
  email?: string;
  room?: string;
}

interface Interaction {
  id: string;
  resident_id: string;
  summary: string;
  details?: string;
  date: string;
  column?: number; // Track which column this interaction belongs to
}

interface InteractionFormData {
  details: string;
  date: string;
}

interface ResidentsGridProps {
  onInteractionUpdate?: () => void;
}

export default function ResidentsGrid({ onInteractionUpdate }: ResidentsGridProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [showPopover, setShowPopover] = useState<{residentId: string, column: number, position: {x: number, y: number}} | null>(null);
  const [interactionFormData, setInteractionFormData] = useState<InteractionFormData>({
    details: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [showAddResidents, setShowAddResidents] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [addMode, setAddMode] = useState<'csv' | 'manual'>('csv');
  const [manualResident, setManualResident] = useState({ name: '', empl_id: '', room: '' });
  const [selectedResidents, setSelectedResidents] = useState<Set<string>>(new Set());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [removingResidents, setRemovingResidents] = useState(false);
  const [addingInteraction, setAddingInteraction] = useState(false);

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

  const getPreviewText = (text: string, maxLength: number = 20) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getExpandedText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };


  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy: ', err);
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
        await fetchResidents(); // Refresh the residents list
        onInteractionUpdate?.(); // Update stats
        setImportFile(null);
        setShowAddResidents(false);
        const input = document.getElementById('additional-file-input') as HTMLInputElement;
        if (input) input.value = '';
      } else {
        const data = await response.json();
        console.error('Import failed:', data.error);
      }
    } catch (error) {
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
        console.error('Add resident failed:', data.error);
        alert('Failed to add resident: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Network error occurred');
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
      const promises = Array.from(selectedResidents).map(id =>
        fetch(`/api/residents/${id}`, { method: 'DELETE' })
      );
      
      await Promise.all(promises);
      await fetchResidents();
      onInteractionUpdate?.();
      setSelectedResidents(new Set());
    } catch (error) {
      console.error('Error removing residents:', error);
      alert('Error removing residents');
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
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(null);
      }
    };

    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const fetchResidents = async () => {
    try {
      const response = await fetch('/api/residents');
      
      if (response.ok) {
        const data = await response.json();
        // Sort residents by room before setting state
        const sortedResidents = sortResidentsByRoom(data || []) as Resident[];
        setResidents(sortedResidents);
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
      }
    } catch (error) {
      console.error('Error fetching residents:', error);
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
    } catch (error) {
      console.error('Error fetching interactions:', error);
    }
  };

  const handlePopoverClick = (residentId: string, column: number, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setShowPopover({
      residentId,
      column,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 5
      }
    });
  };

  const handleAddInteraction = async () => {
    if (!showPopover) return;

    setAddingInteraction(true);
    try {
      // Find the resident to get their EMPL ID
      const resident = residents.find(r => r.id === showPopover.residentId);
      if (!resident) {
        console.error('Resident not found');
        return;
      }

      // Calculate week starting date (Sunday of the selected date's week)
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
        summary: 'Interaction logged',
        details: interactionFormData.details,
        column: showPopover.column // Include the column number
      };


      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });


      if (response.ok) {
        const responseData = await response.json();
        await fetchInteractions();
        onInteractionUpdate?.();
        setShowPopover(null);
        setInteractionFormData({
          details: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        const responseText = await response.text();
        console.error('Failed to add interaction. Status:', response.status);
        console.error('Response text:', responseText);
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error data:', errorData);
        } catch (e) {
          console.error('Could not parse error response as JSON');
        }
      }
    } catch (error) {
      console.error('Error adding interaction:', error);
    } finally {
      setAddingInteraction(false);
    }
  };

  const getInteractionForColumn = (residentId: string, column: number): Interaction | null => {
    const residentInteractions = interactions[residentId] || [];
    
    // First, look for an interaction specifically assigned to this column
    const columnInteraction = residentInteractions.find(interaction => 
      interaction.column === column && interaction.column !== null && interaction.column !== undefined
    );
    if (columnInteraction) {
      return columnInteraction;
    }
    
    // For interactions without column assignments, assign them to columns in order
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200">
      <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center transition-all duration-200">
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

      {/* Show import section when adding more residents */}
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
        <div className="overflow-x-auto overflow-y-visible" style={{touchAction: 'pan-x'}}>
          <table className="w-full border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-yellow-100 dark:bg-yellow-900/30 border-b-2 border-gray-200 dark:border-gray-600 transition-all duration-200">
                <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-12">
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
                <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-[180px]">
                  Resident Name
                </th>
                <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-[140px]">
                  Room
                </th>
                <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-left font-semibold text-gray-900 dark:text-gray-100 w-[130px]">
                  ASU ID
                </th>
                <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-[200px]">
                  Interaction 1
                </th>
                <th className="border-r border-gray-300 dark:border-gray-600 p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-[200px]">
                  Interaction 2
                </th>
                <th className="p-3 text-center font-semibold text-gray-900 dark:text-gray-100 w-[200px]">
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
                  <React.Fragment key={resident.id}>
                    <tr className={`group transition-all duration-200 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} hover:bg-gray-100 dark:hover:bg-gray-600`}>
                      <td className="border-r border-gray-300 dark:border-gray-600 p-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedResidents.has(resident.id)}
                          onChange={() => toggleResidentSelection(resident.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border-r border-gray-300 dark:border-gray-600 p-3 font-medium text-gray-900 dark:text-gray-100 w-[180px]">
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate" title={resident.name}>{resident.name}</span>
                          <button
                            onClick={() => copyToClipboard(resident.name, 'Student name')}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-all flex-shrink-0"
                            title="Copy student name"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      </td>
                      <td className="border-r border-gray-300 dark:border-gray-600 p-3 text-gray-700 dark:text-gray-300 w-[140px]">
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate" title={resident.room || 'N/A'}>{resident.room || 'N/A'}</span>
                          {resident.room && (
                            <button
                              onClick={() => copyToClipboard(resident.room!, 'Room number')}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-all flex-shrink-0"
                              title="Copy room number"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-gray-300 dark:border-gray-600 p-3 text-gray-700 dark:text-gray-300 group w-[140px]">
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate" title={resident.empl_id}>{resident.empl_id}</span>
                          <button
                            onClick={() => copyToClipboard(resident.empl_id, 'Student ID')}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-all flex-shrink-0"
                            title="Copy student ID"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      </td>
                      
                      {/* Interaction 1 */}
                      <td className={`border-r border-gray-300 dark:border-gray-600 p-2 text-center relative group w-[200px] ${
                        interaction1 ? 'bg-green-100 dark:bg-green-900/30' : ''
                      }`}>
                        {interaction1 ? (
                          <div className="relative w-full">
                            <div 
                              className={`text-xs text-green-900 dark:text-green-100 p-2 flex flex-col justify-center relative transition-all duration-200 cursor-pointer w-full ${
                                isCellExpanded(`${resident.id}-1`) ? 'max-h-48' : 'max-h-16'
                              } overflow-hidden`}
                              onClick={() => toggleCellExpansion(`${resident.id}-1`)}
                            >
                              <div 
                                className="text-green-900 dark:text-green-100 text-center break-all leading-relaxed w-full overflow-wrap-anywhere max-w-full"
                                style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}
                                title={isCellExpanded(`${resident.id}-1`) ? 'Click to collapse' : 'Click to expand full text'}
                              >
                                {isCellExpanded(`${resident.id}-1`) 
                                  ? getExpandedText(interaction1.details || 'No details provided')
                                  : getPreviewText(interaction1.details || 'No details provided')
                                }
                              </div>
                              {(interaction1.details || 'No details provided').length > 10 && (
                                <span 
                                  className="text-green-600 text-xs opacity-60 mt-1 cursor-pointer"
                                  onClick={() => toggleCellExpansion(`${resident.id}-1`)}
                                >
                                  {isCellExpanded(`${resident.id}-1`) ? 'Click to collapse' : 'Click to expand'}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(
                                  interaction1.details || 'No details provided',
                                  'Interaction details'
                                );
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-green-200 dark:hover:bg-green-700 rounded transition-all z-10"
                              title="Copy interaction details"
                            >
                              <Copy className="h-3 w-3 text-green-600 dark:text-green-400" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handlePopoverClick(resident.id, 1, e)}
                            className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-800 flex items-center justify-center mx-auto"
                          >
                            <Plus className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                          </button>
                        )}
                      </td>

                      {/* Interaction 2 */}
                      <td className={`border-r border-gray-300 dark:border-gray-600 p-2 text-center relative group w-[200px] ${
                        interaction2 ? 'bg-green-100 dark:bg-green-900/30' : ''
                      }`}>
                        {interaction2 ? (
                          <div className="relative w-full">
                            <div 
                              className={`text-xs text-green-900 dark:text-green-100 p-2 flex flex-col justify-center relative transition-all duration-200 cursor-pointer w-full ${
                                isCellExpanded(`${resident.id}-2`) ? 'max-h-48' : 'max-h-16'
                              } overflow-hidden`}
                              onClick={() => toggleCellExpansion(`${resident.id}-2`)}
                            >
                              <div 
                                className="text-green-900 dark:text-green-100 text-center break-all leading-relaxed w-full overflow-wrap-anywhere max-w-full"
                                style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}
                                title={isCellExpanded(`${resident.id}-2`) ? 'Click to collapse' : 'Click to expand full text'}
                              >
                                {isCellExpanded(`${resident.id}-2`) 
                                  ? getExpandedText(interaction2.details || 'No details provided')
                                  : getPreviewText(interaction2.details || 'No details provided')
                                }
                              </div>
                              {(interaction2.details || 'No details provided').length > 10 && (
                                <span 
                                  className="text-green-600 text-xs opacity-60 mt-1 cursor-pointer"
                                  onClick={() => toggleCellExpansion(`${resident.id}-2`)}
                                >
                                  {isCellExpanded(`${resident.id}-2`) ? 'Click to collapse' : 'Click to expand'}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(
                                  interaction2.details || 'No details provided',
                                  'Interaction details'
                                );
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-green-200 dark:hover:bg-green-700 rounded transition-all z-10"
                              title="Copy interaction details"
                            >
                              <Copy className="h-3 w-3 text-green-600 dark:text-green-400" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handlePopoverClick(resident.id, 2, e)}
                            className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-800 flex items-center justify-center mx-auto"
                          >
                            <Plus className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                          </button>
                        )}
                      </td>

                      {/* Interaction 3 */}
                      <td className={`p-2 text-center relative group w-[200px] ${
                        interaction3 ? 'bg-green-100 dark:bg-green-900/30' : ''
                      }`}>
                        {interaction3 ? (
                          <div className="relative w-full">
                            <div 
                              className={`text-xs text-green-900 dark:text-green-100 p-2 flex flex-col justify-center relative transition-all duration-200 cursor-pointer w-full ${
                                isCellExpanded(`${resident.id}-3`) ? 'max-h-48' : 'max-h-16'
                              } overflow-hidden`}
                              onClick={() => toggleCellExpansion(`${resident.id}-3`)}
                            >
                              <div 
                                className="text-green-900 dark:text-green-100 text-center break-all leading-relaxed w-full overflow-wrap-anywhere max-w-full"
                                style={{wordBreak: 'break-all', overflowWrap: 'anywhere'}}
                                title={isCellExpanded(`${resident.id}-3`) ? 'Click to collapse' : 'Click to expand full text'}
                              >
                                {isCellExpanded(`${resident.id}-3`) 
                                  ? getExpandedText(interaction3.details || 'No details provided')
                                  : getPreviewText(interaction3.details || 'No details provided')
                                }
                              </div>
                              {(interaction3.details || 'No details provided').length > 10 && (
                                <span 
                                  className="text-green-600 dark:text-green-400 text-xs opacity-60 mt-1 cursor-pointer"
                                  onClick={() => toggleCellExpansion(`${resident.id}-3`)}
                                >
                                  {isCellExpanded(`${resident.id}-3`) ? 'Click to collapse' : 'Click to expand'}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(
                                  interaction3.details || 'No details provided',
                                  'Interaction details'
                                );
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-green-200 dark:hover:bg-green-700 rounded transition-all z-10"
                              title="Copy interaction details"
                            >
                              <Copy className="h-3 w-3 text-green-600 dark:text-green-400" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handlePopoverClick(resident.id, 3, e)}
                            className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-800 flex items-center justify-center mx-auto"
                          >
                            <Plus className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                          </button>
                        )}
                      </td>
                    </tr>

                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Popover for adding interactions */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[300px]"
          style={{
            left: showPopover.position.x - 150,
            top: showPopover.position.y,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Add Interaction {showPopover.column}
            </h4>
            <button
              onClick={() => setShowPopover(null)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={interactionFormData.date}
                onChange={(e) => setInteractionFormData(prev => ({...prev, date: e.target.value}))}
                className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Interaction Details
              </label>
              <textarea
                value={interactionFormData.details}
                onChange={(e) => setInteractionFormData(prev => ({...prev, details: e.target.value}))}
                placeholder="Describe the interaction..."
                rows={3}
                className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder:text-gray-500 dark:placeholder:text-gray-400 placeholder:font-normal"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddInteraction}
              disabled={!interactionFormData.details.trim() || addingInteraction}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {addingInteraction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Adding...
                </>
              ) : (
                'Add'
              )}
            </button>
            <button
              onClick={() => setShowPopover(null)}
              className="px-3 py-2 text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}


    </div>
  );
}