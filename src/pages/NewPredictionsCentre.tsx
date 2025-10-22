import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import ClubBadge from "../components/ClubBadge";
import { useNavigate } from "react-router-dom";
import { getMediumName } from "../lib/teamNames";

function sideName(f: any, side: "home" | "away") {
  const nm = f?.[`${side}_name`];
  const team = f?.[`${side}_team`];
  const code = f?.[`${side}_code`];
  const key = code || nm || team || "";
  const resolved = getMediumName(key);
  return resolved || (side === "home" ? "Home" : "Away");
}

type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff_time?: string | null;
};

type Pick = {
  fixture_index: number;
  pick: "H" | "D" | "A";
  gw: number;
};

type PickRow = {
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

type ResultRow = {
  gw: number;
  fixture_index: number;
  result: "H" | "D" | "A" | null;
};

// ResultButton component matching current predictions page
function ResultButton({
  label,
  correct, // true = picked & correct, false = picked & wrong, null = not picked
  isCorrectResult,
}: {
  label: string;
  correct: boolean | null;
  isCorrectResult: boolean;
}) {
  const base =
    "h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center select-none";
  
  // Ultra shiny soccer sticker gradient ONLY for correct picks that the user got right
  const correctPickStyle = correct === true
    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white !border-0 !border-none shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]"
    : isCorrectResult
    ? "bg-[#1C8376] text-white border-[#1C8376]"
    : correct === false
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-slate-50 text-slate-600 border-slate-200";
  
  return <div className={[base, correctPickStyle].join(" ")}>
    <span className={correct === true ? "font-bold" : ""}>{label}</span>
  </div>;
}

type CardState = {
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  scale: number;
};

// Team color mappings
const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  'ARS': { primary: '#EF0107', secondary: '#023474' },
  'AVL': { primary: '#95BFE5', secondary: '#670E36' },
  'BOU': { primary: '#DA291C', secondary: '#000000' },
  'BRE': { primary: '#E30613', secondary: '#FBB800' },
  'BHA': { primary: '#0057B8', secondary: '#FFCD00' },
  'CHE': { primary: '#034694', secondary: '#034694' },
  'CRY': { primary: '#1B458F', secondary: '#C4122E' },
  'EVE': { primary: '#003399', secondary: '#003399' },
  'FUL': { primary: '#FFFFFF', secondary: '#000000' },
  'LIV': { primary: '#C8102E', secondary: '#00B2A9' },
  'MCI': { primary: '#6CABDD', secondary: '#1C2C5B' },
  'MUN': { primary: '#DA291C', secondary: '#FBE122' },
  'NEW': { primary: '#241F20', secondary: '#FFFFFF' },
  'NFO': { primary: '#DD0000', secondary: '#FFFFFF' },
  'TOT': { primary: '#132257', secondary: '#FFFFFF' },
  'WHU': { primary: '#7A263A', secondary: '#1BB1E7' },
  'WOL': { primary: '#FDB913', secondary: '#231F20' },
  'SUN': { primary: '#EB172B', secondary: '#211E1F' },
  'LEE': { primary: '#FFCD00', secondary: '#1D428A' },
};

