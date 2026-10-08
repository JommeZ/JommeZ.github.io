# personal-website

Jomme's personal site — About, Projects, Blog, Contact. Built with [Astro](https://astro.build),
deployed to GitHub Pages via GitHub Actions.

## Commands

| Command           | Action                                       |
| :----------------- | :-------------------------------------------- |
| `npm install`       | Install dependencies                          |
| `npm run dev`        | Start local dev server at `localhost:4321`    |
| `npm run build`      | Build production site to `./dist/`            |
| `npm run preview`    | Preview the build locally                     |
| `npx astro check`    | Type/diagnostics check                        |

Deploys automatically on push to `main` via `.github/workflows/deploy.yml`.

## Adding a new Project/demo

Projects live in `src/data/projects.ts`; each entry renders a card and a detail page at
`/projects/<slug>/`.

To add a standalone HTML/JS demo (no build step):

1. Drop the file (plus any co-located assets it needs, using relative paths) into
   `public/demos/<new-slug>/index.html`. Everything in `public/` is copied as-is into
   the built site.
2. Add one entry to `src/data/projects.ts` with the new `slug`, `title`, `description`,
   `tags`, and `demoUrl: "/demos/<new-slug>/"`.
3. That's it — no new Astro page needed. `src/pages/projects/[slug].astro` is a dynamic
   route driven by `projects.ts`, and shows an inline iframe preview (`DemoEmbed.astro`)
   plus a direct full-screen link whenever `demoUrl` is set.

If a future demo is built as an actual framework component (React/Svelte/Vue) rather
than a pre-built HTML file, use an Astro island instead: add the relevant `@astrojs/*`
integration, drop the component into `src/components/`, and render it with
`client:load` directly inside `projects/[slug].astro`.

## Adding a blog post

Add a new Markdown file to `src/content/blog/<slug>.md` with frontmatter:

```md
---
title: "Post title"
date: 2026-01-01
description: "One-line description."
draft: false
---

Post body in Markdown.
```

Set `draft: true` to keep a post out of the published list while it's unfinished.
