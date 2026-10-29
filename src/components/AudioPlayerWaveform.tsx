import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerWaveformProps {
  label: string;
  blob: Blob;
  highlightColor?: string;
}

export const AudioPlayerWaveform: React.FC<AudioPlayerWaveformProps> = ({
  label,
  blob,
  highlightColor = '#06b6d4',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [waveData, setWaveData] = useState<number[]>([]);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    // Decode waveform data for visualizer
    const decodeWaveform = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);

        // Subsample into 64 peaks
        const bars = 64;
        const step = Math.floor(channelData.length / bars);
        const peaks: number[] = [];

        for (let b = 0; b < bars; b++) {
          let max = 0;
          const start = b * step;
          for (let i = 0; i < step; i++) {
            const v = Math.abs(channelData[start + i] || 0);
            if (v > max) max = v;
          }
          peaks.push(Math.max(0.06, max));
        }

        setWaveData(peaks);
        audioCtx.close();
      } catch (err) {
        console.warn('Could not decode audio buffer for waveform:', err);
      }
    };

    decodeWaveform();

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Draw waveform canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveData.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barWidth = w / waveData.length;
    const progress = duration > 0 ? currentTime / duration : 0;
    const activeIndex = Math.floor(progress * waveData.length);

    waveData.forEach((val, idx) => {
      const barH = val * h * 0.85;
      const x = idx * barWidth + 1;
      const y = (h - barH) / 2;

      ctx.fillStyle = idx <= activeIndex ? highlightColor : 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(2, barWidth - 2), barH, 1.5);
      ctx.fill();
    });
  }, [waveData, currentTime, duration, highlightColor]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="font-mono text-slate-400 tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${label}`}
          className="w-9 h-9 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 flex items-center justify-center transition-colors shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <canvas
          ref={canvasRef}
          width={240}
          height={38}
          className="w-full h-9 rounded bg-black/40"
        />
      </div>
    </div>
  );
};
