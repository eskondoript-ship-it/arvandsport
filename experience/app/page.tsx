'use client';

import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useLayoutEffect, useRef } from 'react';

import BlueprintHUD from '@/components/BlueprintHUD';
import { CHAPTERS, STATS, TAREMI } from '@/lib/taremi';
import { initSmoothScroll, setScrollProgress } from '@/lib/scroll';

/**
 * The canvas is client-only. A static export prerenders every page at build
 * time, and there is no WebGL context in Node -- so this has to be excluded
 * from that pass rather than merely marked 'use client'.
 */
const SoccerCanvas = dynamic(() => import('@/components/SoccerCanvas'), {
  ssr: false,
  loading: () => null,
});

/** Three chapters at 100vh of scroll each. */
const SCROLL_VH = CHAPTERS.length * 100;

export default function Page() {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => initSmoothScroll(), []);

  /**
   * One trigger publishes progress for everything: the HUD reads it, and so
   * does the 3D scene's own timeline. Both are downstream of this single
   * source, so they cannot disagree about where the page is.
   */
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: '#scroll-track',
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => setScrollProgress(self.progress),
      });

      /* The copy fades through its own chapter rather than sitting there for
       * the full 100vh, so the scene gets the frame to itself in between.
       *
       * Triggered on the copy block, not on the section that holds it. The
       * section is a full screen tall and the copy sits at one end of it, so a
       * section-based window keeps text on screen long after it has scrolled
       * to the opposite edge -- on a phone, where the copy is pinned to the
       * foot of each screen, that put two chapters in frame at once. */
      gsap.utils.toArray<HTMLElement>('[data-chapter-copy]').forEach((copy) => {
        gsap.fromTo(
          copy.querySelectorAll('[data-chapter-item]'),
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: copy,
              start: 'top 92%',
              end: 'bottom 18%',
              toggleActions: 'play reverse play reverse',
            },
          },
        );
      });
    }, track);

    // Fonts and the canvas both change layout after first paint.
    const refresh = () => ScrollTrigger.refresh();
    const timer = window.setTimeout(refresh, 400);
    window.addEventListener('load', refresh);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', refresh);
      ctx.revert();
    };
  }, []);

  return (
    <main className="relative bg-[#08080c]">
      {/* The scene, pinned behind everything. */}
      <div className="fixed inset-0 z-0">
        <SoccerCanvas />
      </div>

      {/* Scrims. The copy scrolls while the scene is fixed, so every chapter's
          text crosses the full height of the frame and no arrangement of the
          two keeps them apart -- Taremi arrives at the lower left exactly
          where the second chapter's body copy passes through. A gradient the
          text sits on solves it once, for every chapter, instead of
          choreographing each collision separately.

          A wide screen gets it as a column down the left, which the copy
          never leaves. A phone has no such column -- the copy is full width
          and travels the whole height -- so there the scrim rides with the
          text instead, on the block itself. */}
      <div className="pointer-events-none fixed inset-y-0 left-0 z-10 hidden w-[min(52rem,62vw)] bg-gradient-to-r from-[#08080c] via-[#08080c]/78 to-transparent md:block" />
      {/* A soft floor gradient so the grid does not just stop. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 hidden h-48 bg-gradient-to-t from-[#08080c] to-transparent md:block" />

      <BlueprintHUD />

      {/* The scroll track. Transparent sections stacked over the canvas: their
          only job is to give the page its height and to carry the copy. */}
      <div id="scroll-track" ref={track} className="relative z-10" style={{ height: `${SCROLL_VH}vh` }}>
        {CHAPTERS.map((chapter, index) => (
          <section
            key={chapter.index}
            data-chapter={chapter.index}
            /* Copy sits high in the frame on every size, and the scene moves
               instead: right of it on a wide screen, below it on a narrow one.
               Copy at the foot of each screen looks better in isolation and
               does not survive contact with the scroll -- consecutive chapters
               are one viewport apart and each block is a fraction of that
               tall, so the tail of one and the head of the next are in frame
               together for most of the page. Anchored to the top, a chapter
               leaves exactly as the next arrives. */
            className="flex h-screen items-start px-4 pt-[13vh] md:px-12 md:pt-[17vh]"
          >
            {/* All three columns sit left. The scene is aimed to keep the ball
                in the right half of the frame, so alternating sides -- which is
                the obvious first instinct -- puts the second chapter's copy
                directly behind the exploding shell. */}
            <div
              data-chapter-copy
              className={[
                'max-w-md',
                // The travelling scrim, phone only; see the note above.
                'bg-[#08080c]/82 p-4 backdrop-blur-[2px] md:bg-transparent md:p-0 md:backdrop-blur-none',
                index === 2 ? 'lg:max-w-sm' : '',
              ].join(' ')}
            >
              <p
                data-chapter-item
                className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/70"
              >
                {chapter.index} — {chapter.kicker}
              </p>
              <h2
                data-chapter-item
                className="mt-3 whitespace-pre-line text-[clamp(1.9rem,7.5vw,3rem)] font-light leading-[1.06] tracking-tight text-white md:mt-4 md:text-5xl"
              >
                {chapter.title}
              </h2>
              <p data-chapter-item className="mt-4 text-sm leading-relaxed text-white/55 md:mt-5">
                {chapter.body}
              </p>
              {/* The stat column is a fixed overlay and needs a clear right
                  margin, which only exists from lg up. Below that the same
                  figures ride with the copy instead of being dropped. */}
              {index === 2 && (
                <dl data-chapter-item className="mt-6 mb-8 grid grid-cols-2 gap-px bg-white/10 md:mb-0 lg:hidden">
                  {STATS.map((stat) => (
                    <div key={stat.label} className="bg-[#08080c] px-3 py-2.5">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
                        {stat.label}
                      </dt>
                      <dd className="mt-1 text-2xl font-light leading-none text-white tabular-nums">
                        {stat.value}
                      </dd>
                      <dd className="mt-1 font-mono text-[10px] leading-tight text-white/40">{stat.note}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {index === 2 && (
                <a
                  data-chapter-item
                  href={TAREMI.profile}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="pointer-events-auto mt-7 inline-flex items-center gap-2 border border-cyan-300/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 transition-colors hover:bg-cyan-300/10"
                >
                  Full profile
                  <span aria-hidden>→</span>
                </a>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
