'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  CSSProperties,
  PointerEvent,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import CSChip from './CSChip';
import HonestyNote from './HonestyNote';
import SoundToggle from './SoundToggle';
import { glossary } from '@/content/glossary';
import { BeatMeta } from '@/lib/beats';
import { setScene } from '@/lib/sceneStore';
import { isSide, nearestSnap, sceneInsets, sheetSnaps, sideHeight, Snap } from '@/lib/sheet';
import { useViewport } from '@/lib/viewport';

interface BeatContext {
  reveal: () => void;
  /** The empty spot in the sheet where an interaction's controls go */
  slot: HTMLElement | null;
}

const Ctx = createContext<BeatContext>({ reveal: () => {}, slot: null });

/** Call to unlock the reveal text, the CS terms and the Next button. Stable between renders. */
export function useReveal() {
  return useContext(Ctx).reveal;
}

/**
 * Put controls in the sheet, under the question, from inside an interaction.
 * The interaction keeps one set of state for the scene and the controls; this
 * just draws the controls in the sheet.
 */
export function CardSlot({ children }: { children: ReactNode }) {
  const { slot } = useContext(Ctx);
  return slot ? createPortal(children, slot) : null;
}

/** "How does Maps even *see* a city?" → the starred words in italics */
function withEmphasis(text: string): ReactNode[] {
  return text.split(/\*(.+?)\*/g).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));
}

interface Props {
  meta: BeatMeta;
  /** The reveal text, rendered from MDX on the server */
  reveal: ReactNode;
  topic: string;
  /** The beat's interaction: its on-scene controls, and sheet controls via <CardSlot> */
  children: ReactNode;
}

/**
 * The sheet every beat lives in. On an upright phone or tablet it sits at the
 * bottom, sized to fit what is in it, and can be dragged between three stops.
 * On a wide screen, or a phone on its side, it is a card docked at the side,
 * so it never covers the city. Sizes follow the screen (see lib/sheet.ts).
 *
 * Top to bottom: handle, question, the beat's own controls, the reveal, and a
 * footer with Back and Next that never scrolls away.
 */
