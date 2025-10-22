import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import SiteHeader from "./components/SiteHeader";
import PredictionsBanner from "./components/PredictionsBanner";
import HomePage from "./pages/Home";
import LeaguePage from "./pages/League";
import PredictionsPage from "./pages/Predictions";
import AdminPage from "./pages/Admin";

export default function App() {
  const [oldSchoolMode, setOldSchoolMode] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    if (saved !== null) {
      setOldSchoolMode(JSON.parse(saved));
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);

  return (
    <Router>
      <div className={`min-h-screen overflow-y-auto ${oldSchoolMode ? 'oldschool-theme' : 'bg-slate-50 text-slate-900'}`}>
        <SiteHeader />

        {/* 🟡 Add this right under the header */}
        <PredictionsBanner />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/league/:id" element={<LeaguePage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}