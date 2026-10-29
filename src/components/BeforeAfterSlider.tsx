import React, { useState, useRef, useCallback } from 'react';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Damaged',
  afterLabel = 'Reconstructed',
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) handleMove(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square max-h-[360px] rounded-xl overflow-hidden border border-cyan-500/20 select-none cursor-ew-resize bg-black/40 shadow-inner"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      role="region"
      aria-label="Image comparison slider"
    >
      {/* After (Reconstructed) Image underneath */}
      <img
        src={afterUrl}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* Before (Damaged) Image clipped on top */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none max-w-none"
          style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Draggable handle knob */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-900 border border-cyan-400 text-cyan-300 flex items-center justify-center text-xs shadow-[0_0_12px_rgba(6,182,212,0.6)]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
            <polyline points="9 18 3 12 9 6" />
          </svg>
        </div>
      </div>

      {/* Badges */}
      <div className="absolute top-3 left-3 px-2 py-0.5 rounded text-[11px] font-medium bg-black/60 text-slate-300 border border-white/10 backdrop-blur-sm pointer-events-none">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm pointer-events-none">
        {afterLabel}
      </div>
    </div>
  );
};
