/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ReconstructSection } from './components/ReconstructSection';
import { ReportSection } from './components/ReportSection';
import { HistorySection } from './components/HistorySection';
import { ReconstructionReport, HistoryItem } from './types';
import { getAllHistory, saveHistoryItem } from './utils/db';

export default function App() {
  const [latestReport, setLatestReport] = useState<ReconstructionReport | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // Load history from IndexedDB on initial mount
  useEffect(() => {
    getAllHistory().then((items) => {
      setHistoryItems(items);
      if (items.length > 0 && !latestReport) {
        setLatestReport(items[0].report);
      }
    });
  }, []);

  const handleReconstructionComplete = async (item: HistoryItem) => {
    setLatestReport(item.report);
    setHistoryItems((prev) => [item, ...prev]);
    await saveHistoryItem(item);

    // Smooth scroll down to the Report section so user sees the diagnosis immediately
    const reportElem = document.getElementById('report');
    if (reportElem) {
      reportElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleItemDeleted = (id: string) => {
    setHistoryItems((prev) => prev.filter((i) => i.id !== id));
    if (latestReport?.id === id) {
      setLatestReport(null);
    }
  };

  const handleViewReport = (item: HistoryItem) => {
    setLatestReport(item.report);
    const reportElem = document.getElementById('report');
    if (reportElem) {
      reportElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero with Earth Globe */}
        <Hero />

        {/* 2x2 Reconstruct Grid (Image, Video, Audio, Text) */}
        <ReconstructSection onReconstructionComplete={handleReconstructionComplete} />

        {/* Real Empirical Report Card */}
        <ReportSection latestReport={latestReport} />

        {/* Persisted History */}
        <HistorySection
          items={historyItems}
          onItemDeleted={handleItemDeleted}
          onViewReport={handleViewReport}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="w-full border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>ASTRA · Multimodal Space Data Reconstruction</p>
          <p className="text-slate-600">All neural models and DSP pipelines execute client-side in browser.</p>
        </div>
      </footer>
    </div>
  );
}
