import React from 'react';
import { Sparkles, Compass } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyan-500/10 bg-[#050811]/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Brand */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400/60 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-widest text-slate-100 font-sans group-hover:text-cyan-300 transition-colors">
            ASTRA
          </span>
        </a>

        {/* Nav Links */}
        <nav className="flex items-center gap-4 sm:gap-7 text-xs sm:text-sm font-medium text-slate-300">
          <a
            href="#about"
            className="hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            About
          </a>
          <a
            href="#modules"
            className="hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            Modules
          </a>
          <a
            href="#reconstruct"
            className="hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            Reconstruct
          </a>
          <a
            href="#report"
            className="hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            Report
          </a>
          <a
            href="#history"
            className="hover:text-cyan-400 transition-colors whitespace-nowrap"
          >
            History
          </a>
        </nav>
      </div>
    </header>
  );
};
