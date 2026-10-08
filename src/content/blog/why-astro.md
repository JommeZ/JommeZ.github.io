---
title: "Why I built my site with Astro"
date: 2026-10-07
description: "Notes on picking Astro for a personal site that mixes writing and interactive demos."
---

I wanted a personal site that could do three things at once: hold a short bio, let me
write occasionally, and make it trivial to drop in interactive demos — including
things I build together with Claude.

Astro's islands architecture and its "just copy this into `public/`" approach to
static assets made that last part easy. Static pages stay fast and simple, but
dropping in an iframe'd demo or a hydrated component when I need one doesn't require
rearchitecting anything.

More posts to come.
