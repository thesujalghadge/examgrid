import os
import json
from google import genai
from PIL import Image

def get_api_key():
    with open('.env.local', 'r') as f:
        for line in f:
            if 'SUPABASE_ACCESS_TOKEN' in line:
                pass # not this
    # Wait, the API key wasn't in env.local?
    # Oh I remember, the API key was passed from the frontend. Let's just use it manually? I don't have it!
    pass
