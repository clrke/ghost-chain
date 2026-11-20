# Ghost Chain (prototype)

**Play:** https://clrke.github.io/ghost-chain/

A prototype of a daily co-op game idea for Reddit's Game of the Day Hackathon:
**a level nobody can finish alone.**

- Standing on a **plate** opens its **gate**, but only while someone stands there.
- Every run is recorded (one input per tick at 60 ticks/s) and saved as a **ghost** that replays it exactly.
- Each player is helped by the ghosts of earlier players, and becomes a ghost for the next one.

Four levels (one per day, or pick with < >): Two Gates, Both Hands (a gate needing two plates at once), Relay of Four, and Both Sides.

Two modes:
- **Join today's chain:** two pre-recorded "strangers" (u/ana, u/ben) hold the gates; you're link #3.
- **Build a chain yourself:** play link 1, 2 and 3 in turn, helped by your own ghosts.

Controls: drag your finger (or the mouse) where you want to go, or use the arrow keys / WASD.

Plain HTML and JavaScript, no build step, no external requests. Ghosts live only in the open tab.
In the real game they would be stored per subreddit on Reddit's Developer Platform (Devvit).

## License
MIT
