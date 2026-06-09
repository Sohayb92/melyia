# CLAUDE.md — Mélyia

**Lis ce fichier au début de chaque session. Ne jamais le bypasser.**

## Projet
App Electron + PWA pour suivi de devis dentaires du Dr Sohaïb Kebieche (Colombes 92). Mono-user, IndexedDB local (Dexie), Gmail API + Drive backup, ~15 devis/mois.

Stack : monolithe `melyia.html` (~5000 lignes) + mirror PWA `web/index.html`. Releases via `gh` CLI vers `Sohayb92/melyia`. Auto-update Electron pour Windows.

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

## Commandes utiles
- Build installer : `npx electron-builder --win nsis` (output `dist-electron/Melyia-Setup-{version}.exe`)
- Path gh CLI : `/c/Program Files/GitHub CLI/gh.exe`
- Screenshot : `node scripts/screenshot.js <url-ou-fichier>` (à créer)
