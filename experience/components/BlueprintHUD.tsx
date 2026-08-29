'use client';

import { useEffect, useRef, useState } from 'react';

import { CHAPTERS, CAREER, STATS, TAREMI } from '@/lib/taremi';
import { onChapterChange, scrollState } from '@/lib/scroll';

/**
 * The blueprint overlay: everything that is text rather than geometry.
 *
 * It is deliberately not re-rendered by scroll. React hears about the chapter
 * changing -- three times over the whole page -- and everything finer than that
 * (the progress bar, the readout) is written straight to the DOM from a rAF
 * loop. Re-rendering this tree on every scrubbed frame is the one thing that
 * would make the 3D drop frames, because it is competing for the same main
 * thread the WebGL draw calls are issued from.
 */

function Crosshair({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className} fill="none">
      <circle cx="20" cy="20" r="11.5" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <circle cx="20" cy="20" r="1.6" fill="currentColor" />
      <path d="M20 0v9M20 31v9M0 20h9M31 20h9" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
    </svg>
  );
}

function StatCard({ label, value, note, active }: { label: string; value: string; note: string; active: boolean }) {
  return (
    <div
      /* Opaque enough to read against the exploded ball, which passes directly
         behind this column in the third chapter. A 2%-white card looked right
         on an empty background and became unreadable the moment a lit panel
         drifted under it. */
      className={[
        'border border-white/10 bg-[#08080c]/80 px-4 py-3 backdrop-blur-md',
        'transition-all duration-700 ease-out',
        active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      ].join(' ')}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">{label}</div>
      <div className="mt-1 text-3xl font-light leading-none text-white tabular-nums">{value}</div>
      <div className="mt-1.5 font-mono text-[10px] leading-tight text-white/40">{note}</div>
    </div>
  );
}

export default function BlueprintHUD() {
  const [chapter, setChapter] = useState(0);
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const counterMobile = useRef<HTMLSpanElement>(null);
  const barMobile = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => onChapterChange(setChapter), []);

  /* The fine-grained readouts, written outside React. */
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const p = scrollState.progress;
      const pct = Math.round(p * 100).toString().padStart(3, '0');
      if (counter.current) counter.current.textContent = pct;
      if (counterMobile.current) counterMobile.current.textContent = pct;
      if (bar.current) bar.current.style.transform = `scaleY(${p.toFixed(4)})`;
      if (barMobile.current) barMobile.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (readout.current) {
        readout.current.textContent = `X ${(Math.sin(p * 6.28) * 100).toFixed(1)}  Y ${(p * 360).toFixed(1)}°`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none text-white">
      {/* Tactical rules. Four hairlines inset from the edges, the frame the
          rest of the overlay hangs off. */}
      <div className="absolute inset-x-6 top-20 h-px bg-white/[0.07] md:inset-x-12" />
      <div className="absolute inset-x-6 bottom-20 h-px bg-white/[0.07] md:inset-x-12" />
      <div className="absolute inset-y-6 left-6 w-px bg-white/[0.07] md:inset-y-12 md:left-12" />
      <div className="absolute inset-y-6 right-6 w-px bg-white/[0.07] md:inset-y-12 md:right-12" />

      <Crosshair className="absolute left-6 top-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-cyan-300/40 md:left-12" />
      <Crosshair className="absolute right-6 bottom-20 h-6 w-6 translate-x-1/2 translate-y-1/2 text-cyan-300/40 md:right-12" />

      {/* Masthead */}
      <header className="absolute inset-x-6 top-6 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-white/45 md:inset-x-12">
        <span className="text-white/80">Arvand Sport</span>
        <span className="hidden sm:inline">Match ball · structural study</span>
        <span>FIFA licensed</span>
      </header>

      {/* Chapter counter and scrub bar. The vertical rail needs a clear column
          beside the copy, and a phone has not got one -- there the same
          reading appears as a hairline across the very bottom instead. */}
      <div className="absolute bottom-24 left-6 hidden items-end gap-4 md:left-12 md:flex">
        <div className="flex flex-col gap-2 font-mono text-[10px] tracking-[0.2em]">
          {CHAPTERS.map((entry, index) => (
            <span
              key={entry.index}
              className={[
                'transition-colors duration-500',
                index === chapter ? 'text-cyan-300' : 'text-white/25',
              ].join(' ')}
            >
              {entry.index}
            </span>
          ))}
        </div>
        <div className="relative h-24 w-px bg-white/10">
          <div ref={bar} className="absolute inset-x-0 top-0 h-full origin-top bg-cyan-300/80" />
        </div>
        <div className="pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          <span ref={counter}>000</span>
          <span className="text-white/20"> / 100</span>
        </div>
      </div>

      {/* Phone progress: chapter, percentage, and a hairline that fills. */}
      <div className="absolute inset-x-6 bottom-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 md:hidden">
        <span className="text-cyan-300">{CHAPTERS[chapter]?.index ?? '01'}</span>
        <div className="relative h-px flex-1 bg-white/12">
          <div ref={barMobile} className="absolute inset-y-0 left-0 w-full origin-left bg-cyan-300/80" />
        </div>
        <span ref={counterMobile}>000</span>
      </div>

      {/* Live vector readout, bottom right. Pure instrumentation dressing --
          it is the scroll position, said in the scene's own language. */}
      <div className="absolute bottom-6 right-6 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-white/30 md:right-12 md:block">
        <span ref={readout}>X 0.0 Y 0.0°</span>
      </div>

      {/* Stat cards. Chapter 3 only -- they are about the player, and he is not
          in the scene before the strike. */}
      <div className="absolute right-6 top-1/2 hidden w-56 -translate-y-1/2 flex-col gap-2 lg:flex md:right-12">
        <div
          className={[
            'bg-[#08080c]/80 py-1 font-mono text-[10px] uppercase tracking-[0.24em] transition-opacity duration-700',
            chapter === 2 ? 'text-cyan-300/80 opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          {TAREMI.name} — {TAREMI.position}
        </div>
        {STATS.map((stat, index) => (
          <div key={stat.label} style={{ transitionDelay: `${index * 90}ms` }} className="transition-all">
            <StatCard {...stat} active={chapter === 2} />
          </div>
        ))}
        <div
          className={[
            'mt-2 border border-white/10 border-l-cyan-300/40 bg-[#08080c]/80 px-3 py-3 backdrop-blur-md transition-all duration-700',
            chapter === 2 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          ].join(' ')}
          style={{ transitionDelay: '420ms' }}
        >
          {CAREER.map((move) => (
            <div key={move.year} className="mb-2 last:mb-0">
              <div className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/60">{move.year}</div>
              <div className="text-sm text-white/85">{move.club}</div>
              <div className="font-mono text-[10px] text-white/35">{move.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
