import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white border border-border p-8 space-y-4">
        <div className="w-12 h-12 bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-wide text-ink-text">
          404 — Node Not Found
        </h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          The requested route or administrative endpoint does not exist on this portal cluster.
        </p>
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-forest hover:bg-[#25583E] text-white font-heading text-xs font-bold uppercase tracking-wider transition-colors border border-[#25583E]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Directory</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