export default function NewPredictionsCentre() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const isListView = (mode: "cards" | "list"): mode is "list" => mode === "list";
  
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map());
  const [results, setResults] = useState<Map<number, "H" | "D" | "A">>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards" as const);
  const [cardState, setCardState] = useState<CardState>({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFeedback, setShowFeedback] = useState<"home" | "draw" | "away" | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isResettingRef = useRef(false);

  // Load current gameweek data from database
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Fetch current gameweek from meta table
        const { data: meta } = await supabase
          .from("meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        const currentGw = (meta as any)?.current_gw ?? 1;
        setCurrentGw(currentGw);
        
        // Fetch fixtures for current gameweek
        const { data: fx, error: fxErr } = await supabase
          .from("fixtures")
          .select(
            "id,gw,fixture_index,home_name,away_name,home_team,away_team,home_code,away_code,kickoff_time"
          )
          .eq("gw", currentGw)
          .order("fixture_index", { ascending: true });

        if (fxErr) {
          console.error('Error fetching fixtures:', fxErr);
          return;
        }

        const realFixtures: Fixture[] = (fx as Fixture[]) ?? [];
        if (alive) {
          setFixtures(realFixtures);
          console.log('Loaded', realFixtures.length, 'real GW', currentGw, 'fixtures');
        }

        // Fetch user's picks for current gameweek
        if (user?.id) {
          const { data: pk, error: pkErr } = await supabase
            .from("picks")
            .select("gw,fixture_index,pick")
            .eq("gw", currentGw)
            .eq("user_id", user.id);

          if (pkErr) {
            console.error('Error fetching picks:', pkErr);
            return;
          }

          const picksMap = new Map<number, Pick>();
          (pk as PickRow[] | null)?.forEach((p) => {
            picksMap.set(p.fixture_index, {
              fixture_index: p.fixture_index,
              pick: p.pick,
              gw: p.gw
            });
          });
          
          if (alive) {
            setPicks(picksMap);
            console.log('Loaded', picksMap.size, 'user picks for GW', currentGw);
          }
        }

        // Fetch results for current gameweek for highlighting
        const { data: rs, error: rsErr } = await supabase
          .from("gw_results")
          .select("gw,fixture_index,result")
          .eq("gw", currentGw);

        if (rsErr) {
          console.error('Error fetching results:', rsErr);
          return;
        }

        const resultsMap = new Map<number, "H" | "D" | "A">();
        (rs as ResultRow[] | null)?.forEach((r) => {
          if (r.result === "H" || r.result === "D" || r.result === "A") {
            resultsMap.set(r.fixture_index, r.result);
          }
        });

        if (alive) {
          setResults(resultsMap);
          console.log('Loaded', resultsMap.size, 'GW 8 results');
        }
      } catch (error) {
        console.error('Error loading GW 8 data:', error);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Determine view mode based on predictions status
  useEffect(() => {
    // If we have fixtures and user picks, check if all predictions are made
    if (fixtures.length > 0 && user?.id) {
      const allPredictionsMade = fixtures.every(fixture => picks.has(fixture.fixture_index));
      
      if (allPredictionsMade) {
        // All predictions are made - show list view for review
        setViewMode("list");
      } else {
        // Some predictions missing - show cards for making predictions
        setViewMode("cards");
      }
    } else {
      // Default to cards view
      setViewMode("cards");
    }
  }, [fixtures, picks, user?.id]);

  const currentFixture = fixtures[currentIndex];

  // Calculate user's score for GW 8
  const myScore = useMemo(() => {
    let score = 0;
    fixtures.forEach(fixture => {
      const fixtureResult = results.get(fixture.fixture_index);
      const userPick = picks.get(fixture.fixture_index);
      
      if (fixtureResult && userPick && userPick.pick === fixtureResult) {
        score += 1;
      }
    });
    return score;
  }, [fixtures, results, picks]);

  // Touch/Mouse handlers
  const handleStart = (clientX: number, clientY: number) => {
    if (isAnimating) return;
    setIsDragging(true);
    startPosRef.current = { x: clientX, y: clientY };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return;
    
    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;
    
    const rotation = deltaX * 0.1;
    
    setCardState({ x: deltaX, y: deltaY, rotation, opacity: 1, scale: 1 });
    
    // Show feedback with better mobile thresholds
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setShowFeedback(deltaX > 0 ? "away" : "home");
    } else if (deltaY > 60 && deltaY > Math.abs(deltaX)) {
      // Only trigger draw on significant downward movement to avoid page refresh conflicts
      setShowFeedback("draw");
    } else {
      setShowFeedback(null);
    }
  };

  const handleEnd = () => {
    if (!isDragging || isAnimating) return;
    setIsDragging(false);
    
    const { x, y } = cardState;
    const horizontalThreshold = 70; // Reduced for easier mobile swiping
    const verticalThreshold = 80; // Higher threshold for draw to avoid page refresh conflicts
    
    let pick: "H" | "D" | "A" | null = null;
    
    // Determine if swipe was strong enough
    if (Math.abs(x) > horizontalThreshold && Math.abs(x) > Math.abs(y)) {
      pick = x > 0 ? "A" : "H";
    } else if (y > verticalThreshold && y > Math.abs(x)) {
      pick = "D";
    }
    
    if (pick) {
      animateCardOut(pick);
    } else {
      // Snap back
      setCardState({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
      setShowFeedback(null);
    }
  };

  const animateCardOut = async (pick: "H" | "D" | "A") => {
    setIsAnimating(true);
    setShowFeedback(null);
    
    // Animate card flying out
    const direction = pick === "H" ? -1 : pick === "A" ? 1 : 0;
    const targetX = direction * window.innerWidth;
    const targetY = pick === "D" ? window.innerHeight : 0;
    
    setCardState({
      x: targetX,
      y: targetY,
      rotation: direction * 30,
      opacity: 0,
      scale: 0.8
    });
    
    // Save the pick
    await savePick(pick);
    
    // Wait for animation
    setTimeout(() => {
      // Set resetting flag
      isResettingRef.current = true;
      
      // If we should return to review, go back to review screen
      if (returnToReview) {
        setCurrentIndex(fixtures.length);
        setReturnToReview(false);
      } else {
        // Otherwise, move to next card (or to review screen if this was the last card)
        setCurrentIndex(currentIndex + 1);
      }
      
      // Reset card state instantly
      setCardState({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
      
      // Clear resetting flag and finish
      requestAnimationFrame(() => {
        isResettingRef.current = false;
        setIsAnimating(false);
      });
    }, 300);
  };

  const handleButtonClick = (pick: "H" | "D" | "A") => {
    if (isAnimating) return;
    animateCardOut(pick);
  };

  const savePick = async (pick: "H" | "D" | "A") => {
    if (!currentFixture) return;
    
    // NO DATABASE - just update local state for testing
    console.log('Pick made:', pick, 'for fixture:', currentFixture.home_team, 'vs', currentFixture.away_team);
    setPicks(new Map(picks.set(currentFixture.fixture_index, {
      fixture_index: currentFixture.fixture_index,
      pick: pick,
      gw: currentGw!
    })));
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && !isAnimating) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < fixtures.length - 1 && !isAnimating) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Allow viewing without auth for testing
  // if (!user) return null;
  if (!currentGw || fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading fixtures...</div>
      </div>
    );
  }

  if (currentIndex >= fixtures.length) {
    // Review screen - show all picks
    const allPicksMade = fixtures.every(f => picks.has(f.fixture_index));
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        {/* Save Success Message */}
        {showSaveMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-green-600 text-white px-8 py-6 rounded-xl shadow-2xl max-w-md mx-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="font-bold text-lg">Predictions Saved!</div>
                  <div className="text-sm text-green-100 mt-1">You can come back and edit them before the deadline</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="p-4 bg-white shadow-sm">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-slate-800">Review Your Predictions</h1>
              <button onClick={() => setCurrentIndex(0)} className="text-slate-600 hover:text-slate-800">
                ← Back
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Gameweek {currentGw} • {picks.size} of {fixtures.length} predictions made
            </p>
            <p className="text-xs text-slate-500 italic">
              Click on any fixture to change your prediction
            </p>
          </div>
        </div>

        {/* Picks List */}
        <div className="flex-1 overflow-y-auto p-4 pb-4">
          <div className="max-w-2xl mx-auto space-y-6">
            {(() => {
              // Group fixtures by date
              const grouped: Array<{ label: string; items: typeof fixtures }> = [];
              let currentDate = '';
              let currentGroup: typeof fixtures = [];
              
              fixtures.forEach((fixture) => {
                const fixtureDate = fixture.kickoff_time 
                  ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB', { 
                      weekday: 'short', 
                      day: 'numeric', 
                      month: 'short' 
                    })
                  : 'No date';
                
                if (fixtureDate !== currentDate) {
                  if (currentGroup.length > 0) {
                    grouped.push({ label: currentDate, items: currentGroup });
                  }
                  currentDate = fixtureDate;
                  currentGroup = [fixture];
                } else {
                  currentGroup.push(fixture);
                }
              });
              
              if (currentGroup.length > 0) {
                grouped.push({ label: currentDate, items: currentGroup });
              }
              
              return grouped.map((group, groupIdx) => (
                <div key={groupIdx}>
                  {/* Date Header */}
                  <div className="text-lg font-semibold text-slate-800 mb-4">
                    {group.label}
                  </div>
                  
                  {/* Fixtures for this date */}
                  <div className="space-y-4">
                    {group.items.map((fixture) => {
                      const pick = picks.get(fixture.fixture_index);
                      
                      return (
                        <div key={fixture.id} className="bg-white rounded-xl shadow-sm p-6">
                          {/* Teams and Time */}
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex-1 min-w-0 text-right">
                              <span className="text-xs font-semibold text-slate-800 truncate inline-block">
                                {sideName(fixture, "home")}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <ClubBadge code={fixture.home_code || ""} size={28} />
                              <div className="text-slate-400 font-medium text-sm">
                                {fixture.kickoff_time 
                                  ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })
                                  : ''}
                              </div>
                              <ClubBadge code={fixture.away_code || ""} size={28} />
                            </div>
                            
                            <div className="flex-1 min-w-0 text-left">
                              <span className="text-xs font-semibold text-slate-800 truncate inline-block">
                                {sideName(fixture, "away")}
                              </span>
                            </div>
                          </div>
                          
                          {/* Pick Buttons */}
                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={() => {
                                const newPicks = new Map(picks);
                                newPicks.set(fixture.fixture_index, {
                                  fixture_index: fixture.fixture_index,
                                  pick: "H",
                                  gw: currentGw!
                                });
                                setPicks(newPicks);
                              }}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick === "H"
                                  ? "bg-[#1C8376] text-white border-[#1C8376]"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Home Win
                            </button>
                            
                            <button
                              onClick={() => {
                                const newPicks = new Map(picks);
                                newPicks.set(fixture.fixture_index, {
                                  fixture_index: fixture.fixture_index,
                                  pick: "D",
                                  gw: currentGw!
                                });
                                setPicks(newPicks);
                              }}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick === "D"
                                  ? "bg-[#1C8376] text-white border-[#1C8376]"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Draw
                            </button>
                            
                            <button
                              onClick={() => {
                                const newPicks = new Map(picks);
                                newPicks.set(fixture.fixture_index, {
                                  fixture_index: fixture.fixture_index,
                                  pick: "A",
                                  gw: currentGw!
                                });
                                setPicks(newPicks);
                              }}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick === "A"
                                  ? "bg-[#1C8376] text-white border-[#1C8376]"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Away Win
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="p-6 bg-white shadow-lg">
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Deadline reminder */}
            {fixtures.length > 0 && fixtures[0].kickoff_time && (
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Deadline</div>
                <div className="text-sm font-bold text-slate-700">
                  {new Date(new Date(fixtures[0].kickoff_time).getTime() - (75 * 60 * 1000)).toLocaleString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  (75 minutes before first kickoff)
                </div>
              </div>
            )}
            
            {!allPicksMade && (
              <div className="text-center text-sm text-amber-600 mb-2">
                ⚠️ You haven't made all your predictions yet
              </div>
            )}
            
            {/* Save Predictions Button */}
            <button
              onClick={() => {
                // TODO: Save picks to database without submitting
                console.log('Saving picks:', Array.from(picks.entries()));
                setShowSaveMessage(true);
                setTimeout(() => setShowSaveMessage(false), 3000);
              }}
              className="w-full py-4 bg-slate-600 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors"
            >
              Save Predictions
            </button>
            
            {/* Confirm Predictions Button */}
            <button
              onClick={() => {
                if (allPicksMade) {
                  // TODO: Submit picks to database
                  console.log('Confirming picks:', Array.from(picks.entries()));
                  navigate("/new-predictions");
                } else {
                  alert("Please make all predictions before confirming");
                }
              }}
              disabled={!allPicksMade}
              className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {allPicksMade ? "Confirm Predictions" : "Complete All Predictions First"}
            </button>
            
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header - only show for cards view */}
      {viewMode === "cards" && (
        <div className="p-4 bg-white shadow-sm">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigate("/")} className="text-slate-600 hover:text-slate-800">
                ✕
              </button>
              <h2 className="text-xl font-bold text-slate-700 absolute left-1/2 transform -translate-x-1/2">Gameweek {currentGw}</h2>
              <div className="w-6"></div>
            </div>
            
            {/* Fixture counter and view toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600">
                {isListView(viewMode)
                  ? `${fixtures.length} fixtures` 
                  : `Fixture ${currentIndex + 1} of ${fixtures.length}`
                }
              </div>
              {viewMode === "cards" && (
                <button
                  onClick={() => setCurrentIndex(fixtures.length)}
                  className="text-sm text-[#1C8376] hover:text-[#1C8376]/80 font-medium"
                >
                  Skip to List View →
                </button>
              )}
            </div>
          
          {/* Progress bar - only show for cards view */}
          {viewMode === "cards" && (
          <div className="flex items-center gap-1">
            {fixtures.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all ${
                  idx < currentIndex
                    ? "bg-green-500"
                    : idx === currentIndex
                    ? "bg-blue-500"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          )}
          </div>
        </div>
      )}

      {/* Main Content - conditional rendering */}
      {viewMode === "list" ? (
        // List View - show completed predictions with results (matching current predictions page format)
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4">
            {/* Header matching current predictions page */}
            <div className="relative flex items-center justify-center">
              {/* X back button */}
              <button
                onClick={() => navigate('/')}
                className="absolute left-0 top-0 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Predictions Centre</h1>
                <div className="mt-0 mb-4 text-sm text-slate-600">
                  Call every game, lock in your results,<br />and climb the table.
                </div>
              </div>
            </div>

            {/* GWx Coming Soon banner - using existing component */}
            <div className="mt-2 mb-3">
              <div className="rounded-xl border bg-slate-100 border-slate-200 px-6 py-4">
                <div className="text-center">
                  <div className="font-semibold text-slate-800">GW{currentGw ? currentGw + 1 : 9} Coming Soon</div>
                  <div className="text-sm text-slate-600">Fixtures will be published soon.</div>
                </div>
              </div>
            </div>

            {/* Score summary card - matching current predictions page */}
            <div className="mt-2 mb-4">
              <div className="rounded-xl border bg-gradient-to-r from-[#1C8376]/10 to-blue-50 border-[#1C8376]/20 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[#1C8376]/90 font-semibold text-lg">GW {currentGw} Complete</div>
                    <div className="text-[#1C8376]/90 text-sm font-bold mt-1">Your Score</div>
                  </div>
                  <div className="text-[#1C8376]/90 text-5xl font-extrabold">
                    {myScore}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              {fixtures.map((fixture) => {
                const fixtureResult = results.get(fixture.fixture_index);
                const userPick = picks.get(fixture.fixture_index);
                
                // Format kickoff time like current predictions page
                const kickoff = fixture.kickoff_time
                  ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })
                  : "—";
                
                const home = sideName(fixture, "home");
                const away = sideName(fixture, "away");
                
                return (
                  <div
                    key={fixture.id}
                    className="rounded-2xl border bg-white p-3 shadow-sm"
                  >
                    {/* header: Home kickoff Away */}
                    <div className="flex items-center px-2 pt-1 pb-3">
                      <div className="flex items-center gap-1 flex-1 justify-end">
                        <div className="truncate font-medium">{home}</div>
                        <img 
                          src={`/assets/badges/${fixture.home_code?.toUpperCase() || 'UNK'}.png`} 
                          alt={home}
                          className="w-5 h-5"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="text-slate-500 text-sm px-4">
                        {kickoff}
                      </div>
                      <div className="flex items-center gap-1 flex-1 justify-start">
                        <img 
                          src={`/assets/badges/${fixture.away_code?.toUpperCase() || 'UNK'}.png`} 
                          alt={away}
                          className="w-5 h-5"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="truncate font-medium">{away}</div>
                      </div>
                    </div>

                    {/* Results section - using ResultButton component */}
                    {fixtureResult && userPick && (
                      <div className="grid grid-cols-3 gap-3">
                        {(() => {
                          const correctState = (side: "H" | "D" | "A"): boolean | null => {
                            if (userPick.pick !== side) return null; // not the user's button
                            return fixtureResult === side; // true if correct, false if wrong
                          };

                          return (
                            <>
                              <ResultButton
                                label="Home Win"
                                correct={correctState("H")}
                                isCorrectResult={fixtureResult === "H"}
                              />
                              <ResultButton
                                label="Draw"
                                correct={correctState("D")}
                                isCorrectResult={fixtureResult === "D"}
                              />
                              <ResultButton
                                label="Away Win"
                                correct={correctState("A")}
                                isCorrectResult={fixtureResult === "A"}
                              />
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Cards View - show swipeable cards for making predictions
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Feedback indicators with text */}
        <div
          className={`absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${
            showFeedback === "home" ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-6xl font-bold text-slate-700">←</div>
          <div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            Home Win
          </div>
        </div>
        <div
          className={`absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${
            showFeedback === "away" ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-6xl font-bold text-slate-700">→</div>
          <div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            Away Win
          </div>
        </div>
        <div
          className={`absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${
            showFeedback === "draw" ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="text-6xl font-bold text-slate-700">↓</div>
          <div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg">
            Draw
          </div>
        </div>

        {/* Card wrapper to maintain consistent width */}
        <div className="max-w-md w-full relative" style={{ aspectRatio: '0.75' }}>
          {/* Card stack - show next card behind */}
          {currentIndex < fixtures.length - 1 && (() => {
            const nextFixture = fixtures[currentIndex + 1];
            
            return (
              <div
                key={currentIndex + 1}
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `scale(1)`,
                  opacity: (isDragging || isAnimating) ? 0.5 : 0,
                  zIndex: 1,
                  transition: 'opacity 0.15s ease-out',
                }}
              >
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8">
                  {/* Fixture date at top */}
                  {nextFixture.kickoff_time && (
                    <div className="text-center mb-6">
                      <div className="text-sm text-slate-500 font-medium">
                        {new Date(nextFixture.kickoff_time).toLocaleDateString('en-GB', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short' 
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="flex flex-col items-center">
                      <ClubBadge code={nextFixture.home_code || ""} size={120} />
                      <div className="text-sm font-semibold text-slate-700 mt-4 text-center max-w-[120px]">
                        {nextFixture.home_name || nextFixture.home_team}
                      </div>
                    </div>
                    
                    {/* Fixture time in center */}
                    <div className="flex flex-col items-center mb-8">
                      {nextFixture.kickoff_time && (
                        <div className="text-sm text-slate-700">
                          {new Date(nextFixture.kickoff_time).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <ClubBadge code={nextFixture.away_code || ""} size={120} />
                      <div className="text-sm font-semibold text-slate-700 mt-4 text-center max-w-[120px]">
                        {nextFixture.away_name || nextFixture.away_team}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Team colors for back card */}
                <div className="h-48 relative overflow-hidden">
                  <div 
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: TEAM_COLORS[nextFixture.home_code || '']?.primary || '#94a3b8',
                      clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                    }}
                  />
                  <div 
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: TEAM_COLORS[nextFixture.away_code || '']?.primary || '#94a3b8',
                      clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
            );
          })()}

          {/* Current card */}
          <div
            ref={cardRef}
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            style={{
            transform: `translate(${cardState.x}px, ${cardState.y}px) rotate(${cardState.rotation}deg) scale(${cardState.scale})`,
            opacity: cardState.opacity,
            transition: (isDragging || isResettingRef.current) ? "none" : "all 0.3s ease-out",
          }}
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => {
            e.preventDefault(); // Prevent page refresh conflicts
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            e.preventDefault(); // Prevent page refresh conflicts
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchEnd={(e) => {
            e.preventDefault(); // Prevent page refresh conflicts
            handleEnd();
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden relative">
            {/* Swipe indicator for first card */}
            {currentIndex === 0 && (
              <div className="absolute top-3 right-3 z-10">
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/4603/4603384.png" 
                  alt="Swipe to navigate" 
                  className="w-8 h-8 opacity-60"
                />
              </div>
            )}
            
            {/* Card content */}
            <div className="p-8">
              {/* Fixture date at top */}
              {currentFixture.kickoff_time && (
                <div className="text-center mb-6">
                  <div className="text-sm text-slate-500 font-medium">
                    {new Date(currentFixture.kickoff_time).toLocaleDateString('en-GB', { 
                      weekday: 'short', 
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-center gap-4 mb-6">
                {/* Home team */}
                <div className="flex flex-col items-center">
                  <ClubBadge code={currentFixture.home_code || ""} size={120} />
                  <div className="text-sm font-semibold text-slate-700 mt-4 text-center max-w-[120px]">
                    {currentFixture.home_name || currentFixture.home_team}
                  </div>
                </div>

                {/* Fixture time in center */}
                <div className="flex flex-col items-center mb-8">
                  {currentFixture.kickoff_time && (
                    <div className="text-sm text-slate-700">
                      {new Date(currentFixture.kickoff_time).toLocaleTimeString('en-GB', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                </div>

                {/* Away team */}
                <div className="flex flex-col items-center">
                  <ClubBadge code={currentFixture.away_code || ""} size={120} />
                  <div className="text-sm font-semibold text-slate-700 mt-4 text-center max-w-[120px]">
                    {currentFixture.away_name || currentFixture.away_team}
                  </div>
                </div>
              </div>

              {/* Results and pick indicator */}
              {(() => {
                const fixtureResult = results.get(currentFixture.fixture_index);
                const userPick = picks.get(currentFixture.fixture_index);
                
                if (fixtureResult && userPick) {
                  const isCorrect = userPick.pick === fixtureResult;
                  return (
                    <div className="text-center mb-4 space-y-2">
                      {/* Correct result */}
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold">
                        <span>🎯</span>
                        <span>
                          Result: {fixtureResult === "H" ? "Home Win" : fixtureResult === "A" ? "Away Win" : "Draw"}
                        </span>
                      </div>
                      
                      {/* User's pick with correct/incorrect indicator */}
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                        isCorrect 
                          ? "bg-green-50 text-green-700" 
                          : "bg-red-50 text-red-700"
                      }`}>
                        <span>{isCorrect ? "✓" : "✗"}</span>
                        <span>
                          Your pick: {userPick.pick === "H" ? "Home Win" : userPick.pick === "A" ? "Away Win" : "Draw"}
                          {isCorrect ? " (Correct!)" : " (Incorrect)"}
                        </span>
                      </div>
                    </div>
                  );
                } else if (userPick) {
                  return (
                <div className="text-center mb-4">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-semibold">
                        <span>⏳</span>
                    <span>
                          Your pick: {userPick.pick === "H" ? "Home Win" : userPick.pick === "A" ? "Away Win" : "Draw"}
                          {" (Result pending)"}
                    </span>
                  </div>
                </div>
                  );
                }
                return null;
              })()}

            </div>

            {/* Colored bottom section - diagonal split with team colors */}
            <div className="h-48 relative overflow-hidden">
              {/* Home team color (bottom left) */}
              <div 
                className="absolute inset-0"
                style={{
                  background: TEAM_COLORS[currentFixture.home_code || '']?.primary || '#94a3b8',
                  clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                }}
              />
              {/* Away team color (top right) */}
              <div 
                className="absolute inset-0"
                style={{
                  background: TEAM_COLORS[currentFixture.away_code || '']?.primary || '#94a3b8',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                }}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
      )}

      {/* Bottom controls - only show for cards view */}
      {viewMode === "cards" && (
      <div className="p-6 bg-white shadow-lg">
        <div className="max-w-md mx-auto">
          <div className="flex items-stretch justify-center gap-4 mb-4">
            <button
              onClick={() => handleButtonClick("H")}
              disabled={isAnimating}
              className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center"
              style={{
                backgroundColor: cardState.x < -30 
                  ? `rgba(34, 197, 94, ${Math.min(0.8, Math.abs(cardState.x) / 150)})` 
                  : '#f1f5f9',
                color: cardState.x < -30 ? '#fff' : '#334155',
              }}
            >
              Home Win
            </button>
            <button
              onClick={() => handleButtonClick("D")}
              disabled={isAnimating}
              className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center"
              style={{
                backgroundColor: cardState.y > 30 
                  ? `rgba(59, 130, 246, ${Math.min(0.8, cardState.y / 150)})` 
                  : '#f1f5f9',
                color: cardState.y > 30 ? '#fff' : '#334155',
              }}
            >
              Draw
            </button>
            <button
              onClick={() => handleButtonClick("A")}
              disabled={isAnimating}
              className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center"
              style={{
                backgroundColor: cardState.x > 30 
                  ? `rgba(34, 197, 94, ${Math.min(0.8, cardState.x / 150)})` 
                  : '#f1f5f9',
                color: cardState.x > 30 ? '#fff' : '#334155',
              }}
            >
              Away Win
            </button>
          </div>
          
          {/* Navigation buttons */}
          <div className="flex gap-4 mb-20">
            {currentIndex > 0 && (
              <button
                onClick={handlePrevious}
                disabled={isAnimating}
                className="flex-1 py-3 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50"
              >
                ← Previous
              </button>
            )}
            {currentIndex < fixtures.length - 1 && (
              <button
                onClick={handleNext}
                disabled={isAnimating}
                className="flex-1 py-3 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

