import React from 'react';
import { EarthGlobe } from './EarthGlobe';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-6 pb-12 sm:pb-16 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
      {/* Background stars pattern */}
      <div className="absolute inset-0 pointer-events-none -z-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />

      {/* Rotating Earth Globe with satellite & astronaut */}
      <EarthGlobe />

      {/* Name and Tagline */}
      <div className="mt-4 max-w-2xl mx-auto space-y-3">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-sans drop-shadow-[0_0_25px_rgba(6,182,212,0.35)]">
          ASTRA
        </h1>
        <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl mx-auto text-balance">
          Rebuilding the universe's lost data — one pixel, one signal, one word at a time.
        </p>
      </div>
    </section>
  );
};
