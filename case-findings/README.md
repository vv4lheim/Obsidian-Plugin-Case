# Case Findings — plugin Obsidian

Suivi des findings d'une enquête (CTF, DFIR, pentest) : tu notes tes trouvailles dans un callout `[!finding]`, et une hotkey t'affiche un tableau filtrable de tout ce que tu as trouvé dans l'enquête, toutes notes confondues.

## Installation

1. Ferme Obsidian (ou pas, ça marche aussi à chaud).
2. Copie le dossier `case-findings/` (celui qui contient `main.js`, `manifest.json`, `styles.css`) dans :
   ```
   <ton vault>/.obsidian/plugins/case-findings/
   ```
3. Obsidian → **Paramètres → Plugins communautaires** → désactive le mode restreint si besoin → active **Case Findings**.

> Avec Nextcloud : le dossier `.obsidian/plugins/` se synchronise comme le reste, le plugin sera dispo sur tes autres machines.

## Utilisation

### 1. Rattacher les notes à une enquête

Dans le frontmatter de chaque note de l'enquête :
```yaml
---
case: findme
---
```
Une note peut appartenir à plusieurs enquêtes : `case: [findme, phishing-lab]`.
Raccourci : commande **« Rattacher la note à une enquête (case:) »** (propose les enquêtes existantes).

### 2. Noter les findings

```markdown
> [!finding] Dump RAM fr01.mem
> hash:: 47bf8039a8506cd67c524a03ff84ba4e | NT hash Administrator
> password:: R3sqdl3Fuuz2ZdbdYsf56opFFLe9sAsx | conteneur findme
> user:: vivek
> ip:: 65.21.176.119 | C2, vu dans netscan
> screen:: ![[netscan.png]] | sortie netscan
```

- Une ligne = un finding : `type:: valeur | commentaire`.
- Le type est libre (`hash`, `password`, `user`, `ip`, `domain`, `url`, `email`, `path`, `file`, `process`, `port`, `registry`, `cmd`, `flag`, `screen`…). Les types courants ont une icône.
- Le commentaire est optionnel, séparé par ` | ` (espace-barre-espace). Si la valeur contient elle-même ` | `, mets-la entre backticks : `` password:: `ab | cd` | commentaire ``.
- Le titre du callout est optionnel. Il apparaît sous la source dans le tableau.
- `[!findings]` marche aussi, et tu peux ajouter d'autres noms dans les réglages (ex. `ioc`).
- Les blocs de code, les callouts imbriqués et les lignes sans `::` sont ignorés.

Raccourcis :
- **« Insérer un callout finding »** : insère un modèle prêt à remplir.
- **« Ajouter la sélection comme finding »** : sélectionne un hash / un user dans ta note, lance la commande, choisis le type → un callout est ajouté sous la ligne (ou la ligne est ajoutée au callout si ta sélection est déjà dedans).

### 3. Retrouver

**`Ctrl+Alt+F`** (modifiable dans Paramètres → Raccourcis clavier) ouvre le panneau latéral :

- **Sélecteur d'enquête** : suit automatiquement l'enquête de la note ouverte (📌). Clique sur l'épingle pour figer.
- **Recherche** instantanée sur valeur, commentaire, type, nom de note.
- **Filtres par type** avec compteurs.
- **Clic sur une valeur = copiée.** Bouton copier aussi à droite.
- **Clic sur la source** = ouvre la note à la bonne ligne (`Ctrl+clic` = nouvel onglet).
- **Miniatures** des captures (`screen:: ![[...]]`), clic pour ouvrir l'image.
- **`×2 notes`** : la même valeur apparaît dans plusieurs notes de l'enquête → clic pour filtrer.
- **`↔ autre-enquête`** : la valeur apparaît aussi dans une autre enquête → clic pour y aller. C'est le « j'avais l'info mais je n'y avais pas pensé ».
- **Export** (icône ⬇) : tableau Markdown (pour un writeup), CSV, ou juste la liste des valeurs (pour une wordlist, un grep…).

Commande **« Afficher les findings dans un onglet »** pour le grand tableau en pleine largeur. En panneau étroit, l'affichage passe automatiquement en cartes.

Dans les notes, en **mode lecture**, les callouts finding sont affichés en mini-tableau avec valeurs copiables. En aperçu en direct, ils restent éditables en texte.

## Réglages

- Noms de callout reconnus (défaut : `finding, findings`)
- Champ du frontmatter pour l'enquête (défaut : `case`)
- Suivre la note active (défaut : oui)
- Miniatures des captures (défaut : oui)

## Développement

```bash
npm install
npm run dev     # build en watch (main.js)
npm run build   # build de prod
npm test        # tests du parser
```
Code : `src/parser.ts` (parsing pur, testé) et `src/main.ts` (index, vue, commandes).

## Tuples — lier des donnees sur une ligne (« with »)

Pour garder ensemble des infos qui vont de pair (un compte + son mot de passe + sa machine), separe-les par ` with ` sur une seule ligne :

```markdown
> [!finding] Comptes AD
> id:: john with password:: test with server:: DC01
> id:: alice with password:: Spring2024 with server:: WS01
```

Chaque bloc `type:: valeur` devient un champ du tuple. Dans le tableau, le tuple s'affiche sur une seule ligne (badge « tuple »), chaque valeur restant copiable, et le bouton copier copie tout en `k=v | k=v`. Ca marche aussi dans un noeud de graphe : `id:: web with user:: www-data with pivot:: root | vim`.

Note : pour couper un tuple, chaque segment doit contenir `::`. Une phrase comme `note:: the with lait` n'est donc pas coupee.

## Vue graphe — chemin d'attaque (pivots)

Dans le panneau, le bouton **git-fork** (en haut a droite) bascule entre le tableau et le **graphe de l'enquete**. Les noeuds sont tes etapes (host, service), remplies de leurs findings ; les fleches, c'est **toi** qui les traces, pour marquer un pivot.

### Declarer un noeud et un pivot

```markdown
> [!finding] WordPress 5.2
> id:: wordpress
> url:: http://10.10.11.20/blog/wp-admin | admin:admin123
> cmd:: wpscan --url ... | plugin vulnerable
> pivot:: webserver | upload plugin PHP malveillant (RCE)

> [!finding] Shell www-data
> id:: webserver
> user:: www-data
> cmd:: sudo -l | NOPASSWD /usr/bin/vim
> pivot:: root | GTFOBins vim
```

- `id:: <nom-court>` nomme le noeud pour pouvoir le cibler. Sans `id::`, l'id est le titre du callout en slug.
- `pivot:: <id cible> | <methode>` trace une fleche de ce noeud vers un autre, etiquetee par la methode. Le `| methode` est optionnel.
- Un noeud peut avoir plusieurs pivots (plusieurs fleches sortantes).
- Si une cible n'existe pas encore, un noeud fantome en pointilles « a documenter » apparait : c'est ton TODO.
- Le graphe fusionne toutes les notes de l'enquete : une etape dans une note peut pivoter vers une etape declaree dans une autre.

### Dans le graphe

- Il se lit de gauche a droite (couches calculees automatiquement a partir des pivots).
- Glisser pour deplacer, molette pour zoomer, bouton Ajuster pour recadrer.
- Clic sur le titre d'un noeud = ouvre la note a la bonne ligne.
- Clic sur une valeur = copiee.
- Export (icone bas) -> Copier le graphe en Mermaid : colle-le dans un writeup, il se rend tout seul.

## Pistes v3

- Détection automatique des hashes / IP / emails hors callout (désactivable par enquête)
- Export d'une note récapitulative pour le writeup
