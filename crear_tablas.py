import os
from dotenv import load_dotenv
from app import app, db

load_dotenv()

with app.app_context():
    print("Conectando a Supabase y creando tablas...")
    db.create_all()
    print("¡Listo! Todas las tablas fueron creadas con éxito en Supabase.")
