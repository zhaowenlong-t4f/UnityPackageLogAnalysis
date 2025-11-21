import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-slate-200 h-16 flex items-center px-6 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">Unity<span className="text-indigo-600">LogAI</span></span>
      </div>

      <div className="ml-12 flex gap-6">
        <Link 
          to="/" 
          className={`text-sm font-medium transition-colors ${isActive('/') ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          日志分析 (Analyzer)
        </Link>
        <Link 
          to="/kb" 
          className={`text-sm font-medium transition-colors ${isActive('/kb') ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          知识库 (Knowledge Base)
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;