// The home page's motion. Three visuals act out what they show: the
// transcript replays a task, the loop drawing walks a pulse through its
// rounds, the install terminal types its commands once. Text sections only
// rise as they arrive. Nothing here changes the page's text, and every
// replay starts from and returns to the page as it is without JavaScript.
//
// Only runs when BaseLayout has set `.motion` (no reduced-motion request).

declare global {
  interface Window {
    __motion?: boolean;
  }
}

const root = document.documentElement;

// --- time ------------------------------------------------------------------

const clamp = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k);
const at = (t: number, start: number, dur: number) => clamp((t - start) / dur);
// Close to the CSS curves of the same names in global.css.
const easeIn = (k: number) => 1 - Math.pow(1 - k, 4);
const easeIo = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// Writes a style only when it changes, so a resting frame costs nothing.
const last = new WeakMap<Element, Record<string, string>>();
function css(el: Element, prop: string, value: string) {
  let seen = last.get(el);
  if (!seen) last.set(el, (seen = {}));
  if (seen[prop] === value) return;
  seen[prop] = value;
  (el as HTMLElement).style.setProperty(prop, value);
}

interface Runner {
  t: number;
  started: boolean;
  visible: boolean;
  paused: boolean;
  done?: boolean;
  draw(): void;
}

// One clock for everything. A runner's time moves only while it has started,
// is on screen, is not paused, and the tab is in front.
const runners: Runner[] = [];
let raf = 0;
let then = 0;
const live = (r: Runner) => r.started && r.visible && !r.paused && !r.done && !document.hidden;
function frame(now: number) {
  const dt = Math.min(0.1, (now - then) / 1000);
  then = now;
  raf = 0;
  for (const r of runners) {
    if (!live(r)) continue;
    r.t += dt;
    r.draw();
  }
  if (runners.some(live)) raf = requestAnimationFrame(frame);
}
function wake() {
  if (raf || !runners.some(live)) return;
  then = performance.now();
  raf = requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', wake);

// Starts a runner when 30% of its element is in view, and pauses it whenever
// none of it is.
function watch(el: Element, r: Runner) {
  runners.push(r);
  new IntersectionObserver(
    ([e]) => {
      r.visible = e.isIntersecting;
      if (e.intersectionRatio >= 0.3) r.started = true;
      wake();
    },
    { threshold: [0, 0.3] }
  ).observe(el);
}

// The Pause / Play button under a replay.
function control(
  btn: HTMLButtonElement | null,
  r: Runner,
  onPlay: () => void,
  onPause: () => void
) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    r.paused = !r.paused;
    btn.textContent = r.paused ? 'Play' : 'Pause';
    btn.setAttribute('aria-pressed', String(r.paused));
    if (r.paused) onPause();
    else onPlay();
    wake();
  });
}

function caret(): HTMLElement {
  const c = document.createElement('span');
  c.className = 'caret';
  c.setAttribute('aria-hidden', 'true');
  return c;
}

// --- sections ----------------------------------------------------------------

function reveals() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

// --- the transcript ------------------------------------------------------------
//
// Story: the task runs again. The lines fade from the bottom up, then each
// command is typed, the kit prints, and every dispatch spins, counts its time
// and lands on its result, the one needs-work included. Then it rests.

const TYPE = 0.048; // seconds a glyph
const COUNT = 0.85; // seconds a dispatch takes to count its time
const FIRST = 5.5; // rest after the load-in, before the first replay
const REST = 7; // rest after a replay
const SPIN = '|/-\\';

type Step = {
  el: HTMLElement;
  kind: string;
  start: number;
  cmd?: HTMLElement;
  len?: number;
  typeStart?: number;
  typeEnd?: number;
  res?: HTMLElement;
  time?: HTMLElement;
  total?: number;
  label?: string;
  landed?: number;
};

const seconds = (s: string) => {
  const m = /(?:(\d+)m)?(\d+)s/.exec(s);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : 0;
};
const clock = (v: number, minutes: boolean) =>
  minutes ? `${Math.floor(v / 60)}m${String(v % 60).padStart(2, '0')}s` : `${v}s`;

