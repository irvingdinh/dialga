# CLAUDE.md

## Rules of Work

- Always load these skills, no matter what you're doing:
  - [frontend-design](.claude/skills/frontend-design)
  - [playwright-cli](.claude/skills/playwright-cli)
  - [vercel-react-best-practices](.claude/skills/vercel-react-best-practices)
  - [web-design-guidelines](.claude/skills/web-design-guidelines)
- Always read the Makefile, no matter what you're doing, to understand what scripts are available, use those as your starting point.
- Always lint your implementation with `make lint`.
- Always test your implementation with `playwright-cli`. All assets, including snapshots, screenshots, and downloads, must be placed inside the gitignored `.playwright-cli` folder, never commit the playwright-cli assets.
