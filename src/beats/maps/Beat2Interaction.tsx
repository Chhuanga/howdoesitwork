'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { nodeName } from '@/sim/graph';
import { CITIES, City } from '@/sim/cities';
import { initDijkstra, visitNode, stepDijkstra, frontier, DijkstraState } from '@/sim/dijkstra';
import { changes, describeChanges } from '@/sim/narrate';
import { useCityStore } from '@/lib/cityStore';
import { setScene, useSceneStore } from '@/lib/sceneStore';
import { playChime, playTick, playWrong } from '@/lib/feedback';
import { flyFrom, flyTo } from '@/lib/fly';
import CityToggle from '@/components/CityToggle';
import GraphLegend from '@/components/GraphLegend';
import { CardSlot, useReveal } from '@/components/BeatShell';

const STEP_MS = 480;
const SORT_AFTER = 3; // correct picks before the queue sorts itself and auto-play unlocks

type Feedback = { kind: 'ok' | 'wrong'; text: string } | null;

// Switching city starts the beat over on the new map
export default function Beat2Interaction() {
  const city = CITIES[useCityStore((s) => s.city)];
  return <Beat2Run key={city.id} city={city} />;
}

function Beat2Run({ city }: { city: City }) {
  const { graph, start, end } = city;
  // The start dot is finished before the learner starts, so there is a real choice on the first tap
  const first = useMemo(() => visitNode(initDijkstra(graph, start), graph, end, start), [graph, start, end]);

  // Every step so far, and which one is on screen. Dragging the slider back
  // moves the cursor; picking from there drops the steps after it.
  const [history, setHistory] = useState<DijkstraState[]>([first]);
  const [cursor, setCursor] = useState(0);
  const [auto, setAuto] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [wrong, setWrong] = useState<{ id: number; n: number } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const onReveal = useReveal();

  const state = history[cursor];
  const mode = state.done ? 'done' : auto ? 'auto' : 'pick';
  const picks = cursor;
  const lastChanges = useMemo(
    () => (cursor > 0 ? changes(history[cursor - 1], state) : new Map()) as ReturnType<typeof changes>,
    [history, cursor, state],
  );

  const waiting = frontier(state);
  const sorted = picks >= SORT_AFTER;
  const shown = sorted ? waiting : [...waiting].sort((a, b) => a.node - b.node);
  const chips = useRef(new Map<number, HTMLButtonElement>());

  const advance = useCallback(
    (next: DijkstraState) => {
      setHistory((h) => [...h.slice(0, cursor + 1), next]);
      setCursor(cursor + 1);
    },
    [cursor],
  );

  const pick = useCallback(
    (id: number) => {
      if (mode !== 'pick') return;
      const f = frontier(state);
      const entry = f.find((q) => q.node === id);
      const name = nodeName(id);

      if (!entry) {
        setWrong(null);
        setFeedback({
          kind: 'wrong',
          text: state.visited.has(id)
            ? `${name} is already locked in. Its time is final.`
            : `No road reaches ${name} yet. Pick one of the blue dots.`,
        });
        setScene({ shake: { id, at: performance.now() } });
        playWrong();
        return;
      }

      const best = f[0];
      if (entry.cost > best.cost) {
        setWrong((w) => ({ id, n: (w?.n ?? 0) + 1 }));
        setFeedback({
          kind: 'wrong',
          text: `${name} is ${entry.cost} min away, but ${nodeName(best.node)} is only ${best.cost}. A route through ${nodeName(best.node)} might still reach ${name} faster, so ${name}'s ${entry.cost} isn't final yet.`,
        });
        // Show the cheaper option's route on the map for a moment: the way round
        // that could still beat the pick
        setScene({ hoverOption: best.node });
        setTimeout(() => {
          if (useSceneStore.getState().hoverOption === best.node) setScene({ hoverOption: null });
        }, 2400);
        setScene({ shake: { id, at: performance.now() } });
        playWrong();
        return;
      }

      // The chip leaves the list and flies to its dot in the city
      const { projectNode, reducedMotion } = useSceneStore.getState();
      const chip = chips.current.get(id);
      const target = projectNode?.(id);
      if (chip && target && !reducedMotion) flyTo(chip, target);
      playTick();

      setScene({ hoverOption: null });
      const next = visitNode(state, graph, end, id);
      const lead = picks === 0
        ? `Yes! ${name} is the closest, so no detour can beat it. Its time is final.`
        : `${name} locked in at ${entry.cost} min.`;
      setWrong(null);
      setFeedback({ kind: 'ok', text: next.done ? lead : `${lead} ${describeChanges(id, changes(state, next))}` });
      advance(next);
    },
    [mode, state, picks, graph, end, advance],
  );

  // Auto-play the rest once the learner has shown they get the rule
  useEffect(() => {
    if (mode !== 'auto') return;
    const id = setTimeout(() => advance(stepDijkstra(state, graph, end)), STEP_MS);
    return () => clearTimeout(id);
  }, [mode, state, graph, end, advance]);

  // Newly reached dots fly out of the dot that reached them and into the list
  const drawn = useRef(0);
  useLayoutEffect(() => {
    const forward = cursor > drawn.current;
    drawn.current = cursor;
    const { projectNode, reducedMotion } = useSceneStore.getState();
    const from = state.current !== null ? projectNode?.(state.current) : null;
    if (!forward || !from || reducedMotion) return;
    let i = 0;
    for (const [id, change] of lastChanges) {
      const chip = chips.current.get(id);
      if (chip && change.kind === 'new') flyFrom(chip, from, 40 * i++);
    }
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const chimed = useRef(false);
  useEffect(() => {
    if (mode !== 'done') return;
    onReveal();
    if (!chimed.current) playChime();
    chimed.current = true;
  }, [mode, onReveal]);

  // Drive the shared scene: always X-rayed, showing the search as it stands.
  // While the learner is picking, each option's route is drawn on the map too.
  useEffect(() => {
    setScene({ xray: true, dijkstra: state, runKey, labels: true, onNodeClick: pick, optionRoutes: mode === "pick" });
  }, [state, runKey, pick, mode]);
  useEffect(() => () => setScene({ optionRoutes: false, hoverOption: null }), []);

  // The option being pointed at, from a chip here or its route on the map
  const hoverOption = useSceneStore((s) => s.hoverOption);
  const point = (id: number | null) => setScene({ hoverOption: id });

  const scrub = (to: number) => {
    setCursor(to);
    setAuto(false);
    setFeedback(null);
    setWrong(null);
  };

  const restart = () => {
    setHistory([first]);
    setCursor(0);
    setAuto(false);
    setFeedback(null);
    setWrong(null);
    setRunKey((k) => k + 1);
    chimed.current = false;
  };

  const total = state.dist.get(end);
  const lastStep = history.length - 1;

  return (
    <>
      <CityToggle />
      <GraphLegend search found={mode === 'done'} />

      <CardSlot>
        <p className={`text-sm leading-relaxed min-h-[2.5rem] ${
          feedback?.kind === 'wrong' ? 'text-rose-300' : feedback?.kind === 'ok' ? 'text-emerald-300' : 'text-slate-300'
        }`}>
          {mode === 'done'
            ? `Reached ${nodeName(end)}. Every dot it locked in has its fastest time, so no other route can beat this.`
            : mode === 'auto'
              ? 'Same rule, every step: lock in the closest waiting dot, then update its neighbours.'
              : feedback?.text ?? (cursor === 0
                  ? `${nodeName(start)} is locked in at 0 min. Every number is the best time found so far. Which dot gets locked in next?`
                  : 'Which dot gets locked in next?')}
        </p>

        {mode !== 'done' && (
          <div className="space-y-1.5">
            {sorted ? (
              // Earned: the learner kept picking the smallest, so now the list sorts itself
              <p className="queue-caption">Priority queue · lowest first</p>
            ) : (
              <p className="text-sm text-slate-300">Waiting dots · any could be locked in next</p>
            )}
            {mode === 'pick' && (
              <p className="option-legend">
                <span className="option-swatch" aria-hidden />
                Tap a chip, or a blue arrow on the map
              </p>
            )}
            {mode === 'pick' && feedback?.kind === 'wrong' && (
              <p className="text-sm font-semibold text-sky-300">Which number is smallest?</p>
            )}
            <div className="flex flex-wrap gap-2">
              {shown.map((q, i) => {
                const ch = lastChanges.get(q.node);
                const top = sorted && i === 0;
                const isWrong = q.node === wrong?.id;
                return (
                  <button
                    // A new key on each wrong pick restarts the shake
                    key={isWrong ? `${q.node}-${wrong.n}` : q.node}
                    ref={(el) => {
                      if (el) chips.current.set(q.node, el);
                      else chips.current.delete(q.node);
                    }}
                    onClick={() => pick(q.node)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && point(q.node)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && point(null)}
                    onFocus={() => point(q.node)}
                    onBlur={() => point(null)}
                    disabled={mode !== 'pick'}
                    className={`queue-chip ${isWrong ? 'queue-chip-wrong' : top ? 'queue-chip-top' : ''} ${
                      hoverOption === q.node ? 'queue-chip-pointed' : ''
                    }`}
                  >
                    {nodeName(q.node)} · {q.cost} min
                    {ch && <span className="ml-1.5 text-[0.625rem] text-sky-300">{ch.kind === 'new' ? 'new' : '↓ faster'}</span>}
                  </button>
                );
              })}
            </div>
            {picks === SORT_AFTER && mode === 'pick' && (
              <p className="text-xs text-indigo-300">
                You always picked the smallest. So Maps keeps this list sorted, and the answer is always on top.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {mode === 'pick' && sorted && (
            <button onClick={() => setAuto(true)} className="btn-primary flex-1">
              {cursor < lastStep ? 'Auto-play from here' : 'Got it. Auto-play the rest'}
            </button>
          )}
          {mode === 'done' && (
            <div className="flex-1 flex items-baseline gap-2 px-4 py-2.5 rounded-2xl bg-emerald-400/10 border border-emerald-400/25 text-emerald-300">
              {total !== undefined && total !== Infinity && (
                <>
                  <span className="numeral text-4xl">{total}</span>
                  <span className="text-sm font-semibold">min</span>
                </>
              )}
              <span className="ml-auto text-xs text-emerald-300/80">
                checked {state.visited.size} of {graph.nodes.length} dots
              </span>
            </div>
          )}
          {mode !== 'auto' && cursor > 0 && (
            <button onClick={restart} className={mode === 'done' ? 'btn-glass' : 'px-3 py-3 text-xs text-slate-500 hover:text-slate-300'}>
              {mode === 'done' ? 'Again' : 'Start over'}
            </button>
          )}
        </div>

        {/* Rewind: drag back through every step of the search */}
        {lastStep > 0 && (
          <label className="scrub">
            <span className="scrub-label">
              <span>Rewind</span>
              <span className="tabular-nums">
                step {cursor} of {lastStep}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={lastStep}
              step={1}
              value={cursor}
              onChange={(e) => scrub(Number(e.target.value))}
              style={{ '--fill': `${(cursor / lastStep) * 100}%` } as React.CSSProperties}
              aria-label="Step of the search"
            />
          </label>
        )}
      </CardSlot>
    </>
  );
}
