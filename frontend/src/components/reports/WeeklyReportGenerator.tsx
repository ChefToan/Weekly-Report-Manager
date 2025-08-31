'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { FileText, Copy, CheckCircle, Calendar, Send, List } from 'lucide-react';

interface ReportInteraction {
  id?: string;
  residentId: string;
  summary: string;
  details: string;
  date: string;
  residentName?: string;
  residentEmplId?: string;
}

interface WeeklyReport {
  weekStarting: string;
  requiredInteractions: ReportInteraction[];
  additionalInteractions: ReportInteraction[];
}

interface WeeklyReportGeneratorProps {
  onInteractionUpdate?: () => void;
}

export default function WeeklyReportGenerator({ onInteractionUpdate }: WeeklyReportGeneratorProps) {
  // Helper function to get current date in user's local timezone
  const getCurrentLocalDate = () => {
    return new Date(); // This automatically uses user's local timezone
  };

  // Helper function to calculate week start for any given date
  const getWeekStartForDate = (date: Date) => {
    return startOfWeek(date, { weekStartsOn: 1 }); // Monday as week start
  };

  // Helper function to safely parse date string and avoid timezone issues
  const parseDateSafely = (dateString: string) => {
    // Add T12:00:00 to avoid timezone shifting when parsing date-only strings
    return new Date(dateString + 'T12:00:00');
  };

  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyReport_selectedWeek');
      if (saved) {
        // Validate that saved date represents a Monday (week start)
        const savedDate = parseDateSafely(saved);
        const weekStart = getWeekStartForDate(savedDate);
        return format(weekStart, 'yyyy-MM-dd');
      }
    }
    const now = getCurrentLocalDate();
    const weekStart = getWeekStartForDate(now);
    return format(weekStart, 'yyyy-MM-dd');
  });
  
  const [report, setReport] = useState<WeeklyReport | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyReport_data');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<'additional' | 'autofill' | 'autofill-selection' | null>(null);
  const [allUnsubmittedInteractions, setAllUnsubmittedInteractions] = useState<ReportInteraction[]>([]);
  const [selectedInteractions, setSelectedInteractions] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState<'choose-method' | 'by-week' | 'custom-select'>('choose-method');
  
  const baseFieldId = '808166082'; // Developer-configured base field ID

  // Save state changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weeklyReport_selectedWeek', selectedWeek);
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (report) {
        localStorage.setItem('weeklyReport_data', JSON.stringify(report));
      } else {
        localStorage.removeItem('weeklyReport_data');
      }
    }
  }, [report]);

  useEffect(() => {
    fetchAllUnsubmittedInteractions();
  }, []);

  const toggleInteractionSelection = (interactionId: string) => {
    const newSelection = new Set(selectedInteractions);
    if (newSelection.has(interactionId)) {
      newSelection.delete(interactionId);
    } else {
      newSelection.add(interactionId);
    }
    setSelectedInteractions(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedInteractions.size === allUnsubmittedInteractions.length) {
      setSelectedInteractions(new Set());
    } else {
      const allIds = allUnsubmittedInteractions
        .filter(interaction => interaction.id)
        .map(interaction => interaction.id!);
      setSelectedInteractions(new Set(allIds));
    }
  };


  const fetchAllUnsubmittedInteractions = async () => {
    try {
      const response = await fetch('/api/interactions?submitted=false');
      if (response.ok) {
        const data = await response.json();
        // Transform the data to match ReportInteraction interface
        const transformedData: ReportInteraction[] = data.map((interaction: {
          id: string;
          resident_id: string;
          summary: string;
          details?: string;
          date: string;
          resident_empl_id?: string;
          residents?: { name: string; empl_id: string };
        }) => ({
          id: interaction.id,
          residentId: interaction.resident_id,
          summary: interaction.summary,
          details: interaction.details || '',
          date: interaction.date,
          residentName: interaction.residents?.name || 'Unknown',
          residentEmplId: interaction.resident_empl_id || interaction.residents?.empl_id
        }));
        setAllUnsubmittedInteractions(transformedData);
      }
    } catch {
      console.error('Error fetching unsubmitted interactions');
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/weekly?weekStarting=${selectedWeek}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      } else {
        alert('Error generating report');
      }
    } catch {
      alert('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateCustomReport = async () => {
    if (selectedInteractions.size === 0) {
      alert('Please select at least one interaction');
      return;
    }

    setLoading(true);
    try {
      // Create a custom report with selected interactions
      const selectedInteractionsList = allUnsubmittedInteractions.filter(interaction =>
        interaction.id && selectedInteractions.has(interaction.id)
      );

      // Group by required (3 per resident) and additional
      const residentsWithInteractions = new Map<string, ReportInteraction[]>();

      selectedInteractionsList.forEach(interaction => {
        const key = interaction.residentId;
        if (!residentsWithInteractions.has(key)) {
          residentsWithInteractions.set(key, []);
        }
        residentsWithInteractions.get(key)!.push(interaction);
      });

      const requiredInteractions: ReportInteraction[] = [];
      const additionalInteractions: ReportInteraction[] = [];

      residentsWithInteractions.forEach((interactions, residentId) => {
        // Sort by date to get most recent first
        interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // First 3 are required, rest are additional
        interactions.forEach((interaction, index) => {
          if (index < 3) {
            requiredInteractions.push(interaction);
          } else {
            additionalInteractions.push(interaction);
          }
        });
      });

      const customReport: WeeklyReport = {
        weekStarting: 'Custom Selection',
        requiredInteractions,
        additionalInteractions
      };

      setReport(customReport);
    } catch {
      alert('Error generating custom report');
    } finally {
      setLoading(false);
    }
  };


  const generateAdditionalInteractionsText = () => {
    if (!report || !report.additionalInteractions.length) return '';

    let text = '';

    for (let i = 0; i < Math.min(14, report.additionalInteractions.length); i++) {
      const interaction = report.additionalInteractions[i];
      text += `Interaction ${i + 1}\n`;
      text += `Resident ID: ${interaction.residentId}\n`;
      text += `Summary: ${interaction.summary}\n\n`;
    }

    return text.trim();
  };

  const generateAutofillScript = () => {
    if (!report) return '';

    // Filter out submitted interactions - only include unsubmitted ones in autofill
    const unsubmittedRequired = report.requiredInteractions.filter(interaction => 
      // Check if this interaction exists in our unsubmitted list
      allUnsubmittedInteractions.some(unsubmitted => unsubmitted.id === interaction.id)
    );
    const unsubmittedAdditional = report.additionalInteractions.filter(interaction => 
      allUnsubmittedInteractions.some(unsubmitted => unsubmitted.id === interaction.id)
    );
    
    // Combine required and additional interactions for the autofill script (only unsubmitted)
    const allInteractions = [
      ...unsubmittedRequired.slice(0, 3), // Take first 3 required (only unsubmitted)
      ...unsubmittedAdditional.slice(0, 14) // Take up to 14 additional (only unsubmitted)
    ];

    let script = '// Weekly Report Autofill Script\n';
    script += '// Instructions: \n';
    script += '// 1. Open your weekly report form in the browser\n';
    script += '// 2. Open Developer Tools (F12 or Cmd+Option+I)\n';
    script += '// 3. Go to Console tab\n';
    script += '// 4. Paste this script and press Enter\n\n';
    script += '(function() {\n';
    script += '  console.log("Starting Weekly Report Autofill...");\n';
    script += '  console.log("Processing " + ' + allInteractions.length + ' + " interactions");\n\n';

    // Starting ID for the form fields - configurable base ID
    const baseId = parseInt(baseFieldId);

    allInteractions.forEach((interaction, index) => {
      if (interaction) {
        const asuIdFieldId = baseId + (index * 2); // Even numbers for ASU ID
        const detailsFieldId = baseId + (index * 2) + 1; // Odd numbers for details

        script += `  // Interaction ${index + 1}: ${interaction.summary.slice(0, 50)}${interaction.summary.length > 50 ? '...' : ''}\n`;
        
        // ASU ID field
        script += `  document.getElementById("t_${asuIdFieldId}").value = "${interaction.residentId}";\n`;
        
        // Details field
        const interactionDetails = interaction.details || interaction.summary;
        const escapedDetails = interactionDetails.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
        script += `  document.getElementById("t_${detailsFieldId}").value = "${escapedDetails}";\n`;
        script += `  \n`;
      }
    });

    script += '  console.log("Autofill process completed!");\n';
    script += '  console.log("Please review all filled fields before submitting your report");\n';
    script += '})();\n';

    return script;
  };

  const generateAutofillScriptFromSelection = () => {
    if (selectedInteractions.size === 0) return '';

    // Get selected interactions from our unsubmitted list
    const selectedInteractionsList = allUnsubmittedInteractions.filter(interaction => 
      interaction.id && selectedInteractions.has(interaction.id)
    );

    if (selectedInteractionsList.length === 0) return '';

    let script = '// Weekly Report Autofill Script (Custom Selection)\n';
    script += '// Instructions: \n';
    script += '// 1. Open your weekly report form in the browser\n';
    script += '// 2. Open Developer Tools (F12 or Cmd+Option+I)\n';
    script += '// 3. Go to Console tab\n';
    script += '// 4. Paste this script and press Enter\n\n';
    script += '(function() {\n';
    script += '  console.log("Starting Weekly Report Autofill (Custom Selection)...");\n';
    script += '  console.log("Processing " + ' + selectedInteractionsList.length + ' + " selected interactions");\n\n';

    let fieldCounter = 1;
    const baseId = parseInt(baseFieldId);

    selectedInteractionsList.slice(0, 17).forEach((interaction, index) => {
      const fieldId = baseId + (index * 3);
      
      script += `  // Interaction ${index + 1}: ${interaction.residentName || 'Unknown'}\n`;
      script += `  try {\n`;
      script += `    const resident${fieldCounter} = document.getElementById('${fieldId}');\n`;
      script += `    const summary${fieldCounter} = document.getElementById('${fieldId + 1}');\n`;
      script += `    const details${fieldCounter} = document.getElementById('${fieldId + 2}');\n`;
      script += `    \n`;
      script += `    if (resident${fieldCounter}) resident${fieldCounter}.value = "${interaction.residentEmplId || interaction.residentId}";\n`;
      script += `    if (summary${fieldCounter}) summary${fieldCounter}.value = "${interaction.summary.replace(/"/g, '\\"')}";\n`;
      script += `    if (details${fieldCounter}) details${fieldCounter}.value = "${(interaction.details || '').replace(/"/g, '\\"')}";\n`;
      script += `    console.log("Filled interaction ${index + 1}");\n`;
      script += `  } catch(e) {\n`;
      script += `    console.warn("Could not fill interaction ${index + 1}:", e.message);\n`;
      script += `  }\n\n`;
      
      fieldCounter++;
    });

    script += '  console.log("Autofill completed!");\n';
    script += '  console.log("Please review all fields before submitting.");\n';
    script += '})();\n';

    return script;
  };

  const copyToClipboard = async (text: string, type: 'additional' | 'autofill' | 'autofill-selection') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert('Failed to copy to clipboard');
    }
  };

  const markAsSubmitted = async () => {
    if (!report) return;

    const allInteractionIds = [
      ...report.requiredInteractions,
      ...report.additionalInteractions
    ].map(interaction => interaction.id).filter(Boolean);

    if (allInteractionIds.length === 0) {
      alert('No interactions to mark as submitted');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionIds: allInteractionIds }),
      });

      if (response.ok) {
        alert('Interactions marked as submitted!');
        generateReport(); // Refresh the report
        onInteractionUpdate?.(); // Update the ResidentsGrid
        fetchAllUnsubmittedInteractions(); // Refresh the unsubmitted list
        setSelectedInteractions(new Set()); // Clear selections
      } else {
        alert('Error marking interactions as submitted');
      }
    } catch {
      alert('Network error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const markSelectedAsSubmitted = async () => {
    if (selectedInteractions.size === 0) {
      alert('No interactions selected to mark as submitted');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactionIds: Array.from(selectedInteractions) }),
      });

      if (response.ok) {
        alert(`${selectedInteractions.size} interactions marked as submitted!`);
        onInteractionUpdate?.(); // Update the ResidentsGrid
        fetchAllUnsubmittedInteractions(); // Refresh the unsubmitted list
        setSelectedInteractions(new Set()); // Clear selections
        setReport(null); // Clear current report
      } else {
        alert('Error marking interactions as submitted');
      }
    } catch {
      alert('Network error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const weekStart = parseDateSafely(selectedWeek);
  const weekEnd = addDays(weekStart, 6);

  const resetToStart = () => {
    setCurrentStep('choose-method');
    setReport(null);
    setSelectedInteractions(new Set());
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Weekly Reports</h1>
        {currentStep !== 'choose-method' && (
          <button
            onClick={resetToStart}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Start Over
          </button>
        )}
      </div>

      {/* Step 1: Choose Method */}
      {currentStep === 'choose-method' && (
        <>
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400">How would you like to generate your report?</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setCurrentStep('by-week')}
              className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 p-8 text-center transition-all group"
            >
              <Calendar className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">By Week</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Generate report for all interactions within a specific week
              </p>
            </button>

            <button
              onClick={() => setCurrentStep('custom-select')}
              className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-400 p-8 text-center transition-all group"
            >
              <List className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Custom Selection</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Pick specific interactions from any time period
              </p>
            </button>
          </div>
        </>
      )}

      {/* Step 2a: By Week */}
      {currentStep === 'by-week' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Weekly Report</h2>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select any date within the week
                </label>
                <input
                  type="date"
                  value={selectedWeek}
                  onChange={(e) => {
                    const selectedDate = parseDateSafely(e.target.value);
                    const weekStart = getWeekStartForDate(selectedDate);
                    const weekStartString = format(weekStart, 'yyyy-MM-dd');
                    setSelectedWeek(weekStartString);
                  }}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-700 dark:text-blue-300 font-medium">
                  Week: {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
                </div>
              </div>

              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    Generate Report
                  </>
                )}
              </button>
            </div>

            {/* Autofill Script Section */}
            {report && (report.requiredInteractions.length > 0 || report.additionalInteractions.length > 0) && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Autofill Script</h3>
                    <button
                      onClick={() => copyToClipboard(generateAutofillScript(), 'autofill')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
                    >
                      {copied === 'autofill' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied === 'autofill' ? 'Copied!' : 'Copy Script'}
                    </button>
                  </div>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-3 font-mono text-xs text-gray-900 dark:text-gray-100 max-h-40 overflow-y-auto">
                    {generateAutofillScript()}
                  </div>

                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                    Paste this script in your browser console (F12) on the report form page
                  </p>
                </div>
              </div>
            )}

            {/* Action Button */}
            {report && (report.requiredInteractions.length > 0 || report.additionalInteractions.length > 0) && (
              <button
                onClick={markAsSubmitted}
                disabled={submitting}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Marking as Submitted...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Mark as Submitted
                  </>
                )}
              </button>
            )}

            {/* No Results Message */}
            {report && !(report.requiredInteractions.length > 0 || report.additionalInteractions.length > 0) && (
              <div className="text-center py-8 border-t border-gray-200 dark:border-gray-600">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <div className="text-gray-500 dark:text-gray-400 font-medium mb-2">
                  No interactions found
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No unsubmitted interactions for this week period
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2b: Custom Selection */}
      {currentStep === 'custom-select' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <List className="h-6 w-6 text-green-600 dark:text-green-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Select Interactions</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {allUnsubmittedInteractions.length} available interactions
                </span>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={selectedInteractions.size === allUnsubmittedInteractions.length && allUnsubmittedInteractions.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-green-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">
                    Select All ({selectedInteractions.size}/{allUnsubmittedInteractions.length})
                  </span>
                </label>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                {allUnsubmittedInteractions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <List className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No unsubmitted interactions available</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-600">
                    {allUnsubmittedInteractions.map((interaction) => (
                      <label
                        key={interaction.id}
                        className="flex items-start p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={interaction.id ? selectedInteractions.has(interaction.id) : false}
                          onChange={() => interaction.id && toggleInteractionSelection(interaction.id)}
                          className="mt-1 rounded border-gray-300 dark:border-gray-600 text-green-600"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {interaction.residentName}
                            </p>
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                              {format(new Date(interaction.date), 'MMM dd')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {interaction.summary}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedInteractions.size > 0 && (
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    {selectedInteractions.size} interactions selected
                  </span>
                </div>
              )}
            </div>

            {/* Autofill Script Section */}
            {selectedInteractions.size > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Autofill Script</h3>
                    <button
                      onClick={() => copyToClipboard(generateAutofillScriptFromSelection(), 'autofill-selection')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
                    >
                      {copied === 'autofill-selection' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied === 'autofill-selection' ? 'Copied!' : 'Copy Script'}
                    </button>
                  </div>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-3 font-mono text-xs text-gray-900 dark:text-gray-100 max-h-40 overflow-y-auto">
                    {generateAutofillScriptFromSelection()}
                  </div>

                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                    Paste this script in your browser console (F12) on the report form page
                  </p>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={markSelectedAsSubmitted}
              disabled={selectedInteractions.size === 0 || submitting}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Marking as Submitted...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Mark as Submitted ({selectedInteractions.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}