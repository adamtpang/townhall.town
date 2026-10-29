import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const NYCV = "https://www.nycvotes.org/whats-on-the-ballot";

/** Game plan for New York City (ZIP 10001). Only facts stated on NYC Votes; ID rules link out instead of being restated. */
export function GamePlanNY() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader><span className="eyebrow">When</span><CardTitle>Early voting through Sun, Nov 1</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Early voting runs Sat, Oct 24 to Sun, Nov 1. Election Day is <strong>Tuesday, Nov 3, 2026</strong>.</p>
          <p>Last day to request a mail ballot in person: Mon, Nov 2.</p>
          <p className="text-xs text-slate-500">Source: <a href={NYCV}>NYC Votes (NYC Campaign Finance Board)</a></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><span className="eyebrow">Where</span><CardTitle>Find your poll site</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Early voting and Election Day sites can differ. Use the official lookup:</p>
          <p><a href="https://findmypollsite.vote.nyc/">NYC Board of Elections: find my poll site</a></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><span className="eyebrow">What to bring</span><CardTitle>Check ID rules first</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>ID rules depend on how and when you registered. Check the official page before you go:</p>
          <p><a href="https://elections.ny.gov/">New York State Board of Elections</a></p>
        </CardContent>
      </Card>
    </div>
  );
}