function transcript(fig: HTMLElement) {
  const lines = [...fig.querySelectorAll<HTMLElement>('.tr-line')];
  const n = lines.length;
  const outEnd = 0.25 + (n - 1) * 0.015;
  let cursor = outEnd + 0.35;
  const steps: Step[] = lines.map((el) => {
    const kind = el.dataset.ln ?? 'out';
    const s: Step = { el, kind, start: cursor };
    if (kind === 'cmd') {
      s.cmd = el.querySelector<HTMLElement>('.tr-cmd')!;
      s.len = s.cmd.textContent!.length;
      s.typeStart = cursor + 0.25;
      s.typeEnd = s.typeStart + s.len * TYPE;
      cursor = s.typeEnd + 0.4;
    } else if (kind === 'dispatch') {
      s.res = el.querySelector<HTMLElement>('.tr-res')!;
      s.time = el.querySelector<HTMLElement>('.tr-time')!;
      s.label = s.time.textContent!.slice(1, -1);
      s.total = seconds(s.label);
      s.landed = cursor + 0.2 + COUNT;
      cursor = s.landed + 0.3;
    } else {
      cursor += 0.08;
    }
    return s;
  });
  const runEnd = cursor;
  const cycle = runEnd + REST;
  const c = caret();

  const rest = (s: Step) => {
    css(s.el, 'opacity', '');
    css(s.el, 'transform', '');
    if (s.cmd) css(s.cmd, 'clip-path', '');
    s.res?.classList.remove('pending');
    s.time?.classList.remove('counting');
  };
  const hideCaret = () => css(c, 'opacity', '0');

  const r: Runner = {
    t: 0,
    started: true, // the load-in is CSS and starts with the page
    visible: false,
    paused: false,
    draw() {
      const local = r.t - FIRST;
      if (local < 0) return;
      const t = local % cycle;
      if (t >= runEnd) {
        steps.forEach(rest);
        hideCaret();
        return;
      }
      if (t < outEnd) {
        hideCaret();
        steps.forEach((s, i) => {
          rest(s);
          css(s.el, 'opacity', String(1 - easeIn(at(t, (n - 1 - i) * 0.015, 0.25))));
        });
        return;
      }
      let caretOn: Step | null = null;
      for (const s of steps) {
        const k = easeIn(at(t, s.start, 0.35));
        css(s.el, 'opacity', String(k));
        css(s.el, 'transform', k < 1 ? `translateY(${((1 - k) * 6).toFixed(2)}px)` : '');
        if (s.cmd) {
          const typed =
            t < s.typeStart! ? 0 : Math.min(s.len!, Math.floor((t - s.typeStart!) / TYPE) + 1);
          css(
            s.cmd,
            'clip-path',
            typed < s.len! ? `inset(0 ${(((s.len! - typed) / s.len!) * 100).toFixed(3)}% 0 0)` : ''
          );
          if (t >= s.start && t < s.typeEnd! + 0.4) caretOn = s;
          s.el.dataset.typed = String(typed);
        }
        if (s.res && s.time) {
          const working = t >= s.start && t < s.landed!;
          s.res.classList.toggle('pending', working);
          s.time.classList.toggle('counting', working);
          if (working) {
            s.res.dataset.spin = SPIN[Math.floor(t * 12) % SPIN.length];
            const v = Math.round(s.total! * easeIn(at(t, s.start + 0.2, COUNT)));
            s.time.dataset.count = `(${clock(v, s.label!.includes('m'))})`;
          }
          const pop = at(t, s.landed!, 0.3);
          css(
            s.res,
            'transform',
            pop > 0 && pop < 1 ? `scale(${(0.86 + 0.14 * easeIn(pop)).toFixed(3)})` : ''
          );
        }
      }
      if (caretOn) {
        const s = caretOn as Step;
        if (c.parentElement !== s.el) s.el.append(c);
        const typed = Number(s.el.dataset.typed);
        const ch = s.cmd!.offsetWidth / s.len!;
        css(c, 'left', `${(s.cmd!.offsetLeft + typed * ch).toFixed(1)}px`);
        const idle = t < s.typeStart! || t > s.typeEnd!;
        css(c, 'opacity', idle && (t * 2) % 2 > 1 ? '0' : '0.85');
      } else hideCaret();
    }
  };

  const toRest = () => {
    steps.forEach(rest);
    hideCaret();
  };
  // The load-in animation is CSS; the replay writes inline styles, which an
  // animation would override, so it is dropped once it has played.
  setTimeout(() => lines.forEach((l) => l.classList.remove('rise')), 2600);
  control(fig.querySelector<HTMLButtonElement>('[data-pause]'), r, () => (r.t = FIRST - 1), toRest);
  // "Watch a task run" replays it from the start.
  document.querySelectorAll('a[href="#transcript"]').forEach((a) =>
    a.addEventListener('click', () => {
      if (r.paused) return;
      // To the end of this cycle's rest, so the replay opens as the page lands.
      const local = r.t - FIRST;
      r.t = FIRST + (local < 0 ? 0 : (Math.floor(local / cycle) + 1) * cycle) - 0.9;
      wake();
    })
  );
  watch(fig, r);
}

