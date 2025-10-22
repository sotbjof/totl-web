import React from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/**
 * Shows different banners based on game state:
 *  - "Make predictions" when fixtures exist but no results published
 *  - "Watch this space" when results published but next GW fixtures not ready
 */
export default function PredictionsBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = React.useState(false);
  const [currentGw, setCurrentGw] = React.useState<number | null>(null);
  const [bannerType, setBannerType] = React.useState<"predictions" | "watch-space" | null>(null);
  const [deadlineText, setDeadlineText] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const refreshBanner = async () => {
      try {
        // current GW
        const { data: meta } = await supabase
          .from("meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        const gw: number | null = (meta as any)?.current_gw ?? null;
        if (!alive) return;

        setCurrentGw(gw);
        if (!gw) return setVisible(false);

        // fixtures exist for current GW?
        const { count: fxCount } = await supabase
          .from("fixtures")
          .select("id", { count: "exact", head: true })
          .eq("gw", gw);
        if (!alive) return;

        // results already published for current GW?
        const { count: rsCount } = await supabase
          .from("gw_results")
          .select("gw", { count: "exact", head: true })
          .eq("gw", gw);
        if (!alive) return;
        const resultsPublished = (rsCount ?? 0) > 0;

        if (!fxCount) {
          // No fixtures for current GW - show "watch this space" for next GW
          setBannerType("watch-space");
          setVisible(true);
          setDeadlineText(null);
          return;
        }

        // Calculate deadline (1h 15mins before first kickoff)
        const { data: fixtures } = await supabase
          .from("fixtures")
          .select("kickoff_time")
          .eq("gw", gw)
          .order("kickoff_time", { ascending: true })
          .limit(1);
        
        if (fixtures && fixtures.length > 0 && fixtures[0].kickoff_time) {
          const firstKickoff = new Date(fixtures[0].kickoff_time);
          const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 1h 15mins = 75 minutes
          
          // Format deadline as readable date and time (GMT)
          const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
          const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
          const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
          const hour = String(deadlineTime.getUTCHours()).padStart(2, '0');
          const minute = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
          const deadlineFormatted = `${weekday}, ${month} ${day}, ${hour}:${minute}`;
          setDeadlineText(deadlineFormatted);
        } else {
          setDeadlineText(null);
        }

        if (resultsPublished) {
          // Results published - show "watch this space" for next GW
          setBannerType("watch-space");
          setVisible(true);
          return;
        }

        // Fixtures exist, no results - check if user has submitted
        // Check if user has submitted
        if (!user?.id) {
          setVisible(false);
          return;
        }

        const { data: sub } = await supabase
          .from("gw_submissions")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("gw", gw)
          .maybeSingle();
        if (!alive) return;

        if (!sub) {
          // User hasn't submitted - show predictions banner
          setBannerType("predictions");
          setVisible(true);
        } else {
          setVisible(false);
        }
      } catch {
        setVisible(false);
      }
    };

    refreshBanner();
    
    // Listen for submission events
    const handleSubmission = () => {
      refreshBanner();
    };
    
    // Listen for results published events
    const handleResultsPublished = () => {
      refreshBanner();
    };
    
    // Listen for fixtures published events
    const handleFixturesPublished = () => {
      refreshBanner();
    };
    
    // Refresh when component becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshBanner();
      }
    };
    
    window.addEventListener('predictionsSubmitted', handleSubmission);
    window.addEventListener('resultsPublished', handleResultsPublished);
    window.addEventListener('fixturesPublished', handleFixturesPublished);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      alive = false;
      window.removeEventListener('predictionsSubmitted', handleSubmission);
      window.removeEventListener('resultsPublished', handleResultsPublished);
      window.removeEventListener('fixturesPublished', handleFixturesPublished);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  if (!visible) return null;

  // UI - Different banners based on state
  return (
    <div className="mx-auto max-w-6xl px-4">
      {bannerType === "predictions" ? (
        <Link
          to="/new-predictions"
          className="block mt-4 rounded-lg bg-blue-600 px-4 py-3 hover:bg-blue-700 transition-colors"
        >
          <div className="text-center">
            <div className="font-semibold text-white">GW{currentGw} is Live - Make your predictions</div>
            <div className="text-white/90">
              {deadlineText ? (
                <>
                  <span>Deadline: </span>
                  <span className="font-extrabold">{deadlineText}</span>
                </>
              ) : (
                "Don't miss the deadline!"
              )}
            </div>
          </div>
        </Link>
      ) : (
        <div className="mt-4 rounded-lg bg-slate-100 px-4 py-2 border border-slate-200">
          <div className="text-center">
            <div className="font-semibold text-slate-800">GW{(currentGw || 1) + 1} Coming Soon</div>
            <div className="text-sm text-slate-600">Fixtures will be published soon.</div>
          </div>
        </div>
      )}
    </div>
  );
}