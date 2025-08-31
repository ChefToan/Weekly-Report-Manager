'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, UserPlus, ArrowLeft, CheckCircle, Key, User, Mail, IdCard } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    asuId: '',
    username: '',
    password: '',
    confirmPassword: '',
    registrationCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear general error when user starts typing
    if (error) setError('');
    
    // Clear specific field error when user starts typing in that field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Real-time validation
    validateField(name, value);
  };

  const validateField = (name: string, value: string) => {
    let errorMsg = '';
    
    switch (name) {
      case 'firstName':
      case 'lastName':
        if (value.trim().length > 0 && value.trim().length < 2) {
          errorMsg = 'Must be at least 2 characters';
        }
        break;
      case 'email':
        if (value.trim().length > 0 && !value.includes('@asu.edu')) {
          errorMsg = 'Must be a valid ASU email address (@asu.edu)';
        }
        break;
      case 'asuId':
        if (value.length > 0 && !/^\d{10}$/.test(value)) {
          errorMsg = 'ASU ID must be exactly 10 digits';
        }
        break;
      case 'username':
        if (value.trim().length > 0 && value.trim().length < 3) {
          errorMsg = 'Username must be at least 3 characters';
        }
        break;
      case 'password':
        if (value.length > 0) {
          if (value.length < 8) {
            errorMsg = 'Password must be at least 8 characters long';
          } else {
            // Check password complexity
            const hasUpperCase = /[A-Z]/.test(value);
            const hasLowerCase = /[a-z]/.test(value);
            const hasNumbers = /\d/.test(value);
            const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);
            const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
            
            if (complexityCount < 3) {
              errorMsg = 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters';
            }
          }
        }
        break;
      case 'confirmPassword':
        if (value.length > 0 && value !== formData.password) {
          errorMsg = 'Passwords do not match';
        }
        break;
      case 'registrationCode':
        if (value.trim().length === 0) {
          errorMsg = 'Registration code is required';
        }
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isPasswordValid = (password: string) => {
    if (password.length < 8) return false;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    return complexityCount >= 3;
  };

  const isFormValid = formData.firstName.trim().length >= 2 &&
                     formData.lastName.trim().length >= 2 &&
                     formData.email.trim().length > 0 &&
                     formData.email.includes('@asu.edu') &&
                     formData.asuId.trim().length === 10 &&
                     /^\d{10}$/.test(formData.asuId) &&
                     formData.username.trim().length >= 3 && 
                     isPasswordValid(formData.password) && 
                     formData.password === formData.confirmPassword && 
                     formData.registrationCode.trim().length > 0 &&
                     Object.values(fieldErrors).every(error => error === '');

  const getFieldClassName = (fieldName: string, hasIcon = false) => {
    const baseClass = `w-full px-4 py-3 ${hasIcon ? 'pl-12' : ''} border rounded-lg focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors`;
    const hasError = fieldErrors[fieldName] && fieldErrors[fieldName] !== '';
    
    if (hasError) {
      return `${baseClass} border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20`;
    }
    
    return `${baseClass} border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500`;
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        {/* Theme Toggle - Fixed Position */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Account Created Successfully!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your account has been created. You will be redirected to the login page shortly.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-slate-900 flex items-center justify-center p-4">
      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <div className="max-w-4xl w-full">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
            <button
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 text-blue-100 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">
              Create Your Account
            </h1>
            <p className="text-blue-100">
              Join the Community Assistant weekly reporting system with your ASU credentials
            </p>
          </div>

          <div className="p-8">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Registration Failed
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Personal Information Column */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-6">
                      <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      Personal Information
                    </h3>
                  </div>
                  
                  {/* First & Last Name Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="First name"
                        className={getFieldClassName('firstName')}
                        required
                        disabled={loading}
                        minLength={2}
                      />
                      {fieldErrors.firstName && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fieldErrors.firstName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="Last name"
                        className={getFieldClassName('lastName')}
                        required
                        disabled={loading}
                        minLength={2}
                      />
                      {fieldErrors.lastName && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {fieldErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ASU Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ASU Email *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="yourname@asu.edu"
                        className={getFieldClassName('email', true)}
                        required
                        disabled={loading}
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldErrors.email}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Use your official ASU email address
                    </p>
                  </div>

                  {/* ASU ID */}
                  <div>
                    <label htmlFor="asuId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      ASU ID *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="asuId"
                        name="asuId"
                        value={formData.asuId}
                        onChange={handleChange}
                        placeholder="1234567890"
                        className={getFieldClassName('asuId', true)}
                        required
                        disabled={loading}
                        maxLength={10}
                        pattern="\d{10}"
                      />
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {fieldErrors.asuId && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldErrors.asuId}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Your 10-digit ASU ID number
                    </p>
                  </div>
                </div>

                {/* Account Information Column */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-6">
                      <Key className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      Account Information
                    </h3>
                  </div>
                  
                  {/* Username */}
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Choose a username"
                        className={getFieldClassName('username', true)}
                        required
                        disabled={loading}
                        minLength={3}
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {fieldErrors.username && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldErrors.username}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      At least 3 characters, used for login
                    </p>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Create a password"
                        className={getFieldClassName('password')}
                        required
                        disabled={loading}
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldErrors.password}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      At least 8 characters with 3 of: uppercase, lowercase, numbers, special characters
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm your password"
                        className={getFieldClassName('confirmPassword')}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        disabled={loading}
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {/* Registration Code */}
                  <div>
                    <label htmlFor="registrationCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Registration Code *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="registrationCode"
                        name="registrationCode"
                        value={formData.registrationCode}
                        onChange={handleChange}
                        placeholder="Enter registration code"
                        className={getFieldClassName('registrationCode', true)}
                        required
                        disabled={loading}
                      />
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {fieldErrors.registrationCode && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {fieldErrors.registrationCode}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Registration code provided by administrator
                      <br />
                      <span className="text-blue-600 dark:text-blue-400">(Please DM Toan for this code :D)</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 px-6 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      Create Account
                    </>
                  )}
                </button>
                
                {!isFormValid && Object.values(fieldErrors).some(error => error !== '') && (
                  <p className="text-center text-sm text-red-600 dark:text-red-400 mt-3 flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Please fix the errors above to continue
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}