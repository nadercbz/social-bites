/* Partnerprogramm von Social Bites: eine Quelle für Stufen, Sätze und Regeln.
   Wird von partner.html (öffentlich), partner-leitfaden.html (PDF) und partner-team.html (intern) gelesen.
   Die Zahlen sind ein VORSCHLAG und müssen von Nader und Tommy freigegeben werden. Ändern: nur hier. */
window.PARTNER_CFG = {
  stand: "07.10.2026",
  entwurf: true,                       // true: im Portal-Fenster erscheint der Hinweis "Entwurf, noch nicht freigegeben"
  url: "https://nadercbz.github.io/social-bites/",
  frist: 90,                           // Tage, in denen eine Empfehlung zählt
  auszahlungTage: 30,                  // Tage nach Zahlungseingang des Kunden
  punkteProTausend: 1,                 // Anteilspunkte je 1.000 Euro Netto-Auftragswert, mal Stufenfaktor
  pool: { prozent: 3 },                // Prozent vom Jahresgewinn, die in den Partner-Pool gehen
  stufen: [
    { id: "tipp",    name: "Tippgeber", ab: 1, satz: 8,  faktor: 1,   text: "Du stellst den Kontakt her. Wir übernehmen alles andere." },
    { id: "partner", name: "Partner",   ab: 3, satz: 10, faktor: 1.5, text: "Ab dem 3. Abschluss. Dazu Infomaterial mit deinem Namen und früher Zugang zu neuen Paketen." },
    { id: "circle",  name: "Circle",    ab: 6, satz: 12, faktor: 2,   text: "Ab dem 6. Abschluss. Höchster Satz, doppelte Punkte und ein Platz beim Jahrestreffen." }
  ],
  pakete: [
    { id: "opening", name: "Bites Opening",    modus: "einmalig", label: "Netto-Auftragswert",  start: 5000,  hinweis: "Provision auf den Netto-Auftragswert." },
    { id: "gastro",  name: "Bites for Gastro", modus: "monate",   label: "Monatsbetrag netto",  start: 1500,  monate: 6, hinweis: "Provision auf die ersten 6 Monatsbeträge." },
    { id: "brands",  name: "Bites for Brands", modus: "einmalig", label: "Netto-Auftragswert",  start: 20000, hinweis: "Provision auf den Netto-Auftragswert, ausgezahlt wie der Kunde zahlt." }
  ],
  pitch: {
    kurz:  "Social Bites macht Content und Openings für Gastro und Marken in Berlin. Online gesehen, offline gegessen.",
    mittel: "Social Bites ist ein Kollektiv aus Berlin. Wir produzieren virale Food-Videos, planen Openings und bauen die komplette Markenausstattung für Läden, von der Idee bis zur Eröffnung. Über 5 Millionen Views auf TikTok und Instagram, unter anderem für Burger King, Aldi Nord und Wolt.",
    lang:  "Social Bites verbindet Social Media mit echtem Offline-Marketing. Wir drehen die Videos, schreiben die Konzepte, gestalten Logo, Menüboards und Schaufenster und organisieren das Opening vor Ort. Drei feste Pakete: Bites Opening für Neueröffnungen, Bites for Gastro für die monatliche Betreuung und Bites for Brands für Kampagnen und Filme. Preise nennen wir nach einem kurzen Gespräch, damit alles zum Laden passt."
  },
  signale: [
    "Der Mietvertrag ist unterschrieben und die Eröffnung rückt näher",
    "Neu bei Wolt oder Lieferando, aber noch ohne Bewertungen",
    "Instagram und TikTok liegen brach",
    "Neue Speisekarte, neues Konzept oder Rebranding",
    "Ein Opening oder Event ist geplant",
    "Eine Marke will eine Kampagne oder einen Film"
  ],
  zielgruppe: ["Gastro-Berater", "Makler und Vermieter", "Steuerberater", "Lieferanten und Großhandel", "Franchise-Geber", "Innenausbau und Bauleitung", "Designer und Fotografen", "Creator und Influencer", "Gründerberater", "Kollegen aus der Gastro"]
};
