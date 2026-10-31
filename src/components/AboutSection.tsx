import React from 'react';
import { Database, ShieldCheck, Zap, Layers } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="relative rounded-3xl border border-violet-500/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-8 sm:p-12 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Ambient violet and blue glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
              System Overview
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-sans">
              About Our Project
            </h2>
            <div className="w-16 h-0.5 bg-gradient-to-r from-cyan-400 via-violet-400 to-indigo-500 mx-auto rounded-full" />
          </div>

          {/* Description verbatim from user brief */}
          <div className="p-6 sm:p-8 rounded-2xl bg-black/40 border border-slate-800/80 shadow-inner">
            <p className="text-base sm:text-lg text-slate-200 font-normal leading-relaxed text-center sm:text-left text-balance">
              ASTRA is a Generative AI-based multimodal platform designed to reconstruct damaged or missing information in space-related data. It helps improve the quality and usability of images, videos, audio, and text through AI-powered reconstruction techniques. Users can upload damaged data, process it, and view or download the reconstructed results.
            </p>
          </div>

          {/* 4 Architectural Engineering Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-violet-500/20 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Multimodal AI
              </h4>
              <p className="text-xs text-slate-400 leading-normal">
                Four distinct AI & DSP pipelines covering visual imagery, video telemetry, audio signals, and scientific text logs.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-violet-500/20 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-950/60 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Edge Execution
              </h4>
              <p className="text-xs text-slate-400 leading-normal">
                Neural inpainting and autoregressive models run client-side in the browser without external API servers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-violet-500/20 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Integrity & Honesty
              </h4>
              <p className="text-xs text-slate-400 leading-normal">
                Deterministic detection masks, 3px feathered compositing, and transparent verification reports.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-violet-500/20 flex flex-col gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Persistent Cache
              </h4>
              <p className="text-xs text-slate-400 leading-normal">
                Local IndexedDB binary storage preserves reconstructed PNG, WebM, WAV, and TXT files directly on the device.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
