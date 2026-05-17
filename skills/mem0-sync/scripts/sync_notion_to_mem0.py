import os
import json
import requests
from typing import List, Dict

# Configuration
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "") # Fallback if needed
MEM0_API_KEY = os.environ.get("MEM0_API_KEY", "")
NOTION_DB_ID = "0720db9b-5e1d-41a2-bd0c-6721fe0dab94" # Manus Memory — Sessions
USER_ID = "yannick"

def fetch_notion_sessions() -> List[Dict]:
    """Fetch all session cards from Notion DB."""
    if not NOTION_API_KEY:
        print("Error: NOTION_API_KEY not set.")
        return []
        
    url = f"https://api.notion.com/v1/databases/{NOTION_DB_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    sessions = []
    has_more = True
    next_cursor = None
    
    print("Fetching sessions from Notion...")
    while has_more:
        payload = {}
        if next_cursor:
            payload["start_cursor"] = next_cursor
            
        resp = requests.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            print(f"Error fetching Notion DB: {resp.status_code} {resp.text}")
            break
            
        data = resp.json()
        results = data.get("results", [])
        
        for page in results:
            props = page.get("properties", {})
            
            # Extract basic properties
            title = ""
            if "Title" in props and props["Title"].get("title"):
                title = props["Title"]["title"][0].get("plain_text", "")
                
            uid = ""
            if "UID" in props and props["UID"].get("rich_text"):
                uid = props["UID"]["rich_text"][0].get("plain_text", "")
                
            project = ""
            if "Project" in props and props["Project"].get("select"):
                project = props["Project"]["select"].get("name", "")
                
            date = ""
            if "Date" in props and props["Date"].get("date"):
                date = props["Date"]["date"].get("start", "")
                
            themes = []
            if "Themes" in props and props["Themes"].get("multi_select"):
                themes = [t.get("name") for t in props["Themes"]["multi_select"]]
                
            sessions.append({
                "page_id": page["id"],
                "uid": uid,
                "title": title,
                "project": project,
                "date": date,
                "themes": themes
            })
            
        has_more = data.get("has_more", False)
        next_cursor = data.get("next_cursor")
        print(f"Fetched {len(sessions)} sessions so far...")
        
    return sessions

def fetch_page_content(page_id: str) -> str:
    """Fetch text content from a Notion page."""
    url = f"https://api.notion.com/v1/blocks/{page_id}/children"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28"
    }
    
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        return ""
        
    blocks = resp.json().get("results", [])
    content = []
    
    for block in blocks:
        block_type = block.get("type")
        if block_type and block_type in block:
            text_arr = block[block_type].get("rich_text", [])
            if text_arr:
                text = "".join([t.get("plain_text", "") for t in text_arr])
                content.append(text)
                
    return "\n".join(content)

def push_to_mem0(session: Dict, content: str) -> bool:
    """Push session summary to Mem0."""
    if not MEM0_API_KEY:
        print("Error: MEM0_API_KEY not set.")
        return False
        
    # Construct memory text
    memory_text = f"Session '{session['title']}' ({session['date']})"
    if session['project']:
        memory_text += f" for project {session['project']}"
    memory_text += f". Themes: {', '.join(session['themes'])}.\n\nSummary:\n{content[:2000]}" # Limit to 2000 chars
    
    url = "https://api.mem0.ai/v1/memories/"
    headers = {
        "Authorization": f"Token {MEM0_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messages": [{"role": "user", "content": memory_text}],
        "user_id": USER_ID,
        "metadata": {
            "source": "notion_archive",
            "uid": session["uid"],
            "project": session["project"],
            "type": "session_synthesis"
        }
    }
    
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code in [200, 201]:
        return True
    else:
        print(f"Error pushing to Mem0: {resp.status_code} {resp.text}")
        return False

def get_existing_mem0_uids() -> List[str]:
    """Get list of session UIDs already in Mem0 to avoid duplicates."""
    url = "https://api.mem0.ai/v1/memories/search/"
    headers = {
        "Authorization": f"Token {MEM0_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # We query for our specific metadata source
    payload = {
        "query": "session_synthesis",
        "user_id": USER_ID,
        "limit": 1000
    }
    
    try:
        resp = requests.post(url, headers=headers, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            uids = []
            for mem in data:
                if "metadata" in mem and mem["metadata"] and "uid" in mem["metadata"]:
                    uids.append(mem["metadata"]["uid"])
            return uids
    except Exception as e:
        print(f"Error checking existing Mem0 memories: {e}")
    
    return []

def main():
    print("=== Notion to Mem0 Sync ===")
    
    if not MEM0_API_KEY:
        print("ERROR: MEM0_API_KEY environment variable is required.")
        return
        
    # Check if we have Notion API key (either in env or we ask user to provide it)
    global NOTION_API_KEY
    if not NOTION_API_KEY:
        print("Note: NOTION_API_KEY not found in environment. The script needs it to read the DB.")
        print("You can set it via: export NOTION_API_KEY='secret_...'")
        print("For this run, we'll proceed if it's set, otherwise we'll fail gracefully.")
    
    if not NOTION_API_KEY:
        return
        
    existing_uids = get_existing_mem0_uids()
    print(f"Found {len(existing_uids)} sessions already in Mem0.")
    
    sessions = fetch_notion_sessions()
    print(f"Total sessions in Notion: {len(sessions)}")
    
    added_count = 0
    skipped_count = 0
    
    for i, session in enumerate(sessions):
        if session["uid"] in existing_uids:
            skipped_count += 1
            continue
            
        print(f"[{i+1}/{len(sessions)}] Processing: {session['title']}")
        
        # Fetch content (we only need the top level blocks for the summary)
        content = fetch_page_content(session["page_id"])
        
        if push_to_mem0(session, content):
            added_count += 1
            print(f"  -> Added to Mem0")
        else:
            print(f"  -> Failed to add to Mem0")
            
    print("\n=== Sync Complete ===")
    print(f"Added: {added_count}")
    print(f"Skipped (already exist): {skipped_count}")

if __name__ == "__main__":
    main()
