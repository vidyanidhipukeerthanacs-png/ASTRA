import React from 'react';
import { Image, Video, Music, FileText, ArrowRight } from 'lucide-react';

interface ModuleCard {
  id: string;
  targetId: string;
  title: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  accentBorder: string;
  accentBg: string;
  iconColor: string;
  btnGradient: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'image',
    targetId: 'image-module',
    title: 'IMAGE RECONSTRUCTION',
    category: 'Computer Vision',
    description:
      'Uses AI-based image inpainting to detect and reconstruct missing or damaged regions in satellite images.',
    icon: <Image className="w-5 h-5" />,
    accentBorder: 'hover:border-cyan-500/50',
    accentBg: 'bg-cyan-950/40 border-cyan-500/30',
    iconColor: 'text-cyan-400',
    btnGradient: 'hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    id: 'video',
    targetId: 'video-module',
    title: 'VIDEO RECONSTRUCTION',
    category: 'Temporal Processing',
    description:
      'Uses AI-based video restoration techniques to reconstruct damaged or missing video information.',
    icon: <Video className="w-5 h-5" />,
    accentBorder: 'hover:border-sky-500/50',
    accentBg: 'bg-sky-950/40 border-sky-500/30',
    iconColor: 'text-sky-400',
    btnGradient: 'hover:bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    id: 'audio',
    targetId: 'audio-module',
    title: 'AUDIO RECONSTRUCTION',
    category: 'Digital Signal Processing',
    description:
      'Uses audio reconstruction techniques to recover missing or corrupted audio information.',
    icon: <Music className="w-5 h-5" />,
    accentBorder: 'hover:border-violet-500/50',
    accentBg: 'bg-violet-950/40 border-violet-500/30',
    iconColor: 'text-violet-400',
    btnGradient: 'hover:bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  {
    id: 'text',
    targetId: 'text-module',
    title: 'TEXT RECONSTRUCTION',
    category: 'Natural Language Processing',
    description:
      'Uses AI-based language processing to identify missing or damaged text and reconstruct it using surrounding context.',
    icon: <FileText className="w-5 h-5" />,
    accentBorder: 'hover:border-indigo-500/50',
    accentBg: 'bg-indigo-950/40 border-indigo-500/30',
    iconColor: 'text-indigo-400',
    btnGradient: 'hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
];

export const ModulesOverview: React.FC = () => {
  const handleOpenModule = (targetId: string) => {
    const elem = document.getElementById(targetId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief pulse highlight
      elem.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-[#050811]');
      setTimeout(() => {
        elem.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-[#050811]');
      }, 1600);
    } else {
      const fallback = document.getElementById('reconstruct');
      fallback?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="modules" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {/* Section Header */}
      <div className="text-center space-y-3 mb-10 sm:mb-12">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-400 font-mono">
          Capabilities & Architecture
        </span>
        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-sans">
          Our Reconstruction Modules
        </h2>
        <div className="w-16 h-0.5 bg-gradient-to-r from-violet-400 via-cyan-400 to-indigo-500 mx-auto rounded-full" />
      </div>

      {/* 4 Attractive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MODULES.map((mod) => (
          <div
            key={mod.id}
            className={`group rounded-2xl border border-slate-800 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(139,92,246,0.15)] ${mod.accentBorder}`}
          >
            <div className="space-y-4">
              {/* Icon and Category Tag */}
              <div className="flex items-center justify-between">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-105 ${mod.accentBg} ${mod.iconColor}`}
                >
                  {mod.icon}
                </div>
                <span className="text-[11px] font-mono text-slate-400 tracking-wide">
                  {mod.category}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-bold text-white tracking-wider font-sans group-hover:text-cyan-300 transition-colors">
                {mod.title}
              </h3>

              {/* Description verbatim from user brief */}
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                {mod.description}
              </p>
            </div>

            {/* Button that opens the existing reconstruction module */}
            <div className="pt-6 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => handleOpenModule(mod.targetId)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border bg-slate-900/80 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${mod.btnGradient}`}
              >
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
