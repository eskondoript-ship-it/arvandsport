/**
 * A clip the visitor scrubs by scrolling.
 *
 * One sticky stage over a tall section, like the hero and the spotlight: the
 * frame holds still in the middle of the screen and the scroll runs the footage
 * through it, forward when you scroll down and backward when you scroll up.
 * Nothing plays on its own and there is no sound, so it can never start talking
 * at someone.
 *
 * The markup is the finished frame -- the poster is in the `poster` attribute
 * and the copy is plain HTML -- so with no JavaScript, or with reduced motion
 * set, this section is a still photograph with a caption over it rather than an
 * empty box. src/scripts/film.js adds the scrub on top and nothing else.
 *
 * Two sources, not one. VP9 in a WebM container is the smaller file and every
 * browser that takes it is the majority of traffic; H.264 in MP4 is the one
 * every browser and every iOS version can decode. A single MP4 would work
 * everywhere too, but the WebM is free to make and the browser picks whichever
 * it can play without either of us thinking about it.
 *
 * `preload="none"` is deliberate and is why the video is not a cost the page
 * carries. The browser fetches nothing until film.js decides this visitor is
 * getting the scrub and asks for it, which it does when the section is close.
 * A `preload="auto"` here would have every visitor download half a megabyte of
 * football on the way past.
 */
import { esc, attr } from './layout.mjs';

export function film(site) {
  const config = site.film;
  if (!config || !(config.sources || []).length) return '';

  return `<section class="film" data-film aria-labelledby="film-title">
  <div class="film__pin" data-film-pin>
    <div class="film__frame">
      <!-- muted + playsinline are not preferences: without both, a phone
           refuses to show an inline video at all and opens it fullscreen
           instead. disablePictureInPicture and the controls being absent keep
           it scenery rather than a player. -->
      <video
        class="film__video"
        data-film-video
        poster="${attr(config.poster)}"
        preload="none"
        muted
        playsinline
        disablePictureInPicture
        aria-hidden="true"
        tabindex="-1">
        ${(config.sources || [])
          .map((s) => `<source src="${attr(s.src)}" type="${attr(s.type)}">`)
          .join('\n        ')}
      </video>
      <span class="film__vignette" aria-hidden="true"></span>
      <span class="film__scanline" aria-hidden="true"></span>
    </div>

    <div class="film__copy">
      <p class="film__kicker">${esc(config.kicker || '')}</p>
      <h2 class="film__title" id="film-title">${esc(config.title)}</h2>
      <p class="film__body">${esc(config.body)}</p>
    </div>

    <!-- The readout, in the instrument language the hero uses. It is written
         to from film.js as a plain number; nothing here is tweened. -->
    <p class="film__meter" aria-hidden="true">
      <span data-film-count>000</span><span class="film__meter-of"> / 100</span>
    </p>
  </div>
</section>`;
}
