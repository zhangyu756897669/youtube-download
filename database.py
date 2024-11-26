import sqlite3
from datetime import datetime

def init_db():
    conn = sqlite3.connect('downloads.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS downloads
        (id INTEGER PRIMARY KEY AUTOINCREMENT,
         title TEXT NOT NULL,
         url TEXT NOT NULL,
         filename TEXT NOT NULL,
         download_date TIMESTAMP NOT NULL)
    ''')
    conn.commit()
    conn.close()

def add_download(title, url, filename):
    conn = sqlite3.connect('downloads.db')
    c = conn.cursor()
    c.execute('INSERT INTO downloads (title, url, filename, download_date) VALUES (?, ?, ?, ?)',
              (title, url, filename, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    conn.commit()
    conn.close()

def get_downloads():
    conn = sqlite3.connect('downloads.db')
    c = conn.cursor()
    c.execute('SELECT * FROM downloads ORDER BY download_date DESC')
    downloads = c.fetchall()
    conn.close()
    return downloads