// --- the loop drawing ----------------------------------------------------------
//
// Intro: the commands drop in, the boxes pop in reading order, the arrows
// draw, the notes rise. Story: a pulse walks one task: new, plan, the gate,
// one needs-work round, ready, the judge, the pull request. Every second run
// the planner asks a question first. Each box lights as the pulse reaches it.

type Hop = { node: string; hold: number } | { edge: string };

function loop(svg: SVGSVGElement) {
  const NS = 'http://www.w3.org/2000/svg';
  const items = [...svg.querySelectorAll<SVGGraphicsElement>('[data-k]')].map((el) => ({
    el,
    k: el.dataset.k!,
    at: Number(el.dataset.at ?? 0),
    len: el.dataset.k === 'draw' ? (el as SVGGeometryElement).getTotalLength() : 0,
    marker: el.getAttribute('marker-end')
  }));
  const LANDED = Math.max(...items.map((i) => i.at)) + 1.1;

  const nodes = new Map<string, SVGRectElement>();
  svg.querySelectorAll<SVGGElement>('[data-node]').forEach((g) => {
    const rect = g.querySelector('rect')!;
    const lit = rect.cloneNode() as SVGRectElement;
    lit.setAttribute('class', rect.classList.contains('you') ? 'lit lit-you' : 'lit');
    rect.after(lit);
    nodes.set(g.dataset.node!, lit);
  });
  const edges = new Map<string, SVGGeometryElement>();
  svg.querySelectorAll<SVGGeometryElement>('[data-e]').forEach((e) => edges.set(e.dataset.e!, e));

  const pulse = document.createElementNS(NS, 'g');
  pulse.setAttribute('aria-hidden', 'true');
  pulse.innerHTML =
    '<circle r="9" fill="currentColor" opacity="0.22"></circle><circle r="3.5" fill="currentColor"></circle>';
  pulse.style.opacity = '0';
  svg.append(pulse);

  const route = (ask: boolean): Hop[] => [
    { node: 'new', hold: 0.45 },
    { edge: 'new-planner' },
    { node: 'planner', hold: 0.5 },
    ...(ask ? ([{ edge: 'ask' }, { node: 'planner', hold: 0.5 }] as Hop[]) : []),
    { edge: 'planner-you' },
    { node: 'you', hold: 0.75 },
    { edge: 'you-impl' },
    { node: 'impl', hold: 0.55 },
    { edge: 'impl-rev' },
    { node: 'rev', hold: 0.5 },
    { edge: 'work' },
    { node: 'impl', hold: 0.55 },
    { edge: 'impl-rev' },
    { node: 'rev', hold: 0.5 },
    { edge: 'rev-judge' },
    { node: 'judge', hold: 0.55 },
    { edge: 'judge-pr' },
    { node: 'pr', hold: 0.9 }
  ];
  // Seconds an edge takes: by its length, never a blink.
  const travel = (e: SVGGeometryElement) => Math.max(0.32, e.getTotalLength() / 200);
  type Timed = { hop: Hop; start: number; end: number };
  const timeline = (hops: Hop[]) => {
    let t = 0;
    const out: Timed[] = hops.map((hop) => {
      const d = 'node' in hop ? hop.hold : travel(edges.get(hop.edge)!);
      const s = { hop, start: t, end: t + d };
      t += d;
      return s;
    });
    return { hops: out, length: t + 1.4 };
  };
  const runs = [timeline(route(false)), timeline(route(true))];
  const pair = runs[0].length + runs[1].length;

  const intro = (t: number) => {
    for (const i of items) {
      const k =
        i.k === 'draw'
          ? easeIo(at(t, i.at, 0.5))
          : easeIn(at(t, i.at, i.k === 'fade' ? 0.7 : 1.05));
      const f = clamp((t - i.at) / 0.75);
      const el = i.el;
      if (i.k === 'draw') {
        css(el, 'opacity', k > 0 ? '1' : '0');
        css(el, 'stroke-dasharray', `${i.len}`);
        css(el, 'stroke-dashoffset', `${(i.len * (1 - k)).toFixed(2)}`);
        if (i.marker) {
          if (k >= 1) el.setAttribute('marker-end', i.marker);
          else el.removeAttribute('marker-end');
        }
        continue;
      }
      css(el, 'opacity', String(i.k === 'fade' ? k : 1 - Math.pow(1 - f, 3)));
      if (i.k === 'fade') continue;
      css(el, 'filter', f < 1 ? `blur(${((1 - f) * 4).toFixed(2)}px)` : '');
      css(
        el,
        'transform',
        k >= 1
          ? ''
          : i.k === 'pop'
            ? `scale(${(0.86 + 0.14 * k).toFixed(4)})`
            : `translateY(${((1 - k) * (i.k === 'down' ? -8 : 10)).toFixed(2)}px)`
      );
    }
  };
  const land = () => {
    for (const i of items) {
      for (const p of ['opacity', 'filter', 'transform', 'stroke-dasharray', 'stroke-dashoffset'])
        css(i.el, p, '');
      if (i.marker) i.el.setAttribute('marker-end', i.marker);
    }
    svg.classList.add('landed');
  };
  const still = () => {
    nodes.forEach((n) => css(n, 'opacity', '0'));
    css(pulse, 'opacity', '0');
  };

  const story = (t: number) => {
    let local = t % pair;
    const run = local < runs[0].length ? runs[0] : runs[1];
    if (run === runs[1]) local -= runs[0].length;
    // Lights: up in 0.12s when the pulse arrives, down over 0.5s after it leaves.
    const light = new Map<string, number>();
    let shown = false;
    for (const h of run.hops) {
      if ('node' in h.hop) {
        const up = at(local, h.start - 0.04, 0.12);
        const down = 1 - at(local, h.end, 0.5);
        const v = Math.min(up, down);
        light.set(h.hop.node, Math.max(light.get(h.hop.node) ?? 0, v));
      } else if (local >= h.start && local < h.end) {
        const e = edges.get(h.hop.edge)!;
        const k = easeIo((local - h.start) / (h.end - h.start));
        const p = e.getPointAtLength(k * e.getTotalLength());
        css(pulse, 'transform', `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`);
        css(pulse, 'color', e.dataset.pulse ?? getComputedStyle(e).color);
        shown = true;
      }
    }
    css(pulse, 'opacity', shown ? '1' : '0');
    nodes.forEach((n, name) => css(n, 'opacity', (light.get(name) ?? 0).toFixed(3)));
  };

  let landed = false;
  const r: Runner = {
    t: 0,
    started: false,
    visible: false,
    paused: false,
    draw() {
      if (r.t < LANDED) return intro(r.t);
      if (!landed) {
        land();
        landed = true;
      }
      story(r.t - LANDED);
    }
  };
  control(
    svg.closest('figure')?.querySelector<HTMLButtonElement>('[data-pause]') ?? null,
    r,
    () => {
      if (landed) r.t = LANDED;
    },
    () => {
      if (!landed) {
        land();
        landed = true;
        r.t = LANDED;
      }
      still();
    }
  );
  watch(svg, r);
}

