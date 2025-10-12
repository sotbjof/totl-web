// src/main.tsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import TablesPage from "./pages/Tables";
import LeaguePage from "./pages/League";
import PredictionsPage from "./pages/Predictions";
import AdminPage from "./pages/Admin";
import HomePage from "./pages/Home";
import GlobalPage from "./pages/Global";
import CreateLeaguePage from "./pages/CreateLeague";
import HowToPlayPage from "./pages/HowToPlay";
import { getCurrentUser, onDevUserChange, setDevUser } from "./devAuth";
import PredictionsBanner from "./components/PredictionsBanner";

function AppShell() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [me, setMe] = React.useState(() => getCurrentUser());
  React.useEffect(() => onDevUserChange(setMe), []);
  const shortId = (id: string) => `${id.slice(0, 4)}…${id.slice(-4)}`;
  return (
    <BrowserRouter>
      {/* Dev User Selector - Above Header */}
      {import.meta.env.DEV && (
        <div className="bg-gray-100 text-xs py-1 flex justify-center items-center gap-3 border-b border-gray-300">
          <span className="text-gray-600 font-medium">{me.name}. -{shortId(me.id)}</span>
          {["Admin", "Ben", "Paul", "Jof"].map(name => (
            <button
              key={name}
              onClick={() => setDevUser(name)}
              className="px-2 py-1 rounded bg-white border hover:bg-gray-50"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Site Header */}
      <header className="sticky top-0 z-50 text-white shadow">
        <div className="bg-emerald-600">
          <div className="max-w-6xl mx-auto px-4 h-24 sm:h-28 flex items-center gap-6">
                 <Link to="/" className="flex items-center no-underline">
                   <img src="/assets/badges/totl-logo1.svg" alt="TOTL" className="h-20 sm:h-26 w-auto" />
                 </Link>

            {/* Desktop nav */}
            <div className="ml-auto hidden sm:flex items-center gap-6">
              <Link to="/tables" className="text-white no-underline hover:opacity-90 text-xl font-bold">Mini Leagues</Link>
              <Link to="/predictions" className="text-white no-underline hover:opacity-90 text-xl font-bold">Predictions</Link>
              <Link to="/global" className="text-white no-underline hover:opacity-90 text-xl font-bold">Leaderboard</Link>
              <Link to="/how-to-play" className="text-white no-underline hover:opacity-90 text-xl font-bold">How To Play</Link>
              <Link to="/admin" className="text-white no-underline hover:opacity-90 text-xl font-bold">Admin</Link>
            </div>

            {/* Hamburger menu */}
            <div className="ml-auto sm:ml-4 flex items-center gap-2">
              <button
                className="sm:hidden inline-flex items-center justify-center rounded-md p-2 focus:outline-none focus:ring-0"
                aria-label="Toggle menu"
                onClick={() => setMenuOpen(v => !v)}
              >
                {/* icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 font-bold">
                  <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="sm:hidden border-t border-white/20">
              <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-4 text-white">
                {/* Removed signed-in pill from here */}
                <Link
                  to="/tables"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  Mini Leagues
                </Link>
                <Link
                  to="/predictions"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  Predictions
                </Link>
                <Link
                  to="/global"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  Leaderboard
                </Link>
                <Link
                  to="/how-to-play"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  How To Play
                </Link>
                <Link
                  to="/admin"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Global Predictions Banner */}
      <PredictionsBanner />

      {/* Routes */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tables" element={<TablesPage />} />
        <Route path="/league/:code" element={<LeaguePage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/global" element={<GlobalPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/create-league" element={<CreateLeaguePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);