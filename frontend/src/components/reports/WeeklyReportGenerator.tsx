'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { FileText, Copy, CheckCircle, Calendar, Send } from 'lucide-react';

interface ReportInteraction {
  id?: string;
  residentId: string;
  summary: string;
  details: string;
  date: string;
}

interface WeeklyReport {
  weekStarting: string;
  requiredInteractions: ReportInteraction[];
  additionalInteractions: ReportInteraction[];
}

export default function WeeklyReportGenerator() {
  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyReport_selectedWeek');
      if (saved) return saved;
    }
    const now = new Date();
    return format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });
  
  const [report, setReport] = useState<WeeklyReport | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyReport_data');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<'additional' | 'autofill' | null>(null);
  
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
    } catch (error) {
      alert('Network error occurred');
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

    // Combine required and additional interactions for the autofill script
    const allInteractions = [
      ...report.requiredInteractions.slice(0, 3), // Take first 3 required
      ...report.additionalInteractions.slice(0, 14) // Take up to 14 additional
    ];

    let script = '// Weekly Report Autofill Script\n';
    script += '// Instructions: \n';
    script += '// 1. Open your weekly report form in the browser\n';
    script += '// 2. Open Developer Tools (F12 or Cmd+Option+I)\n';
    script += '// 3. Go to Console tab\n';
    script += '// 4. Paste this script and press Enter\n\n';
    script += '(function() {\n';
    script += '  console.log("🚀 Starting Weekly Report Autofill...");\n';
    script += '  console.log("📊 Processing " + ' + allInteractions.length + ' + " interactions");\n\n';

    // Starting ID for the form fields - configurable base ID
    let baseId = parseInt(baseFieldId);

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

    script += '  console.log("🎉 Autofill process completed!");\n';
    script += '  console.log("📝 Please review all filled fields before submitting your report");\n';
    script += '  alert("✅ Weekly Report Autofill Completed!\\n\\n📊 Processed ' + allInteractions.length + ' interactions\\n📝 Please review all fields before submitting");\n';
    script += '})();\n';

    return script;
  };

  const copyToClipboard = async (text: string, type: 'additional' | 'autofill') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
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
      } else {
        alert('Error marking interactions as submitted');
      }
    } catch (error) {
      alert('Network error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const weekStart = new Date(selectedWeek);
  const weekEnd = addDays(weekStart, 6);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weekly Report Generator</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Select Week Starting (Monday)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-base text-black dark:text-gray-100 font-bold bg-white dark:bg-gray-700 border border-gray-400 dark:border-gray-600 px-3 py-2 rounded-md shadow-sm">
              {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
            </span>
            <button
              onClick={generateReport}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate Report
            </button>
          </div>
        </div>

        {report && (
          <div className="space-y-6 mt-6">


            {report && (report.requiredInteractions.length > 0 || report.additionalInteractions.length > 0) && (
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">JavaScript Autofill Script</h3>
                </div>
                

                <div className="flex items-center justify-between mb-3">
                  <div></div>
                  <button
                    onClick={() => copyToClipboard(generateAutofillScript(), 'autofill')}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                  >
                    {copied === 'autofill' ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy to Clipboard
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600 font-mono text-sm whitespace-pre-line text-gray-900 dark:text-gray-100 max-h-96 overflow-y-auto">
                  {generateAutofillScript()}
                </div>

                <div className="mt-3 text-xs text-gray-700 dark:text-gray-300">
                  <p><strong>Instructions:</strong> Copy the script above and paste it into the console of your browser&apos;s developer tools on the report page. Then press Enter to run the script and autofill the form fields.</p>
                </div>
              </div>
            )}

            {report && (report.requiredInteractions.length > 0 || report.additionalInteractions.length > 0) ? (
              <div className="flex justify-center pt-4">
                <button
                  onClick={markAsSubmitted}
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Mark Interactions as Submitted
                </button>
              </div>
            ) : report && (
              <div className="text-center py-8">
                <div className="text-gray-500 dark:text-gray-400 text-lg">
                  No interactions found for the week of {format(new Date(selectedWeek), 'MMM dd, yyyy')}
                </div>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Add some interactions first, then generate your report.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}