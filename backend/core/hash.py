# hashing.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain_password: str) -> str:
    # Given a plaintext password, return the bcrypt hash.
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    
    # Compare a candidate plain password with the stored hashed password.
    # Return True if they match, else False.
    
    return pwd_context.verify(plain_password, hashed_password)

