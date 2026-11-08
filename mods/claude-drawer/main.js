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
  theme,
  shared,
  setAgentOrder,
  placement,
  updates,
} from "herdr";

const MARK = {
  ansi6: "#22a99a",
  ansi3: "#e3814f",
  ansi4: "#5b8def",
  ansi5: "#8b7cf6",
  ansi2: "#3fae6a",
  ansi1: "#d9649a",
};

const FALLBACK_PALETTE = [
  "#d97757",
  "#6a9bcc",
  "#788c5d",
  "#c46686",
  "#b8844a",
  "#5a9e8f",
];

function hashName(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function spaceFill(w, t) {
  const colors = shared("space.colors") ?? {};
  const color = colors[w.id];
  if (color) {
    return color.startsWith("#") ? color : MARK[color] ?? t[color] ?? t.accent;
  }
  return FALLBACK_PALETTE[hashName(w.name || "?") % FALLBACK_PALETTE.length];
}

function aggregateSpaceStatus(spaceId, agentList, focusedPane) {
  let hasDone = false;
  let hasWorking = false;
  for (const a of agentList) {
    if (a.space !== spaceId) continue;
    if (a.pane === focusedPane) continue;
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

function statusLabel(status) {
  switch (status) {
    case "working":
      return "Working";
    case "blocked":
      return "Needs you";
    case "done":
      return "Done";
    default:
      return "Idle";
  }
}

function agentProgramIcon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint
    ? svg(p.icon).size(size).flex_none().text_color(color)
    : image(p.icon).w(size).h(size).flex_none();
}

const cleanTitle = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function taskTitle(a, paneById, termById) {
  const pane = paneById.get(a.pane);
  const term = pane?.terminal ? termById.get(pane.terminal) : null;
  const raw = cleanTitle(term?.title || pane?.title || "");
  if (!raw || raw.toLowerCase() === (a.program?.name || "").toLowerCase()) {
    return a.program?.name || "Agent";
  }
  return raw;
}

function iconBtn(id, iconPath, t, onClick) {
  return div()
    .id(id)
    .size(24)
    .rounded(6)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .text_color(t.muted)
    .cursor_pointer()
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click(onClick)
    .child(svg(iconPath).size(13).text_color(t.muted));
}

function edgeRow(id, onRight, height, edgeEl, bodyEl) {
  const edgeSlot = div()
    .w(44)
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
    .justify_between()
    .gap(6)
    .pr(onRight ? 4 : 10)
    .pl(onRight ? 10 : 4)
    .child(bodyEl);

  const row = h_flex().id(id).w_full().h(height).items_center();
  return onRight ? row.child(bodySlot).child(edgeSlot) : row.child(edgeSlot).child(bodySlot);
}

export default class ClaudeDrawer extends View {
  render() {
    const t = theme();
    const place = placement();
    const onRight = place?.edge === "right";
    const spaceList = spaces();
    const rawAgents = agents();
    const paneList = panes();
    const termList = terminals();
    const focusedPane = focused();
    const updateReady = Boolean(updates().app.ready);

    const spaceOrder = new Map(spaceList.map((s, i) => [s.id, i]));
    const agentList = [...rawAgents].sort((a, b) => {
      const sa = spaceOrder.get(a.space) ?? 9999;
      const sb = spaceOrder.get(b.space) ?? 9999;
      if (sa !== sb) return sa - sb;
      return a.pane - b.pane;
    });
    setAgentOrder(agentList.map((a) => a.address));

    const paneById = new Map(paneList.map((p) => [p.id, p]));
    const termById = new Map(termList.map((tm) => [tm.id, tm]));

    const root = v_flex()
      .id("claude-drawer-root")
      .w(248)
      .py(2)
      .gap(1)
      .text_size(12.5);

    // 1. Header Row (Claude Brand + Quick Actions)
    const brandEdge = div()
      .size(26)
      .rounded(7)
      .bg(t.surface)
      .border_1()
      .border_color(t.border)
      .flex()
      .items_center()
      .justify_center()
      .child(image("icons/claude.svg").w(16).h(16));

    const brandBody = h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .child(
        div()
          .text_size(13)
          .font_semibold()
          .text_color(t.foreground)
          .child("Claude")
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
            iconBtn("drawer-new", "mods/workspace-chrome/plus.svg", t, () =>
              run("space.new")
            )
          )
          .child(
            iconBtn("drawer-sidebar", "mods/workspace-chrome/sidebar.svg", t, () => {
              run("layout.toggle", { id: "sidebar" });
              run("layout.toggle", { id: "drawer-gutter" });
            })
          )
      );

    root.child(edgeRow("drawer-header", onRight, 34, brandEdge, brandBody));
    root.child(div().h(1).w_full().bg(t.border).my(2));

    // 2. Spaces Section Header
    const spacesHeaderEdge = div()
      .text_size(9.5)
      .font_bold()
      .text_color(t.dim)
      .child("SP");

    const spacesHeaderBody = h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .child(
        h_flex()
          .gap(5)
          .items_center()
          .child(
            div()
              .text_size(11)
              .font_medium()
              .text_color(t.dim)
              .child("Spaces")
          )
          .child(
            div()
              .text_size(10.5)
              .text_color(t.dim)
              .child(String(spaceList.length))
          )
      )
      .child(
        iconBtn("drawer-add-space", "mods/workspace-chrome/plus.svg", t, () =>
          run("space.new")
        )
      );

    root.child(edgeRow("drawer-spaces-hdr", onRight, 24, spacesHeaderEdge, spacesHeaderBody));

    // Spaces Rows
    for (const w of spaceList) {
      const fill = spaceFill(w, t);
      const letter = [...(w.name || "?")][0]?.toUpperCase() ?? "?";
      const agg = aggregateSpaceStatus(w.id, agentList, focusedPane);

      const badge = div()
        .relative()
        .size(22)
        .rounded(6)
        .bg(fill)
        .flex()
        .items_center()
        .justify_center()
        .text_size(11)
        .font_bold()
        .text_color("#ffffff")
        .child(letter);

      if (agg === "blocked" || agg === "done" || agg === "working") {
        badge.child(
          div()
            .absolute()
            .top(-2)
            .right(-2)
            .size(7)
            .rounded_full()
            .bg(statusColor(agg, t))
        );
      }

      const edgeCell = div()
        .relative()
        .w_full()
        .h_full()
        .flex()
        .items_center()
        .justify_center()
        .when(w.active, (d) =>
          d.child(
            div()
              .absolute()
              .when(onRight, (bar) => bar.right(0))
              .when(!onRight, (bar) => bar.left(0))
              .top(6)
              .bottom(6)
              .w(3)
              .rounded(2)
              .bg(t.accent)
          )
        )
        .child(badge);

      const bodyCell = h_flex()
        .w_full()
        .min_w(0)
        .items_center()
        .justify_between()
        .gap(6)
        .child(
          div()
            .flex_1()
            .min_w(0)
            .truncate()
            .text_size(12.5)
            .when(w.active, (el) => el.font_semibold().text_color(t.foreground))
            .when(!w.active, (el) => el.text_color(t.muted))
            .child(w.name)
        );

      root.child(
        edgeRow(`drawer-space-${w.id}`, onRight, 32, edgeCell, bodyCell)
          .cursor_pointer()
          .rounded(6)
          .when(w.active, (r) => r.bg(t.selected))
          .when(!w.active, (r) => r.hover((s) => s.bg(t.hover)))
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
          )
      );
    }

    root.child(div().h(1).w_full().bg(t.border).my(2));

    // 3. Agents Section Header
    const activeAgents = agentList.filter(
      (a) => a.status === "working" || a.status === "blocked"
    ).length;

    const agentsHeaderEdge = div()
      .text_size(9.5)
      .font_bold()
      .text_color(activeAgents > 0 ? t.accent : t.dim)
      .child("AG");

    const agentsHeaderBody = h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .child(
        h_flex()
          .gap(5)
          .items_center()
          .child(
            div()
              .text_size(11)
              .font_medium()
              .text_color(t.dim)
              .child("Agents")
          )
          .child(
            div()
              .text_size(10.5)
              .text_color(t.dim)
              .child(
                activeAgents > 0
                  ? `${activeAgents}/${agentList.length}`
                  : String(agentList.length)
              )
          )
      );

    root.child(edgeRow("drawer-agents-hdr", onRight, 24, agentsHeaderEdge, agentsHeaderBody));

    if (agentList.length === 0) {
      const emptyEdge = div().size(6).rounded_full().bg(t.border);
      const emptyBody = div()
        .text_size(11.5)
        .text_color(t.dim)
        .child("No active agents");
      root.child(edgeRow("drawer-agents-empty", onRight, 28, emptyEdge, emptyBody));
    } else {
      for (const a of agentList) {
        const isFocused = a.pane === focusedPane;
        const sc = statusColor(a.status, t);
        const title = taskTitle(a, paneById, termById);
        const pic = agentProgramIcon(a.program, 14, isFocused ? t.foreground : t.muted);

        const iconBadge = div()
          .relative()
          .size(24)
          .rounded(6)
          .bg(t.surface)
          .border_1()
          .border_color(isFocused ? t.accent : t.border)
          .flex()
          .items_center()
          .justify_center()
          .child(pic ?? div().size(8).rounded_full().bg(sc))
          .child(
            a.status === "working"
              ? div()
                  .absolute()
                  .bottom(-2)
                  .right(-2)
                  .size(10)
                  .rounded_full()
                  .bg(t.background)
                  .flex()
                  .items_center()
                  .justify_center()
                  .child(
                    svg("mods/workspace-chrome/spinner.svg")
                      .size(8)
                      .text_color(sc)
                      .spin(900)
                  )
              : div()
                  .absolute()
                  .bottom(-2)
                  .right(-2)
                  .size(7)
                  .rounded_full()
                  .bg(sc)
          );

        const agentBody = v_flex()
          .flex_1()
          .min_w(0)
          .gap(1)
          .child(
            h_flex()
              .w_full()
              .min_w(0)
              .items_center()
              .justify_between()
              .gap(4)
              .child(
                div()
                  .truncate()
                  .text_size(11.5)
                  .when(isFocused, (el) => el.font_semibold().text_color(t.foreground))
                  .when(!isFocused, (el) => el.font_medium().text_color(t.muted))
                  .child(a.space_name || "Space")
              )
              .child(
                div()
                  .flex_none()
                  .text_size(10)
                  .text_color(sc)
                  .child(statusLabel(a.status))
              )
          )
          .child(
            div()
              .w_full()
              .truncate()
              .text_size(10.5)
              .text_color(t.dim)
              .child(title)
          );

        root.child(
          edgeRow(`drawer-agent-${a.pane}`, onRight, 36, iconBadge, agentBody)
            .cursor_pointer()
            .rounded(6)
            .when(isFocused, (r) => r.bg(t.selected))
            .when(!isFocused, (r) => r.hover((s) => s.bg(t.hover)))
            .on_click(() => run("pane.focus", { pane: a.pane }))
        );
      }
    }

    root.child(div().h(1).w_full().bg(t.border).my(2));

    // 4. Footer Row (Settings + Toggle Fixed Sidebar Hint)
    const footerEdge = div()
      .relative()
      .size(24)
      .rounded(6)
      .flex()
      .items_center()
      .justify_center()
      .child(
        svg("mods/workspace-chrome/settings.svg")
          .size(14)
          .text_color(t.muted)
      )
      .when(updateReady, (d) =>
        d.child(
          div()
            .absolute()
            .top(2)
            .right(2)
            .size(6)
            .rounded_full()
            .bg(t.accent)
        )
      );

    const footerBody = h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .child(
        div()
          .text_size(12)
          .text_color(t.muted)
          .child(updateReady ? "Settings · Update" : "Settings")
      )
      .child(
        div()
          .px(5)
          .py(1)
          .rounded(4)
          .bg(t.surface)
          .text_size(10)
          .text_color(t.dim)
          .child("⌃⇧B")
      );

    root.child(
      edgeRow("drawer-footer", onRight, 30, footerEdge, footerBody)
        .cursor_pointer()
        .rounded(6)
        .hover((s) => s.bg(t.hover))
        .on_click(() => run("app.settings"))
    );

    return root;
  }
}
