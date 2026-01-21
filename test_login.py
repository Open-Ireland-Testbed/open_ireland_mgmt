
import requests
import sys

URL = "http://localhost:25001/login"
# You might need to adjust these credentials based on your seed data
CREDENTIALS = {
    "username": "admin",
    "password": "password123" 
}

def test_login():
    try:
        print(f"Attempting login to {URL} with {CREDENTIALS['username']}")
        resp = requests.post(URL, json=CREDENTIALS)
        print(f"Status Code: {resp.status_code}")
        print(f"Response: {resp.text}")
        
        if resp.status_code == 200:
            print("Login SUCCESS")
        elif resp.status_code == 401:
            print("Login FAILED (Auth)")
        else:
            print("Login FAILED (Server Error)")
            
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    test_login()
