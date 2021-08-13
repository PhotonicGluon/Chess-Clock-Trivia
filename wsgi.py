"""
wsgi.py

Created on 2021-08-13
Updated on 2021-08-13

Copyright © Ryan Kan

Description: WSGI file.
"""

# IMPORTS
from app.main import app

# MAIN CODE
if __name__ == "__main__":
    # Run the app
    app.run()
