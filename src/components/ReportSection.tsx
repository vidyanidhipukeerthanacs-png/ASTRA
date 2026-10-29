import React from 'react';
import { FileCheck, Download, Clock, Cpu, AlertTriangle, FileCode } from 'lucide-react';
import { ReconstructionReport } from '../types';

interface ReportSectionProps {
  latestReport: ReconstructionReport | null;
}

export const ReportSection: React.FC<ReportSectionProps> = ({ latestReport }) => {
  const downloadReportFile = () => {
    if (!latestReport) return;
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

## 4. Integrity Notice
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
