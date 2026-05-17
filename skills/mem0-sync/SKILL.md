---
name: mem0-sync
description: Pipeline de synchronisation bidirectionnelle entre les sessions Manus, Notion (Manus Memory) et Mem0. Utiliser quand l'utilisateur demande de synchroniser les anciennes sessions vers Mem0, de rattraper le retard de mémorisation, ou de faire une migration initiale de Notion vers Mem0.
---

# Mem0 Sync Pipeline

Ce skill gère la synchronisation des sessions passées vers Mem0. Il offre trois modes d'opération pour s'assurer que Mem0 contient l'historique complet des conversations de l'utilisateur (Yannick).

## Modes d'opération

### Mode 1 : Notion → Mem0 (Recommandé)

Ce mode lit toutes les session cards déjà archivées et synthétisées dans la base Notion "Manus Memory — Sessions" et les pousse dans Mem0.
**Avantage :** Pousse des synthèses propres (titre, projet, thèmes, résumé, décisions) au lieu du texte brut. Zéro coût LLM.

```bash
# Nécessite NOTION_API_KEY et MEM0_API_KEY
python /home/ubuntu/skills/mem0-sync/scripts/sync_notion_to_mem0.py
```

### Mode 2 : Manus API → Mem0 (Fallback)

Ce mode prend un fichier JSON contenant les sessions extraites directement de l'API Manus (via le pipeline LMP `01_collect_sessions.py`) et les pousse dans Mem0.
**Avantage :** Permet de rattraper les sessions récentes qui ne sont pas encore archivées dans Notion.

```bash
# Nécessite MEM0_API_KEY et un fichier JSON d'entrée
python /home/ubuntu/skills/mem0-sync/scripts/sync_manus_to_mem0.py --input /chemin/vers/sessions.json
```

### Mode 3 : Rattrapage complet (Full Sync)

Pour s'assurer que rien ne manque, la procédure complète est :

1. Lancer la synchronisation Notion → Mem0 pour récupérer tout l'historique structuré.
2. Utiliser le script de collecte Manus du LMP (`/home/ubuntu/manus_pipeline/01_collect_sessions.py`) pour récupérer les sessions récentes.
3. Lancer la synchronisation Manus → Mem0 sur ce fichier JSON pour combler le trou entre la dernière archive Notion et aujourd'hui.

## Format des données dans Mem0

Les mémoires sont poussées avec `user_id: yannick` et des métadonnées spécifiques pour éviter les doublons :

**Depuis Notion :**
```json
{
  "metadata": {
    "source": "notion_archive",
    "uid": "id_de_la_session",
    "project": "nom_du_projet",
    "type": "session_synthesis"
  }
}
```

**Depuis Manus (Direct) :**
```json
{
  "metadata": {
    "source": "manus_direct",
    "uid": "id_de_la_session",
    "type": "session_raw"
  }
}
```

Les scripts vérifient automatiquement les UIDs existants dans Mem0 avant de pousser pour éviter les doublons.
