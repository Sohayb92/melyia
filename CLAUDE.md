# CLAUDE.md — Mélyia

**Lis ce fichier au début de chaque session. Ne jamais le bypasser.**

## Projet
App Electron + PWA pour suivi de devis dentaires du Dr Sohaïb Kebieche (Colombes 92). Mono-user, IndexedDB local (Dexie), Gmail API + Drive backup, ~15 devis/mois.

Stack : monolithe `melyia.html` (~5000 lignes) + mirror PWA `web/index.html`. Releases via `gh` CLI vers `Sohayb92/melyia`. Auto-update Electron pour Windows.

## ⚠️ Le user N'EST PAS technique — je fais TOUT pour lui (fixé 2026-06-22)
- **Ne jamais lui demander de taper une commande** (npm, git, node, build, .bat…). Je les exécute moi-même via mes outils.
- **Pour qu'il teste : JE lance l'app pour lui** (voir Commandes utiles). Ne pas dire « tape npm start » — le faire.
- **Expliquer en français simple, zéro jargon.** Donner des gestes concrets (« clic droit sur l'icône M en bas à droite près de l'horloge → Quitter »), pas des instructions techniques.
- Builds, releases, lancements, vérifs, screenshots : **tout passe par moi.** Le user clique au maximum, ne tape rien.

## 6 règles de travail PERMANENTES (le user les a fixées 2026-05-21)

1. **Plan avant le code.** Annoncer en français ce que je vais coder, attendre "OK". Pas de bypass même pour petits fixes.
2. **Vérifier mon propre travail.** Pour chaque modif UI : screenshot via `scripts/screenshot.js`, regarder, corriger, itérer 2-3 fois EN AUTONOMIE avant de montrer.
3. **Git filet de sécurité.** Commit après chaque étape qui fonctionne (pas à la fin). Permet rollback propre.
4. **Mémoire 2 niveaux.** Ce CLAUDE.md = règles permanentes courtes. Mémoire complète dans `~/.claude/projects/.../memory/*.md`.
5. **Questions quand ambigu.** 2-3 options + avis + tradeoffs, laisser user trancher. Ne PAS deviner sur architecture/naming/priorités.
6. **Reste simple.** Volume modeste = solution la plus simple qui marche. Quand tenté de sur-architecturer → demander d'abord.

## Workflow release type
1. Plan présenté + validé
2. Code étape par étape, commit chaque étape qui marche
3. Screenshot des modifs UI + auto-review 2-3 fois
4. Présenter rendu final
5. Attendre "OK push"
6. Build (`npx electron-builder --win nsis`) + tag + push + `gh release create`
7. Update contexte/ (JOURNAL.md, ROADMAP.md) si grosse modif

## Pointers mémoire importants
- `feedback_regles_travail.md` — les 6 règles détaillées
- `feedback_valider_avant_push_prod.md` — workflow validation
- `project_kebieche_cabinet.md` — profil pro user
- `project_melyia_statut_accepte_semantique.md` — "Accepté" = RDV pris ≠ soin fait
- `project_melyia_perimetre_patients.md` — Mélyia couvre que les patients avec devis
- `project_melyia_workflow_rdv_secretaire.md` — RDV soins = secrétaire (jamais Doctolib) ; Doctolib = maintenance only
- `reference_site_devis_links.md` — liens mails→site : /comprendre-mon-devis?soins=… + /rappel?r=jeton&p=nom (CTA « Je souhaite prendre rendez-vous »)
- `reference_google_oauth_setup.md` — config OAuth (Production mode depuis 2026-05-21)
- `reference_google_review_url.md` — lien GBP du cabinet
- `project_marketing_gbp_sprint_dormant.md` — levier ROI #1 jamais démarré

## Tableaux de bord du projet
- `contexte/JOURNAL.md` — historique chronologique des releases et décisions
- `contexte/ROADMAP.md` — roadmap stratégique 90j + status releases
- `contexte/ARCHITECTURE.md` — schéma DB + OAuth setup

## Ne JAMAIS faire
- Push prod sans validation visuelle screenshot + accord user
- Inventer des décisions structurantes (taxonomie, naming) sans demander
- Sur-architecturer (lib lourde, abstraction prématurée)
- Bypass règle 1 (plan avant code) sous prétexte que c'est "petit"
- Mentir sur des faits (ex: APHP au présent alors que le user a arrêté en 2025)
- Push géant en fin de release (commit par étape, règle 3)
- Lien Doctolib pour des RDV de SOINS (Doctolib = maintenance only ; soins = secrétaire). Ni discours coût/prise en charge dans les mails patients.
- Expliquer/afficher l'ALTERNATIVE thérapeutique (RAC0 / acte sans reste à charge) au patient. On ne montre QUE le traitement proposé (mails, page /mon-devis, capture devis).

## Commandes utiles (JE les lance, jamais le user)
- **Lancer l'app DEV** (vraies données + mon code source `melyia.html`) : `Lancer Melyia App.bat`. ⚠️ `ELECTRON_RUN_AS_NODE=1` est présent dans mon shell → toujours lancer via le .bat (ou PowerShell qui clear la var), sinon Electron démarre en mode Node et crashe. ⚠️ **L'app INSTALLÉE doit être quittée** (tray → Quitter) sinon le single-instance lock bloque la version dev (elle ne fait que refocus l'installée).
- **Lancer l'app DEV en données ISOLÉES** : `Lancer Melyia TEST.bat` (dossier `Melyia-DevTest`, peut tourner À CÔTÉ de l'installée, mais réglages Gemini/Google à re-saisir 1×).
- **Screenshot (existe)** : `node scripts/screenshot.js [dashboard|stats|patient-detail|settings] [--mobile]` (Puppeteer, charge melyia.html, relaye les erreurs JS navigateur → sert aussi de check JS).
- Build installer : `npx electron-builder --win nsis` (output `dist-electron/Melyia-Setup-{version}.exe`)
- Path gh CLI : `/c/Program Files/GitHub CLI/gh.exe`
