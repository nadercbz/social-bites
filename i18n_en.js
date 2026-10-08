/* Englische Fassung der Startseite. Tauscht Texte per Wörterbuch (Deutsch zu Englisch) und merkt sich die Wahl.
   Fehlt ein Text im Wörterbuch, bleibt er Deutsch. Neue Texte: unten im Wörterbuch EN ergänzen. */
(function () {
  "use strict";
  var EN = {
    "Reel mit Dina": "Reel with Dina", "Mmaah · KBBQ und Reels 1 bis 3": "Mmaah · KBBQ and reels 1 to 3", "Gratis-Pizzen zur Neueröffnung": "Free pizzas at the opening",
    "Kurzvideos in der Auswahl": "Selected short videos", "Kurzvideo für Spreegold": "Short video for Spreegold", "Reels in der Auswahl": "Selected reels", "Reel für House of Sweets": "Reel for House of Sweets",
    "10 Videos mit Ton": "10 videos with sound", "Sandwich für 5 €": "Sandwich for 5 €", "Bowls und Chicken": "Bowls and chicken", "Das Team": "The team", "9 Instagram-Beiträge": "9 Instagram posts", "So beißen wir uns rein": "How we dig in",
    "Zum Inhalt springen": "Skip to content", "Projekte": "Projects", "Leistungen": "Services", "Pakete": "Packages", "So läuft's": "How it works",
    "Kundenportal": "Client portal", "Projekt starten": "Start a project", "Wir machen": "We make", "den": "that", "keiner wegscrollt": "nobody scrolls past",
    "Social Media für Gastro und Unternehmen aus Berlin.": "Social media for restaurants and businesses in Berlin.",
    "Über 100 Millionen organische Views auf TikTok und Instagram.": "Over 100 million organic views on TikTok and Instagram.", "mit": "with",
    "Unser • Reel": "Our • Reel", "Food Content": "Food content", "Views auf TikTok": "views on TikTok", "Views auf Instagram": "views on Instagram",
    "Video ansehen": "Watch video", "Original auf TikTok": "Original on TikTok", "Original auf Instagram": "Original on Instagram", "Food-Challenge": "Food challenge",
    "Ein Trend, eine Crew, ein Restaurant. Tanz-Video mitten im Burger King, gedreht für den TikTok-Kanal von Burger King Deutschland.": "One trend, one crew, one restaurant. A dance video in the middle of a Burger King, shot for the TikTok channel of Burger King Germany.",
    "Food-Challenge bei Mmaah KBBQ: Schaffst du beide, zahlst du nix. Ein Reel, das Hunger macht und zum Mitmachen einlädt.": "Food challenge at Mmaah KBBQ: finish both and you pay nothing. A reel that makes you hungry and invites you to join in.",
    "Neueröffnung von null auf Schlange vor der Tür. Umbau als Serie, Food-Reels jeden Tag, und am Opening 500 Pizzen gratis. Im Netz angekündigt, vor Ort eingelöst.": "A new opening from zero to a queue at the door. The renovation as a series, food reels every day, and 500 free pizzas on opening day. Announced online, redeemed on site.",
    "Mit ESN bei der Mr. Olympia. Athleten, Backstage und die riesigen Billboards, geschnitten als Reel für Instagram.": "With ESN at Mr. Olympia. Athletes, backstage and the huge billboards, cut as a reel for Instagram.",
    "POV: Du musst vor der Gamescom noch schnell zu Aldi. Freier Fall über die Karte bis zum GG Market.": "POV: you need to pop into Aldi before Gamescom. Free fall across the map down to the GG Market.",
    "Tulpen von Blume 2000, per Wolt nach Hause geliefert. Reel mit Untertiteln Wort für Wort.": "Tulips from Blume 2000, delivered home via Wolt. A reel with word-by-word subtitles.",
    "Eine Flasche Spreequell auf Tour durch Berlin. Aus der Spree über U-Bahn und Döner bis aufs Hochhaus.": "A bottle of Spreequell on tour through Berlin. From the Spree via subway and doner to the high-rise.",
    "Nachtdreh in Rot und Schwarz. Fashion-Film für Zalando und Nike, von der Neon-Treppe bis auf die Straße.": "A night shoot in red and black. Fashion film for Zalando and Nike, from the neon staircase to the street.",
    "Kurzvideos für 44 Chicken: die Vorstellung, Bowls und Chicken, und das Sandwich für 5 €.": "Short videos for 44 Chicken: the introduction, bowls and chicken, and the 5 € sandwich.",
    "Kurzvideo für das Restaurant Spreegold.": "A short video for the restaurant Spreegold.",
    "Reel für Crazy Canes mit Dina: Chicken, Sauce und Crunch im Mittelpunkt.": "A reel for Crazy Canes with Dina: chicken, sauce and crunch at the centre.",
    "Reels für den Mian Market: Produkte, Atmosphäre und der Laden in kurzen, direkten Clips.": "Reels for Mian Market: products, atmosphere and the shop in short, direct clips.",
    "Ein Reel für House of Sweets: Süßes in Szene gesetzt, vom ersten Bild bis zum letzten Biss.": "A reel for House of Sweets: sweets staged from the first frame to the last bite.",
    "Unsere • Haltung": "Our • Mindset", "Wirkung, nicht nur Reichweite.": "Impact, not just reach.",
    "Wir bringen Marken und Menschen digital näher zusammen. 80 % der deutschen Unternehmen sind auf Social Media aktiv (laut Bitkom), doch viele bleiben unter ihrem Potenzial.": "We bring brands and people closer together digitally. 80 % of German companies are active on social media (according to Bitkom), yet many stay below their potential.",
    "Das Problem ist nicht die Plattform. Das Problem ist fehlende Strategie und Konstanz.": "The problem is not the platform. The problem is a missing strategy and consistency.",
    "organische Views": "organic views", "Kunden und Projekte": "clients and projects", "Bereit, deine Marke sichtbar zu machen?": "Ready to make your brand visible?", "Kostenloses Erstgespräch": "Free intro call",
    "Unsere • Leistungen": "Our • Services", "Konzept": "Concept", "Produktion": "Production", "KI": "AI", "Flächen": "Space", "Beratung": "Consulting",
    "Reels für TikTok und Instagram, Karussells und Fotos. Wir drehen vor Ort, schneiden, posten und betreuen die Community.": "Reels for TikTok and Instagram, carousels and photos. We shoot on site, edit, post and look after the community.",
    "Skripte, Storys, Shotlists und der komplette Marketingplan. Ein Konzept, das zu deiner Marke passt.": "Scripts, stories, shotlists and the complete marketing plan. A concept that fits your brand.",
    "Neueröffnungen, Kampagnen und Events, die vorher online laufen und am Tag X die Schlange holen. Mit Influencern aus unserem Netzwerk.": "Openings, campaigns and events that run online beforehand and bring the queue on day X. With influencers from our network.",
    "Logo, Farben, Schrift, Menuboard, Fensterbeklebung und Werbeanlage. Alles, was ein Laden braucht, um aufzufallen.": "Logo, colours, typography, menu board, window graphics and signage. Everything a venue needs to stand out.",
    "Musikvideos, Imagefilme und Werbevideos auf cinematischem Level, von der Idee bis zum fertigen Film.": "Music videos, image films and commercials at a cinematic level, from the idea to the finished film.",
    "Autonome Workflows, die dich entlasten und mit deinen Firmenwerten eigenständig für dein Unternehmen arbeiten. Für deinen Fall eingerichtet.": "Autonomous workflows that take work off your plate and run on your company values on their own. Set up for your case.",
    "Beratung bei der Suche nach Geschäfts- und Store-Flächen, als Beratungsleistung gegen Gebühr. Direkt verbunden mit dem Marketing zum Start.": "Advice on finding commercial and store space, as a consulting service for a fee. Directly linked to the marketing for your launch.",
    "Passt etwas davon zu deinem Vorhaben?": "Does any of this fit your plan?",
    "Unsere • Pakete": "Our • Packages", "Drei Pakete. Ein Biss.": "Three packages. One bite.",
    "Für jeden Laden das passende Paket, vom ersten Spatenstich bis zur Kampagne für die ganze Kette. Jedes Paket stellen wir nach dem Erstgespräch auf dich zusammen.": "A fitting package for every venue, from the first shovel to a campaign for a whole chain. We tailor each package for you after the intro call.",
    "Neuer Laden": "New venue", "Neueröffnung mit Content und Opening-Event. Von der Baustelle bis zur Schlange vor der Tür.": "Opening with content and an opening event. From the construction site to the queue at the door.",
    "Preis": "Price", "auf Anfrage": "on request", "Anfragen": "Enquire", "Was drin ist": "What's inside", "Bestehender Laden": "Existing venue",
    "Monatliche Betreuung für Läden, die mehr Gäste, mehr Reichweite und einen Kanal wollen, der endlich läuft.": "Monthly support for venues that want more guests, more reach and a channel that finally works.",
    "Kette und Marke": "Chain and brand", "Kampagnen für Systemgastronomie und Marken. Mit Einkauf, Recht und mehreren Freigabestufen.": "Campaigns for chain restaurants and brands. With procurement, legal and several approval stages.",
    "Zeitraum": "Period", "Dieses Paket anfragen": "Enquire about this package", "Lieber anrufen": "Prefer to call",
    "Film • Foto • Musik": "Film • Photo • Music", "Mehr als Food.": "More than food.", "Commercials, Musikvideos mit zusammen": "Commercials, music videos with a combined",
    "auf YouTube, Food-Fotografie, Kampagnen und Reels für Kunden, Events und Blicke hinter die Kamera. Das bringt unser Kollektiv mit an den Tisch.": "on YouTube, food photography, campaigns and reels for clients, events and behind the scenes. That is what our collective brings to the table.",
    "Musikvideos": "Music videos", "Kampagnen & Reels": "Campaigns & Reels", "Das könnte dein nächstes Projekt sein.": "This could be your next project.", "Original ansehen": "View original",
    "Views laut YouTube, Stand 07.10.2026. Die Musikvideos laufen auf den Kanälen der Artists.": "Views according to YouTube, as of 07.10.2026. The music videos run on the artists' channels.",
    "So beißen wir uns rein": "How we dig in", "Briefing": "Briefing", "Wir hören zu.": "We listen.",
    "Was soll passieren? Mehr Gäste, ein Opening, ein neues Gericht, ein Kanal, der endlich läuft. Wir klären Ziele und Positionierung, dann kommt der Content.": "What should happen? More guests, an opening, a new dish, a channel that finally works. We clarify goals and positioning, then comes the content.",
    "Moodboard, Story, Plan.": "Moodboard, story, plan.", "Wir bauen die Geschichte, schreiben die Skripte und legen fest, wie Social Media und echte Aktion vor Ort zusammenspielen.": "We build the story, write the scripts and decide how social media and real action on site work together.",
    "Dreh": "Shoot", "Shotlist steht, Kamera läuft.": "Shotlist is set, camera rolling.",
    "Komplette Shotlist für den Tag. Wir bündeln alles in einem Drehtag bei dir vor Ort, führen Regie und organisieren die Talente vor der Kamera.": "Complete shotlist for the day. We bundle everything into one shoot day at your place, direct, and organise the talent in front of the camera.",
    "Schnitt": "Edit", "Schnitt, Posting, Community.": "Edit, posting, community.", "Editing mit Hook in den ersten drei Sekunden. Auf Wunsch posten wir für dich, antworten auf Kommentare, werten die Zahlen aus und optimieren laufend.": "Editing with a hook in the first three seconds. If you like, we post for you, reply to comments, evaluate the numbers and keep optimising.",
    "Vor Ort": "On site", "Aus Views werden Gäste.": "Views become guests.", "Opening, Event, Influencer-Abend. Der Moment, in dem Leute vom Handy aufschauen und bei dir vor der Tür stehen.": "Opening, event, influencer evening. The moment people look up from their phones and stand at your door.",
    "Online + vor Ort": "Online + on site", "Content, den Leute sehen wollen": "Content people want to watch", "Kundenportal ansehen": "View client portal",
    "Kostenloses Erstgespräch: Ziele und Umfang festlegen, ersten Drehtag planen.": "Free intro call: set goals and scope, plan the first shoot day.", "Lieber direkt anrufen?": "Prefer to call directly?",
    "Haltung": "Mindset", "bald": "soon", "Hauptquartier": "Headquarters", "Berlin, Deutschland": "Berlin, Germany", "Das sagen • Kunden": "What clients • say", "Stimmen.": "Voices.",
    "Nach oben ↑": "Back to top ↑", "© 2026 Social Bites. Alle Rechte vorbehalten.": "© 2026 Social Bites. All rights reserved.", "Website Version 2.0": "Website version 2.0",
    "Projekt • starten": "Start a • project", "Worum geht's?": "What's it about?", "Tipp an, was passt. Mehrere gehen auch.": "Tap what fits. Several is fine.",
    "Food Content & Reels": "Food content & reels", "Opening oder Event": "Opening or event", "Branding & Laden": "Branding & design", "Film Produktion": "Film production", "KI Automation": "AI automation",
    "Weiß ich noch nicht": "Don't know yet", "Wann soll's losgehen?": "When should it start?", "So schnell wie möglich": "As soon as possible", "In 1 bis 3 Monaten": "In 1 to 3 months", "Erst mal informieren": "Just looking for now",
    "Erzähl kurz.": "Tell us briefly.", "Laden oder Marke": "Venue or brand", "Was habt ihr vor?": "What are you planning?", "(optional)": "(optional)", "Wie erreichen wir dich?": "How can we reach you?",
    "Dein Name": "Your name", "E-Mail": "Email", "Telefon": "Phone", "Wie sollen wir uns melden?": "How should we get in touch?", "Per Mail": "By email", "Anruf": "Call",
    "Ich bin einverstanden, dass Social Bites meine Angaben für diese Anfrage nutzt. Sie werden über den Dienst FormSubmit per Mail an uns geschickt und nicht weitergegeben.": "I agree that Social Bites uses my details for this enquiry. They are sent to us by email via the FormSubmit service and not passed on.",
    "Zurück": "Back", "Weiter": "Next", "Anfrage senden": "Send enquiry", "Danke!": "Thank you!", "Deine Anfrage ist bei uns. Wir melden uns so schnell wie möglich.": "Your enquiry has arrived. We will get back to you as soon as possible.",
    "Schließen": "Close", "Per Mail-Programm senden": "Send via email app", "Lieber direkt?": "Rather direct?", "Ruf an oder schreib uns per WhatsApp. Wir melden uns so schnell wie möglich.": "Call or write us on WhatsApp. We will get back to you as soon as possible."
  };
  var PATTERNS = [[/^Schritt (\d+)$/, "Step $1"], [/^(\d+) Projekte$/, "$1 projects"]];
  var KEY = "sb-lang", orig = new WeakMap(), lang = "de";
  try { lang = localStorage.getItem(KEY) || (/^en/i.test(navigator.language || "") ? "de" : "de"); } catch (e) {}
  function tr(t) {
    var k = t.replace(/\s+/g, " ").trim();
    if (EN[k]) return EN[k];
    for (var i = 0; i < PATTERNS.length; i++) if (PATTERNS[i][0].test(k)) return k.replace(PATTERNS[i][0], PATTERNS[i][1]);
    return null;
  }
  function walk(root, toEn) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      var p = n.parentNode && n.parentNode.nodeName; return /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    var n, list = []; while ((n = w.nextNode())) list.push(n);
    list.forEach(function (n) {
      if (toEn) { var o = orig.has(n) ? orig.get(n) : n.nodeValue, t = tr(o); if (t) { if (!orig.has(n)) orig.set(n, n.nodeValue); var lead = /^\s/.test(o) ? " " : "", trail = /\s$/.test(o) ? " " : ""; n.nodeValue = lead + t + trail; } }
      else if (orig.has(n)) { n.nodeValue = orig.get(n); }
    });
  }
  function apply() {
    var en = lang === "en";
    document.documentElement.lang = en ? "en" : "de";
    walk(document.body, en);
    var b = document.getElementById("lang-btn"); if (b) { b.textContent = en ? "DE" : "EN"; b.setAttribute("aria-label", en ? "Auf Deutsch wechseln" : "Switch to English"); }
  }
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("lang-btn");
    if (b) b.addEventListener("click", function () { lang = lang === "en" ? "de" : "en"; try { localStorage.setItem(KEY, lang); } catch (e) {} apply(); });
    if (lang === "en") apply();
  });
})();
