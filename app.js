(function () {
  "use strict";
  var COLORS = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  var NS = "http://www.w3.org/2000/svg";
  var hidden = {};
  var sortKey = "pnl", sortAsc = false;

  // ---------- helpers ----------
  var usd = function (x, sign) {
    if (x == null || isNaN(x)) return "–";
    var s = Math.abs(x).toLocaleString("en-US", { style: "currency", currency: "USD" });
    return (x < 0 ? "−" : sign && x > 0 ? "+" : "") + s;
  };
  var pct = function (x) { return x == null ? "–" : Math.round(x * 100) + "%"; };
  var num = function (x) { return x == null ? "–" : String(x); };
  var cls = function (x) { return x > 0 ? "pos" : x < 0 ? "neg" : ""; };
  var el = function (tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  var svgEl = function (parent, tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  var setColor = function (e, c) { e.style.setProperty("--c", c); return e; };  // CSSOM is allowed by the CSP
  var clear = function (id) { var e = document.getElementById(id); e.textContent = ""; return e; };
  var fmtTime = function (t) {
    return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  var fmtDay = function (d) {
    return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  };
  var niceTicks = function (lo, hi, n) {
    var step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n)));
    [1, 2, 2.5, 5, 10].some(function (m) { if ((hi - lo) / (step * m) <= n) { step *= m; return true; } return false; });
    var out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < 1e-9 ? 0 : v);
    return out;
  };
  var axisUsd = function (v) {
    var a = Math.abs(v);
    var s = a >= 1000 ? "$" + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + "k" : "$" + (a < 10 && a % 1 ? a.toFixed(1) : Math.round(a));
    return (v < 0 ? "−" : "") + s;
  };
  var maxDrawdown = function (values) {
    var peak = 0, dd = 0;
    values.forEach(function (v) { if (v == null) return; peak = Math.max(peak, v); dd = Math.min(dd, v - peak); });
    return dd;
  };

  // ---------- tooltip ----------
  var tip = document.getElementById("tip");
  function showTip(evt, title, lines) {
    tip.textContent = "";
    tip.appendChild(el("div", { "class": "t" }, title));
    lines.forEach(function (l) {
      var row = el("div", { "class": "l" });
      var name = el("span", null, l[0]);
      if (l[2]) setColor(name, l[2]); else name.className = "nodot";
      row.appendChild(name);
      row.appendChild(el("span", { "class": cls(l[1]) }, usd(l[1], true)));
      tip.appendChild(row);
    });
    tip.hidden = false;
    var x = evt.clientX + 14, y = evt.clientY + 14, r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.hidden = true; }

  // ---------- charts ----------
  // series: [{label, color, values (aligned to ts), area}]
  function lineChart(box, ts, series, o) {
    o = o || {};
    var W = Math.max(320, box.clientWidth || 1000), H = o.height || 300, L = 52, R = 10, T = 10, B = o.xAxis === false ? 8 : 26;
    if (W < 600) H = Math.round(H * 0.8);
    var xt = W < 480 ? 1 : W < 800 ? 2 : 4;
    if (ts.length < 2) { box.appendChild(el("p", { "class": "empty" }, "The chart fills in as hourly updates arrive.")); return; }
    var t0 = ts[0], t1 = ts[ts.length - 1];
    var lo = 0, hi = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.06; hi = o.topZero ? 0 : hi + pad; lo -= pad;
    var x = function (t) { return L + (t - t0) / (t1 - t0) * (W - L - R); };
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var svg = svgEl(null, "svg", { viewBox: "0 0 " + W + " " + H });
    niceTicks(lo, hi, o.ticks || 5).forEach(function (v) {
      svgEl(svg, "line", { x1: L, x2: W - R, y1: y(v), y2: y(v), "class": v === 0 ? "zero" : "grid" });
      svgEl(svg, "text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, axisUsd(v));
    });
    if (o.xAxis !== false) {
      for (var j = 0; j <= xt; j++) {
        var t = t0 + (t1 - t0) * j / xt;
        svgEl(svg, "text", { x: x(t), y: H - 6, "text-anchor": j === 0 ? "start" : j === xt ? "end" : "middle" }, fmtTime(t));
      }
    }
    series.forEach(function (s) {
      var pts = [];
      s.values.forEach(function (v, i) { if (v != null) pts.push([x(ts[i]), y(v)]); });
      if (pts.length < 2) return;
      var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
      if (s.area) {
        var a = svgEl(svg, "path", { d: d + "L" + pts[pts.length - 1][0].toFixed(1) + "," + y(0) + "L" + pts[0][0].toFixed(1) + "," + y(0) + "Z" });
        a.style.fill = s.area; a.style.stroke = "none";
      }
      var line = svgEl(svg, "path", { d: d, fill: "none", "stroke-width": s.width || 2, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" });
      line.style.stroke = s.color;
    });
    var cross = svgEl(svg, "line", { y1: T, y2: H - B, "class": "cross", visibility: "hidden", "vector-effect": "non-scaling-stroke" });
    svg.addEventListener("mousemove", function (evt) {
      var r = svg.getBoundingClientRect();
      var px = (evt.clientX - r.left) / r.width * W;
      var tt = t0 + (px - L) / (W - L - R) * (t1 - t0), best = 0;
      ts.forEach(function (t, i) { if (Math.abs(t - tt) < Math.abs(ts[best] - tt)) best = i; });
      cross.setAttribute("x1", x(ts[best])); cross.setAttribute("x2", x(ts[best])); cross.setAttribute("visibility", "visible");
      showTip(evt, fmtTime(ts[best]), series.filter(function (s) { return s.values[best] != null; })
        .map(function (s) { return [s.label, s.values[best], s.dot === false ? null : s.color]; }));
    });
    svg.addEventListener("mouseleave", function () { cross.setAttribute("visibility", "hidden"); hideTip(); });
    box.appendChild(svg);
  }

  function barChart(box, days, values) {
    if (!days.length) { box.appendChild(el("p", { "class": "empty" }, "No full days yet.")); return; }
    var W = Math.max(320, box.clientWidth || 1000), H = 200, L = 52, R = 10, T = 10, B = 26;
    var lo = Math.min(0, Math.min.apply(null, values)), hi = Math.max(0, Math.max.apply(null, values));
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var svg = svgEl(null, "svg", { viewBox: "0 0 " + W + " " + H });
    niceTicks(lo, hi, 4).forEach(function (v) {
      svgEl(svg, "line", { x1: L, x2: W - R, y1: y(v), y2: y(v), "class": v === 0 ? "zero" : "grid" });
      svgEl(svg, "text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, axisUsd(v));
    });
    var slot = (W - L - R) / Math.max(days.length, 7), bw = Math.min(48, slot * 0.7);
    var every = Math.ceil(days.length / Math.max(2, Math.floor(W / 90)));
    days.forEach(function (d, i) {
      var cx = L + slot * (i + 0.5), v = values[i];
      var rect = svgEl(svg, "rect", { x: cx - bw / 2, width: bw, y: Math.min(y(v), y(0)), height: Math.max(1, Math.abs(y(v) - y(0))), rx: 3 });
      rect.style.fill = v >= 0 ? "var(--pos)" : "var(--neg)";
      rect.addEventListener("mousemove", function (evt) { showTip(evt, fmtDay(d), [["Total", v, null]]); });
      rect.addEventListener("mouseleave", hideTip);
      if (i % every === 0) svgEl(svg, "text", { x: cx, y: H - 6, "text-anchor": "middle" }, fmtDay(d));
    });
    box.appendChild(svg);
  }

  function spark(box, ts, values, color) {
    var pts = [];
    values.forEach(function (v, i) { if (v != null) pts.push([ts[i], v]); });
    if (pts.length < 2) { box.appendChild(el("div", { "class": "dim" }, "")); return; }
    var W = 300, H = 44, t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    var lo = Math.min(0, Math.min.apply(null, pts.map(function (p) { return p[1]; })));
    var hi = Math.max(0, Math.max.apply(null, pts.map(function (p) { return p[1]; })));
    if (hi - lo < 0.01) { hi += 0.5; lo -= 0.5; }
    var x = function (t) { return (t - t0) / ((t1 - t0) || 1) * W; };
    var y = function (v) { return 3 + (hi - v) / (hi - lo) * (H - 6); };
    var svg = svgEl(null, "svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    svgEl(svg, "line", { x1: 0, x2: W, y1: y(0), y2: y(0), "class": "zero", "vector-effect": "non-scaling-stroke" }).style.stroke = "var(--line)";
    var line = svgEl(svg, "path", { d: pts.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1); }).join(""),
      fill: "none", "stroke-width": 1.75, "vector-effect": "non-scaling-stroke" });
    line.style.stroke = color;
    box.appendChild(svg);
  }

  // ---------- render ----------
  function load() {
    fetch("data/results.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(function () { document.getElementById("meta").textContent = "Results are not available right now."; });
  }

  var last = null, resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (last) render(last); }, 200);
  });

  function render(d) {
    last = d;
    var strategies = d.strategies || [];
    var labels = strategies.map(function (s) { return s.label; });
    var colorOf = {};
    labels.forEach(function (l, i) { colorOf[l] = "var(" + COLORS[i % COLORS.length] + ")"; });
    var history = d.history || [];
    var ts = history.map(function (p) { return Date.parse(p.t); });
    var seriesOf = function (l) { return history.map(function (p) { return typeof p[l] === "number" ? p[l] : null; }); };
    var total = history.map(function (p) {
      var s = 0, any = false;
      labels.forEach(function (l) { if (typeof p[l] === "number") { s += p[l]; any = true; } });
      return any ? Math.round(s * 100) / 100 : null;
    });
    var peak = 0;
    var dd = total.map(function (v) { if (v == null) return null; peak = Math.max(peak, v); return Math.round((v - peak) * 100) / 100; });
    strategies.forEach(function (s) { s.max_dd = Math.round(maxDrawdown(seriesOf(s.label)) * 100) / 100; });

    document.getElementById("meta").textContent = "Since " + fmtTime(Date.parse(d.period_start)) + " · updated " + fmtTime(Date.parse(d.updated));
    document.getElementById("note").textContent = d.note || "";

    // tiles
    var sum = function (k) { return strategies.reduce(function (a, s) { return a + (s[k] || 0); }, 0); };
    var wins = sum("wins"), losses = sum("losses"), closed = sum("closed");
    var pnl = sum("pnl"), realized = sum("realized"), unreal = sum("unrealized");
    var maxDD = maxDrawdown(total);
    var tiles = clear("tiles");
    [["Total P&L", usd(pnl, true), cls(pnl), strategies.filter(function (s) { return s.pnl > 0; }).length + " of " + strategies.length + " strategies up"],
     ["Realized", usd(realized, true), cls(realized), closed + " closed trades"],
     ["Open positions", usd(unreal, true), cls(unreal), sum("open") + " open now"],
     ["Win rate", pct(wins + losses ? wins / (wins + losses) : null), "", wins + " won · " + losses + " lost"],
     ["Avg trade", usd(closed ? realized / closed : null, true), cls(realized), "per closed trade"],
     ["Max drawdown", usd(maxDD), maxDD < 0 ? "neg" : "", "from portfolio peak"]
    ].forEach(function (t) {
      var tile = el("div", { "class": "tile" });
      tile.appendChild(el("div", { "class": "k" }, t[0]));
      tile.appendChild(el("div", { "class": "v " + t[2] }, t[1]));
      tile.appendChild(el("div", { "class": "s" }, t[3]));
      tiles.appendChild(tile);
    });

    // portfolio charts
    lineChart(clear("equity"), ts, [{ label: "Total", color: "var(--accent)", values: total, area: "var(--accent-fill)", width: 2.25, dot: false }], { height: 280 });
    lineChart(clear("drawdown"), ts, [{ label: "Drawdown", color: "var(--neg)", values: dd, area: "var(--neg-fill)", dot: false }], { height: 110, ticks: 2, topZero: true, xAxis: false });

    // cards
    var cards = clear("cards");
    strategies.slice().sort(function (a, b) { return b.pnl - a.pnl; }).forEach(function (s) {
      var c = setColor(el("article", { "class": "card" }), colorOf[s.label]);
      var r1 = el("div", { "class": "row" });
      r1.appendChild(el("span", { "class": "name" }, s.label));
      r1.appendChild(el("span", { "class": "pill" }, s.open + " open · " + s.closed + " closed"));
      c.appendChild(r1);
      var r2 = el("div", { "class": "row" });
      r2.appendChild(el("span", { "class": "big " + cls(s.pnl) }, usd(s.pnl, true)));
      r2.appendChild(el("span", { "class": "dim" }, "drawdown " + usd(s.max_dd)));
      c.appendChild(r2);
      var sp = el("div", { "class": "spark" }); spark(sp, ts, seriesOf(s.label), colorOf[s.label]); c.appendChild(sp);
      var mag = Math.abs(s.realized) + Math.abs(s.unrealized);
      var bar = el("div", { "class": "split", title: "Realized vs open" });
      if (mag > 0) {
        var r = el("span", { "class": "r" }), u = el("span", { "class": "u" });
        r.style.width = (Math.abs(s.realized) / mag * 100) + "%"; u.style.width = (Math.abs(s.unrealized) / mag * 100) + "%";
        bar.appendChild(r); bar.appendChild(u);
      }
      c.appendChild(bar);
      var dl = el("dl", { "class": "stats" });
      [["Realized", usd(s.realized, true), cls(s.realized)], ["Open", usd(s.unrealized, true), cls(s.unrealized)],
       ["Win rate", pct(s.win_rate), ""], ["Avg trade", usd(s.avg_trade, true), cls(s.avg_trade)],
       ["Avg win", s.avg_win == null ? "–" : usd(s.avg_win), ""],
       ["Avg loss", s.avg_loss == null ? "–" : usd(s.avg_loss), ""]
      ].forEach(function (k) {
        var w = el("div"); w.appendChild(el("dt", null, k[0])); w.appendChild(el("dd", { "class": k[2] }, k[1])); dl.appendChild(w);
      });
      c.appendChild(dl);
      cards.appendChild(c);
    });

    // multi-strategy chart + legend
    var drawMulti = function () {
      lineChart(clear("multi"), ts, labels.filter(function (l) { return !hidden[l]; })
        .map(function (l) { return { label: l, color: colorOf[l], values: seriesOf(l) }; }), { height: 300 });
    };
    var legend = clear("legend");
    labels.forEach(function (l) {
      var b = setColor(el("button", { type: "button", "class": hidden[l] ? "off" : "" }, l), colorOf[l]);
      b.addEventListener("click", function () { hidden[l] = !hidden[l]; b.className = hidden[l] ? "off" : ""; drawMulti(); });
      legend.appendChild(b);
    });
    drawMulti();

    // daily net change (end-of-day total vs previous end of day; the period starts at 0)
    var eod = {};
    history.forEach(function (p, i) { if (total[i] != null) eod[p.t.slice(0, 10)] = total[i]; });
    var days = Object.keys(eod).sort(), prev = 0;
    var changes = days.map(function (dd_) { var v = Math.round((eod[dd_] - prev) * 100) / 100; prev = eod[dd_]; return v; });
    barChart(clear("daily"), days, changes);

    // comparison table
    var drawCompare = function () {
      var tb = document.querySelector("#compare tbody"); tb.textContent = "";
      var rows = strategies.slice().sort(function (a, b) {
        var x = a[sortKey], y = b[sortKey];
        if (x == null) return 1; if (y == null) return -1;
        var c = typeof x === "string" ? x.localeCompare(y) : x - y;
        return sortAsc ? c : -c;
      });
      rows.forEach(function (s) {
        var tr = el("tr");
        var name = el("td"); name.appendChild(setColor(el("span", { "class": "dot" }), colorOf[s.label])); name.appendChild(document.createTextNode(s.label));
        tr.appendChild(name);
        [[usd(s.pnl, true), cls(s.pnl)], [usd(s.realized, true), cls(s.realized)], [usd(s.unrealized, true), cls(s.unrealized)],
         [usd(s.max_dd), s.max_dd < 0 ? "neg" : ""], [num(s.closed), ""], [num(s.open), ""], [pct(s.win_rate), ""],
         [usd(s.avg_trade, true), cls(s.avg_trade)], [s.avg_win == null ? "–" : usd(s.avg_win), ""],
         [s.avg_loss == null ? "–" : usd(s.avg_loss), ""], [num(s.profit_factor), ""]
        ].forEach(function (v) { tr.appendChild(el("td", { "class": "num " + v[1] }, v[0])); });
        tb.appendChild(tr);
      });
      document.querySelectorAll("#compare th").forEach(function (th) {
        th.className = (th.className.indexOf("num") >= 0 ? "num" : "") + (th.dataset.k === sortKey ? " sorted" + (sortAsc ? " asc" : "") : "");
      });
    };
    document.querySelectorAll("#compare th").forEach(function (th) {
      th.onclick = function () {
        if (sortKey === th.dataset.k) sortAsc = !sortAsc; else { sortKey = th.dataset.k; sortAsc = sortKey === "label"; }
        drawCompare();
      };
    });
    drawCompare();

    // realized by day table
    var daily = (d.daily_realized || []).slice().reverse();
    var used = labels.filter(function (l) { return daily.some(function (r) { return r[l] != null; }); });
    var thead = document.querySelector("#dailytable thead"), tbody = document.querySelector("#dailytable tbody");
    thead.textContent = ""; tbody.textContent = "";
    var old = document.querySelector("#dailytable tfoot"); if (old) old.remove();
    if (!daily.length) {
      var tr0 = el("tr"); tr0.appendChild(el("td", { "class": "dim" }, "No closed trades yet.")); tbody.appendChild(tr0);
      return;
    }
    var hr = el("tr"); hr.appendChild(el("th", null, "Day"));
    used.forEach(function (l) { hr.appendChild(el("th", { "class": "num" }, l)); });
    hr.appendChild(el("th", { "class": "num" }, "Total")); thead.appendChild(hr);
    var colTot = {}, grand = 0;
    daily.forEach(function (r) {
      var tr = el("tr"), t = 0;
      tr.appendChild(el("td", null, fmtDay(r.d)));
      used.forEach(function (l) {
        var v = r[l]; tr.appendChild(el("td", { "class": "num " + (v == null ? "dim" : cls(v)) }, v == null ? "–" : usd(v, true)));
        if (v != null) { t += v; colTot[l] = (colTot[l] || 0) + v; }
      });
      grand += t;
      tr.appendChild(el("td", { "class": "num " + cls(t) }, usd(t, true)));
      tbody.appendChild(tr);
    });
    var tf = el("tfoot"), fr = el("tr"); fr.appendChild(el("td", null, "All days"));
    used.forEach(function (l) { fr.appendChild(el("td", { "class": "num " + cls(colTot[l]) }, usd(colTot[l], true))); });
    fr.appendChild(el("td", { "class": "num " + cls(grand) }, usd(grand, true)));
    tf.appendChild(fr); document.getElementById("dailytable").appendChild(tf);
  }

  load();
  setInterval(load, 5 * 60 * 1000);
})();
