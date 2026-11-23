import { test } from "node:test";
import assert from "node:assert/strict";
import { viewportFrame, installModalViewport } from "./modalViewport.js";

test("Safari keyboard keeps actual visible height and viewport pan", () => {
  assert.deepEqual(
    viewportFrame({
      height: 370,
      layoutHeight: 844,
      offsetTop: 62,
      focused: true,
      baselineHeight: 844,
    }),
    { height: 370, top: 62, keyboardOpen: true },
  );
  // Android/Safari variants can shrink innerHeight as well: offset must not be lost.
  assert.deepEqual(
    viewportFrame({
      height: 370,
      layoutHeight: 370,
      offsetTop: 62,
      focused: true,
      baselineHeight: 844,
    }),
    { height: 370, top: 62, keyboardOpen: true },
  );
});
test("closing keyboard does not retain stale Safari offset", () => {
  assert.deepEqual(
    viewportFrame({
      height: 844,
      layoutHeight: 844,
      offsetTop: 62,
      focused: false,
      baselineHeight: 844,
    }),
    { height: 844, top: 0, keyboardOpen: false },
  );
  assert.equal(
    viewportFrame({
      height: 370,
      layoutHeight: 844,
      offsetTop: 62,
      focused: false,
      baselineHeight: 844,
    }).keyboardOpen,
    true,
  );
});
test("document lock restores original scroll and cleans viewport listeners", () => {
  const emitter = () => ({
    listeners: new Map(),
    addEventListener(k, v) {
      this.listeners.set(k, v);
    },
    removeEventListener(k) {
      this.listeners.delete(k);
    },
  });
  const style = () => ({
    setProperty(k, v) {
      this[k] = v;
    },
    removeProperty(k) {
      delete this[k];
    },
  });
  const root = { style: style(), dataset: {} };
  const body = {
    style: { position: "", top: "", left: "", width: "", overflow: "" },
  };
  const viewport = { ...emitter(), height: 844, offsetTop: 0 };
  const queue = new Map();
  let seq = 0,
    restored;
  const win = {
    ...emitter(),
    innerHeight: 844,
    innerWidth: 390,
    scrollX: 0,
    scrollY: 520,
    visualViewport: viewport,
    requestAnimationFrame(fn) {
      queue.set(++seq, fn);
      return seq;
    },
    cancelAnimationFrame(id) {
      queue.delete(id);
    },
    scrollTo(x, y) {
      restored = [x, y];
    },
  };
  const field = {
    matches: () => true,
    getBoundingClientRect: () => ({ top: 650, bottom: 700 }),
  };
  const scroller = {
    scrollTop: 0,
    getBoundingClientRect: () => ({ top: 52, bottom: 370 }),
  };
  const doc = {
    ...emitter(),
    documentElement: root,
    body,
    activeElement: null,
    getElementById(id) {
      return id === "checkout-form"
        ? { contains: (x) => x === field }
        : scroller;
    },
  };
  const tick = () => {
    for (const [id, fn] of [...queue]) {
      queue.delete(id);
      fn();
    }
  };
  const dispose = installModalViewport(win, doc);
  tick();
  tick();
  assert.equal(body.style.top, "-520px");
  doc.activeElement = field;
  viewport.height = 370;
  viewport.offsetTop = 50;
  doc.listeners.get("focusin")();
  tick();
  tick();
  assert.equal(root.dataset.inputActive, "true");
  assert.equal(root.dataset.keyboardOpen, "true");
  assert.equal(root.style["--visible-top"], "50px");
  assert.equal(scroller.scrollTop, 354);
  // Panning the visible viewport must not repeatedly force the inner scroll position.
  viewport.listeners.get("scroll")();
  tick();
  tick();
  assert.equal(scroller.scrollTop, 354);
  dispose();
  assert.deepEqual(restored, [0, 520]);
  assert.equal(body.style.position, "");
  assert.equal(viewport.listeners.size, 0);
  assert.equal(doc.listeners.size, 0);
  assert.equal(root.dataset.inputActive, undefined);
  assert.equal(queue.size, 0);
});
