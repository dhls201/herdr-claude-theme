import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import {
  spaces,
  agents,
  panes,
  terminals,
  focused,
  run,
  openOverlay,
  closeOverlay,
  shared,
  setShared,
  theme,
  setAgentOrder,
  placement,
  updates,
  layout,
  props,
  machines,
  hc,
  window as appWindow,
} from "herdr";

const FOLD_KEY = "machines.folded";

function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

const FADE_MS = 170;
const OPEN_MS = 240;
const CLOSE_MS = 200;
const GHOST_DELAY = 70; // 收起：等背后布局切换完再开始收回
const SIDEBAR_W = 268;
const INSTANT = "claude-drawer.instant"; // 浮层动画刚结束：固定侧栏直接出现，不再淡入

function aggregateSpaceStatus(spaceId, agentList, focusedPaneId) {
  let hasDone = false;
  let hasWorking = false;
  for (const a of agentList) {
    if (a.space !== spaceId) continue;
    if (a.focused || (focusedPaneId && a.pane === focusedPaneId)) continue;
    if (a.status === "blocked") return "blocked";
    if (a.status === "working") hasWorking = true;
    if (a.status === "done") hasDone = true;
  }
  if (hasWorking) return "working";
  if (hasDone) return "done";
  return null;
}

function statusColor(status, t) {
  switch (status) {
    case "working":
      return t.working ?? t.accent;
    case "blocked":
      return t.blocked ?? t.ansi3;
    case "done":
      return t.done ?? t.ansi2;
    default:
      return t.dim;
  }
}

const CLAUDE_ICON = "mods/claude-drawer/claude-code.svg";

function agentProgramIcon(p, size, color) {
  if (!p?.icon) return null;
  if (/(^|\/)claude\.svg$/.test(p.icon)) return image(CLAUDE_ICON).w(size).h(size).flex_none();
  return p.tint
    ? svg(p.icon).size(size).flex_none().text_color(color)
    : image(p.icon).w(size).h(size).flex_none();
}

const cleanTitle = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function taskDetail(a, paneById, termById) {
  const pane = paneById.get(a.pane);
  const term =
    termById.get(a.address) ?? (pane?.terminal ? termById.get(pane.terminal) : null);
  const raw = cleanTitle(a.title || term?.title || pane?.title || "");
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (
    lower === (a.program?.name || "").toLowerCase() ||
    lower === (a.program?.key || "").toLowerCase() ||
    lower === (a.space_name || "").toLowerCase() ||
    lower === (a.address || "").toLowerCase() ||
    /^t[0-9a-z]+$/i.test(raw) ||
    /^\d+$/.test(raw) ||
    /^[~/]/.test(raw)
  ) {
    return null;
  }
  return raw;
}

const EDGE = 44;
const ROW = 30;
const TILE = 26;

function iconBtn(id, iconPath, t, onClick) {
  return div()
    .id(id)
    .size(24)
    .rounded(7)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click(onClick)
    .child(svg(iconPath).size(14).text_color(t.dim));
}

// 一行：边缘格（收起时可见）+ 正文（展开后可见）。悬停只变底色，不改布局。
// 展开时选中项整行铺浅暖底；收起时只高亮图标格。
function row(id, onRight, height, edgeEl, bodyEl, t, interactive = true, selected = false, expanded = false) {
  const edgeSlot = div()
    .w(EDGE - 8)
    .h_full()
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .child(edgeEl);
  const bodySlot = h_flex()
    .flex_1()
    .min_w(0)
    .h_full()
    .items_center()
    .gap(6)
    .when(onRight, (s) => s.pl(10).pr(14))
    .when(!onRight, (s) => s.pl(14).pr(10))
    .child(bodyEl);
  let r = h_flex()
    .id(id)
    .h(height)
    .flex_none()
    .items_center()
    .rounded(8)
    .when(onRight, (s) => s.ml(6).mr(4))
    .when(!onRight, (s) => s.ml(4).mr(6))
    .when(selected && expanded, (s) => s.bg(t.selected));
  if (interactive) {
    r = r.cursor_pointer().hover((s) => s.bg(selected && expanded ? t.selected : t.hover));
  }
  return onRight ? r.child(bodySlot).child(edgeSlot) : r.child(edgeSlot).child(bodySlot);
}

