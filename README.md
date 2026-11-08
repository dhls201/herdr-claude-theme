# Claude theme for Herdr

A warm, Claude-flavoured **dark + light** theme for [Herdr](https://herdr.app), plus the layout and drawer mod it was designed for. Both themes follow your system appearance automatically.

| Dark | Light |
|---|---|
| ![dark](assets/preview-dark.png) | ![light](assets/preview-light.png) |

## What's inside

| File | Goes to | What it does |
|---|---|---|
| `themes/claude-dark.json` | `~/.config/herdr-app/themes/` | terminal palette + panel colours, dark |
| `themes/claude-light.json` | `~/.config/herdr-app/themes/` | terminal palette + panel colours, light |
| `layouts/claude.json` | `~/.config/herdr-app/layouts/` | the window: no titlebar, hidden sidebar, rounded panes, theme bound to `{ light, dark }` |
| `layouts/claude.svg` | `~/.config/herdr-app/layouts/` | the layout's preview thumbnail |
| `mods/claude-drawer/` | `~/.config/herdr-app/mods/claude-drawer/` | the left rail: a Claude-style drawer of spaces and agents, collapsed to a 44px peek |

## Install

```sh
git clone https://github.com/dhls201/herdr-claude-theme.git
cd herdr-claude-theme
mkdir -p ~/.config/herdr-app/{themes,layouts,mods}
cp themes/*.json ~/.config/herdr-app/themes/
cp layouts/*     ~/.config/herdr-app/layouts/
cp -R mods/claude-drawer ~/.config/herdr-app/mods/
```

Herdr picks up theme, layout and mod files live — no restart. Then switch to the **claude** layout in the app (layout switcher, or `herdr-app do layout.switch --name claude`).

The layout binds both appearances:

```json
"theme": { "light": "claude-light", "dark": "claude-dark" }
```

so it follows macOS light/dark mode on its own. To pin one, replace it with `"theme": "claude-dark"` (or `"claude-light"`). Only the colours? Copy the two files in `themes/` and point any layout at them — the drawer is optional.

If a layout edit ever goes wrong, `ctrl-alt-shift-escape` always drops back to Herdr's default `main` layout.

### The drawer

The sidebar ships hidden (`"hidden": true` on the `sidebar` node) and the drawer floats over the left edge with `"peek": 44`: a Claude mark, then one coloured badge per space with its first letter and a status dot. Hover it and it opens to the full list — spaces, their agents and their state.

- The drawer's own toggle button (`layout.toggle` on `sidebar` + `drawer-gutter`) puts the classic sidebar back.
- It reuses icons from Herdr's bundled `workspace-chrome` mod and `icons/claude.svg` from the app itself, so it needs a normal Herdr install — nothing else to fetch.
- Space badge colours come from `shared.json` (`space.colors`) when set, otherwise from a fixed warm palette hashed by name.

### Fonts (optional)

The layout asks for **Anthropic Mono Variable** (terminals) and **Anthropic Sans Web Text** (chrome). Those are Claude's own fonts and are not redistributed here. Without them Herdr falls back to JetBrains Mono and Geist, which look fine — the colours are the point. Use the real family name: `Anthropic Sans Web` (without `Text`) silently falls back.

## Palette

Anthropic-ish cream, charcoal and clay, tuned for long sessions rather than maximum contrast.

| Role | Dark | Light |
|---|---|---|
| canvas | `#141413` | `#efe9dc` |
| surface (terminal) | `#1c1b1a` | `#faf7f0` |
| chrome (sidebar) | `#1b1a19` | `#f3eddf` |
| text | `#faf9f5` | `#2b2723` |
| muted | `#b0aea5` | `#756e65` |
| dim | `#73716a` | `#9e968a` |
| accent | `#d97757` | `#d97757` |
| border | `#2e2d29` | `#dfd7c7` |
| selection | `#3b362e` | `#e4dccb` |
| working / blocked / done | `#d97757` / `#cf4b38` / `#788c5d` | `#d97757` / `#c43628` / `#387530` |

ANSI:

| | black | red | green | yellow | blue | magenta | cyan | white |
|---|---|---|---|---|---|---|---|---|
| dark | `#141413` | `#cf4b38` | `#788c5d` | `#d97757` | `#6a9bcc` | `#9d79bc` | `#63a3a7` | `#b0aea5` |
| dark bright | `#595752` | `#de604d` | `#8ea76d` | `#e08b6e` | `#7eaede` | `#b18ecc` | `#75b7bb` | `#faf9f5` |
| light | `#2b2723` | `#c43628` | `#387530` | `#aa5517` | `#2561a0` | `#784496` | `#167480` | `#45403a` |
| light bright | `#6e675e` | `#d14535` | `#43883a` | `#bd621e` | `#3677bf` | `#8c51ad` | `#1e8491` | `#1c1917` |

## 中文速用

1. `themes/` 里两个 json → `~/.config/herdr-app/themes/`
2. `layouts/` 里 `claude.json` + `claude.svg` → `~/.config/herdr-app/layouts/`
3. `mods/claude-drawer/` 整个目录 → `~/.config/herdr-app/mods/claude-drawer/`
4. 在 Herdr 里切到 **claude** 布局，深浅色自动跟随系统
5. 侧栏默认隐藏，左边 44px 是抽屉的 peek（Claude 标 + 各 space 首字母色块），悬停展开；抽屉里的按钮能把经典侧栏切回来
6. 字体是 Claude 自带字体，没装会自动回落到 JetBrains Mono / Geist，配色不受影响

## Notes

- Unofficial. Not affiliated with Anthropic; the palette is hand-picked to feel like Claude's UI, no Anthropic assets are included.
- Built for Herdr 0.1.13 (layout cloned from the shipped `main` layout).
- Screenshots taken with `herdr-app shot` on a throwaway space; no space names or hostnames appear in them.
