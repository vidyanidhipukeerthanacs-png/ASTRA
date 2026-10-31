import React from 'react';
import { FileCheck, Download, Clock, Cpu, AlertTriangle, FileCode } from 'lucide-react';
import { ReconstructionReport } from '../types';

interface ReportSectionProps {
  latestReport: ReconstructionReport | null;
}

export const ReportSection: React.FC<ReportSectionProps> = ({ latestReport }) => {
  const downloadReportFile = () => {
    if (!latestReport) return;
    let extraReportText = '';
    if (latestReport.videoMetrics) {
      extraReportText += `\n## 4. Video Telemetry & Quality Metrics
- PSNR (Peak Signal-to-Noise Ratio): ${latestReport.videoMetrics.psnrDb} dB
- SSIM (Structural Similarity Index): ${latestReport.videoMetrics.ssim}
- Temporal Continuity: ${latestReport.videoMetrics.temporalContinuity}%
`;
    }
    if (latestReport.audioMetrics) {
      extraReportText += `\n## 4. Audio Restoration Telemetry
- Initial SNR: ${latestReport.audioMetrics.initialSnrDb} dB
- Restored SNR: ${latestReport.audioMetrics.restoredSnrDb} dB (+${latestReport.audioMetrics.snrGainDb} dB gain)
- Total Harmonic Distortion (THD): ${latestReport.audioMetrics.thdPercent}%
- Spectral Flatness Measure: ${latestReport.audioMetrics.spectralFlatness}
- Click Transients Removed: ${latestReport.audioMetrics.clicksRemoved}
- Silent Dropouts Interpolated: ${latestReport.audioMetrics.dropoutsInterpolated}
- Power Line Hum Attenuated: ${latestReport.audioMetrics.humAttenuatedDb} dB
- Pristine Input Status: ${latestReport.audioMetrics.isCleanSignal ? 'Yes (Clean signal preserved)' : 'Restored'}
`;
    }
    if (latestReport.textItems && latestReport.textItems.length > 0) {
      extraReportText += `\n## 4. Text Restoration Telemetry (${latestReport.textItems.length} parsed items)
- Missing Empirical Measurements designated [Unknown value]: ${latestReport.textItems.filter((i) => i.status === 'unknown_value').length}
- Reconstructed Domain Vocabulary Words: ${latestReport.textItems.filter((i) => i.status === 'restored').length}
- Ambiguous Gaps flagged [Uncertain]: ${latestReport.textItems.filter((i) => i.status === 'uncertain').length}
`;
    }

    const reportContent = `# ASTRA Space Data Reconstruction Report
Generated: ${new Date(latestReport.timestamp).toISOString()}
ID: ${latestReport.id}

## 1. Input Specification
- File Name: ${latestReport.fileName}
- Modality: ${latestReport.modality.toUpperCase()}
- File Size: ${(latestReport.fileSizeBytes / 1024).toFixed(1)} KB

## 2. Damage Diagnosis
- Finding: ${latestReport.damageDescription}
${latestReport.damagedAreaPercent !== undefined ? `- Damaged Area Ratio: ${latestReport.damagedAreaPercent}%` : ''}

## 3. Reconstruction Outcome
- Result: ${latestReport.reconstructionSummary}
- Method: ${latestReport.methodUsed}
- Measured Execution Time: ${latestReport.measuredTimeMs} ms
${extraReportText}
## 5. Integrity & Scientific Disclaimer
${latestReport.disclaimer}
`;

    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ASTRA_Report_${latestReport.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section id="report" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Reconstruction Report
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Empirical diagnosis and model execution metrics.
          </p>
        </div>

        {latestReport && (
          <button
            type="button"
            onClick={downloadReportFile}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>
        )}
      </div>

      {latestReport ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-white/[0.03] backdrop-blur-md p-6 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.37)] space-y-6">
          {/* Metadata Bar (Zero-Pill Discipline) */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 border-b border-slate-800/80 pb-4">
            <span className="font-semibold text-cyan-300 uppercase tracking-wider">
              {latestReport.modality}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-300 font-medium">{latestReport.fileName}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono tabular-nums">{(latestReport.fileSizeBytes / 1024).toFixed(1)} KB</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {new Date(latestReport.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Report Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
            {/* Damage Found */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Damage Found
              </span>
              <p className="text-slate-200 text-xs leading-relaxed font-sans">
                {latestReport.damageDescription}
              </p>
            </div>

            {/* What ASTRA Reconstructed */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                Reconstructed Outcome
              </span>
              <p className="text-slate-200 text-xs leading-relaxed font-sans">
                {latestReport.reconstructionSummary}
              </p>
            </div>

            {/* Method Used */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Method Used
              </span>
              <p className="text-slate-200 text-xs font-mono">
                {latestReport.methodUsed}
              </p>
            </div>

            {/* Measured Processing Time */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Processing Time
              </span>
              <p className="text-slate-200 text-xs font-mono tabular-nums">
                {latestReport.measuredTimeMs.toLocaleString()} ms (Real measured time)
              </p>
            </div>
          </div>

          {/* Video Metrics Card if Available */}
          {latestReport.videoMetrics && (
            <div className="pt-4 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-400 block mb-2">Video Verification Telemetry</span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">PSNR Fidelity</span>
                  <span className="text-cyan-300 font-mono font-bold">{latestReport.videoMetrics.psnrDb} dB</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">SSIM Index</span>
                  <span className="text-cyan-300 font-mono font-bold">{latestReport.videoMetrics.ssim}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">Temporal Continuity</span>
                  <span className="text-cyan-300 font-mono font-bold">{latestReport.videoMetrics.temporalContinuity}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Audio Metrics Card if Available */}
          {latestReport.audioMetrics && (
            <div className="pt-4 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-400 block mb-2">Audio Restoration Telemetry</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">SNR Gain</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    +{latestReport.audioMetrics.snrGainDb} dB
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ({latestReport.audioMetrics.initialSnrDb} → {latestReport.audioMetrics.restoredSnrDb} dB)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">THD Distortion</span>
                  <span className="text-cyan-300 font-mono font-bold">{latestReport.audioMetrics.thdPercent}%</span>
                  <span className="text-[10px] text-slate-400 block font-mono">Harmonic</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">Spectral Flatness</span>
                  <span className="text-cyan-300 font-mono font-bold">{latestReport.audioMetrics.spectralFlatness}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">SFM Index</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">Glitches Repaired</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {latestReport.audioMetrics.clicksRemoved + latestReport.audioMetrics.dropoutsInterpolated}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {latestReport.audioMetrics.isCleanSignal ? 'Pristine Input' : 'Restored'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Text Items Summary if Available */}
          {latestReport.textItems && latestReport.textItems.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-400 block mb-2">
                Text Restoration Integrity ({latestReport.textItems.length} tokens parsed)
              </span>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Empirical measurements designated [Unknown value]:</span>
                  <span className="text-amber-400 font-bold">
                    {latestReport.textItems.filter((i) => i.status === 'unknown_value').length}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Restored domain words:</span>
                  <span className="text-cyan-400 font-bold">
                    {latestReport.textItems.filter((i) => i.status === 'restored').length}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Ambiguous tokens flagged [Uncertain]:</span>
                  <span className="text-purple-400 font-bold">
                    {latestReport.textItems.filter((i) => i.status === 'uncertain').length}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mandatory Honesty Disclaimer */}
          <div className="pt-4 border-t border-slate-800/80">
            <p className="text-xs text-slate-400 italic">
              "{latestReport.disclaimer}"
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/80 bg-white/[0.02] p-8 text-center text-slate-400 text-xs sm:text-sm">
          <FileCode className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
          <p>Ready to inspect space telemetry.</p>
          <p className="text-slate-500 mt-1">Reconstruct any asset above to view empirical verification metrics.</p>
        </div>
      )}
    </section>
  );
};
