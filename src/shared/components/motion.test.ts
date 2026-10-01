import { describe, expect, it } from "vitest";

import { ENTER, FADE_IN, MODAL_BACKDROP, MODAL_CARD, staggerDelay } from "./motion";

describe("motion", () => {
  it.each(Object.entries({ ENTER, FADE_IN, MODAL_BACKDROP, MODAL_CARD }))(
    "%s solo anima con motion-safe",
    (_, classes) => {
      const animated = classes
        .split(" ")
        .filter((c) => /animate-in|fade-in|slide-in|zoom-in/.test(c));
      expect(animated.length).toBeGreaterThan(0);
      for (const c of animated) expect(c.startsWith("motion-safe:"), c).toBe(true);
    },
  );

  it("la cascada va de 40 en 40 ms y se detiene en el octavo", () => {
    expect(staggerDelay(0)).toEqual({ animationDelay: "0ms" });
    expect(staggerDelay(1)).toEqual({ animationDelay: "40ms" });
    expect(staggerDelay(8)).toEqual({ animationDelay: "320ms" });
    expect(staggerDelay(30)).toEqual({ animationDelay: "320ms" });
  });
});
