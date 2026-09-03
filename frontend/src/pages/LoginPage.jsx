import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { Shield, KeyRound, Mail, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check URL query param for logout or session expiration reason
  const queryParams = new URLSearchParams(location.search);
  const sessionReason = queryParams.get('reason');

  useEffect(() => {
    if (isAuthenticated && !isSuccess) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isSuccess, navigate]);

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const data = await authService.login(email.trim(), password);
      // Success: trigger checkmark draw-in animation before navigating
      setIsSuccess(true);
      login(data.token, data.user);
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 700);
    } catch (err) {
      setLoading(false);
      // Show exact backend message inline near the form
      const msg = err.response?.data?.message || 'Authentication failed. Please verify your credentials.';
      setServerError(msg);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full overflow-x-hidden">
      {/* Left Column: Brand & Security Display */}
      <div className="md:w-1/2 bg-ink text-paper p-6 sm:p-8 md:p-16 flex flex-col justify-between border-r border-[#222733]">
        <div>
          <div className="flex items-center space-x-3 mb-8 md:mb-12">
            <div className="w-9 h-9 bg-forest flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-heading text-xs font-bold uppercase tracking-widest text-stone-300">
              Enterprise Access Node
            </span>
          </div>

          <div className="max-w-md space-y-4">
            <h1 className="font-heading text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight uppercase">
              Custom Employee Portal
            </h1>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
              Unified Role-Based Access Control and single-credential proxy architecture for Zoho One business suites.
            </p>
          </div>
        </div>

        <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-[#222733] flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-stone-500 font-mono">
          <span>SECURE REVERSE PROXY</span>
          <span>ZOHO OAUTH2 ENFORCED</span>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="md:w-1/2 bg-paper p-6 sm:p-8 md:p-16 flex flex-col justify-center items-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-ink-text">
              Sign In
            </h2>
            <p className="text-xs text-stone-500">
              Enter your corporate credentials to access authorized applications.
            </p>
          </div>

          {sessionReason && (
            <div className="p-3 bg-amber-50 border border-amber/30 text-amber text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                {sessionReason === 'session_expired'
                  ? 'Your session has expired due to inactivity. Please sign in again.'
                  : sessionReason}
              </span>
            </div>
          )}

          {serverError && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{serverError}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="p-8 bg-white border border-forest/30 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-forest/10 border-2 border-forest flex items-center justify-center text-forest">
                <svg
                  className="w-8 h-8 stroke-current animate-checkmark fill-none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-heading font-bold text-sm uppercase text-forest tracking-wider">
                  Access Authorized
                </p>
                <p className="text-xs text-stone-500 mt-1">Directing to applications...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Corporate Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@brainwave.io"
                    className={`w-full pl-9 pr-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest transition-colors ${
                      fieldErrors.email ? 'border-red-500' : 'border-border'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full pl-9 pr-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest transition-colors ${
                      fieldErrors.password ? 'border-red-500' : 'border-border'
                    }`}
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-forest hover:bg-[#25583E] text-white font-heading text-xs font-bold uppercase tracking-wider transition-colors border border-[#25583E] disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-border text-center">
            <p className="text-[11px] text-stone-500 font-mono">
              Default Admin: <span className="text-ink-text font-bold">admin@brainwave.io</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
