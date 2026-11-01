// La page /renoncer de MyPadelChamp. Seul script du site. Aucun cookie, aucun stockage du navigateur : le jeton se lit
// dans le fragment de l'adresse et ne sert qu'aux appels à la fonction `retractation`. Ouvrir la page n'écrit rien ;
// seul « Confirmer la rétractation » écrit.
(function () {
  "use strict";

  var JETON = /^#([A-Za-z0-9_-]{43})$/.exec(window.location.hash || "");
  var racine = document.documentElement;
  racine.classList.add("js");
  if (JETON) racine.classList.add("avec-jeton");

  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  var API = LOCAL
    ? "http://127.0.0.1:54321/functions/v1/retractation"
    : "https://qsmncmzsmusemrlulhev.supabase.co/functions/v1/retractation";
  var ECHEC = "Ça n'a pas abouti. Réessaie dans un instant.";
  var NOMBRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

  function appeler(corps) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      credentials: "omit",
      cache: "no-store",
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          // Seule une phrase du serveur se montre ; le navigateur (« Failed to fetch ») et une réponse qui n'est pas
          // du JSON rendent la phrase prévue (S81, PAS-115).
          var e = new Error((j && j.error) || ECHEC);
          e.duServeur = true;
          throw e;
        }
        return j;
      });
    });
  }

  // ─── Le français des dates et de l'argent ───
  function euros(c) {
    var e = Math.floor(c / 100), r = c % 100;
    return r === 0 ? e + " €" : e + "," + (r < 10 ? "0" : "") + r + " €";
  }
  function parties(date, avecHeure) {
    var o = { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric" };
    if (avecHeure) { o.hour = "2-digit"; o.minute = "2-digit"; o.hour12 = false; }
    var p = {};
    new Intl.DateTimeFormat("fr-FR", o).formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    if (p.day === "1") p.day = "1er";
    return p;
  }
  // « lundi 28 décembre », depuis « 2026-12-28 » (jour calendaire, lu à midi pour ne pas changer de jour).
  function jourCourt(ymd) {
    var p = parties(new Date(ymd + "T12:00:00Z"), false);
    return p.weekday + " " + p.day + " " + p.month;
  }
  function jourLong(ymd) {
    var p = parties(new Date(ymd + "T12:00:00Z"), false);
    return p.weekday + " " + p.day + " " + p.month + " " + p.year;
  }
  // « mardi 22 décembre 2026 à 20 h 14 », heure de Paris.
  function quand(iso) {
    var p = parties(new Date(iso), true);
    return p.weekday + " " + p.day + " " + p.month + " " + p.year + " à " + Number(p.hour) + " h " + p.minute;
  }
  function majuscule(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ─── Le DOM ───
  function champ(nom) { return document.querySelector('[data-champ="' + nom + '"]'); }
  function texte(nom, valeur) { champ(nom).textContent = valeur; }
  function grasPuis(nom, gras, suite) {
    var el = champ(nom);
    el.textContent = "";
    var b = document.createElement("b");
    b.textContent = gras;
    el.appendChild(b);
    el.appendChild(document.createTextNode(suite));
  }
  function montrer(etat) {
    document.querySelectorAll("[data-etat]").forEach(function (s) { s.hidden = s.getAttribute("data-etat") !== etat; });
    racine.classList.remove("avec-jeton");
    window.scrollTo(0, 0);
  }
  function erreur(nom, message) {
    var el = champ(nom);
    el.textContent = message;
    el.hidden = !message;
  }

  // La déclaration, avec le Pass et l'équipe en gras comme sur la planche.
  function declaration(phrase, equipe) {
    var el = champ("declaration");
    el.textContent = "";
    var reste = phrase;
    ["Pass Championnat", equipe].forEach(function (gras) {
      var i = reste.indexOf(gras);
      if (i < 0) return;
      el.appendChild(document.createTextNode(reste.slice(0, i)));
      var b = document.createElement("b");
      b.textContent = gras;
      el.appendChild(b);
      reste = reste.slice(i + gras.length);
    });
    el.appendChild(document.createTextNode(reste));
  }

  function partenaire(p) { return p || "ton partenaire"; }

  function motifDuMontant(r) {
    if (!r.en_poule) return "Ta poule n'est pas encore lancée : tu ne dois rien.";
    if (r.demande_expresse !== true) {
      return "Tu n'avais pas demandé que ton championnat commence pendant ce délai : rien ne reste dû, même si ta poule est lancée.";
    }
    var n = r.journees_ouvertes;
    if (n === 0) return "Aucune journée de ta poule n'est encore ouverte : tu ne dois rien.";
    if (n === 1) {
      return "Tu avais demandé que ton championnat puisse commencer pendant ce délai, et la journée 1 est ouverte : " +
        euros(r.retenue_centimes) + " restent dus, un dixième du Pass.";
    }
    // C-Q1 et V1 : « les journées 1 et 2 », puis « les journées 1 à {n} » à partir de trois.
    return "Tu avais demandé que ton championnat puisse commencer pendant ce délai, et les journées " +
      (n === 2 ? "1 et 2" : "1 à " + n) + " sont ouvertes : " + euros(r.retenue_centimes) +
      " restent dus, " + (NOMBRES[n] || n) + " dixièmes du Pass.";
  }

  function afficherDeclaration(d) {
    var c = d.contrat, r = d.remboursement, p = partenaire(c.partenaire_prenom);
    texte("fin-courte", jourCourt(c.fin_delai));
    declaration(c.texte, c.equipe);
    document.getElementById("nom").value = d.prefill.nom || "";
    document.getElementById("adresse").value = d.prefill.adresse || "";
    texte("rembourse", euros(r.rembourse_centimes));
    texte("au-plus-tard", jourCourt(r.au_plus_tard));
    texte("motif", motifDuMontant(r));
    texte("equipe-phrase", r.en_poule
      ? c.equipe + " garde sa place dans la poule. " + majuscule(p) + " peut jouer avec votre remplaçant."
      : c.equipe + " sort de la file d'attente. " + majuscule(p) + " garde son Pass et peut chercher un autre partenaire.");
    montrer("declaration");
  }

  function afficherEnregistree(f) {
    var p = majuscule(partenaire(f.partenaire_prenom));
    texte("recue-le", quand(f.declaree_le));
    if (f.etat === "echec_remboursement") {
      texte("argent", "Ton remboursement de " + euros(f.rembourse_centimes) + " part dans les quatorze jours : nous te l'écrivons dès qu'il est fait.");
    } else {
      grasPuis("argent", euros(f.rembourse_centimes), " repartent sur ta carte. Selon ta banque, ils apparaissent sous cinq à dix jours.");
    }
    texte("adresse-accuse", f.adresse_accuse);
    texte("prevenu", f.en_poule
      ? p + " est prévenu. " + f.equipe + " garde sa place dans la poule."
      : p + " est prévenu. " + f.equipe + " sort de la file d'attente.");
    // En échec, personne n'est encore prévenu et l'équipe n'a pas bougé ; un partenaire sans Pass n'est pas prévenu
    // (V4). La ligne est retirée et non masquée, pour que le dernier fait de la carte reste le dernier pour la feuille
    // de style.
    if (f.etat === "echec_remboursement" || f.partenaire_prevenu === false) champ("prevenu").remove();
    montrer("enregistree");
  }

  function afficherDeja(f) {
    // V9 : accord au genre déclaré.
    texte("deja-titre", f.joueur_feminin ? "Tu t'es déjà rétractée de ce Pass" : "Tu t'es déjà rétracté de ce Pass");
    texte("deja-recue-le", quand(f.declaree_le));
    if (f.etat === "echec_remboursement") {
      texte("deja-argent", "Ton remboursement de " + euros(f.rembourse_centimes) + " part dans les quatorze jours : nous te l'écrivons dès qu'il est fait.");
    } else {
      // S81b (S81-Q4) : le jour réel quand le passage horaire a remboursé un autre jour que la déclaration ; un serveur
      // pas encore redéployé n'envoie pas le champ, et la phrase d'avant reste vraie le jour même.
      grasPuis("deja-argent", euros(f.rembourse_centimes),
        " remboursés sur ta carte le " + (f.rembourse_un_autre_jour || "même jour") + ".");
    }
    montrer("deja_retracte");
  }

  function afficher(rep) {
    if (rep.etat === "declaration") return afficherDeclaration(rep);
    if (rep.etat === "enregistree") return afficherEnregistree(rep.faite);
    if (rep.etat === "deja_retracte") return afficherDeja(rep.faite);
    if (rep.etat === "delai_passe") { texte("fin-longue", jourLong(rep.fin_delai)); return montrer("delai_passe"); }
    montrer("sans_lien");
  }

  function demarrer() {
    var formDeclaration = document.getElementById("form-declaration");
    var formLien = document.getElementById("form-lien");

    formDeclaration.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!formDeclaration.reportValidity()) return;
      var bouton = formDeclaration.querySelector("button");
      bouton.disabled = true;
      erreur("erreur", "");
      appeler({
        action: "confirmer",
        jeton: JETON[1],
        nom: document.getElementById("nom").value,
        adresse: document.getElementById("adresse").value,
      }).then(afficher, function (err) {
        bouton.disabled = false;
        erreur("erreur", err && err.duServeur ? err.message : ECHEC);
      });
    });

    formLien.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!formLien.reportValidity()) return;
      var bouton = formLien.querySelector("button");
      bouton.disabled = true;
      // La réponse est la même dans tous les cas (P7) : le bouton reste éteint, la phrase sous lui la dit déjà.
      appeler({ action: "recevoir-lien", adresse: document.getElementById("adresse-compte").value })
        .catch(function () { bouton.disabled = false; });
    });

    if (!JETON) return;
    appeler({ action: "lire", jeton: JETON[1] }).then(afficher, function () {
      montrer("sans_lien");
    });
  }

  document.addEventListener("DOMContentLoaded", demarrer);
})();
