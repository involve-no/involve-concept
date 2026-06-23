# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## 🗄️ Sanity CMS Integration

We have integrated Sanity CMS via the `@sanity/astro` package to serve as our content backend, replacing the legacy WordPress database.

### Schema Replacement: WordPress vs. Sanity
Instead of managing case study content inside the heavy WordPress relational MySQL database (which is tightly coupled to PHP and bloated page builder plugins), we define content schemas programmatically.

The schema in [sanity/schema.js](file:///e:/Google%20Antigravity/Involve%20new%20site/involve-concept/sanity/schema.js) maps WordPress custom posts to a clean, JSON-based document system:
- **Relational Tables ➔ Structured Documents**: WordPress `wp_posts` and `wp_postmeta` are replaced by a single, clean `caseStudy` document type.
- **Title & Client Fields**: Explicitly defined string fields with validation.
- **WP Media Library ➔ Cover Image**: Replaced by Sanity’s optimized CDN-backed `image` field with hotspot support.
- **TinyMCE/Gutenberg ➔ Portable Text (Body)**: The rich text content is structured as a Portable Text array, which avoids raw HTML injection and allows front-ends to render components dynamically and safely.

This headless CMS architecture ensures fast page builds, structured content APIs, and removes database-level maintenance overhead.

