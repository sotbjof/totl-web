import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
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

export default function NewPredictionsCentre() {
  const { user } = useAuth();
  
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
      } catch (error) {
        console.error('Error loading GW data:', error);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Show loading state
  if (loading || !currentGw || fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading fixtures...</div>
      </div>
    );
  }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Main Content - List View for making predictions */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Page Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Predictions Centre</h1>
            <div className="mt-0 mb-4 text-sm text-slate-600">
              Call every game, lock in your results,<br />and climb the table.
            </div>
          </div>

          {/* Current Gameweek banner - show active gameweek */}
          {currentGw && (
            <div className="mt-2 mb-3">
              <div className="rounded-xl border bg-gradient-to-r from-[#1C8376]/10 to-blue-50 border-[#1C8376]/20 px-6 py-4">
                <div className="text-center">
                  <div className="font-semibold text-[#1C8376] text-lg">Gameweek {currentGw}</div>
                  <div className="text-sm text-slate-600">Make your predictions below</div>
            </div>
          </div>
        </div>
          )}

          <div className="space-y-4">
            {fixtures.map((fixture) => {
              const userPick = picks.get(fixture.fixture_index);
              
              // Format kickoff time - using same logic as original Predictions page
              const kickoff = fixture.kickoff_time
                ? (() => {
                    const d = new Date(fixture.kickoff_time);
                    const hh = String(d.getUTCHours()).padStart(2, '0');
                    const mm = String(d.getUTCMinutes()).padStart(2, '0');
                    return `${hh}:${mm}`;
                  })()
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
                          
                  {/* Prediction buttons - show for making predictions */}
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
                        userPick?.pick === "H"
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
                        userPick?.pick === "D"
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
                        userPick?.pick === "A"
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
        </div>

      {/* Bottom actions - save and confirm predictions */}
        <div className="p-6 bg-white shadow-lg">
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Deadline reminder */}
            {fixtures.length > 0 && fixtures[0].kickoff_time && (
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-1">Deadline</div>
                <div className="text-sm font-bold text-slate-700">
                {(() => {
                  const firstKickoff = new Date(fixtures[0].kickoff_time);
                  const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
                  return deadlineTime.toLocaleString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                })()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  (75 minutes before first kickoff)
                </div>
              </div>
            )}
            
            {/* Save Predictions Button */}
            <button
              onClick={() => setShowSaveModal(true)}
              className="w-full py-4 bg-slate-600 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors"
            >
              Save Predictions
            </button>
            
            {/* Confirm Predictions Button */}
            <button
              onClick={() => {
                const allPicksMade = fixtures.every(f => picks.has(f.fixture_index));
                if (allPicksMade) {
                  setShowConfirmModal(true);
                } else {
                  alert("Please make all predictions before confirming");
                }
              }}
              className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors"
            >
              Confirm Predictions
            </button>
        </div>
          </div>
          
      {/* Save Predictions Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 mb-2">Save Predictions?</div>
              <div className="text-slate-600 mb-6">
                Your predictions will be saved but you can still change them before confirming.
                {fixtures.length > 0 && fixtures[0].kickoff_time && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm font-medium text-amber-800 mb-1">Deadline Reminder</div>
                    <div className="text-xs text-amber-700">
                      {(() => {
                        const firstKickoff = new Date(fixtures[0].kickoff_time);
                        const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
                        return deadlineTime.toLocaleString('en-GB', {
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short',
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                      })()}
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      (75 minutes before first kickoff)
                    </div>
                  </div>
                )}
                </div>
              <div className="flex gap-3">
            <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-3 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors"
            >
                  Cancel
            </button>
                <button
                  onClick={() => {
                    console.log('Saving picks:', Array.from(picks.entries()));
                    // TODO: Save picks to database
                    setShowSaveModal(false);
                    setShowSuccessModal(true);
                  }}
                  className="flex-1 py-3 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
                  </div>
                </div>
              )}
              
      {/* Confirm Predictions Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 mb-2">Are You Sure?</div>
              <div className="text-slate-600 mb-6">
                Once confirmed, you cannot change your predictions. Make sure you're happy with all your picks!
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    console.log('Confirming picks:', Array.from(picks.entries()));
                    // TODO: Submit picks to database
                    setShowConfirmModal(false);
                    setShowSuccessModal(true);
                  }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                >
                  Confirm
                </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">Predictions Saved!</div>
              <div className="text-slate-600 mb-6">
                Your predictions have been saved successfully. Good luck!
          </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}