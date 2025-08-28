'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Check, AlertCircle, Clock, User, Key } from 'lucide-react';

interface RegistrationCode {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  is_used: boolean;
  expires_at: string;
  created_at: string;
  created_by_user?: {
    username: string;
    first_name: string;
    last_name: string;
  };
  used_by_user?: {
    username: string;
    first_name: string;
    last_name: string;
  };
}

export default function CodeGenerator() {
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(24);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    try {
      const response = await fetch('/api/admin/registration-codes', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setCodes(data.codes);
      } else {
        setError('Failed to load registration codes');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createCode = async () => {
    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/admin/registration-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ expiresInHours }),
      });

      if (response.ok) {
        const data = await response.json();
        setCodes([data.code, ...codes]);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to create registration code');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setCreating(false);
    }
  };

  const deleteCode = async (codeId: string) => {
    if (!confirm('Are you sure you want to delete this registration code?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/registration-codes?id=${codeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setCodes(codes.filter(code => code.id !== codeId));
      } else {
        setError('Failed to delete registration code');
      }
    } catch (err) {
      setError('Network error occurred');
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const getStatusColor = (code: RegistrationCode) => {
    if (code.is_used) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    if (isExpired(code.expires_at)) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const getStatusText = (code: RegistrationCode) => {
    if (code.is_used) return 'Used';
    if (isExpired(code.expires_at)) return 'Expired';
    return 'Active';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Registration Code Generator
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate one-time registration codes for new users
          </p>
        </div>
        
        {/* Create Code Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Expires in:
            </label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              disabled={creating}
            >
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
          </div>
          
          <button
            onClick={createCode}
            disabled={creating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Generate Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Registration Codes List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Registration Codes
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {codes.filter(c => !c.is_used && !isExpired(c.expires_at)).length} active codes
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {codes.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No registration codes yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Generate a code to allow new users to register
              </p>
            </div>
          ) : (
            codes.map((code) => (
              <div key={code.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="font-mono text-lg font-medium text-gray-900 dark:text-gray-100">
                        {code.code}
                      </code>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(code)}`}>
                        {getStatusText(code)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Expires: {formatDate(code.expires_at)}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>By: {code.created_by_user ? `${code.created_by_user.first_name} ${code.created_by_user.last_name}` : 'Unknown'}</span>
                      </div>
                      
                      {code.is_used && code.used_by_user && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>Used by: {code.used_by_user.first_name} {code.used_by_user.last_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => copyToClipboard(code.code)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === code.code ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    
                    {!code.is_used && (
                      <button
                        onClick={() => deleteCode(code.id)}
                        className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        title="Delete code"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}