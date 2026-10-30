(function () {
  "use strict";
  var COLORS = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  var usd = function (x) {
    var s = Math.abs(x).toLocaleString("en-US", { style: "currency", currency: "USD" });
    return (x < 0 ? "−" : x > 0 ? "+" : "") + s;
  };
  var cls = function (x) { return x > 0 ? "pos" : x < 0 ? "neg" : ""; };
  var el = function (tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  var fmtTime = function (iso) {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  fetch("data/results.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(function () { document.getElementById("meta").textContent = "Results are not available right now."; });

  function render(d) {
    var strategies = d.strategies || [];
    var colorOf = {};
    strategies.forEach(function (s, i) { colorOf[s.label] = "var(" + COLORS[i % COLORS.length] + ")"; });

    document.getElementById("meta").textContent =
      "Since " + fmtTime(d.period_start) + " · updated " + fmtTime(d.updated);
    document.getElementById("note").textContent = d.note || "";

    var total = strategies.reduce(function (a, s) { return a + s.pnl; }, 0);
    var open = strategies.reduce(function (a, s) { return a + s.open; }, 0);
    var winners = strategies.filter(function (s) { return s.pnl > 0; }).length;
    var tiles = document.getElementById("tiles");
    [["Total P&L", usd(total), cls(total)], ["Strategies in profit", winners + " of " + strategies.length, ""],
     ["Open positions", String(open), ""]].forEach(function (t) {
      var tile = el("div", { "class": "tile" });
      tile.appendChild(el("div", { "class": "k" }, t[0]));
      tile.appendChild(el("div", { "class": "v " + t[2] }, t[1]));
      tiles.appendChild(tile);
    });

    var rows = document.getElementById("rows");
    strategies.slice().sort(function (a, b) { return b.pnl - a.pnl; }).forEach(function (s) {
      var tr = el("tr");
      tr.appendChild(el("td", null, s.label));
      tr.appendChild(el("td", { "class": "num " + cls(s.pnl) }, usd(s.pnl)));
      tr.appendChild(el("td", { "class": "num" }, String(s.open)));
      tr.appendChild(el("td", { "class": "num" }, String(s.closed)));
      rows.appendChild(tr);
    });

    var legend = document.getElementById("legend");
    strategies.forEach(function (s) {
      var item = el("span", null, s.label);
      item.style.setProperty("--c", colorOf[s.label]);  // CSSOM, allowed under the CSP
      legend.appendChild(item);
    });

    chart(d.history || [], strategies.map(function (s) { return s.label; }), colorOf);
  }

  function chart(history, labels, colorOf) {
    var box = document.getElementById("chart");
    if (history.length < 2) {
      box.appendChild(el("p", { "class": "empty" }, "The chart fills in as hourly updates arrive."));
      return;
    }
    var W = 840, H = 300, L = 56, R = 12, T = 12, B = 28;
    var ts = history.map(function (p) { return Date.parse(p.t); });
    var t0 = ts[0], t1 = ts[ts.length - 1];
    var lo = 0, hi = 0;
    history.forEach(function (p) { labels.forEach(function (k) {
      if (typeof p[k] === "number") { lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k]); }
    }); });
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
    var x = function (t) { return L + (t - t0) / (t1 - t0) * (W - L - R); };
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var add = function (tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      svg.appendChild(e); return e;
    };
    for (var i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4;
      add("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), "class": "grid" });
      add("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, usd(Math.round(v)));
    }
    add("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), "class": "zero" });
    for (var j = 0; j <= 3; j++) {
      var t = t0 + (t1 - t0) * j / 3;
      add("text", { x: x(t), y: H - 8, "text-anchor": j === 0 ? "start" : j === 3 ? "end" : "middle" }, fmtTime(new Date(t).toISOString()));
    }
    labels.forEach(function (k) {
      var pts = [];
      history.forEach(function (p, idx) { if (typeof p[k] === "number") pts.push(x(ts[idx]).toFixed(1) + "," + y(p[k]).toFixed(1)); });
      if (pts.length < 2) return;
      var line = add("polyline", { points: pts.join(" "), fill: "none", "stroke-width": 2, "stroke-linejoin": "round" });
      line.style.stroke = colorOf[k];
      var title = document.createElementNS(NS, "title"); title.textContent = k; line.appendChild(title);
    });
    box.appendChild(svg);
  }
})();