export default function BeatShell({ meta, reveal, topic, children }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const doReveal = useCallback(() => setRevealed(true), []);
  const ctx = useMemo(() => ({ reveal: doReveal, slot }), [doReveal, slot]);

  // ── Measure: the screen, and the three parts of the sheet ───────────────────
  const headerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const view = useViewport();
  const sheetRef = useRef<HTMLElement>(null);
  // edge: the sheet's own top and bottom borders, which its height must include
  const [parts, setParts] = useState({ header: 120, content: 140, footer: 68, edge: 2 });

  useEffect(() => {
    const measure = () => {
      const next = {
        header: headerRef.current?.offsetHeight ?? 120,
        content: contentRef.current?.offsetHeight ?? 140,
        footer: footerRef.current?.offsetHeight ?? 68,
        edge: sheetRef.current ? sheetRef.current.offsetHeight - sheetRef.current.clientHeight : 2,
      };
      setParts((p) =>
        p.header === next.header && p.content === next.content && p.footer === next.footer && p.edge === next.edge ? p : next,
      );
    };
    measure();
    const watch = new ResizeObserver(measure);
    for (const el of [headerRef.current, contentRef.current, footerRef.current]) if (el) watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // ── Height: fit the content, within stops on a phone ────────────────────────
  const wide = isSide(view.w, view.h);
  const contentH = parts.header + parts.content + parts.footer + parts.edge;
  const snaps = useMemo(() => sheetSnaps(view.h, contentH, parts.header), [view.h, contentH, parts.header]);
  const [snap, setSnap] = useState<Snap>('half');
  const [dragH, setDragH] = useState<number | null>(null);
  const height = wide ? sideHeight(view.h, contentH, view.rem) : dragH ?? snaps[snap];
  const tucked = !wide && snap === 'peek' && dragH === null;

  // Tell the scene what the sheet covers, so the camera keeps the city clear of it
  useEffect(() => {
    setScene({ ...sceneInsets(view.w, view.h, height, view.rem), mode: 'beat' });
  }, [view.w, view.h, view.rem, height]);

  // ── Drag, on a phone: the header moves the sheet between its stops ──────────
  const drag = useRef<{ y: number; h: number; t: number; v: number; moved: boolean; grip: boolean } | null>(null);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (wide) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const grip = !!(e.target as HTMLElement).closest('.sheet-grip');
    drag.current = { y: e.clientY, h: height, t: e.timeStamp, v: 0, moved: false, grip };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 4) return;
    d.moved = true;
    // Past the last stop the sheet resists, so the ends feel like ends
    const raw = d.h + dy;
    const over = raw > snaps.full ? snaps.full + (raw - snaps.full) * 0.2 : raw;
    const next = Math.max(snaps.peek * 0.8, over);
    d.v = (next - (dragH ?? d.h)) / Math.max(1, e.timeStamp - d.t); // px per ms, positive = growing
    d.t = e.timeStamp;
    setDragH(next);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) setSnap(nearestSnap(snaps, height, d.v));
    else if (d.grip) toggleTuck();
    setDragH(null);
  };
  const toggleTuck = () => setSnap((s) => (s === 'peek' ? 'half' : 'peek'));

  // ── When the point lands: bring the sheet back if tucked, and show the reveal ─
  useEffect(() => {
    if (!revealed) return;
    setSnap((s) => (s === 'peek' ? 'half' : s));
    const id = setTimeout(() => revealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 380);
    return () => clearTimeout(id);
  }, [revealed]);

  // ── Scroll cues: fade the edge that has more text beyond it ─────────────────
  const [more, setMore] = useState({ up: false, down: false });
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = { up: el.scrollTop > 4, down: el.scrollTop + el.clientHeight < el.scrollHeight - 4 };
    setMore((m) => (m.up === next.up && m.down === next.down ? m : next));
  }, []);
  useEffect(() => {
    // Wait for the height spring to settle before judging
    const id = setTimeout(checkScroll, 60);
    const late = setTimeout(checkScroll, 760);
    return () => {
      clearTimeout(id);
      clearTimeout(late);
    };
  }, [height, parts.content, checkScroll]);

  const prevHref = meta.prevBeat ? `/topics/${topic}/${meta.prevBeat}` : '/';
  const nextHref = meta.nextBeat ? `/topics/${topic}/${meta.nextBeat}` : null;
  const settle = dragH === null ? 'sheet-settle' : '';
  const insets = sceneInsets(view.w, view.h, height, view.rem);

  return (
    <Ctx.Provider value={ctx}>
      <div style={{ '--sheet': `${insets.sheetPx}px`, '--side': `${insets.sidePx}px`, '--sheet-h': `${height}px` } as CSSProperties}>
        {/* On-scene controls: the part of the screen the sheet leaves free */}
        <div className={`stage-overlay ${settle}`}>
          {children}
          <SoundToggle />
        </div>

        {/* How far through the topic: fills as each beat's point lands */}
        <div className="progress" aria-hidden>
          <span style={{ width: `${((meta.beatNum - 1 + (revealed ? 1 : 0)) / meta.totalBeats) * 100}%` }} />
        </div>

        <section ref={sheetRef} className={`sheet beat-sheet ${settle}`} aria-label={`Beat ${meta.beatNum}: ${meta.title}`}>
          <div
            ref={headerRef}
            className="sheet-header"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <button
              type="button"
              className="sheet-grip"
              aria-expanded={!tucked}
              aria-label={tucked ? 'Bring the card back up' : 'Tuck the card away to see the whole city'}
              // Pointer taps are handled by the drag code above; this is for keyboards
              onClick={(e) => e.detail === 0 && toggleTuck()}
            >
              <span className="sheet-handle" data-tucked={tucked} />
            </button>
            <p className="eyebrow">
              Beat {meta.beatNum} of {meta.totalBeats} · {meta.topicTitle}
            </p>
            <h1 className="question">{withEmphasis(meta.question)}</h1>
          </div>

          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="sheet-scroll"
            data-more-up={more.up}
            data-more-down={more.down}
            // Hidden content must not be reachable by keyboard while the sheet is tucked
            inert={tucked}
          >
            <div ref={contentRef} className="sheet-content">
              <div ref={setSlot} className="space-y-3 empty:hidden" />

              {revealed && (
                <div ref={revealRef} className="reveal-in space-y-3">
                  <p className="section-label">The idea</p>
                  <div className="text-[0.9375rem] text-slate-200 leading-relaxed space-y-2">{reveal}</div>

                  <p className="section-label pt-1">In CS terms · tap one</p>
                  <div className="flex flex-wrap gap-2">
                    {meta.csTerms.map((t) => (
                      <CSChip key={t} term={t} open={term === t} onToggle={() => setTerm(term === t ? null : t)} />
                    ))}
                  </div>
                  {term && glossary[term] && (
                    <p key={term} className="definition reveal-in">
                      <strong className="text-slate-100">{term}:</strong> {glossary[term]}
                    </p>
                  )}
                  {meta.honestyNote && <HonestyNote note={meta.honestyNote} />}
                </div>
              )}
            </div>
          </div>

          {/* Back and Next stay put: they never scroll out of thumb reach */}
          <nav ref={footerRef} className="sheet-footer" inert={tucked}>
            <Link href={prevHref} className="btn-quiet" aria-label={meta.prevBeat ? 'Previous beat' : 'Back to the start page'}>
              ← {meta.prevBeat ? 'Back' : 'Home'}
            </Link>

            {/* A status, not a link: where you are, and (until it unlocks) what opens Next */}
            <span className="footer-status">
              <span className="steps" aria-label={`Beat ${meta.beatNum} of ${meta.totalBeats}`}>
                {Array.from({ length: meta.totalBeats }, (_, i) => (
                  <i key={i} data-on={i < meta.beatNum - (revealed ? 0 : 1)} data-here={i === meta.beatNum - 1} />
                ))}
              </span>
              {!revealed && <span className="unlock-hint">{meta.unlockHint ?? 'Finish this step to continue'}</span>}
            </span>

            {!revealed ? (
              <span className="btn-primary btn-locked" aria-disabled title={meta.unlockHint ?? undefined}>
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="mr-1.5">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
                  <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                {nextHref ? 'Next' : 'Finish'}
              </span>
            ) : nextHref ? (
              <Link href={nextHref} className="btn-primary btn-arrive">
                Next →
              </Link>
            ) : (
              <Link href="/" className="btn-primary btn-arrive">
                Finish ✓
              </Link>
            )}
          </nav>
        </section>
      </div>
    </Ctx.Provider>
  );
}
