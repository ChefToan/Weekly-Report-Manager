'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { FileText, Copy, CheckCircle, Calendar, Send, List } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ReportInteraction {
  id?: string;
  residentId: string;
  details: string;
  date: string;
  created_at?: string;
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
  const { user } = useAuth();

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

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyReport_selectedDate');
      if (saved) {
        return saved;
      }
    }
    const now = getCurrentLocalDate();
    return format(now, 'yyyy-MM-dd');
  });

  const [selectedWeek, setSelectedWeek] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyReport_selectedDate');
      if (saved) {
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

  // Save state changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weeklyReport_selectedDate', selectedDate);
      localStorage.setItem('weeklyReport_selectedWeek', selectedWeek);
    }
  }, [selectedDate, selectedWeek]);

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
          details: string;
          date: string;
          created_at?: string;
          resident_empl_id?: string;
          residents?: { name: string; empl_id: string };
        }) => ({
          id: interaction.id,
          residentId: interaction.resident_id,
          details: interaction.details,
          date: interaction.date,
          created_at: interaction.created_at,
          residentName: interaction.residents?.name || 'Unknown',
          residentEmplId: interaction.resident_empl_id || interaction.residents?.empl_id
        }));
        
        // Sort by created_at (most recent first) - API should already handle this but double-check
        transformedData.sort((a, b) => {
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          // Fallback to date if created_at is not available
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
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
      text += `Details: ${interaction.details}\n\n`;
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
      ...unsubmittedAdditional.slice(0, 20) // Take up to 20 additional (only unsubmitted)
    ];

    const interactions = allInteractions.map(interaction => ({
      id: interaction.residentEmplId || interaction.residentId,
      summary: interaction.details
    }));

    const userAsuId = user?.asu_id || '1234567890'; // Fallback if user not available

    // Add warning comment if less than 3 interactions available
    const warningComment = interactions.length < 3 
      ? `// ⚠️ WARNING: Only ${interactions.length} interaction${interactions.length === 1 ? '' : 's'} available for this week. Weekly reports typically require at least 3 interactions.\n// Consider adding more interactions or selecting a different week.\n\n`
      : '';

    return `${warningComment}(function() {
    console.log('🚀 Starting ASU Survey Autofill...');
    
    // Generated interaction data  
    const interactions = ${JSON.stringify(interactions, null, 8)};

    let isProcessing = false;
    
    // Function to trigger proper form events
    function fillField(element, value) {
        if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.classList.add('used');
            return true;
        }
        return false;
    }
    
    // Function to fill Page 1
    function fillPage1() {
        if (isProcessing) return;
        isProcessing = true;
        
        console.log('📝 Filling Page 1...');
        const asuIdField = document.querySelector('input[name="t_808166078"]');
        if (fillField(asuIdField, '${userAsuId}')) {
            console.log('✅ Filled ASU ID');
            
            setTimeout(() => {
                const startBtn = document.querySelector('#SurveySubmitButtonElement');
                if (startBtn) {
                    console.log('🎯 Clicking Start button...');
                    startBtn.click();
                    monitorForPage2();
                }
            }, 1000);
        } else {
            console.log('❌ ASU ID field not found');
            isProcessing = false;
        }
    }
    
    // Function to monitor for Page 2
    function monitorForPage2() {
        let attempts = 0;
        const maxAttempts = 15;
        
        const checkForPage2 = () => {
            attempts++;
            console.log(\`🔍 Checking for Page 2... (attempt \${attempts})\`);
            
            if (document.querySelector('input[name="t_808166082"]')) {
                console.log('📍 Page 2 detected! Starting autofill...');
                isProcessing = false;
                setTimeout(() => fillPage2(), 1500);
                return;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(checkForPage2, 1000);
            } else {
                console.log('❌ Page 2 not detected after maximum attempts');
                isProcessing = false;
            }
        };
        
        setTimeout(checkForPage2, 2000);
    }
    
    // Function to fill Page 2
    function fillPage2() {
        if (isProcessing) return;
        isProcessing = true;
        
        console.log('📝 Filling Page 2 interactions...');
        
        // Fill required interactions (first 3)
        const requiredFields = [
            { idField: 't_808166082', summaryField: 't_808166083' },
            { idField: 't_808166084', summaryField: 't_808166085' },
            { idField: 't_808166086', summaryField: 't_808166087' }
        ];
        
        console.log('📝 Filling required interactions...');
        for (let i = 0; i < 3 && i < interactions.length; i++) {
            const idField = document.querySelector(\`input[name="\${requiredFields[i].idField}"]\`);
            const summaryField = document.querySelector(\`input[name="\${requiredFields[i].summaryField}"]\`);
            
            if (fillField(idField, interactions[i].id) && fillField(summaryField, interactions[i].summary)) {
                console.log(\`✅ Filled required interaction \${i + 1}\`);
            }
        }
        
        // Fill additional interactions (up to 20)
        const additionalFields = [
            { idField: 't_808166088', summaryField: 't_808166089' },
            { idField: 't_808166090', summaryField: 't_808166091' },
            { idField: 't_808166092', summaryField: 't_808166093' },
            { idField: 't_808166094', summaryField: 't_808166095' },
            { idField: 't_808166096', summaryField: 't_808166097' },
            { idField: 't_808166098', summaryField: 't_808166099' },
            { idField: 't_808166100', summaryField: 't_808166101' },
            { idField: 't_808166102', summaryField: 't_808166103' },
            { idField: 't_808166104', summaryField: 't_808166105' },
            { idField: 't_808166106', summaryField: 't_808166107' },
            { idField: 't_808166108', summaryField: 't_808166109' },
            { idField: 't_808166110', summaryField: 't_808166111' },
            { idField: 't_808166112', summaryField: 't_808166113' },
            { idField: 't_808166114', summaryField: 't_808166115' },
            { idField: 't_808166116', summaryField: 't_808166117' },
            { idField: 't_808166118', summaryField: 't_808166119' },
            { idField: 't_808166120', summaryField: 't_808166121' },
            { idField: 't_808166122', summaryField: 't_808166123' },
            { idField: 't_808166124', summaryField: 't_808166125' },
            { idField: 't_808166126', summaryField: 't_808166127' }
        ];
        
        console.log('📝 Filling additional interactions...');
        const remainingInteractions = interactions.slice(3);
        const maxAdditional = Math.min(remainingInteractions.length, 20);
        
        for (let i = 0; i < maxAdditional; i++) {
            const idField = document.querySelector(\`input[name="\${additionalFields[i].idField}"]\`);
            const summaryField = document.querySelector(\`input[name="\${additionalFields[i].summaryField}"]\`);
            
            if (fillField(idField, remainingInteractions[i].id) && fillField(summaryField, remainingInteractions[i].summary)) {
                console.log(\`✅ Filled additional interaction \${i + 1}\`);
            }
        }
        
        // Handle "Would you like to add more" question and submit
        setTimeout(() => {
            handleRadioAndSubmit();
        }, 2000);
    }
    
    // Function to handle radio selection and submit
    function handleRadioAndSubmit() {
        try {
            console.log('📝 Handling radio selection...');
            
            // Calculate if we need more interactions
            const totalFilled = Math.min(interactions.length, 23); // 3 required + 20 additional max on page 2
            const needsMore = interactions.length > 23;
            
            console.log(\`📊 Total interactions: \${interactions.length}\`);
            console.log(\`📊 Filled on page 2: \${totalFilled}\`);
            console.log(\`📊 Remaining: \${Math.max(0, interactions.length - 23)}\`);
            console.log(\`📊 Needs more pages: \${needsMore}\`);
            
            // Use getElementById for IDs that start with numbers
            const radioYes = document.getElementById('808166128ID');
            const radioNo = document.getElementById('808166129ID');
            
            if (needsMore && radioYes) {
                radioYes.checked = true;
                radioYes.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✅ Selected "Yes" for more interactions');
            } else if (!needsMore && radioNo) {
                radioNo.checked = true;
                radioNo.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✅ Selected "No" - all interactions fit on page 2');
            }
            
            // Click Next button
            setTimeout(() => {
                const nextBtn = document.querySelector('#SurveySubmitButtonElement');
                if (nextBtn) {
                    console.log('🎯 Clicking Next button...');
                    nextBtn.click();
                    
                    // Monitor for popup
                    setTimeout(() => {
                        monitorForPopup();
                    }, 2000);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error handling radio and submit:', error);
            isProcessing = false;
        }
    }
    
    // Function to monitor for popup
    function monitorForPopup() {
        console.log('🔍 Monitoring for popup or next page...');
        
        const popup = document.querySelector('#requestResponseDialog');
        if (popup && popup.style.display !== 'none') {
            console.log('⚠️ Popup detected - waiting for user decision');
            console.log('ℹ️ User can click "Continue Without Answering" to proceed');
            isProcessing = false;
            return;
        }
        
        // Check if we successfully moved to next page
        setTimeout(() => {
            const currentPage = detectCurrentPage();
            if (currentPage === 'page3' || currentPage === 'unknown') {
                console.log('✅ Successfully completed autofill process!');
                console.log(\`📊 Total interactions processed: \${interactions.length}\`);
                isProcessing = false;
            } else if (currentPage === 'page2.1') {
                console.log('📍 Moved to Page 2.1 for additional interactions');
                // Could add logic here to fill Page 2.1 if needed
                isProcessing = false;
            }
        }, 1000);
    }
    
    // Function to detect current page
    function detectCurrentPage() {
        if (document.querySelector('input[name="t_808166078"]')) {
            return 'page1';
        } else if (document.querySelector('input[name="t_808166082"]')) {
            return 'page2';
        } else if (document.querySelector('input[name="t_808166130"]')) { // Assuming continuation
            return 'page2.1';
        } else {
            return 'unknown';
        }
    }
    
    // Start the autofill process
    function startAutofill() {
        const currentPage = detectCurrentPage();
        console.log('🔍 Detecting current page...');
        
        switch(currentPage) {
            case 'page1':
                console.log('📍 Detected Page 1');
                fillPage1();
                break;
            case 'page2':
                console.log('📍 Detected Page 2');
                fillPage2();
                break;
            default:
                console.log('📍 Page not recognized or already completed');
                break;
        }
    }
    
    // Initialize
    startAutofill();
    console.log(\`✅ Autofill script initialized! Total interactions: \${interactions.length}\`);
})();`;
  };

  const generateAutofillScriptFromSelection = () => {
    if (selectedInteractions.size === 0) return '';

    // Get selected interactions from our unsubmitted list
    const selectedInteractionsList = allUnsubmittedInteractions.filter(interaction => 
      interaction.id && selectedInteractions.has(interaction.id)
    );

    if (selectedInteractionsList.length === 0) return '';

    // Add warning comment if less than 3 interactions selected
    const warningComment = selectedInteractionsList.length < 3 
      ? `// ⚠️ WARNING: Only ${selectedInteractionsList.length} interaction${selectedInteractionsList.length === 1 ? '' : 's'} selected. Weekly reports typically require at least 3 interactions.\n// Consider adding ${3 - selectedInteractionsList.length} more interaction${3 - selectedInteractionsList.length === 1 ? '' : 's'} for a complete report.\n\n`
      : '';

    const interactions = selectedInteractionsList.map(interaction => ({
      id: interaction.residentEmplId || interaction.residentId,
      summary: interaction.details
    }));

    const userAsuId = user?.asu_id || '1234567890'; // Fallback if user not available

    return `${warningComment}(function() {
    console.log('🚀 Starting ASU Survey Autofill (Custom Selection)...');
    
    // Generated interaction data from custom selection
    const interactions = ${JSON.stringify(interactions, null, 8)};

    let isProcessing = false;
    
    // Function to trigger proper form events
    function fillField(element, value) {
        if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.classList.add('used');
            return true;
        }
        return false;
    }
    
    // Function to fill Page 1
    function fillPage1() {
        if (isProcessing) return;
        isProcessing = true;
        
        console.log('📝 Filling Page 1...');
        const asuIdField = document.querySelector('input[name="t_808166078"]');
        if (fillField(asuIdField, '${userAsuId}')) {
            console.log('✅ Filled ASU ID');
            
            setTimeout(() => {
                const startBtn = document.querySelector('#SurveySubmitButtonElement');
                if (startBtn) {
                    console.log('🎯 Clicking Start button...');
                    startBtn.click();
                    monitorForPage2();
                }
            }, 1000);
        } else {
            console.log('❌ ASU ID field not found');
            isProcessing = false;
        }
    }
    
    // Function to monitor for Page 2
    function monitorForPage2() {
        let attempts = 0;
        const maxAttempts = 15;
        
        const checkForPage2 = () => {
            attempts++;
            console.log(\`🔍 Checking for Page 2... (attempt \${attempts})\`);
            
            if (document.querySelector('input[name="t_808166082"]')) {
                console.log('📍 Page 2 detected! Starting autofill...');
                isProcessing = false;
                setTimeout(() => fillPage2(), 1500);
                return;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(checkForPage2, 1000);
            } else {
                console.log('❌ Page 2 not detected after maximum attempts');
                isProcessing = false;
            }
        };
        
        setTimeout(checkForPage2, 2000);
    }
    
    // Function to fill Page 2
    function fillPage2() {
        if (isProcessing) return;
        isProcessing = true;
        
        console.log('📝 Filling Page 2 interactions...');
        
        // Fill required interactions (first 3)
        const requiredFields = [
            { idField: 't_808166082', summaryField: 't_808166083' },
            { idField: 't_808166084', summaryField: 't_808166085' },
            { idField: 't_808166086', summaryField: 't_808166087' }
        ];
        
        console.log('📝 Filling required interactions...');
        for (let i = 0; i < 3 && i < interactions.length; i++) {
            const idField = document.querySelector(\`input[name="\${requiredFields[i].idField}"]\`);
            const summaryField = document.querySelector(\`input[name="\${requiredFields[i].summaryField}"]\`);
            
            if (fillField(idField, interactions[i].id) && fillField(summaryField, interactions[i].summary)) {
                console.log(\`✅ Filled required interaction \${i + 1}\`);
            }
        }
        
        // Fill additional interactions (up to 20)
        const additionalFields = [
            { idField: 't_808166088', summaryField: 't_808166089' },
            { idField: 't_808166090', summaryField: 't_808166091' },
            { idField: 't_808166092', summaryField: 't_808166093' },
            { idField: 't_808166094', summaryField: 't_808166095' },
            { idField: 't_808166096', summaryField: 't_808166097' },
            { idField: 't_808166098', summaryField: 't_808166099' },
            { idField: 't_808166100', summaryField: 't_808166101' },
            { idField: 't_808166102', summaryField: 't_808166103' },
            { idField: 't_808166104', summaryField: 't_808166105' },
            { idField: 't_808166106', summaryField: 't_808166107' },
            { idField: 't_808166108', summaryField: 't_808166109' },
            { idField: 't_808166110', summaryField: 't_808166111' },
            { idField: 't_808166112', summaryField: 't_808166113' },
            { idField: 't_808166114', summaryField: 't_808166115' },
            { idField: 't_808166116', summaryField: 't_808166117' },
            { idField: 't_808166118', summaryField: 't_808166119' },
            { idField: 't_808166120', summaryField: 't_808166121' },
            { idField: 't_808166122', summaryField: 't_808166123' },
            { idField: 't_808166124', summaryField: 't_808166125' },
            { idField: 't_808166126', summaryField: 't_808166127' }
        ];
        
        console.log('📝 Filling additional interactions...');
        const remainingInteractions = interactions.slice(3);
        const maxAdditional = Math.min(remainingInteractions.length, 20);
        
        for (let i = 0; i < maxAdditional; i++) {
            const idField = document.querySelector(\`input[name="\${additionalFields[i].idField}"]\`);
            const summaryField = document.querySelector(\`input[name="\${additionalFields[i].summaryField}"]\`);
            
            if (fillField(idField, remainingInteractions[i].id) && fillField(summaryField, remainingInteractions[i].summary)) {
                console.log(\`✅ Filled additional interaction \${i + 1}\`);
            }
        }
        
        // Handle "Would you like to add more" question and submit
        setTimeout(() => {
            handleRadioAndSubmit();
        }, 2000);
    }
    
    // Function to handle radio selection and submit
    function handleRadioAndSubmit() {
        try {
            console.log('📝 Handling radio selection...');
            
            // Calculate if we need more interactions
            const totalFilled = Math.min(interactions.length, 23); // 3 required + 20 additional max on page 2
            const needsMore = interactions.length > 23;
            
            console.log(\`📊 Total interactions: \${interactions.length}\`);
            console.log(\`📊 Filled on page 2: \${totalFilled}\`);
            console.log(\`📊 Remaining: \${Math.max(0, interactions.length - 23)}\`);
            console.log(\`📊 Needs more pages: \${needsMore}\`);
            
            // Use getElementById for IDs that start with numbers
            const radioYes = document.getElementById('808166128ID');
            const radioNo = document.getElementById('808166129ID');
            
            if (needsMore && radioYes) {
                radioYes.checked = true;
                radioYes.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✅ Selected "Yes" for more interactions');
            } else if (!needsMore && radioNo) {
                radioNo.checked = true;
                radioNo.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✅ Selected "No" - all interactions fit on page 2');
            }
            
            // Click Next button
            setTimeout(() => {
                const nextBtn = document.querySelector('#SurveySubmitButtonElement');
                if (nextBtn) {
                    console.log('🎯 Clicking Next button...');
                    nextBtn.click();
                    
                    // Monitor for popup
                    setTimeout(() => {
                        monitorForPopup();
                    }, 2000);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error handling radio and submit:', error);
            isProcessing = false;
        }
    }
    
    // Function to monitor for popup
    function monitorForPopup() {
        console.log('🔍 Monitoring for popup or next page...');
        
        const popup = document.querySelector('#requestResponseDialog');
        if (popup && popup.style.display !== 'none') {
            console.log('⚠️ Popup detected - waiting for user decision');
            console.log('ℹ️ User can click "Continue Without Answering" to proceed');
            isProcessing = false;
            return;
        }
        
        // Check if we successfully moved to next page
        setTimeout(() => {
            const currentPage = detectCurrentPage();
            if (currentPage === 'page3' || currentPage === 'unknown') {
                console.log('✅ Successfully completed autofill process!');
                console.log(\`📊 Total interactions processed: \${interactions.length}\`);
                isProcessing = false;
            } else if (currentPage === 'page2.1') {
                console.log('📍 Moved to Page 2.1 for additional interactions');
                // Could add logic here to fill Page 2.1 if needed
                isProcessing = false;
            }
        }, 1000);
    }
    
    // Function to detect current page
    function detectCurrentPage() {
        if (document.querySelector('input[name="t_808166078"]')) {
            return 'page1';
        } else if (document.querySelector('input[name="t_808166082"]')) {
            return 'page2';
        } else if (document.querySelector('input[name="t_808166130"]')) { // Assuming continuation
            return 'page2.1';
        } else {
            return 'unknown';
        }
    }
    
    // Start the autofill process
    function startAutofill() {
        const currentPage = detectCurrentPage();
        console.log('🔍 Detecting current page...');
        
        switch(currentPage) {
            case 'page1':
                console.log('📍 Detected Page 1');
                fillPage1();
                break;
            case 'page2':
                console.log('📍 Detected Page 2');
                fillPage2();
                break;
            default:
                console.log('📍 Page not recognized or already completed');
                break;
        }
    }
    
    // Initialize
    startAutofill();
    console.log(\`✅ Autofill script initialized! Total interactions: \${interactions.length}\`);
})();`;
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
                  value={selectedDate}
                  onChange={(e) => {
                    const newSelectedDate = e.target.value;
                    const selectedDateObj = parseDateSafely(newSelectedDate);
                    const weekStart = getWeekStartForDate(selectedDateObj);
                    const weekStartString = format(weekStart, 'yyyy-MM-dd');
                    setSelectedDate(newSelectedDate);
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

            {/* Report Results and Actions */}
            {report && (() => {
              // Filter out submitted interactions for accurate count
              const unsubmittedRequired = report.requiredInteractions.filter(interaction => 
                allUnsubmittedInteractions.some(unsubmitted => unsubmitted.id === interaction.id)
              );
              const unsubmittedAdditional = report.additionalInteractions.filter(interaction => 
                allUnsubmittedInteractions.some(unsubmitted => unsubmitted.id === interaction.id)
              );
              const totalUnsubmitted = unsubmittedRequired.length + unsubmittedAdditional.length;
              
              return (
                <div className="space-y-6">
                  {/* Warning for insufficient interactions - always visible if < 3 unsubmitted */}
                  {totalUnsubmitted < 3 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-lg p-5 shadow-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-amber-800 dark:text-amber-200">
                          Minimum Interactions Required
                        </h3>
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                          Weekly reports require at least 3 interactions. 
                          {totalUnsubmitted === 0 
                            ? ' No unsubmitted interactions found for this week. Please add interactions for this week to generate a complete report.'
                            : ` You have ${totalUnsubmitted} unsubmitted interaction${totalUnsubmitted === 1 ? '' : 's'}. Please add ${3 - totalUnsubmitted} more interaction${3 - totalUnsubmitted === 1 ? '' : 's'} for this week to generate a complete report.`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Autofill Script Section - only show if there are unsubmitted interactions */}
                {totalUnsubmitted > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">Autofill Script</h3>
                        {totalUnsubmitted < 3 && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-full">
                            Incomplete ({totalUnsubmitted}/3)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-3 font-mono text-xs text-gray-900 dark:text-gray-100 max-h-40 overflow-y-auto mb-3">
                      {generateAutofillScript()}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                      Paste this script in your browser console (F12) on the report form page
                    </p>

                    {/* Copy Script Button */}
                    <button
                      onClick={() => copyToClipboard(generateAutofillScript(), 'autofill')}
                      disabled={totalUnsubmitted < 3}
                      className={`w-full px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2 font-medium mb-4 ${
                        totalUnsubmitted < 3
                          ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed opacity-50' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {copied === 'autofill' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied === 'autofill' ? 'Copied!' : (
                        totalUnsubmitted < 3 
                          ? `Copy Script (Need ${3 - totalUnsubmitted} more interactions)`
                          : 'Copy Script'
                      )}
                    </button>

                    {/* Mark as Submitted Button */}
                    <button
                      onClick={markAsSubmitted}
                      disabled={submitting || totalUnsubmitted < 3}
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
                  </div>
                )}
              </div>
              )})()}

            {/* No Results Message - only show if no interactions AND we haven't already shown the warning above */}
            {report && (report.requiredInteractions.length + report.additionalInteractions.length) === 0 && (
              <div className="text-center py-8">
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

              <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
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
                            {interaction.details}
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

            {/* Warning for insufficient interactions */}
            {selectedInteractions.size > 0 && selectedInteractions.size < 3 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-600 dark:text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Minimum Interactions Required
                    </h3>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      Weekly reports require at least 3 interactions. You have selected {selectedInteractions.size} interaction{selectedInteractions.size === 1 ? '' : 's'}. Please select {3 - selectedInteractions.size} more interaction{3 - selectedInteractions.size === 1 ? '' : 's'} to generate a complete report.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Autofill Script Section */}
            {selectedInteractions.size > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Autofill Script</h3>
                    {selectedInteractions.size < 3 && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-full">
                        Incomplete ({selectedInteractions.size}/3)
                      </span>
                    )}
                  </div>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-3 font-mono text-xs text-gray-900 dark:text-gray-100 max-h-40 overflow-y-auto mb-3">
                    {generateAutofillScriptFromSelection()}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                    Paste this script in your browser console (F12) on the report form page
                  </p>

                  {/* Copy Script Button */}
                  <button
                    onClick={() => copyToClipboard(generateAutofillScriptFromSelection(), 'autofill-selection')}
                    disabled={selectedInteractions.size < 3}
                    className={`w-full px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2 font-medium mb-4 ${
                      selectedInteractions.size < 3
                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed opacity-50' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied === 'autofill-selection' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied === 'autofill-selection' ? 'Copied!' : (
                      selectedInteractions.size < 3 
                        ? `Copy Script (Need ${3 - selectedInteractions.size} more interactions)`
                        : 'Copy Script'
                    )}
                  </button>

                  {/* Mark as Submitted Button */}
                  <button
                    onClick={markSelectedAsSubmitted}
                    disabled={selectedInteractions.size === 0 || submitting || selectedInteractions.size < 3}
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
        </div>
      )}

    </div>
  );
}