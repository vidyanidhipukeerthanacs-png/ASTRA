import React from 'react';
import { Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  const teamMembers = [
    'Sumaiya Khanam',
    'Keerthana C S',
    'Pragna S N',
    'Sahana N',
  ];

  return (
    <footer className="w-full border-t border-slate-800/80 bg-[#04060d] py-12 px-4 sm:px-6 relative overflow-hidden">
      {/* Subtle cosmic glow at base */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[150px] bg-gradient-to-t from-violet-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-6 relative z-10">
        {/* Brand Lockup */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-xl font-bold tracking-widest text-white font-sans">
              ASTRA
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-300 tracking-wide font-sans">
            Gen AI Based Multimodal Space Data Reconstruction
          </p>
        </div>

        {/* Designed and Developed by with centered neat names */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400 font-mono">
            Designed and Developed by:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium text-slate-200">
            {teamMembers.map((name, index) => (
              <React.Fragment key={name}>
                <span className="hover:text-cyan-300 transition-colors">
                  {name}
                </span>
                {index < teamMembers.length - 1 && (
                  <span aria-hidden="true" className="text-slate-600 hidden sm:inline">
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Project Quote */}
        <p className="text-xs sm:text-sm text-slate-400 italic max-w-xl font-normal">
          "From damaged data to new possibilities — exploring the universe through AI."
        </p>

        {/* Copyright */}
        <div className="pt-4 border-t border-slate-900 w-full max-w-md">
          <p className="text-xs text-slate-500 font-mono">
            © 2026 ASTRA. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
