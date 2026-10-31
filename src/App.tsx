/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutSection } from './components/AboutSection';
import { ModulesOverview } from './components/ModulesOverview';
import { ReconstructSection } from './components/ReconstructSection';
import { ReportSection } from './components/ReportSection';
import { HistorySection } from './components/HistorySection';
import { Footer } from './components/Footer';
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

        {/* Engineering Overview: About Our Project */}
        <AboutSection />

        {/* Modules Overview: 4 Architectural Pillars with Quick-jump buttons */}
        <ModulesOverview />

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

      {/* Engineering Project Footer with Team Member Credits */}
      <Footer />
    </div>
  );
}