// --- the install terminal --------------------------------------------------------
//
// Intro only: the three commands are typed once, then the caret leaves.

function typing(box: HTMLElement) {
  const lines = [...box.querySelectorAll<HTMLElement>('.ty-tx')].map((tx) => ({
    tx,
    len: tx.textContent!.length
  }));
  let cursor = 0.45;
  const timed = lines.map((l) => {
    const s = { ...l, start: cursor, end: cursor + l.len * TYPE };
    cursor = s.end + 0.35;
    return s;
  });
  const end = cursor + 1.2;
  const c = caret();
  const r: Runner = {
    t: 0,
    started: false,
    visible: false,
    paused: false,
    draw() {
      let on: (typeof timed)[number] | null = null;
      for (const l of timed) {
        const typed = r.t < l.start ? 0 : Math.min(l.len, Math.floor((r.t - l.start) / TYPE) + 1);
        css(
          l.tx,
          'clip-path',
          typed < l.len ? `inset(0 ${(((l.len - typed) / l.len) * 100).toFixed(3)}% 0 0)` : 'none'
        );
        if (r.t >= l.start - 0.35) on = l;
        l.tx.dataset.typed = String(typed);
      }
      if (on && r.t < end) {
        const l = on as (typeof timed)[number];
        const line = l.tx.parentElement!;
        if (c.parentElement !== line) line.append(c);
        const ch = l.tx.offsetWidth / l.len;
        css(c, 'left', `${(l.tx.offsetLeft + Number(l.tx.dataset.typed) * ch).toFixed(1)}px`);
        const idle = r.t < l.start || r.t > l.end;
        css(c, 'opacity', idle && (r.t * 2) % 2 > 1 ? '0' : '0.85');
      }
      if (r.t >= end) {
        c.remove();
        r.done = true;
      }
    }
  };
  watch(box, r);
}

// --- start -----------------------------------------------------------------------

if (root.classList.contains('motion')) {
  window.__motion = true;
  reveals();
  document.querySelectorAll<HTMLElement>('[data-transcript]').forEach(transcript);
  document.querySelectorAll<SVGSVGElement>('svg[data-loop]').forEach(loop);
  document.querySelectorAll<HTMLElement>('[data-typing]').forEach(typing);
}

export {};
