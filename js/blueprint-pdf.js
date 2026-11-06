/* letstalkadu.com: 5-page "ADU Feasibility & Financing Blueprint" PDF.
 * One builder for the website (window.buildBlueprintPdf) and for Node (module.exports), so the sample PDFs
 * are made by exactly the code visitors get.
 *
 *   buildBlueprintPdf(jsPDF, {
 *     name, address,                 // from the form
 *     ptype, pay,                    // "Single-Family Home" | "Duplex / Multi-Family";  "HELOC / 2nd Lien" | "Cash on Hand" | "Construction-to-Perm"
 *     scope,                         // the page's SCOPES entry or CUSTOM: { title, short, sqft, cost, rent, rentRange, equity, appraisal, impactExempt, custom }
 *     config,                        // the page's CONFIG: { helocRate, drawYears, repayYears, opExShare }
 *     logo,                          // optional { url: "data:image/png;base64,...", ratio: w / h }
 *     date                           // optional Date
 *   }) -> jsPDF document (exactly 5 pages, or it throws)
 *
 * Every page has a fixed budget. Anything that would run past a page's bottom margin throws instead of
 * spilling onto a 6th page; the page catches that and still sends the lead.
 * The QR code on page 5 is Pat's booking-page QR (img/qr-book-pat-collins.png), embedded below as base64.
 */
