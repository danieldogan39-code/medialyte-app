// Beispiel-Tischbuch: erfundene Anfragen und ein Verlauf mit dem Website-Agenten, alles nur im Browser.
// Ersetzt im Beispiel den Dienst: Bestätigen, Ablehnen, Einstellungen und der Chat funktionieren, gesendet wird nichts.
(function () {
  "use strict";
  var BERLIN = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
  var heute = BERLIN.format(new Date());
  function tag(n) { var d = new Date(heute + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function vor(min) { return new Date(Date.now() - min * 60000).toISOString(); }
  var nr = 0;
  function neueId() { nr += 1; return "b" + nr + Date.now().toString(36); }
  function kopie(x) { return JSON.parse(JSON.stringify(x)); }
  function anfrage(t, uhrzeit, personen, name, telefon, status, vorMin, extra) {
    var a = { id: neueId(), zeit: vor(vorMin), datum: tag(t), uhrzeit: uhrzeit, personen: personen, name: name, telefon: telefon, email: "",
              nachricht: "", status: status, von: status === "offen" ? "" : "restaurant", hinweis: "" };
    if (status !== "offen") a.entschieden = vor(Math.max(1, vorMin - 12));
    for (var k in extra || {}) a[k] = extra[k];
    return a;
  }

  var BUCH = {
    lokal: { name: "", pause_bis: null, pause_alle: false, auto: true, auto_regel: { an: true, max: 4, tische: 2 }, telefon: "", geraete: 2, mail_aktiv: false },
    anfragen: [
      anfrage(0, "19:30", 6, "Familie Yılmaz", "0151 1234 5601", "offen", 18, { nachricht: "Wir feiern einen Geburtstag, gern ein ruhiger Tisch." }),
      anfrage(1, "12:30", 2, "Jonas Hartmann", "0176 1234 5602", "offen", 52),
      anfrage(0, "18:00", 2, "Laura Schmidt", "0160 1234 5603", "bestaetigt", 1500, { von: "auto" }),
      anfrage(0, "19:00", 4, "Ali Demir", "0172 1234 5604", "bestaetigt", 2900),
      anfrage(0, "20:15", 3, "Sophie Lange", "0157 1234 5605", "bestaetigt", 400, { von: "auto" }),
      anfrage(1, "19:30", 5, "Markus Becker", "0171 1234 5606", "bestaetigt", 3000),
      anfrage(3, "18:30", 9, "Team Nordlicht", "0170 1234 5607", "bestaetigt", 2000, { nachricht: "Weihnachtsessen mit dem Team" }),
      anfrage(-1, "19:00", 2, "Nina Wolf", "0152 1234 5608", "bestaetigt", 4000, { von: "auto" }),
      anfrage(-1, "20:30", 10, "Tim Richter", "0178 1234 5609", "abgelehnt", 3500, { hinweis: "Leider sind wir zu dieser Zeit ausgebucht." }),
      anfrage(-3, "13:00", 2, "Eva Krause", "0159 1234 5610", "bestaetigt", 6000)
    ]
  };

  var AG = {
    arbeitet: false, eingerichtet: true,
    nachrichten: [
      { id: "w1", von: "wirt", text: "Neues Tagesgericht ab Montag: Linsensuppe mit Brot für 7,50 €", fotos: 0, zeit: vor(3 * 1440 + 130), status: "erledigt" },
      { id: "v1", von: "agent", art: "vorschau", text: "Fertig. Die Linsensuppe steht als Tagesgericht oben auf Ihrer Startseite, im Stil Ihrer Karte. Sie erscheint ab Montag von selbst.",
        bild: "bild-tagesgericht.webp", zeit: vor(3 * 1440 + 128), status: "online" },
      { id: "o1", von: "agent", art: "online", text: "Ist online. Ab Montag sehen Ihre Gäste die Linsensuppe auf der Website.", zeit: vor(3 * 1440 + 110), aenderung: "k1" },
      { id: "w2", von: "wirt", text: "An Heiligabend und am ersten Weihnachtstag haben wir zu, Silvester nur bis 15 Uhr.", fotos: 0, zeit: vor(26), status: "erledigt" },
      { id: "v2", von: "agent", art: "vorschau",
        text: "Fertig. Oben auf der Seite steht jetzt ein Hinweis zu Weihnachten und Silvester. Online-Reservierungen sind am 24. und 25.12. gesperrt, an Silvester gehen sie bis 14 Uhr. Nach dem 31.12. verschwindet der Hinweis von selbst.",
        bild: "bild-weihnachten.webp", zeit: vor(24), status: "offen" }
    ]
  };

  function melden() { try { window.dispatchEvent(new Event("tb-beispiel")); } catch (e) {} }
  function spaeter(ms, f) { setTimeout(function () { f(); melden(); }, ms); }
  function fuerWirt() { return kopie(AG); }
  function fehler(status) { var e = new Error(String(status)); e.status = status; e.daten = fuerWirt(); return Promise.reject(e); }
  function agentSagt(art, text, extra) {
    var m = { id: neueId(), von: "agent", art: art, text: text, zeit: new Date().toISOString() };
    for (var k in extra || {}) m[k] = extra[k];
    AG.nachrichten.push(m);
    return m;
  }

  window.TB_BEISPIEL = {
    buch: function (methode, body) {
      if (methode === "GET") return Promise.resolve({ lokal: kopie(BUCH.lokal), anfragen: kopie(BUCH.anfragen), heute: BERLIN.format(new Date()) });
      var d = body || {};
      if (d.aktion === "entscheiden") {
        var a = BUCH.anfragen.filter(function (x) { return x.id === d.id; })[0];
        if (!a) return Promise.reject(new Error("404"));
        a.status = d.status; a.von = "restaurant"; a.entschieden = new Date().toISOString(); a.hinweis = String(d.hinweis || "").slice(0, 300);
        return Promise.resolve({ anfrage: kopie(a), gemailt: false });
      }
      if (d.aktion === "einstellungen") {
        if (d.auto) BUCH.lokal.auto_regel = { an: !!d.auto.an, max: Number(d.auto.max) || 4, tische: Number(d.auto.tische) || 2 };
        if ("pause" in d) {
          BUCH.lokal.pause_alle = !!(d.pause && d.pause.alle);
          BUCH.lokal.pause_bis = d.pause && d.pause.bis ? d.pause.bis : null;
        }
        BUCH.lokal.auto = !!BUCH.lokal.auto_regel.an;
        return Promise.resolve({ lokal: kopie(BUCH.lokal) });
      }
      return Promise.resolve({ gesendet: 0 });
    },
    agent: function (methode, body) {
      if (methode === "GET") return Promise.resolve(fuerWirt());
      var d = body || {};
      if (d.aktion === "nachricht") {
        if (AG.arbeitet) return fehler(409);
        var text = String(d.text || "").trim().slice(0, 2000), fotos = (d.fotos || []).length;
        if (!text && !fotos) return fehler(400);
        var w = { id: neueId(), von: "wirt", text: text, fotos: fotos, zeit: new Date().toISOString(), status: "wartet" };
        AG.nachrichten.push(w); AG.arbeitet = true;
        spaeter(4000, function () {
          w.status = "erledigt"; AG.arbeitet = false;
          agentSagt("info", "Das hier ist ein Beispiel, darum baue ich nichts. Im echten Tischbuch arbeite ich jetzt an Ihrer Änderung und schicke Ihnen in ein bis drei Minuten eine Vorschau wie die oben. Online geht sie erst, wenn Sie „Übernehmen“ tippen.");
        });
        return Promise.resolve(fuerWirt());
      }
      var m = AG.nachrichten.filter(function (x) { return x.id === d.id; })[0];
      if (d.aktion === "uebernehmen") {
        if (!m || m.art !== "vorschau" || m.status !== "offen" || AG.arbeitet) return fehler(409);
        m.status = "wird_online"; AG.arbeitet = true;
        spaeter(3500, function () {
          m.status = "online"; AG.arbeitet = false;
          agentSagt("online", "Ist online. Der Hinweis zu Weihnachten und Silvester steht jetzt auf Ihrer Website, die Reservierung richtet sich danach.", { aenderung: "k" + m.id });
        });
        return Promise.resolve(fuerWirt());
      }
      if (d.aktion === "verwerfen") {
        if (!m || m.art !== "vorschau" || m.status !== "offen") return fehler(409);
        m.status = "verworfen";
        agentSagt("info", "Alles klar, die Änderung ist verworfen. Ihre Website bleibt, wie sie ist.");
        return Promise.resolve(fuerWirt());
      }
      if (d.aktion === "zurueck") {
        if (AG.arbeitet) return fehler(409);
        var online = AG.nachrichten.slice().reverse().filter(function (x) { return x.von === "agent" && (x.art === "online" || x.art === "zurueck"); })[0];
        if (!online || online.art !== "online" || online.zurueck) return fehler(409);
        AG.nachrichten.push({ id: neueId(), von: "wirt", text: "Bitte die letzte Änderung zurücknehmen.", fotos: 0, zeit: new Date().toISOString(), status: "wartet", rueckgaengig: true });
        AG.arbeitet = true;
        spaeter(3500, function () {
          online.zurueck = true; AG.arbeitet = false;
          AG.nachrichten.forEach(function (x) { if (x.status === "wartet") x.status = "erledigt"; });
          agentSagt("zurueck", "Zurückgenommen. Ihre Website ist wieder so wie vor der letzten Änderung.");
        });
        return Promise.resolve(fuerWirt());
      }
      return fehler(400);
    }
  };
})();
