// 面板头部（Claude 风格）。由 layouts/claude.json 的 pane.header 使用，reveal: hover。
// 按钮在按下时执行并阻止冒泡，避免被头部的聚焦点击或终端吞掉。
import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint
    ? svg(p.icon).size(size).flex_none().text_color(color)
    : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

function button(t, id, name, tip, command, args, danger = false) {
  return div()
    .id(id)
    .size(24)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .rounded(6)
    .cursor_pointer()
    .text_color(t.dim)
    .hover((s) => s.bg(danger ? t.blocked + "1f" : t.hover).text_color(danger ? t.blocked : t.foreground))
    .tooltip(tip)
    .on_mouse_down("left", (_e, cx) => {
      cx.stop_propagation();
      run(command, args);
    })
    .on_click((_e, cx) => cx.stop_propagation())
    .child(svg(`mods/claude-pane/${name}.svg`).size(14));
}

export default class ClaudePane extends View {
  render() {
    const t = theme();
    const all = panes();
    const p = all.find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const pane = p.pane;
    const siblings = all.filter((x) => x.tab === p.tab).length;
    const name =
      ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;

    return h_flex()
      .id(`cpane-head-${pane}`)
      .size_full()
      .pl(12)
      .pr(6)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(12.5)
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", (el) =>
        el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900))
      )
      .when(st === "blocked", (el) =>
        el.child(
          div().flex_none().px(7).h(18).flex().items_center().rounded_full()
            .bg(t.blocked + "1f").text_size(10.5).font_medium().text_color(t.blocked).child("Needs input")
        )
      )
      .when(st === "done", (el) => el.child(div().size(7).flex_none().rounded_full().bg(t.done)))
      .child(
        h_flex()
          .flex_none()
          .gap(2)
          .items_center()
          .child(button(t, `cp-r-${pane}`, "split-right", "Split right", "pane.split", { direction: "right", pane }))
          .child(button(t, `cp-d-${pane}`, "split-down", "Split down", "pane.split", { direction: "down", pane }))
          .when(siblings > 1 || p.zoomed, (el) =>
            el.child(
              button(t, `cp-z-${pane}`, p.zoomed ? "unzoom" : "zoom", p.zoomed ? "Show all" : "Zoom", "pane.zoom", { pane })
            )
          )
          .child(button(t, `cp-x-${pane}`, "close", "Close", "pane.close", { pane }, true))
      );
  }
}