// 图标格：无边框，选中时浅暖底
function tile(content, active, t) {
  return div()
    .relative()
    .size(TILE)
    .rounded(8)
    .flex()
    .items_center()
    .justify_center()
    .when(active, (d) => d.bg(t.selected))
    .child(content);
}

function statusDot(status, t, size = 7) {
  return div()
    .absolute()
    .top(-1)
    .right(-1)
    .size(size + 3)
    .rounded_full()
    .bg(t.background)
    .flex()
    .items_center()
    .justify_center()
    .child(div().size(size).rounded_full().bg(statusColor(status, t)));
}

// 分组标题：收起时是一条短细线，展开后是小号灰字 + 数量
function sectionLabel(id, label, count, onRight, t) {
  const edge = div().w(14).h(1).bg(t.border);
  const body = h_flex()
    .w_full()
    .items_center()
    .justify_between()
    .child(div().text_size(11.5).font_medium().text_color(t.dim).child(label))
    .when(count != null, (s) =>
      s.child(div().text_size(10.5).text_color(t.dim).child(String(count)))
    );
  return row(id, onRight, 24, edge, body, t, false).mt(6);
}

export default class ClaudeDrawer extends View {
  init(_props, cx) {
    this.wasVisible = false;
    this.shown = false; // 进场动画目标
    this.leaving = false; // 退场动画中
    this.syncing = false;
    // 机器分组：折叠状态持久化；连接状态每 15s 用 hc 问一次（浮层动画副本不问）
    this.folded = new Set(JSON.parse(localStorage.getItem(FOLD_KEY) ?? "[]"));
    this.hosts = [];
    if (!props()?.ghost && cx?.timer) {
      cx.timer.after(10, (cx) => this.refreshHosts(cx));
      cx.timer.every(15000, (cx) => this.refreshHosts(cx));
    }
  }

