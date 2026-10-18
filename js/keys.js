/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "Snow TT Bros",
  cols: ["Teddy", "Tommy"],
  keys: [
    ["walk", "A D", "← →"],
    ["jump", "W", "↑"],
    ["throw snow · kick a snowball", "F", "L or Enter"],
    ["drop through a ledge", "S + W", "↓ + ↑"],
    ["call your brother · high five", "T", "T"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "1 player: ← → or A D to walk, ↑ W or Space to jump, F L or J to throw.",
  touch: "Slide on the pad, ⬆️ to jump, ❄️ to throw. The big face button calls your brother.",
});