(function (root) {
  "use strict";
  var BOOKING_URL = "https://link.theradcrm.com/widget/bookings/appointment-booking-with-pat-collins";
  var TEL = "tel:+19497872662", PHONE = "(949) 787-2662";
  var QR_PNG = "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JUqVosOee+4ZafyWgz0X39fU+j3++ONu4MCB3nENGTLEPffcc97rZnMYmcXm26677jo7JNJmL9zwjcf62fO8LRffZi9j+f3vf+/tanO0atVKyjmTG5U0QQw7r1ixwt14443S/nvrrbciz2Tw4MHSWg8bNkzKwXffZdqvf//+7txzz5VysD2rtAEDBji7Pvkvht7zkksuiTQHJV/ra/csu3cp62L3Rj3z0h2R8wKgdOFyNAIIIIAAAghkQ4ACIBuKjIEAAgggkBUBBsmdAAVA7qyZCQEEEEAAgdgIUADEZikIBAEEEEi7APnnUoACIJfazIUAAggggEBMBCgAYrIQhIEAAgikXYD8cytAAZBbb2ZDAAEEEEAgFgIUALFYBoJAAAEE0i5A/rkWoADItTjzIYAAAgggEAMBCoAYLAIhIIAAAmkXIP/cC+S8ALDn7h9zzDHOt7Vu3Tryx0g2a9bMOx6Lu06dOu61116LrI0bN85ZU+aYM2eOtHu++eYbZ88l953D4mnUqJHkZAH5jm/9ZsyYIY3fqVMneQ3skbIWV1Rt7dq1buLEiVJce++9t5R38+bNowp/27gdO3aUYtpnn322HRuXL2w/2b7ybfPmzZNytmuBcg5ZHOq1pmHDhpFybtq0qfAdHxabb7NrgW9f6/f222879fHV6jm0bNkyyWnJkiXSOWp5KO311193UV9rpISL6VyumO9H9u0rrrjCjR071rvdcccdrmLFipHFYwP369fPOx6L3U78zp07u6jascce66wp4z/yyCOWinf75JNPnL18x3cOe9mGvfjE8vdtdtL7jm/9/vrXv0rr8Pzzz8tr8OGHH3obWccgCOyTd1u4cKE766yzpLjM1tfU+v3ud7/zjsc62jrYZ6XZex9sLt924oknKsPnpK/tJ9tXvs3ej+Gbb1E/e/GT7/jW77e//a20x88777xIrVatWuUuu+wyab+q16YLLrjAowDYMc3u3btLManvfRg9erQ0vq2d0rp27er+85//7JhUDP+W8wLADIIgcEHg16x/LloQ+MUTBEEuwonlHEEQeK9bEARyDnajCoLAew55ghgfEATxyjsI/OMJgiDGslpoQRB4778gCLTBw95BEEjjB0EQHsUHAtEIlEkBEE0qjIoAAgggkEQBYi4bAQqAsnFnVgQQQAABBMpUgAKgTPmZHAEEEEi7APmX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";

  var C = {
    navy: [34, 61, 120], deep: [24, 45, 92], orange: [232, 153, 21], orangeSoft: [255, 243, 218],
    orangeInk: [138, 86, 0], mist: [242, 244, 246], sky: [234, 244, 253], ink: [28, 38, 48],
    muted: [95, 107, 119], green: [31, 122, 77], greenSoft: [230, 244, 236], line: [219, 227, 234],
    white: [255, 255, 255], paleNavy: [207, 218, 240], equity: [168, 214, 188]
  };

  // ---------------- Sample floor plans (same drawings as the website's plan section; 1 unit = 1 ft) ----------------
  var D749 = 23 + 5 / 12;
  var PLANS = {
    studio374: {
      sqft: 374, name: "374 sq ft studio", W: 22, D: 17, wl: "22'-0\"", dl: "17'-0\"",
      tints: [[0, 0, 7, 8, "wet"]],
      ext: [[0, 0, 22, 0], [0, 0, 0, 17], [22, 0, 22, 17], [0, 17, 17.5, 17], [20.5, 17, 22, 17]],
      walls: [[7, 0, 7, 8], [0, 8, 4.2, 8]],
      windows: [[10, 0, 15, 0], [0, 10, 0, 14.5], [22, 5, 22, 10], [8, 17, 12.5, 17]],
      doors: [[7, 8, 2.6, 180, 270], [20.5, 17, 3, 180, 270]],
      furn: [["r", 0.3, 0.3, 3, 3], ["r", 0.6, 0.6, 2.4, 2.4], ["e", 5.6, 1.4, 0.55, 0.7], ["r", 5.0, 0.3, 1.2, 0.5], ["r", 0.3, 4.6, 1.8, 2.6],
        ["r", 7.4, 0.3, 11.8, 2], ["r", 11.4, 0.6, 2.2, 1.3], ["c", 16.2, 0.9, 0.3], ["c", 17.2, 0.9, 0.3], ["c", 16.2, 1.7, 0.3], ["c", 17.2, 1.7, 0.3], ["r", 19.3, 0.3, 2.4, 2.6],
        ["r", 0.3, 10.4, 6.6, 5], ["r", 0.3, 10.4, 1.1, 5], ["r", 19.2, 5.6, 2.5, 6.5], ["r", 16.0, 7.4, 2, 3], ["c", 11.5, 6.8, 1.4]],
      labels: [["BATH", "7' x 8'", 4.6, 5.0], ["KITCHEN", "", 12.5, 4.4], ["LIVING + SLEEPING", "22' x 17' open studio", 11.5, 12.4], ["ENTRY", "", 19, 18.4, true]],
      caption: "About 374 sq ft · studio · 1 bath · full kitchen"
    },
    garage400: {
      sqft: 400, name: "400 sq ft garage conversion", W: 20, D: 20, wl: "20'-0\"", dl: "20'-0\"",
      tints: [[0, 0, 7, 7.5, "wet"]],
      ext: [[0, 0, 20, 0], [0, 0, 0, 20], [20, 0, 20, 20], [0, 20, 8.2, 20], [11.2, 20, 20, 20]],
      walls: [[7, 0, 7, 7.5], [0, 7.5, 4.4, 7.5]],
      windows: [[2, 20, 7, 20], [13, 20, 18.5, 20], [0, 10, 0, 15], [20, 11.5, 20, 16.5], [2.5, 0, 5, 0]],
      doors: [[7, 7.5, 2.6, 180, 270], [11.2, 20, 3, 180, 270]],
      furn: [["r", 0.3, 0.3, 3, 3], ["r", 0.6, 0.6, 2.4, 2.4], ["e", 5.6, 1.4, 0.55, 0.7], ["r", 5.0, 0.3, 1.2, 0.5], ["r", 0.3, 4.3, 1.8, 2.6],
        ["r", 7.3, 0.3, 2.4, 2.6], ["r", 9.9, 0.3, 7.8, 2], ["r", 12.2, 0.6, 2.2, 1.3], ["r", 17.7, 0.3, 2, 9], ["c", 18.3, 5.2, 0.3], ["c", 19.1, 5.2, 0.3], ["c", 18.3, 6.0, 0.3], ["c", 19.1, 6.0, 0.3],
        ["r", 0.3, 9.4, 6.6, 5], ["r", 0.3, 9.4, 1.1, 5], ["r", 12.0, 15.4, 6, 2.4], ["r", 13.4, 12.4, 3, 1.6], ["c", 12.0, 7.6, 1.2]],
      labels: [["BATH", "7' x 7'-6\"", 4.6, 4.8], ["KITCHEN", "", 12.8, 4.6], ["STUDIO", "20' x 20'", 8.6, 13.4], ["NEW ENTRY", "", 9.7, 21.6, true]],
      caption: "About 400 sq ft · studio · 1 bath · full kitchen in the old garage"
    },
    two749: {
      sqft: 749, name: "749 sq ft 2-bedroom plan", W: 32, D: D749, wl: "32'-0\"", dl: "23'-5\"",
      tints: [[12, 0, 6, 8.5, "wet"], [12, 15.5, 4, D749 - 15.5, "util"]],
      ext: [[0, 0, 32, 0], [0, 0, 0, D749], [32, 0, 32, D749], [0, D749, 27.5, D749], [30.5, D749, 32, D749]],
      walls: [[12, 0, 12, 8.6], [12, 11.2, 12, 12.4], [12, 15, 12, D749], [0, 11.7, 12, 11.7], [18, 0, 18, 8.5], [12, 8.5, 13, 8.5], [15.6, 8.5, 18, 8.5], [12, 15.5, 12.6, 15.5], [15.2, 15.5, 16, 15.5], [16, 15.5, 16, D749]],
      windows: [[3, 0, 8, 0], [0, 3.5, 0, 7.5], [0, 15.5, 0, 19.5], [3, D749, 8, D749], [14, 0, 16, 0], [22.5, 0, 27.5, 0], [32, 9.5, 32, 14.5], [32, 16.5, 32, 21], [19.5, D749, 25.5, D749]],
      doors: [[12, 8.6, 2.6, 90, 180], [12, 15, 2.6, -90, -180], [15.6, 8.5, 2.6, 180, 270], [30.5, D749, 3, 180, 270]],
      furn: [["r", 1.2, 1.6, 5, 6.7], ["r", 1.2, 1.6, 5, 1.2], ["r", 1.2, 16.4, 5, 6.7], ["r", 1.2, 21.9, 5, 1.2], ["r", 9.8, 0.3, 2, 6], ["r", 9.8, 17.1, 2, 6],
        ["r", 12.3, 0.3, 5.4, 2.6], ["r", 12.6, 0.6, 4.8, 2], ["r", 16.3, 3.3, 1.5, 2.6], ["e", 16.65, 7.0, 0.7, 0.55], ["r", 17.3, 6.4, 0.55, 1.2],
        ["c", 13.3, 19.7, 1.05], ["c", 13.3, 22.0, 1.05], ["r", 18.3, 0.3, 13.4, 2.1], ["r", 18.4, 0.4, 2.8, 2.7], ["r", 24.2, 0.6, 2.4, 1.4],
        ["c", 29, 0.9, 0.3], ["c", 30.2, 0.9, 0.3], ["c", 29, 1.7, 0.3], ["c", 30.2, 1.7, 0.3], ["r", 22, 5.2, 6, 2.6], ["r", 19.6, 18.6, 7.5, 2.8], ["r", 21.2, 15.2, 4.2, 2.2]],
      labels: [["BEDROOM 1", "12' x 11'-8\"", 6, 10.2], ["BEDROOM 2", "12' x 11'-9\"", 6, 13.9], ["BATH", "6' x 8'-6\"", 14.3, 4.6], ["HALL", "", 14, 12.6, true], ["LAUNDRY", "", 14, 17.2, true],
        ["KITCHEN", "", 25, 4.3], ["LIVING / DINING", "16' x 23'-5\" open plan", 25, 11], ["ENTRY", "", 29, D749 + 1.6, true]],
      caption: "About 749 sq ft · 2 bedrooms · 1 bath · in-unit laundry · open kitchen and living"
    },
    three1000: {
      sqft: 1000, name: "1,000 sq ft 3-bedroom plan", W: 40, D: 25, wl: "40'-0\"", dl: "25'-0\"",
      tints: [[12, 0, 7, 8, "wet"], [19, 0, 6, 8, "wet"], [12, 17, 4, 8, "util"]],
      ext: [[0, 0, 40, 0], [0, 0, 0, 25], [40, 0, 40, 25], [0, 25, 30, 25], [33, 25, 40, 25]],
      walls: [[12, 0, 12, 9], [12, 11.6, 12, 13.5], [12, 16.1, 12, 25], [0, 12.5, 12, 12.5], [12, 8, 13, 8], [15.6, 8, 19, 8], [19, 0, 19, 8],
        [19, 8, 20, 8], [22.6, 8, 25, 8], [25, 0, 25, 12], [25, 12, 26, 12], [28.6, 12, 40, 12], [12, 17, 12.6, 17], [15.2, 17, 16, 17], [16, 17, 16, 25]],
      windows: [[3, 0, 8, 0], [0, 3, 0, 8], [0, 16, 0, 21], [3, 25, 8, 25], [14, 0, 16.5, 0], [20.5, 0, 22.5, 0], [29, 0, 36, 0], [40, 3, 40, 8], [40, 15, 40, 22], [20, 25, 27, 25], [35, 25, 38.5, 25]],
      doors: [[12, 9, 2.6, 90, 180], [12, 16.1, 2.6, -90, -180], [15.6, 8, 2.6, 180, 270], [22.6, 8, 2.6, 180, 270], [28.6, 12, 2.6, 180, 270], [15.2, 17, 2.6, 180, 270], [33, 25, 3, 180, 270]],
      furn: [["r", 3.5, 0.3, 5, 6.7], ["r", 3.5, 0.3, 5, 1.2], ["r", 9.8, 0.3, 2, 6], ["r", 3.5, 18, 5, 6.7], ["r", 3.5, 23.5, 5, 1.2], ["r", 9.8, 18.7, 2, 6],
        ["r", 12.3, 0.3, 6.4, 2.6], ["r", 12.6, 0.6, 5.8, 2], ["r", 17.2, 3.3, 1.5, 2.6], ["e", 18.0, 6.9, 0.55, 0.7],
        ["r", 19.3, 0.3, 3.2, 3.2], ["r", 19.6, 0.6, 2.6, 2.6], ["r", 23.2, 0.3, 1.5, 2.6], ["e", 24.0, 5.2, 0.55, 0.7],
        ["r", 31, 0.3, 6, 6.9], ["r", 31, 0.3, 6, 1.2], ["r", 25.3, 0.3, 2, 6],
        ["c", 13.3, 20.3, 1.05], ["c", 13.3, 22.6, 1.05],
        ["r", 29.2, 12.3, 10.5, 2.1], ["r", 37, 12.4, 2.7, 2.7], ["r", 32, 12.6, 2.4, 1.4], ["c", 34.9, 12.9, 0.3], ["c", 35.9, 12.9, 0.3], ["c", 34.9, 13.7, 0.3], ["c", 35.9, 13.7, 0.3],
        ["r", 31, 16.5, 6, 2.6], ["r", 20.3, 20.6, 7, 2.6], ["r", 21.8, 17.2, 4, 1.8], ["c", 35.5, 20.6, 1.5]],
      labels: [["BEDROOM 1", "12' x 12'-6\"", 6, 10.6], ["BEDROOM 2", "12' x 12'-6\"", 6, 15.4], ["BATH 1", "", 15.3, 4.9], ["BATH 2", "", 21.6, 4.7, true],
        ["BEDROOM 3", "15' x 12'", 32.6, 9.4], ["HALL", "", 15.5, 12.8, true], ["LAUNDRY", "", 14, 18.6, true], ["W/D", "", 15.3, 21.8, true],
        ["KITCHEN", "", 34, 15.9], ["LIVING / DINING", "21' x 13' open plan", 24.5, 15.0], ["ENTRY", "", 31.5, 26.6, true]],
      caption: "About 1,000 sq ft · 3 bedrooms · 2 baths · in-unit laundry · open kitchen and living"
    }
  };

  function build(JsPDF, input) {
    var d = input.scope, cfg = input.config || {};
    if (!d || !d.cost) throw new Error("buildBlueprintPdf: missing scope");
    var doc = new JsPDF({ unit: "pt", format: "letter", compress: true });
    var W = 612, H = 792, M = 48, CW = W - 2 * M;
    var FOOT_TOP = H - 50, BOTTOM = FOOT_TOP - 10;
    var y = 0, pageNo = 1;

    // ---------------- drawing helpers ----------------
    function fill(c) { doc.setFillColor(c[0], c[1], c[2]); }
    function stroke(c) { doc.setDrawColor(c[0], c[1], c[2]); }
    function color(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function font(style, size, c) { doc.setFont("helvetica", style); doc.setFontSize(size); color(c || C.ink); }
    function plain(t) { return String(t).replace(/ /g, " ").replace(/•/g, "·").replace(/[–—−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, "\""); }
    function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
    function sign(v) { return (v >= 0 ? "+" : "-") + money(Math.abs(v)); }
    function kfmt(v) { return (v >= 0 ? "+" : "-") + "$" + Math.round(Math.abs(v) / 1000).toLocaleString("en-US") + "k"; }
    // Pat's rule: never leave one word alone on the last line
    function wrap(t, width) {
      var lines = doc.splitTextToSize(plain(t), width), w = width;
      for (var i = 0; i < 14 && lines.length > 1 && !/\s/.test(lines[lines.length - 1].trim()); i++) { w *= 0.96; lines = doc.splitTextToSize(plain(t), w); }
      return lines;
    }
    function fitSize(t, maxW, size, min) { doc.setFontSize(size); while (doc.getTextWidth(plain(t)) > maxW && size > min) { size -= 0.25; doc.setFontSize(size); } return size; }
    function budget(label) { if (y > BOTTOM + 0.5) throw new Error("Blueprint page " + pageNo + " overflows at " + label); }
    function newPage() { doc.addPage(); pageNo++; fill(C.navy); doc.rect(0, 0, W, 8, "F"); y = 46; }
    function paraH(t, size, width, lhf) { font("normal", size); return size + 1 + (wrap(t, width || CW).length - 1) * size * (lhf || 1.4) + 6; }
    function para(t, size, c, style, x, width, lhf) {
      size = size || 10; lhf = lhf || 1.4; font(style || "normal", size, c);
      var lines = wrap(t, width || CW), lh = size * lhf;
      y += size + 1;
      doc.text(lines, x || M, y, { lineHeightFactor: lhf });
      y += (lines.length - 1) * lh + 6;
      budget("text");
    }
    function heading(n, t, intro) {
      y += 16;
      fill(C.orange); doc.circle(M + 11, y - 5, 11, "F");
      font("bold", 11.5, C.deep); doc.text(String(n), M + 11, y - 1, { align: "center" });
      font("bold", 17, C.deep); doc.text(plain(t), M + 30, y); y += 6;
      if (intro) { para(intro, 10, C.muted); y += 6; } else y += 8;
    }
    function sub(t) { y += 14; font("bold", 11, C.deep); doc.text(plain(t), M, y); y += 4; }
    function card(x, w, h, bg, label, value, note, vc, vsize) {
      fill(bg); doc.roundedRect(x, y, w, h, 9, 9, "F");
      font("bold", 8, C.muted);
      var lab = wrap(plain(label).toUpperCase(), w - 24);
      doc.text(lab, x + 12, y + 17, { lineHeightFactor: 1.25 });
      var vs = vsize || 20, vy = y + 17 + (lab.length - 1) * 10 + vs + 6;
      font("bold", vs, vc || C.deep); vs = fitSize(value, w - 24, vs, 11);
      doc.text(plain(value), x + 12, vy);
      if (note) { font("normal", 8.5, C.muted); doc.text(wrap(note, w - 24), x + 12, vy + 15, { lineHeightFactor: 1.3 }); }
    }
    function table(widths, rows, opts) {
      opts = opts || {};
      var pad = 7, size = opts.size || 9, lh = size * 1.3;
      var hl = function (ri) { return opts.highlightLast && ri === rows.length - 1; };
      y += 2;
      rows.forEach(function (r, ri) {
        var head = ri === 0;
        var cells = r.map(function (c, ci) { font(head || (opts.boldFirst && ci === 0) || hl(ri) ? "bold" : "normal", head ? 8 : size); return wrap(c, widths[ci] - 2 * pad); });
        var rh = Math.max.apply(null, cells.map(function (c) { return c.length; })) * lh + 2 * pad - 3;
        if (head) { fill(C.navy); doc.rect(M, y, CW, rh, "F"); }
        else if (hl(ri)) { fill(C.greenSoft); doc.rect(M, y, CW, rh, "F"); }
        else if (ri % 2 === 0) { fill(C.mist); doc.rect(M, y, CW, rh, "F"); }
        var x = M;
        cells.forEach(function (lines, ci) {
          var bold = head || (opts.boldFirst && ci === 0) || hl(ri);
          font(bold ? "bold" : "normal", head ? 8 : size, head ? C.white : (hl(ri) ? C.green : C.ink));
          var right = opts.right && opts.right.indexOf(ci) > -1;
          doc.text(head ? lines.map(function (l) { return l.toUpperCase(); }) : lines, right ? x + widths[ci] - pad : x + pad, y + pad + size - 1.5, { lineHeightFactor: 1.3, align: right ? "right" : "left" });
          x += widths[ci];
        });
        y += rh;
      });
      y += 4;
      budget("table");
    }
    function calloutH(t) { font("normal", 9.5); return wrap(t, CW - 30).length * 13.3 + 17 + 8; }
    function callout(t, bg, bar, ink) {
      font("normal", 9.5, ink);
      var lines = wrap(t, CW - 30), h = lines.length * 13.3 + 17;
      fill(bg); doc.roundedRect(M, y, CW, h, 8, 8, "F");
      fill(bar); doc.rect(M, y, 4, h, "F");
      var first = lines[0], ci = first.indexOf(":");
      if (ci > 0 && ci < 30) {
        var lead = first.slice(0, ci + 1);
        font("bold", 9.5, ink); doc.text(lead, M + 16, y + 15);
        var lw = doc.getTextWidth(lead + " ");
        font("normal", 9.5, ink); doc.text(first.slice(ci + 2), M + 16 + lw, y + 15);
        if (lines.length > 1) doc.text(lines.slice(1), M + 16, y + 15 + 13.3, { lineHeightFactor: 1.4 });
      } else doc.text(lines, M + 16, y + 15, { lineHeightFactor: 1.4 });
      y += h + 8;
      budget("callout");
    }
    function check(x, cy, c) { stroke(c || C.green); doc.setLineWidth(1.6); doc.line(x, cy, x + 3, cy + 3); doc.line(x + 3, cy + 3, x + 8.5, cy - 3.5); doc.setLineWidth(0.6); }

    // Floor plan inside a box; returns the bottom of the drawing
    function drawPlan(p, bx, by, bw, bh) {
      var padL = 2.6, padT = 2.6, padB = (p.patio ? p.patio[3] : 0) + 2.2;
      var tw = p.W + padL + 0.6, th = p.D + padT + padB;
      var s = Math.min(bw / tw, bh / th, 13.5), k = s / 11.6;
      var ox = bx + (bw - tw * s) / 2 + padL * s, oy = by + padT * s;
      var X = function (v) { return ox + v * s; }, Y = function (v) { return oy + v * s; };
      var ln = function (a) { doc.line(X(a[0]), Y(a[1]), X(a[2]), Y(a[3])); };
      var TINT = { wet: [234, 241, 250], util: [243, 244, 246] };
      stroke(C.muted); doc.setLineWidth(0.6);
      ln([0, -1.6, p.W, -1.6]); ln([0, -2.1, 0, -1.1]); ln([p.W, -2.1, p.W, -1.1]);
      ln([-1.6, 0, -1.6, p.D]); ln([-2.1, 0, -1.1, 0]); ln([-2.1, p.D, -1.1, p.D]);
      font("bold", Math.max(7.5, 8.5 * k), C.muted);
      doc.text(p.wl, X(p.W / 2), Y(-2.0), { align: "center" });
      doc.text(p.dl, X(-2.0), Y(p.D / 2), { align: "center", angle: 90 });
      fill([250, 247, 240]); doc.rect(X(0), Y(0), p.W * s, p.D * s, "F");
      (p.tints || []).forEach(function (t) { fill(TINT[t[4]]); doc.rect(X(t[0]), Y(t[1]), t[2] * s, t[3] * s, "F"); });
      stroke([150, 160, 172]); doc.setLineWidth(0.6);
      (p.furn || []).forEach(function (f) {
        if (f[0] === "r") doc.rect(X(f[1]), Y(f[2]), f[3] * s, f[4] * s, "S");
        else if (f[0] === "e") doc.ellipse(X(f[1]), Y(f[2]), f[3] * s, f[4] * s, "S");
        else doc.circle(X(f[1]), Y(f[2]), f[3] * s, "S");
      });
      stroke(C.ink); doc.setLineWidth(2 * k); (p.walls || []).forEach(ln);
      doc.setLineWidth(3.6 * k); p.ext.forEach(ln);
      (p.windows || []).forEach(function (wd) {
        stroke(C.white); doc.setLineWidth(4 * k); ln(wd);
        stroke(C.navy); doc.setLineWidth(0.7); var o = 1.5 * k;
        if (wd[1] === wd[3]) { doc.line(X(wd[0]), Y(wd[1]) - o, X(wd[2]), Y(wd[3]) - o); doc.line(X(wd[0]), Y(wd[1]) + o, X(wd[2]), Y(wd[3]) + o); }
        else { doc.line(X(wd[0]) - o, Y(wd[1]), X(wd[2]) - o, Y(wd[3])); doc.line(X(wd[0]) + o, Y(wd[1]), X(wd[2]) + o, Y(wd[3])); }
      });
      (p.doors || []).forEach(function (dr) {
        var hx = dr[0], hy = dr[1], r = dr[2], a0 = dr[3] * Math.PI / 180, a1 = dr[4] * Math.PI / 180;
        stroke(C.ink); doc.setLineWidth(1); doc.line(X(hx), Y(hy), X(hx + r * Math.cos(a1)), Y(hy + r * Math.sin(a1)));
        stroke([150, 160, 172]); doc.setLineWidth(0.5);
        var px = hx + r * Math.cos(a0), py = hy + r * Math.sin(a0);
        for (var j = 1; j <= 12; j++) { var a = a0 + (a1 - a0) * j / 12, nx = hx + r * Math.cos(a), ny = hy + r * Math.sin(a); doc.line(X(px), Y(py), X(nx), Y(ny)); px = nx; py = ny; }
      });
      (p.labels || []).forEach(function (l) {
        if (l[4]) { font("bold", Math.max(6.5, 7.5 * k), l[0] === "ENTRY" || l[0] === "NEW ENTRY" ? C.orangeInk : C.muted); doc.text(l[0], X(l[2]), Y(l[3]), { align: "center" }); return; }
        font("bold", Math.max(7.5, 8.5 * k), C.deep); doc.text(l[0], X(l[2]), Y(l[3]), { align: "center" });
        if (l[1]) { font("normal", Math.max(6.5, 7 * k), C.muted); doc.text(l[1], X(l[2]), Y(l[3]) + 9 * k + 1, { align: "center" }); }
      });
      doc.setLineWidth(0.6);
      return oy + (p.D + padB) * s;
    }

    // ---------------- the numbers (same formulas as the page) ----------------
    var sqft = d.sqft, cost = d.cost, rent = d.rent;
    var rateP = cfg.helocRate || 8, rate = rateP / 100, r = rate / 12;
    var drawY = cfg.drawYears || 5, repayY = cfg.repayYears || 30, span = drawY + repayY;
    var opShare = cfg.opExShare == null ? 0.15 : cfg.opExShare;
    var pmt = function (P) { return P * r / (1 - Math.pow(1 + r, -12 * repayY)); };
    var io = cost * r, amort = pmt(cost), opex = rent * opShare;
    var cf1 = rent - opex - io, cf2 = rent - opex - amort;
    var garage = /garage/i.test(d.title || "");
    var school = sqft > 500 ? Math.round(sqft * 5.2 / 10) * 10 : 0;
    var permits = 10000, utilities = 8000, contingency = cost * 0.05;
    var cushion = cost + school + permits + utilities + contingency;
    var cushionCF = rent - opex - cushion * r;
    var vRent = rent * 0.9, vCost = cost * 1.1, v1 = vRent * (1 - opShare) - vCost * r, v2 = vRent * (1 - opShare) - pmt(vCost);
    var appraisal = d.appraisal, equity = d.equity, perSq = appraisal / sqft, fiveYr = cf1 * 12 * drawY;
    var duplex = /duplex|multi/i.test(input.ptype || "");
    var pay = input.pay || "HELOC / 2nd Lien";
    var date = input.date || new Date();
    var today = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    var title = plain(d.title || (sqft + " sq ft ADU"));
    var short = plain(d.short || title);
    var phase1 = "years 1-" + drawY, phase2 = "years " + (drawY + 1) + "-" + span;

    // Which sample floor plan to show
    var planKey = garage ? "garage400" : sqft >= 900 ? "three1000" : sqft >= 600 ? "two749" : "studio374";
    var plan = PLANS[planKey];
    var planExact = !d.custom && plan.sqft === sqft;
    var layout = garage ? "Studio, 1 bath" : sqft >= 900 ? "3 bed / 2 bath" : sqft >= 600 ? "2 bed / 1 bath" : sqft >= 450 ? "1 bed / 1 bath" : "Studio, 1 bath";

    // ================= PAGE 1: PROJECT SNAPSHOT & WEALTH DASHBOARD =================
    fill(C.navy); doc.rect(0, 0, W, 104, "F");
    if (input.logo && input.logo.url) {
      try { doc.addImage(input.logo.url, "PNG", M, 24, 56 * (input.logo.ratio || 1.5), 56, undefined, "FAST"); } catch (e) { /* the logo is optional */ }
    }
    font("bold", 19, C.white); doc.text("ADU Feasibility & Financing Blueprint", W - M, 50, { align: "right" });
    font("normal", 10, C.paleNavy); doc.text("Prepared " + today + " · letstalkadu.com", W - M, 70, { align: "right" });
    y = 132;
    var badge = duplex ? "DUPLEX / MULTI-FAMILY · UP TO 2 DETACHED ADUS" : "SINGLE-FAMILY HOME · ADU ALLOWED BY STATE LAW";
    font("bold", 8.5); var bwid = doc.getTextWidth(badge) + 24;
    fill(C.green); doc.roundedRect(M, y - 12, bwid, 18, 9, 9, "F");
    font("bold", 8.5, C.white); doc.text(badge, M + bwid / 2, y, { align: "center" });
    y += 27;
    var addr = plain(input.address || "Your property");
    font("bold", 18, C.deep); var as = fitSize(addr, CW, 18, 11);
    if (doc.getTextWidth(addr) > CW) { var al = doc.splitTextToSize(addr, CW).slice(0, 2); doc.text(al, M, y, { lineHeightFactor: 1.15 }); y += (al.length - 1) * as * 1.15; }
    else doc.text(addr, M, y);
    y += 16;
    var who = plain(input.name || "").trim();
    var subline = (who ? "Prepared for " + who + " · " : "") + title + " · Financing pick: " + plain(pay);
    font("normal", 10, C.muted); fitSize(subline, CW, 10, 7.5); doc.text(doc.splitTextToSize(subline, CW)[0], M, y); y += 8;
    para("What a " + short + " could cost, what it could earn each month and how much equity it could create on day one. Every number is an estimate to help you plan. It is not a quote, an appraisal or a loan offer.", 10, C.ink);

    heading(1, "Your wealth dashboard");
    (function () {
      var gap = 10, cw = (CW - gap) / 2, ch = 92;
      card(M, cw, ch, C.mist, "Total build cost", money(cost), sqft.toLocaleString("en-US") + " sq ft at $250 per sq ft. Full budget with fees and a cushion is on page 3.", C.deep, 24);
      card(M + cw + gap, cw, ch, C.greenSoft, "Projected monthly rent", money(rent) + " / mo", "Long-term 12-month lease. " + money(rent * 12) + " a year before costs.", C.green, 24);
      y += ch + gap;
      card(M, cw, ch, C.orangeSoft, "Net monthly cash flow", sign(cf1) + " / mo", "Years 1-" + drawY + ", after the " + Math.round(opShare * 100) + "% cost set-aside and the loan payment. About " + sign(cf2) + " a month after that.", C.orangeInk, 24);
      card(M + cw + gap, cw, ch, C.sky, "Day-1 equity gain", sign(equity), "The ADU adds about " + money(appraisal) + " in value once the city signs off.", C.navy, 24);
      y += ch + 14;
    })();
    var bothUp = v1 > 0 && v2 > 0;
    callout(cf1 > 0
      ? "Bottom line: this project works on paper. The rent pays the costs and the loan, with about " + money(cf1) + " a month left over in years 1 to " + drawY + (cf2 > 0 ? " and about " + money(cf2) + " after that." : ".") + (bothUp ? " It stays cash-flow positive even if rent comes in 10% lower and the budget runs 10% over at the same time." : "")
      : "Bottom line: at today's example rate, the rent does not fully cover the costs and the loan payment in years 1 to " + drawY + ". Page 3 shows the gap, and the site audit is where we look for a size or financing setup that closes it.",
      C.orangeSoft, C.orange, [90, 58, 0]);

    sub("Inside this blueprint");
    y += 4;
    [["2", "Lot suitability & concept floor plan", "Your project, the rules that apply and a sample layout"],
     ["3", "Build budget & cash-flow architecture", "Every cost, the HELOC and what you keep each month"],
     ["4", "Equity creation & valuation upside", "What the ADU adds to the property's value"],
     ["5", "What we verify on site", "The four checks that make it buildable, and how to book them"]].forEach(function (row) {
      fill(C.mist); doc.roundedRect(M, y, CW, 26, 6, 6, "F");
      fill(C.navy); doc.circle(M + 15, y + 13, 8.5, "F");
      font("bold", 9, C.white); doc.text(row[0], M + 15, y + 16.3, { align: "center" });
      font("bold", 10, C.deep); doc.text(row[1], M + 32, y + 16.8);
      font("normal", 9, C.muted); doc.text(row[2], W - M - 12, y + 16.8, { align: "right" });
      y += 30;
    });
    (function () {
      var bh = 46, by = BOTTOM - bh;
      if (y + 6 > by) throw new Error("Blueprint page 1 overflows at the call-to-action bar");
      fill(C.navy); doc.roundedRect(M, by, CW, bh, 9, 9, "F");
      font("bold", 11.5, C.white); doc.text("Ready to confirm it on your lot?", M + 16, by + 19);
      font("normal", 9, C.paleNavy); doc.text("Book a free on-site feasibility & financing audit", M + 16, by + 34);
      doc.link(M + 16, by + 26, 230, 12, { url: BOOKING_URL });
      fill(C.orange); doc.roundedRect(W - M - 142, by + 9, 128, 28, 7, 7, "F");
      font("bold", 11, C.deep); doc.text(PHONE, W - M - 78, by + 27.5, { align: "center" });
      doc.link(W - M - 142, by + 9, 128, 28, { url: TEL });
    })();

    // ================= PAGE 2: LOT SUITABILITY & CONCEPT FLOOR PLAN =================
    newPage();
    heading(2, "Lot suitability & concept floor plan", "Based on your answers and California ADU law. We confirm your parcel's lot size, zoning and utilities on the free site audit.");
    (function () {
      var tiles = [
        ["Property", duplex ? "Duplex / multi-family" : "Single-family home", duplex ? "Up to 2 detached ADUs" : "1 ADU + 1 junior ADU allowed"],
        ["ADU type", garage ? "Garage conversion" : d.custom ? "Custom-size detached" : "Detached ADU", garage ? "Reuses the existing garage" : "A new building in the yard"],
        ["Size", sqft.toLocaleString("en-US") + " sq ft", "$250 per sq ft to build"],
        ["Layout", layout, d.custom ? "Typical for this size" : "Our " + (garage ? "garage" : "detached") + " model"],
        ["Setbacks", garage ? "None needed" : "4 ft rear & side", garage ? "The existing footprint is reused" : "State limit for a detached ADU"],
        ["Height", garage ? "Existing structure" : "16 ft allowed", garage ? "No new height needed" : "Cities must allow at least this"]
      ];
      var gap = 8, tw = (CW - 2 * gap) / 3, th = 52;
      tiles.forEach(function (t, i) {
        var tx = M + (i % 3) * (tw + gap), ty = y + Math.floor(i / 3) * (th + gap);
        fill(C.mist); doc.roundedRect(tx, ty, tw, th, 7, 7, "F");
        font("bold", 7.5, C.muted); doc.text(t[0].toUpperCase(), tx + 10, ty + 15);
        font("bold", 12.5, C.deep); fitSize(t[1], tw - 20, 12.5, 9); doc.text(t[1], tx + 10, ty + 32);
        font("normal", 8, C.muted); fitSize(t[2], tw - 20, 8, 6.5); doc.text(t[2], tx + 10, ty + 44);
      });
      y += 2 * th + gap + 10;
    })();
    sub("Why this lot works");
    y += 6;
    (function () {
      var pts = [
        d.impactExempt ? ["$0 city impact fees", "Cities can't charge impact fees on an ADU under 750 sq ft. This plan is " + sqft.toLocaleString("en-US") + " sq ft."]
                       : ["Impact fees stay fair", "At 750 sq ft or more, city fees must be in proportion to your home's size. A 749 sq ft design avoids them."],
        garage ? ["No replacement parking", "Converting a garage to an ADU never requires replacing its parking spaces."]
               : ["Parking often waived", "Within 1/2 mile of public transit, the city can't require parking for the ADU."],
        ["Prop 13 tax base protected", "Only the new ADU is added to your tax bill. Your home's existing tax base stays the same."]
      ];
      var gap = 8, tw = (CW - 2 * gap) / 3;
      font("normal", 8.5);
      var th = Math.max.apply(null, pts.map(function (p) { return wrap(p[1], tw - 22).length; })) * 11 + 36;
      pts.forEach(function (p, i) {
        var tx = M + i * (tw + gap);
        fill(C.greenSoft); doc.roundedRect(tx, y, tw, th, 7, 7, "F");
        check(tx + 10, y + 14);
        font("bold", 10, C.green); fitSize(p[0], tw - 34, 10, 8); doc.text(p[0], tx + 24, y + 17);
        font("normal", 8.5, C.ink); doc.text(wrap(p[1], tw - 22), tx + 10, y + 32, { lineHeightFactor: 1.3 });
      });
      y += th + 6;
    })();
    sub(planExact ? "A possible " + sqft.toLocaleString("en-US") + " sq ft layout" : "Example layout: our " + plan.name);
    (function () {
      var note = planExact
        ? "Concept only. This is an example of what could fit in " + sqft.toLocaleString("en-US") + " sq ft, not your project's design or a construction drawing, and not to exact scale. A licensed designer sets the final layout and your city approves it."
        : "Concept only. This sample plan shows the feel of the space; your designer sizes the real layout to " + sqft.toLocaleString("en-US") + " sq ft. It is not a construction drawing and not to exact scale, and your city approves the final design.";
      font("normal", 8.5); var nl = wrap(note, CW - 28), nh = nl.length * 11.5 + 14;
      var avail = BOTTOM - y - nh - 30;
      var bottom = drawPlan(plan, M, y + 6, CW, Math.min(avail, 330));
      y = bottom + 14;
      font("bold", 9.5, C.deep); doc.text(plan.caption, W / 2, y, { align: "center" });
      y += 10;
      fill(C.mist); doc.roundedRect(M, y, CW, nh, 7, 7, "F");
      font("normal", 8.5, C.muted); doc.text(nl, M + 14, y + 14, { lineHeightFactor: 1.35 });
      y += nh;
      budget("floor plan");
    })();

    // ================= PAGE 3: BUILD BUDGET & CASH-FLOW ARCHITECTURE =================
    // Drawn normally first; if a long intro makes it overflow, the page is deleted and drawn again tighter
    var page3 = function (tight) {
    var gapK = tight ? 0.5 : 1;
    newPage();
    var payNote = pay === "Cash on Hand" ? " You picked cash, so you may not need a loan; this shows the HELOC route in case you'd rather keep your cash."
      : /construction/i.test(pay) ? " You picked construction-to-perm; this shows the HELOC route side by side, and we compare both on the audit." : "";
    heading(3, "Build budget & cash-flow architecture", "What it costs to build, how a HELOC pays for it and what is left for you each month. Some costs are often billed on top of a per-sq-ft price, so anything your contract includes comes off this list." + payNote);
    table([250, 106, 160], [
      ["Cost item", "Amount", "Status"],
      ["Construction, " + sqft.toLocaleString("en-US") + " sq ft at $250 per sq ft", money(cost), "From the build price"],
      ["School district fee", school ? "About " + money(school) : "$0", school ? "Varies by district, about $5 per sq ft" : "None at 500 sq ft or less"],
      ["City impact fees", d.impactExempt ? "$0" : "Varies", d.impactExempt ? "Under 750 sq ft (state law)" : "Set by your city, by home size"],
      ["City plan check and building permit", "About " + money(permits), "Estimate: $5,000 to $15,000"],
      ["Sewer and power connection fees", "About " + money(utilities), "Estimate: $1,000 to $15,000"],
      ["Cushion for surprises (5%)", money(contingency), "Recommended"],
      ["Total with cushion", money(cushion), d.impactExempt ? "If none of these are included" : "Plus any city impact fees"]
    ], { boldFirst: true, highlightLast: true, right: [1] });
    y += 4 * gapK;
    sub("How the HELOC pays for it");
    y += 8 * gapK;
    (function () {
      var gap = 10, bw = (CW - 2 * gap) / 3, bh = 76;
      card(M, bw, bh, C.mist, "You borrow", money(cost), "At an example " + rateP.toFixed(2) + "% rate, against your home's equity", C.deep, 17);
      card(M + bw + gap, bw, bh, C.orangeSoft, "Years 1-" + drawY + ": interest only", money(io) + " / mo", "The balance stays at " + money(cost), C.orangeInk, 17);
      card(M + 2 * (bw + gap), bw, bh, C.sky, "Years " + (drawY + 1) + "-" + span + ": pay it down", money(amort) + " / mo", "Paid off in full at year " + span, C.navy, 17);
      y += bh + 4;
    })();
    font("normal", 8.5, C.muted);
    doc.text(wrap("Your current mortgage and its rate stay the same. Real HELOC rates are usually variable, so payments can change. Plan for about " + money(io * 6) + " of interest during a 6-month build, before rent starts.", CW), M, y + 10, { lineHeightFactor: 1.35 });
    y += tight ? 32 : 36;
    sub("Your monthly cash-flow equation");
    y += 10 * gapK;
    (function () {
      var op = 20, tw = (CW - 3 * op) / 4, th = 76;
      var vals = [money(rent), money(opex), money(io), sign(cf1)];
      var labels = ["Gross rent", "Operating expenses", "HELOC payment", "Net monthly cash flow"];
      var notes = ["12-month lease", Math.round(opShare * 100) + "% set-aside", "Phase 1: " + phase1, cf1 >= 0 ? "Yours to keep" : "From your pocket"];
      var bgs = [C.greenSoft, C.mist, C.orangeSoft, cf1 >= 0 ? C.green : C.orange];
      vals.forEach(function (v, i) {
        var tx = M + i * (tw + op), last = i === 3;
        fill(bgs[i]); doc.roundedRect(tx, y, tw, th, 8, 8, "F");
        font("bold", 7.5, last ? C.white : C.muted); doc.text(wrap(labels[i].toUpperCase(), tw - 16), tx + tw / 2, y + 15, { align: "center", lineHeightFactor: 1.2 });
        font("bold", 18, last ? C.white : C.deep); fitSize(v, tw - 12, 18, 11); doc.text(v, tx + tw / 2, y + 47, { align: "center" });
        font("normal", 7.5, last ? [230, 244, 236] : C.muted); doc.text(notes[i], tx + tw / 2, y + 63, { align: "center" });
        if (i < 3) { font("bold", 18, C.muted); doc.text(i === 2 ? "=" : "-", tx + tw + op / 2, y + th / 2 + 6, { align: "center" }); }
      });
      y += th + 8;
    })();
    (function () {
      var pillW = 62, tx = M + 14 + pillW + 12, tw = CW - (tx - M) - 14;
      var msg = "Years " + (drawY + 1) + "-" + span + ": the HELOC payment adjusts to " + money(amort) + "/mo as principal paydown begins, yielding " + sign(cf2) + "/mo net cash flow.";
      font("normal", 9.5); var lines = wrap(msg, tw), bh = lines.length * 13 + 16;
      fill(C.sky); doc.roundedRect(M, y, CW, bh, 8, 8, "F");
      fill(C.navy); doc.roundedRect(M + 14, y + bh / 2 - 9, pillW, 18, 9, 9, "F");
      font("bold", 8, C.white); doc.text("PHASE 2", M + 14 + pillW / 2, y + bh / 2 + 3, { align: "center" });
      font("normal", 9.5, C.deep); doc.text(lines, tx, y + 17.5, { lineHeightFactor: 1.37 });
      y += bh + 12 * gapK;
    })();
    para("Operating expenses: a " + Math.round(opShare * 100) + "% set-aside (" + money(opex) + " a month) for empty months, property tax on the new unit only (Prop 13), landlord insurance and repairs.", 8.5, C.muted, "normal", M, CW, 1.35);
    if (d.rentRange && !tight) para("Rent check: " + plain(d.rentRange) + " is the typical range for a new " + layout.replace(", 1 bath", "").toLowerCase() + " ADU of this size. We confirm it against local rents on the site audit.", 8.5, C.muted, "normal", M, CW, 1.35);
    y += 6 * gapK;
    callout(bothUp
      ? "Stress-tested: drop the rent 10% to " + money(vRent) + " and raise the budget 10% to " + money(vCost) + " at the same time, and the ADU still leaves about " + sign(v1) + " a month in years 1 to " + drawY + " and " + sign(v2) + " after that. Even borrowing the full " + money(cushion) + " budget with cushion leaves about " + sign(cushionCF) + " a month."
      : "Stress test: with rent 10% lower (" + money(vRent) + ") and the budget 10% higher (" + money(vCost) + "), cash flow would be about " + sign(v1) + " a month in years 1 to " + drawY + " and " + sign(v2) + " after that. The site audit is where we tighten the budget and the financing.",
      C.greenSoft, C.green, [20, 84, 52]);
    };
    try { page3(false); }
    catch (e) {
      if (!/page 3/.test(e.message)) throw e;
      doc.deletePage(pageNo); pageNo--;
      page3(true);
    }

    // ================= PAGE 4: EQUITY CREATION & VALUATION UPSIDE =================
    newPage();
    heading(4, "Equity creation & valuation upside", "Equity is what a property is worth minus what you owe on it. A permitted " + (garage ? "garage conversion" : "ADU") + " like this one typically appraises around " + money(perSq) + " per sq ft, more than the $250 per sq ft it costs to build.");
    (function () {
      var gap = 10, bw = (CW - 2 * gap) / 3, bh = 92;
      card(M, bw, bh, C.mist, "Appraisal value per sq ft", "About " + money(perSq), "Estimated for this model, vs $250 per sq ft to build", C.deep, 19);
      card(M + bw + gap, bw, bh, C.sky, "Total asset appreciation", "+" + money(appraisal), "Added to the property's value by the " + sqft.toLocaleString("en-US") + " sq ft ADU", C.navy, 19);
      card(M + 2 * (bw + gap), bw, bh, C.greenSoft, "Day-1 equity creation", sign(equity), "Value added minus the cost to build, once the city signs off", C.green, 19);
      y += bh + 22;
    })();
    sub("Build cost vs. value created");
    y += 16;
    (function () {
      var lx = M + 112, gw = CW - 112 - 62, maxV = Math.max(appraisal, cost) * 1.02, bh = 50, gapB = 30;
      var X = function (v) { return lx + v / maxV * gw; };
      var top = y, chartH = 2 * bh + gapB;
      [["Cost to build", cost, C.navy], ["Value added", appraisal, C.green]].forEach(function (b, i) {
        var by = top + i * (bh + gapB);
        font("bold", 9, C.ink); doc.text(b[0], M, by + bh / 2 + 3);
        fill(b[2]); doc.rect(X(0), by, X(b[1]) - X(0), bh, "F");
        if (i === 1 && b[1] > cost) {
          fill(C.equity); doc.rect(X(cost), by, X(b[1]) - X(cost), bh, "F");
          font("bold", 8.5, C.green); var eqTxt = sign(b[1] - cost);
          if (doc.getTextWidth(eqTxt) + 10 < X(b[1]) - X(cost)) doc.text(eqTxt, X(cost) + 5, by + bh / 2 + 3);
        }
        font("bold", 9, C.deep); doc.text(money(b[1]), X(b[1]) + 6, by + bh / 2 + 3);
      });
      stroke(C.navy); doc.setLineWidth(1); doc.setLineDashPattern([3, 2], 0); doc.line(X(cost), top - 6, X(cost), top + chartH + 6); doc.setLineDashPattern([], 0); doc.setLineWidth(0.6);
      y = top + chartH + 6;
    })();
    var p4Note = "Before any market appreciation. During years 1 to " + drawY + " the loan is interest only, so you still owe " + money(cost) + " at the end of year " + drawY + ". Only a licensed appraiser can set the final value.";
    var p4Catch = "The catch: none of this equity exists until the ADU is permitted and built, and four site conditions decide whether it can be. Page 5 shows what we check and how to book it.";
    var rest = 18 + 10 + 72 + 6 + paraH(p4Note, 8.5, CW, 1.35) + calloutH(p4Catch);
    var free = BOTTOM - 12 - y - rest;
    if (free < 0) throw new Error("Blueprint page 4 overflows");
    var p4Gap = Math.floor(free / 2);
    y += p4Gap;
    sub("Your first " + drawY + " years, added up");
    y += 10;
    (function () {
      var op = 20, tw = (CW - 2 * op) / 3, th = 72;
      var items = [["Day-1 equity", kfmt(equity), C.sky, C.navy], [drawY + " years of cash flow", sign(fiveYr), C.orangeSoft, C.orangeInk], ["Wealth built by year " + drawY, kfmt(equity + fiveYr), C.green, C.white]];
      items.forEach(function (it, i) {
        var tx = M + i * (tw + op);
        fill(it[2]); doc.roundedRect(tx, y, tw, th, 8, 8, "F");
        font("bold", 7.5, i === 2 ? C.white : C.muted); doc.text(it[0].toUpperCase(), tx + tw / 2, y + 21, { align: "center" });
        font("bold", 17, it[3]); fitSize(it[1], tw - 16, 17, 11); doc.text(it[1], tx + tw / 2, y + 48, { align: "center" });
        if (i < 2) { font("bold", 18, C.muted); doc.text(i === 1 ? "=" : "+", tx + tw + op / 2, y + th / 2 + 6, { align: "center" }); }
      });
      y += th + 6;
    })();
    para(p4Note, 8.5, C.muted, "normal", M, CW, 1.35);
    y += p4Gap;
    callout(p4Catch, C.orangeSoft, C.orange, [90, 58, 0]);

    // ================= PAGE 5: SITE FEASIBILITY GAPS & DIRECT CTA =================
    newPage();
    heading(5, "4 things we verify on your lot", "Your numbers work on paper. These four checks are what turn a paper plan into a buildable one. Any of them can change the cost, so we confirm them before you pay for plans.");
    (function () {
      var gaps = [
        ["Sewer depth", "How deep the sewer line runs and its condition from the ADU to the street. It decides whether the ADU can drain by gravity or needs a pump.", "Hookup fees: about $1,000 to $15,000 (page 3)"],
        ["Electrical panel capacity", "Your main panel and utility service size. A new unit may need a panel or service upgrade, which is one of the most common surprise costs.", "Hookup fees: about $1,000 to $15,000 (page 3)"],
        ["City records & overlays", "A city records check for overlay zones, easements, open permits or code cases that could change what can be built or how long plan check takes.", "Plans and plan check: about 2 to 4 months"],
        garage ? ["Garage structure & fit", "The slab, foundation, framing and ceiling height of the existing garage, to confirm it can be converted as-is or what needs work.", "The existing footprint keeps setbacks simple"]
               : ["Rear setbacks & backyard fit", "A site plan showing the 4-foot rear and side setbacks, your home, any garage or shed and trees, to confirm the " + sqft.toLocaleString("en-US") + " sq ft unit fits.", d.impactExempt ? "Under 750 sq ft, city impact fees stay at $0" : "At 749 sq ft or less, city impact fees drop to $0"]
      ];
      var gap = 12, cw = (CW - gap) / 2;
      font("normal", 9);
      var ch = Math.max.apply(null, gaps.map(function (g) { return wrap(g[1], cw - 28).length; })) * 12.2 + 72;
      gaps.forEach(function (g, i) {
        var cx = M + (i % 2) * (cw + gap), cy = y + Math.floor(i / 2) * (ch + gap);
        fill(C.white); stroke(C.line); doc.setLineWidth(1); doc.roundedRect(cx, cy, cw, ch, 9, 9, "FD");
        fill(C.orange); doc.rect(cx, cy + 10, 4, ch - 20, "F");
        fill(C.orangeSoft); doc.circle(cx + 26, cy + 22, 11, "F");
        font("bold", 10.5, C.orangeInk); doc.text(String(i + 1), cx + 26, cy + 26, { align: "center" });
        font("bold", 11.5, C.deep); doc.text(g[0], cx + 44, cy + 26);
        font("normal", 9, C.ink); doc.text(wrap(g[1], cw - 28), cx + 14, cy + 48, { lineHeightFactor: 1.35 });
        fill(C.mist); doc.roundedRect(cx + 12, cy + ch - 24, cw - 24, 16, 5, 5, "F");
        font("bold", 8, C.muted); fitSize(g[2], cw - 40, 8, 6); doc.text(g[2], cx + 20, cy + ch - 13);
      });
      y += 2 * ch + gap + 16;
      doc.setLineWidth(0.6);
    })();
    budget("site checks");
    (function () {
      var y0 = y, pad = 20, qrBox = 118, qrH = 140, qrX = W - M - pad - qrBox, qrY = y0 + 18;
      var textW = qrX - 16 - (M + 38);
      var pts = ["We check all four items above in one visit", "We review what the $250 per sq ft price includes", "Pat Collins (Dedicated Lending Specialist, E Mortgage Capital) reviews your custom HELOC options"];
      font("normal", 10);
      var ptLines = pts.map(function (p) { return wrap(p, textW); });
      var listH = ptLines.reduce(function (s, l) { return s + l.length * 13.5 + 6; }, 0);
      var btnY = Math.max(y0 + 108 + listH + 6, qrY + qrH + 12), btnH = 42;
      var bh = btnY - y0 + btnH + 46;
      fill(C.navy); doc.roundedRect(M, y0, CW, bh, 12, 12, "F");
      fill(C.orange); doc.roundedRect(M + pad, y0 + 18, 132, 18, 9, 9, "F");
      font("bold", 8, C.deep); doc.text("FREE · NO OBLIGATION", M + pad + 66, y0 + 30, { align: "center" });
      font("bold", 20, C.white); doc.text("Book your on-site feasibility", M + pad, y0 + 62);
      doc.text("& financing audit", M + pad, y0 + 86);
      var ly = y0 + 112;
      ptLines.forEach(function (lines) {
        check(M + 22, ly - 4, C.orange);
        font("normal", 10, C.paleNavy); doc.text(lines, M + 38, ly, { lineHeightFactor: 1.35 });
        ly += lines.length * 13.5 + 6;
      });
      // Pat's booking QR: square image, drawn square, centered above its caption
      var qs = 96, qx = qrX + (qrBox - qs) / 2, qy = qrY + 9;
      fill(C.white); doc.roundedRect(qrX, qrY, qrBox, qrH, 9, 9, "F");
      doc.addImage("data:image/png;base64," + QR_PNG, "PNG", qx, qy, qs, qs, "qr-book", "FAST");
      doc.link(qrX, qrY, qrBox, qrH, { url: BOOKING_URL });
      font("bold", 7.6, C.deep); doc.text(wrap("Scan to schedule on your phone", qrBox - 14), qrX + qrBox / 2, qy + qs + 15, { align: "center", lineHeightFactor: 1.25 });
      var gapB = 12, bw2 = (CW - 2 * pad - gapB) / 2, bx1 = M + pad, bx2 = bx1 + bw2 + gapB;
      fill(C.orange); doc.roundedRect(bx1, btnY, bw2, btnH, 9, 9, "F");
      font("bold", 13, C.deep); doc.text("Book my audit", bx1 + bw2 / 2, btnY + 19, { align: "center" });
      font("normal", 8, C.deep); doc.text("Pick a time with Pat online", bx1 + bw2 / 2, btnY + 32, { align: "center" });
      doc.link(bx1, btnY, bw2, btnH, { url: BOOKING_URL });
      fill(C.white); doc.roundedRect(bx2, btnY, bw2, btnH, 9, 9, "F");
      font("bold", 13, C.deep); doc.text("Call " + PHONE, bx2 + bw2 / 2, btnY + 19, { align: "center" });
      font("normal", 8, C.muted); doc.text("Mon - Sat, 7:30 AM - 6:00 PM", bx2 + bw2 / 2, btnY + 32, { align: "center" });
      doc.link(bx2, btnY, bw2, btnH, { url: TEL });
      stroke([70, 96, 150]); doc.line(M + pad, btnY + btnH + 16, W - M - pad, btnY + btnH + 16);
      font("normal", 8.5, C.paleNavy);
      doc.text("Construction by Mars Construction, CSLB #1138550 · Lending by E Mortgage Capital, NMLS #1416824", W / 2, btnY + btnH + 33, { align: "center" });
      y = y0 + bh + 18;
    })();
    budget("call to action");
    sub("What happens after the audit");
    y += 12;
    (function () {
      var steps = [["1", "Site audit", "This week"], ["2", "Final plans & city check", "About 2-4 months"], ["3", "HELOC lined up", "Rate and terms locked"], ["4", "Build & rent", "Permit to keys in 3-6 months"]];
      var tw = CW / 4;
      stroke(C.line); doc.setLineWidth(1.5); doc.line(M + tw / 2, y + 11, M + CW - tw / 2, y + 11); doc.setLineWidth(0.6);
      steps.forEach(function (s, i) {
        var cx = M + i * tw + tw / 2;
        fill(i === 0 ? C.orange : C.navy); doc.circle(cx, y + 11, 11, "F");
        font("bold", 10, i === 0 ? C.deep : C.white); doc.text(s[0], cx, y + 14.5, { align: "center" });
        font("bold", 9.5, C.deep); doc.text(s[1], cx, y + 37, { align: "center" });
        font("normal", 8.5, C.muted); doc.text(s[2], cx, y + 50, { align: "center" });
      });
      y += 56;
    })();
    budget("timeline");

    // ================= COMPACT FOOTER ON EVERY PAGE =================
    var n = doc.getNumberOfPages();
    if (n !== 5) throw new Error("Blueprint should be 5 pages, got " + n);
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      stroke(C.line); doc.setLineWidth(0.6); doc.line(M, FOOT_TOP, W - M, FOOT_TOP);
      font("normal", 6.3, C.muted);
      doc.text(wrap("Estimates for planning only, not a quote, bid, appraisal, zoning decision or loan offer. " + rateP.toFixed(2) + "% is an example rate, not an APR; HELOC rates are usually variable. A HELOC is secured by your home. Loans by E Mortgage Capital Inc., NMLS #1416824. Pat Collins, NMLS #1628553, DRE #02143449. Not a commitment to lend; all loans subject to credit, income, property and underwriting approval. Construction by Mars Construction Industries Corp, CSLB #1138550. Equal Housing Opportunity.", CW - 52), M, FOOT_TOP + 10, { lineHeightFactor: 1.3 });
      font("bold", 7, C.muted); doc.text(p + " / " + n, W - M, FOOT_TOP + 10, { align: "right" });
    }
    doc.setProperties({ title: "ADU Feasibility & Financing Blueprint - " + addr, author: "Let's Talk ADU", subject: title });
    return doc;
  }

  build.PLANS = PLANS;
  build.BOOKING_URL = BOOKING_URL;
  if (typeof module !== "undefined" && module.exports) module.exports = build;
  else root.buildBlueprintPdf = build;
})(typeof window !== "undefined" ? window : this);