  async refreshHosts(cx) {
    try {
      const r = await hc(["machine", "ls", "--json"]);
      if (r.code === 0) {
        this.hosts = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary);
        cx.notify();
      }
    } catch {}
  }

  // scope: "sp"（Spaces，旧的折叠键不变）或 "ag"（Agents，独立折叠）
  foldKey(m, scope = "sp") {
    return scope === "sp" ? (m ?? "") : `${scope}:${m ?? ""}`;
  }

  toggleFold(m, cx, scope = "sp") {
    const key = this.foldKey(m, scope);
    this.folded.has(key) ? this.folded.delete(key) : this.folded.add(key);
    localStorage.setItem(FOLD_KEY, JSON.stringify([...this.folded]));
    cx.notify();
  }

  // 机器分组标题：收起时是 显示器/服务器 图标 + 连接圆点；展开后是 名称 · 数量 · + · 折叠箭头
  machineHeader(m, count, onRight, t, scope = "sp", urgent = null) {
    const host = this.hosts.find((h) => h.name === m);
    const layoutState = machines().find((k) => k.name === m)?.layout;
    const connected = !m || host?.state === "connected" || (!host && layoutState === "ready");
    const state = connected ? "connected" : (host?.state ?? layoutState ?? "asleep").replace(/_/g, " ");
    const folded = this.folded.has(this.foldKey(m, scope));
    const label = m ?? "This computer";
    const canAdd = connected && scope === "sp";

    const edge = tile(
      svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(14).text_color(t.dim),
      false,
      t
    ).child(
      div()
        .absolute()
        .bottom(2)
        .right(2)
        .size(7)
        .rounded_full()
        .border_1()
        .border_color(t.background)
        .bg(connected ? t.done ?? t.ansi2 : t.dim)
    );
    // 折叠的 Agents 组里有需要关注的：收起态也能看到
    if (folded && urgent) edge.child(statusDot(urgent, t, 6));

    const body = h_flex()
      .w_full()
      .min_w(0)
      .items_center()
      .gap(6)
      .text_size(11.5)
      .text_color(t.dim)
      .child(div().flex_1().min_w(0).truncate().font_medium().child(label))
      .when(!connected, (s) => s.child(div().flex_none().text_size(10.5).child(state)))
      .when(folded && Boolean(urgent), (s) =>
        s.child(div().flex_none().size(6).rounded_full().bg(statusColor(urgent, t)))
      )
      .when(folded, (s) => s.child(div().flex_none().text_size(10.5).child(String(count))))
      .when(canAdd, (s) =>
        s.child(
          div()
            .id(`drawer-machine-add-${m ?? "local"}`)
            .size(18)
            .flex_none()
            .rounded(5)
            .flex()
            .items_center()
            .justify_center()
            .hover((h) => h.bg(t.hover))
            .tooltip(`New space on ${label}`)
            .on_click((_e, cx) => {
              cx.stop_propagation();
              run("space.new", { machine: m ?? "" });
            })
            .child(svg("mods/workspace-chrome/plus.svg").size(11).text_color(t.dim))
        )
      )
      .child(
        svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`)
          .size(11)
          .flex_none()
          .text_color(t.dim)
      );

    return row(`drawer-${scope}-machine-${m ?? "local"}`, onRight, 26, edge, body, t)
      .mt(4)
      .tooltip(`${label} · ${state}`)
      .on_click((_e, cx) => this.toggleFold(m, cx, scope));
  }

  // 动画放在一个透明浮层里由 GPUI 原生绘制（帧率跟屏幕一致），布局只在开头或结尾切一次，
  // 终端只重排一次，避免逐帧改宽度造成的卡顿。
  openGhost(mode) {
    return openOverlay({
      mod: "claude-drawer",
      kind: "window",
      frame: "none",
      at: { x: 0, y: 0 },
      width: SIDEBAR_W + 1,
      height: 1,
      props: { pinned: true, ghost: mode },
    });
  }

  switchMode(pin, cx) {
    if (this.leaving) return;
    this.leaving = true;
    if (pin) {
      cx.notify(); // 悬浮抽屉先淡出
      cx.timer.after(FADE_MS - 60, (cx) => {
        const ghost = this.openGhost("open");
        cx.timer.after(OPEN_MS + 40, (cx) => {
          setShared(INSTANT, true);
          run("layout.hide", { id: "drawer-gutter" });
          run("layout.show", { id: "sidebar" });
          cx.timer.after(90, (cx) => {
            closeOverlay(ghost);
            this.leaving = false;
            cx.notify();
          });
        });
      });
    } else {
      // 先用一模一样的浮层盖住，背后切换布局，再让浮层收回
      const ghost = this.openGhost("close");
      cx.timer.after(50, (cx) => {
        run("layout.hide", { id: "sidebar" });
        run("layout.show", { id: "drawer-gutter" });
        cx.timer.after(GHOST_DELAY + CLOSE_MS + 40, (cx) => {
          closeOverlay(ghost);
          this.leaving = false;
          cx.notify();
        });
      });
    }
  }

  render(cx) {
    const pinned = Boolean(props()?.pinned);
    const ghost = props()?.ghost ?? null; // "open" | "close"：浮层里的动画副本
    const tree = layout();
    const sidebarShown = !findNode(tree, "sidebar")?.hidden;
    const gutterShown = !findNode(tree, "drawer-gutter")?.hidden;

    // 悬浮那份负责让左侧留白栏与固定侧栏保持互斥（cmd-b 等切换也能对齐）
    if (!pinned && !ghost && !this.leaving && !this.syncing && sidebarShown === gutterShown) {
      this.syncing = true;
      cx.timer.after(0, (cx) => {
        run(sidebarShown ? "layout.hide" : "layout.show", { id: "drawer-gutter" });
        this.syncing = false;
        cx.notify();
      });
    }

    // 任何时候只显示一个：固定侧栏在时，悬浮抽屉什么都不画（浮动块随之隐藏）
    const visible = ghost ? true : pinned ? sidebarShown : !sidebarShown;
    if (!visible) {
      this.wasVisible = false;
      this.shown = false;
      return div();
    }
    if (!this.wasVisible) {
      this.wasVisible = true;
      if (pinned && !ghost && shared(INSTANT)) {
        // 浮层刚演完展开：真侧栏原样接上，不重复淡入
        this.shown = true;
        cx.timer.after(60, () => setShared(INSTANT, false));
      } else {
        this.shown = false;
        cx.timer.after(16, (cx) => {
          this.shown = true;
          cx.notify();
        });
      }
    }
    // 固定侧栏收起时由浮层盖住演动画，自身不淡出
    const on = ghost === "close" || (this.shown && !(this.leaving && !pinned));

    const t = theme();
    const place = placement();
    const onRight = place?.edge === "right";
    const spaceList = spaces();
    const rawAgents = agents();
    const paneList = panes();
    const termList = terminals();
    const foc = focused();
    const focusedPane = foc?.pane ?? null;
    const updateReady = Boolean(updates().app.ready);
    // 未浮动（固定在栏里）或鼠标悬停时视为展开
    const expanded = !place || Boolean(place.hovered);

    const spaceOrder = new Map(spaceList.map((s, i) => [s.id, i]));
    const agentList = [...rawAgents].sort((a, b) => {
      const sa = spaceOrder.get(a.space) ?? 9999;
      const sb = spaceOrder.get(b.space) ?? 9999;
      if (sa !== sb) return sa - sb;
      return String(a.pane).localeCompare(String(b.pane));
    });
    setAgentOrder(agentList.map((a) => a.address));

    const paneById = new Map(paneList.map((p) => [p.pane, p]));
    const termById = new Map(termList.map((tm) => [tm.address, tm]));

    const win = appWindow();
    const topPad = pinned && win?.platform === "macos" && !win?.fullscreen ? 34 : pinned ? 8 : 4;
    const slide = onRight ? 10 : -10;
    const root = v_flex()
      .id("claude-drawer-root")
      .when(pinned, (r) => r.w(SIDEBAR_W).h_full().flex_none().overflow_y_scrollbar())
      .when(!pinned, (r) => r.w(268))
      .relative()
      .pt(topPad)
      .pb(4)
      .text_size(13)
      .opacity(on ? 1 : 0)
      .left(on ? 0 : slide)
      .transition("opacity", { duration: FADE_MS, easing: "ease-out" })
      .transition("left", { duration: FADE_MS + 40, easing: "ease-out" });

    // 1. 顶部：品牌 + 快捷按钮
    const brandEdge = tile(image("frame/welcome/herdr.png").size(20).rounded(5), false, t);
    const brandBody = h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .child(
        div()
          .font_family("Anthropic Serif Web")
          .text_size(18)
          .text_color(t.foreground)
          .child("Herdr")
      )
      .child(
        h_flex()
          .gap(2)
          .items_center()
          .child(
            iconBtn("drawer-search", "mods/workspace-chrome/search.svg", t, () =>
              run("mod.open", { name: "picker" })
            )
          )
          .child(
            iconBtn(
              "drawer-sidebar",
              pinned ? "mods/workspace-chrome/panel-left.svg" : "mods/workspace-chrome/sidebar.svg",
              t,
              (_e, cx) => this.switchMode(!pinned, cx)
            ).tooltip(pinned ? "Float sidebar" : "Pin sidebar")
          )
      );
    root.child(row("drawer-header", onRight, 38, brandEdge, brandBody, t, false));

    // 新建空间：Claude 式「New chat」入口
    const newEdge = div()
      .size(TILE)
      .rounded(8)
      .bg(t.accent)
      .flex()
      .items_center()
      .justify_center()
      .child(svg("mods/workspace-chrome/plus.svg").size(14).text_color(t.accent_foreground));
    const newBody = div().text_size(13).text_color(t.foreground).child("New space");
    root.child(
      row("drawer-new", onRight, ROW + 4, newEdge, newBody, t).on_click(() => run("space.new"))
    );

    // 2. Spaces（有远程机器时按机器分组）
    root.child(sectionLabel("drawer-spaces-label", "Spaces", spaceList.length, onRight, t));
    const drawSpace = (w) => {
      const first = [...(w.name || "")][0] ?? "";
      const letter = /[\p{L}\p{N}]/u.test(first) ? first.toUpperCase() : null;
      const agg = aggregateSpaceStatus(w.id, agentList, focusedPane);
      const letterEl = letter
        ? div()
            .text_size(12)
            .when(w.active, (el) => el.text_color(t.foreground).font_semibold())
            .when(!w.active, (el) => el.text_color(t.muted))
            .child(letter)
        : svg("mods/workspace-chrome/folder.svg")
            .size(14)
            .text_color(w.active ? t.foreground : t.muted);
      const edge = tile(letterEl, w.active && !expanded, t);
      if (agg) edge.child(statusDot(agg, t, 6));

      const body = div()
        .flex_1()
        .min_w(0)
        .truncate()
        .text_size(13)
        .when(w.active, (el) => el.text_color(t.foreground).font_medium())
        .when(!w.active, (el) => el.text_color(t.muted))
        .child(w.name === "~" ? "Home" : w.name);

      return row(`drawer-space-${w.id}`, onRight, ROW, edge, body, t, true, w.active, expanded)
        .on_click(() => run("space.select", { id: w.id }))
        .on_mouse_down("right", (ev) =>
          openOverlay({
            mod: "menu",
            kind: "popup",
            width: 200,
            height: 260,
            anchor: ev.mouse,
            props: { tab: "space", target: { id: w.id } },
          })
        );
    };

    const remote = [
      ...new Set([
        ...spaceList.map((s) => s.machine).filter(Boolean),
        ...this.hosts.map((h) => h.name),
      ]),
    ].sort();
    if (!remote.length) {
      for (const w of spaceList) root.child(drawSpace(w));
    } else {
      for (const m of [null, ...remote]) {
        const mine = spaceList.filter((s) => (s.machine ?? null) === m);
        root.child(this.machineHeader(m, mine.length, onRight, t));
        if (this.folded.has(m ?? "")) continue;
        for (const w of mine) root.child(drawSpace(w));
      }
    }

    // 3. Agents
    root.child(sectionLabel("drawer-agents-label", "Agents", agentList.length, onRight, t));
    if (agentList.length === 0) {
      root.child(
        row(
          "drawer-agents-empty",
          onRight,
          ROW,
          div().size(5).rounded_full().bg(t.border),
          div().text_size(12).text_color(t.dim).child("No active agents"),
          t,
          false
        )
      );
    } else {
      const drawAgent = (a) => {
        const isFocused = Boolean(
          a.focused ||
            (foc &&
              (a.pane === foc.pane ||
                a.address === foc.terminal ||
                a.address === foc.agent))
        );
        const sc = statusColor(a.status, t);
        const detail = taskDetail(a, paneById, termById);
        const pic = agentProgramIcon(a.program, 15, isFocused ? t.foreground : t.muted);

        const edge = tile(pic ?? div().size(7).rounded_full().bg(sc), isFocused && !expanded, t)
          .when(!isFocused, (d) => d.opacity(0.9));
        if (a.status === "working") {
          edge.child(
            div()
              .absolute()
              .bottom(-2)
              .right(-2)
              .size(10)
              .rounded_full()
              .bg(t.background)
              .flex()
              .items_center()
              .justify_center()
              .child(svg("mods/workspace-chrome/spinner.svg").size(8).text_color(sc).spin(900))
          );
        } else if (a.status === "blocked" || a.status === "done") {
          edge.child(statusDot(a.status, t, 6));
        }

        const spaceName = a.space_name === "~" ? "Home" : a.space_name || "Space";
        const title = detail || a.program?.name || "Terminal";
        const body = h_flex()
          .w_full()
          .min_w(0)
          .items_center()
          .gap(6)
          .child(
            div()
              .flex_1()
              .min_w(0)
              .truncate()
              .text_size(13)
              .when(isFocused, (el) => el.text_color(t.foreground).font_medium())
              .when(!isFocused, (el) => el.text_color(t.muted))
              .child(title)
          )
          .child(
            a.status === "blocked"
              ? div()
                  .flex_none()
                  .px(7)
                  .h(18)
                  .flex()
                  .items_center()
                  .rounded_full()
                  .bg(sc + "1f")
                  .text_size(10.5)
                  .font_medium()
                  .text_color(sc)
                  .child("Needs input")
              : div()
                  .flex_none()
                  .max_w(90)
                  .truncate()
                  .text_size(11.5)
                  .text_color(a.status === "working" ? sc : t.dim)
                  .child(a.status === "working" ? "Working" : spaceName)
          );

        return row(`drawer-agent-${a.address}`, onRight, ROW, edge, body, t, true, isFocused, expanded).on_click(() =>
          run("pane.focus", { pane: a.pane })
        );
      };

      // 有远程机器时按机器分组（只列出有 agent 的机器）；机器取自所属 space，其次取地址前缀
      const spaceMachine = new Map(spaceList.map((s) => [s.id, s.machine ?? null]));
      const machineOf = (a) =>
        spaceMachine.get(a.space) ?? (a.address.includes("/") ? a.address.split("/")[0] : null);
      const RANK = { blocked: 3, done: 2, working: 1 };
      if (!remote.length) {
        for (const a of agentList) root.child(drawAgent(a));
      } else {
        for (const m of [null, ...remote]) {
          const mine = agentList.filter((a) => machineOf(a) === m);
          if (!mine.length) continue;
          const urgent = mine.reduce(
            (top, a) => ((RANK[a.status] ?? 0) > (RANK[top] ?? 0) ? a.status : top),
            null
          );
          root.child(this.machineHeader(m, mine.length, onRight, t, "ag", urgent));
          if (this.folded.has(this.foldKey(m, "ag"))) continue;
          for (const a of mine) root.child(drawAgent(a));
        }
      }
    }

    // 4. 底部：设置
    root.child(div().h(6));
    root.child(div().mx(10).h(1).bg(t.border));
    const footerEdge = tile(
      svg("mods/workspace-chrome/settings.svg").size(15).text_color(t.dim),
      false,
      t
    ).when(updateReady, (d) =>
      d.child(div().absolute().top(2).right(2).size(6).rounded_full().bg(t.accent))
    );
    const footerBody = h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .child(
        div()
          .text_size(13)
          .text_color(t.muted)
          .child(updateReady ? "Settings · Update ready" : "Settings")
      )
      .child(div().text_size(11).text_color(t.dim).child("⌃⇧B"));
    root.child(
      row("drawer-footer", onRight, ROW + 4, footerEdge, footerBody, t)
        .mt(4)
        .on_click(() => run("app.settings"))
    );

    if (ghost) {
      // 浮层：面板宽度原生过渡，内容固定宽度被裁切，像抽屉被拉出 / 推回
      const open = ghost === "open";
      const width = open ? (this.shown ? SIDEBAR_W : 0) : this.shown ? 0 : SIDEBAR_W;
      return h_flex()
        .id("claude-drawer-ghost")
        .size_full()
        .child(
          div()
            .id("claude-drawer-ghost-panel")
            .h_full()
            .flex_none()
            .w(width)
            .overflow_hidden()
            .bg(t.chrome)
            .border_r(1)
            .border_color(t.border)
            .transition(
              "width",
              open
                ? { duration: OPEN_MS, easing: "ease-out" }
                : { duration: CLOSE_MS, delay: GHOST_DELAY, easing: "ease-in-out" }
            )
            .child(root)
        );
    }
    if (pinned) {
      return div().id("claude-drawer-clip").size_full().overflow_hidden().child(root);
    }
    return root;
  }
}
