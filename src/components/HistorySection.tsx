import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  Download,
  Trash2,
  Eye,
  X,
  Clock,
  Archive,
} from 'lucide-react';
import { HistoryItem } from '../types';
import { deleteHistoryItem } from '../utils/db';

interface HistorySectionProps {
  items: HistoryItem[];
  onItemDeleted: (id: string) => void;
  onViewReport: (item: HistoryItem) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  items,
  onItemDeleted,
  onViewReport,
}) => {
  const [viewingItem, setViewingItem] = useState<HistoryItem | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteHistoryItem(id);
      onItemDeleted(id);
      if (viewingItem?.id === id) setViewingItem(null);
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleDownloadResult = (item: HistoryItem) => {
    if (item.reconstructedBlob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(item.reconstructedBlob);
      a.download = `reconstructed_${item.fileName}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (item.reconstructedText) {
      const blob = new Blob([item.reconstructedText], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `reconstructed_${item.fileName}`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const handleDownloadReport = (item: HistoryItem) => {
    const r = item.report;
    const reportContent = `# ASTRA Reconstruction Report
ID: ${r.id}
Date: ${new Date(r.timestamp).toISOString()}
File: ${r.fileName} (${r.modality.toUpperCase()})
Damage: ${r.damageDescription}
Outcome: ${r.reconstructionSummary}
Method: ${r.methodUsed}
Time: ${r.measuredTimeMs} ms
Disclaimer: ${r.disclaimer}
`;
    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Report_${r.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderModalityIcon = (modality: string) => {
    switch (modality) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-cyan-400" />;
      case 'video':
        return <VideoIcon className="w-4 h-4 text-sky-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-indigo-400" />;
      case 'text':
      default:
        return <FileText className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <section id="history" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 border-t border-slate-800/80">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Reconstruction History
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Locally persisted records in your browser storage.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-white/[0.02] p-8 text-center text-slate-400 text-xs sm:text-sm">
          <Archive className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
          <p>No past reconstructions saved yet.</p>
          <p className="text-slate-500 mt-1">
            Every reconstructed image, video, audio file, and text log is safely cached in your browser.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-800/90 bg-white/[0.03] hover:border-cyan-500/30 p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-black/50 border border-slate-800 flex items-center justify-center shrink-0">
                  {renderModalityIcon(item.modality)}
                </div>

                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-100 truncate">
                    {item.fileName}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    <span>·</span>
                    <span className="truncate max-w-[180px] text-slate-500">{item.methodUsed}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setViewingItem(item);
                    onViewReport(item);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="View result"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>View</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadResult(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download result file"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Result</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadReport(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download report markdown"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Report</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                  title="Delete item"
                  aria-label="Delete item from history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Viewing Item Modal / Lightbox */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-cyan-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{viewingItem.fileName}</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(viewingItem.timestamp).toLocaleString()} · {viewingItem.modality.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Display result according to modality */}
            <div className="flex justify-center">
              {viewingItem.modality === 'image' && viewingItem.reconstructedUrl && (
                <img
                  src={viewingItem.reconstructedUrl}
                  alt={viewingItem.fileName}
                  className="max-h-[420px] rounded-xl object-contain border border-cyan-500/20"
                />
              )}

              {viewingItem.modality === 'video' && viewingItem.reconstructedUrl && (
                <video
                  src={viewingItem.reconstructedUrl}
                  controls
                  loop
                  autoPlay
                  className="max-h-[380px] w-full rounded-xl object-contain border border-cyan-500/20"
                />
              )}

              {viewingItem.modality === 'audio' && viewingItem.reconstructedBlob && (
                <audio
                  src={URL.createObjectURL(viewingItem.reconstructedBlob)}
                  controls
                  className="w-full my-4"
                />
              )}

              {viewingItem.modality === 'text' && viewingItem.reconstructedText && (
                <div className="w-full p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                  {viewingItem.reconstructedText}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleDownloadResult(viewingItem)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Result</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
