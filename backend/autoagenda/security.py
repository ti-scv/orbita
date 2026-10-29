import hashlib
import json
import re
from core.oracle_credentials import service_cipher


def seal(value):
    return service_cipher().encrypt(json.dumps(value, default=str).encode()).decode()


def unseal(value):
    if not value:return {}
    if value.startswith('{'):
        from cryptography.fernet import Fernet
        envelope=json.loads(value)
        key=service_cipher().decrypt(envelope['key'].encode())
        return json.loads(Fernet(key).decrypt(envelope['ciphertext'].encode()))
    return json.loads(service_cipher().decrypt(value.encode()))


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def cpf_valid(value):
    value = re.sub(r"\D", "", value)
    if len(value) != 11 or len(set(value)) == 1:
        return False
    for n in (9, 10):
        digit = (sum(int(value[i]) * (n + 1 - i) for i in range(n)) * 10 % 11) % 10
        if digit != int(value[n]):
            return False
    return True


def phone(value):
    value = re.sub(r"\D", "", str(value))
    if len(value) in (10, 11):
        value = "55" + value
    if not re.fullmatch(r"[1-9][0-9]{9,14}", value):
        raise ValueError("Informe um celular com DDD.")
    return value


def seal_credentials(value, admin_password):
    from core.oracle_credentials import encrypt,wrap_service_key
    salt,ciphertext,key=encrypt(value,admin_password)
    return json.dumps({'salt':salt,'ciphertext':ciphertext,'key':wrap_service_key(key)})
