import React from 'react';
import { EarthGlobe } from './EarthGlobe';
import { ArrowDown, Sparkles } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-6 pb-14 sm:pb-20 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      {/* Background stars and deep cosmic nebula gradient */}
      <div className="absolute inset-0 pointer-events-none -z-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-violet-600/15 via-cyan-500/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Rotating Earth Globe with atmosphere glow, orbiting satellite & tiny floating astronaut */}
      <EarthGlobe />

      {/* Name, Main Heading, and Subtitle */}
      <div className="mt-4 max-w-4xl mx-auto space-y-4">
        {/* Project Name */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/40 border border-violet-500/30 text-violet-300 text-xs font-semibold tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Project ASTRA</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white font-sans leading-tight drop-shadow-[0_0_35px_rgba(139,92,246,0.35)] uppercase">
          GEN AI BASED MULTIMODAL SPACE DATA RECONSTRUCTION
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto text-balance">
          "An AI-powered platform for reconstructing damaged space data using Generative AI."
        </p>

        {/* Action CTAs */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#reconstruct"
            className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Launch Reconstruction</span>
            <ArrowDown className="w-4 h-4" />
          </a>
          <a
            href="#about"
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            About Project
          </a>
        </div>
      </div>
    </section>
  );
};
