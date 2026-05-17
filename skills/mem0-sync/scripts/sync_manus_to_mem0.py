import os
import json
import requests
import argparse
from typing import List, Dict

# Configuration
MEM0_API_KEY = os.environ.get("MEM0_API_KEY", "")
USER_ID = "yannick"

def get_existing_mem0_uids() -> List[str]:
    """Get list of session UIDs already in Mem0."""
    url = "https://api.mem0.ai/v1/memories/search/"
    headers = {
        "Authorization": f"Token {MEM0_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": "session_synthesis manus",
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

def push_to_mem0(session_data: Dict) -> bool:
    """Push raw session data to Mem0."""
    if not MEM0_API_KEY:
        print("Error: MEM0_API_KEY not set.")
        return False
        
    uid = session_data.get("uid", "")
    title = session_data.get("title", "Untitled Session")
    date = session_data.get("date", "")
    
    # We only send the first few messages to give context, not the whole raw session
    messages = session_data.get("messages", [])
    context_msgs = messages[:4] # First 4 messages
    
    context_text = ""
    for m in context_msgs:
        role = m.get("role", "UNKNOWN")
        content = m.get("content", "")[:500] # Limit each message
        context_text += f"{role}: {content}\n\n"
        
    memory_text = f"Manus Session '{title}' ({date}).\n\nInitial context:\n{context_text}"
    
    url = "https://api.mem0.ai/v1/memories/"
    headers = {
        "Authorization": f"Token {MEM0_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messages": [{"role": "user", "content": memory_text}],
        "user_id": USER_ID,
        "metadata": {
            "source": "manus_direct",
            "uid": uid,
            "type": "session_raw"
        }
    }
    
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code in [200, 201]:
        return True
    else:
        print(f"Error pushing to Mem0: {resp.status_code} {resp.text}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Sync Manus sessions to Mem0 directly")
    parser.add_argument("--input", type=str, help="Path to JSON file containing extracted Manus sessions")
    args = parser.parse_args()
    
    print("=== Manus API to Mem0 Sync ===")
    
    if not MEM0_API_KEY:
        print("ERROR: MEM0_API_KEY environment variable is required.")
        return
        
    if not args.input or not os.path.exists(args.input):
        print("ERROR: --input file is required and must exist.")
        print("Example: python sync_manus_to_mem0.py --input /tmp/manus_sessions.json")
        return
        
    existing_uids = get_existing_mem0_uids()
    print(f"Found {len(existing_uids)} sessions already in Mem0.")
    
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            sessions = json.load(f)
    except Exception as e:
        print(f"Error reading input file: {e}")
        return
        
    print(f"Total sessions in input file: {len(sessions)}")
    
    added_count = 0
    skipped_count = 0
    
    for i, session in enumerate(sessions):
        uid = session.get("uid", "")
        if uid in existing_uids:
            skipped_count += 1
            continue
            
        title = session.get("title", "Untitled")
        print(f"[{i+1}/{len(sessions)}] Processing: {title}")
        
        if push_to_mem0(session):
            added_count += 1
            print(f"  -> Added to Mem0")
        else:
            print(f"  -> Failed to add to Mem0")
            
    print("\n=== Sync Complete ===")
    print(f"Added: {added_count}")
    print(f"Skipped (already exist): {skipped_count}")

if __name__ == "__main__":
    main()
