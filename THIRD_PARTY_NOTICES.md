# Third-Party Notices

Markdown Viewer uses third-party open-source software. This notice summarizes
the main direct dependencies used by the application. A full dependency license
report can be generated with:

```bash
pnpm license:check
```

The generated report is written to `THIRD_PARTY_LICENSES.md`.

## Main Direct Dependencies

| Package | Purpose | License |
| --- | --- | --- |
| Electron | Desktop application runtime | MIT |
| React | Renderer UI framework | MIT |
| React DOM | React DOM renderer | MIT |
| electron-vite | Electron + Vite build tooling | MIT |
| electron-builder | Application packaging | MIT |
| Vite | Frontend build tooling | MIT |
| TypeScript | Type checking and compilation | Apache-2.0 |
| CodeMirror packages | Markdown source editor | MIT |
| Lezer highlight | CodeMirror syntax highlighting support | MIT |
| react-markdown | Markdown rendering in React | MIT |
| remark-gfm | GitHub Flavored Markdown support | MIT |
| remark-math | Markdown math parsing | MIT |
| remark-parse | Markdown parsing | MIT |
| rehype-katex | KaTeX rendering for math | MIT |
| rehype-raw | Raw HTML parsing for Markdown | MIT |
| rehype-sanitize | HTML sanitization | MIT |
| unified | Markdown/HTML processing pipeline | MIT |
| unist-util-visit | AST traversal | MIT |
| mdast-util-to-string | Markdown AST text extraction | MIT |
| github-slugger | GitHub-style heading IDs | ISC |
| highlight.js | Code block syntax highlighting | BSD-3-Clause |
| KaTeX | Math typesetting | MIT |
| Mermaid | Diagram rendering | MIT |
| lucide-react | Toolbar icons | ISC |

## Notes

- The application itself is licensed under the MIT License. See `LICENSE`.
- The table above is a convenience summary and may not include every transitive
  dependency. Generate `THIRD_PARTY_LICENSES.md` for the complete dependency
  report from the current lockfile and installed packages.
- Third-party package names, copyrights, and license texts remain the property
  of their respective owners.
