import React, { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { onDevUserChange } from "../devAuth";

/**
 * SiteHeader – gradient header bar with brand, current user, and hamburger menu on mobile.
 * - Desktop: inline nav links
 * - Mobile: hamburger toggles a slide-down menu
 */
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => onDevUserChange(() => {}), []);

  const Item = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <NavLink
      to={to}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) =>
        `px-3 py-2 rounded hover:bg-white/10 transition ` +
        (isActive ? "text-white" : "text-white/80")
      }
    >
      {children}
    </NavLink>
  );

  return (
    <header className="relative">
      {/* Gradient bar */}
      <div className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-rose-500 text-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand */}
          <Link to="/" className="font-bold tracking-wide text-lg sm:text-xl select-none flex-shrink-0">TOTL</Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center">
            <Item to="/leagues">Mini Leagues</Item>
            <Item to="/predictions">Predictions</Item>
            <Item to="/global">Global</Item>
            <Item to="/admin">Admin</Item>
          </nav>

          {/* Hamburger menu */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              className="sm:hidden inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10"
              aria-label="Menu"
              onClick={() => setMenuOpen(o => !o)}
            >
              {/* Hamburger */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu (slide-down) */}
      {menuOpen && (
        <div className="sm:hidden bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-3 py-2 flex flex-col">
            <Item to="/leagues">Mini Leagues</Item>
            <Item to="/predictions">Predictions</Item>
            <Item to="/global">Global</Item>
            <Item to="/admin">Admin</Item>
          </div>
        </div>
      )}
    </header>
  );
}