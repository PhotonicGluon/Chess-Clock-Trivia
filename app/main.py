"""
main.py

Created on 2021-08-12
Updated on 2021-08-21

Copyright © Ryan Kan

Description: Main flask app file.
"""

# IMPORTS
import os
import threading
from csv import DictReader
from datetime import datetime, timedelta
from json import dumps
from random import choices, Random
from time import sleep

from flask import Flask, render_template, send_file, request

# CONSTANTS
TRIVIA_QUESTIONS_FILE = "data/Trivia.csv"
SEED_WORDS_FILE = "data/seed-words.txt"

SEED_LENGTH = 5  # Number of words in the seed

CHECK_EXPIRY_INTERVAL = 300  # How many seconds between each check of expiry of sessions
EXPIRY_AFTER = 300  # How many seconds before the session expires (assuming no heartbeat)

# SETUP
# Change working directory to the `app` directory
os.chdir("app")

# Get the list of questions from the CSV file
with open(TRIVIA_QUESTIONS_FILE, "r") as f:
    csvReader = DictReader(f)
    questions = [line for line in csvReader]
    numQuestions = len(questions)

# Get the list of seed words from the `SEED_WORDS_FILE`
with open(SEED_WORDS_FILE, "r") as f:
    seedWords = [x.strip() for x in f.readlines()]

# Set up the app instance and logging
app = Flask(__name__)
app.logger.setLevel(20)  # 20 = Info

# Set up a dictionary that stores the active sessions
sessions = {}


# Create a thread class to check for sessions' expiry
class CheckSessionExpiryThread(threading.Thread):
    def run(self):
        app.logger.info(f"Check session expiry thread started")

        while True:
            sleep(CHECK_EXPIRY_INTERVAL)

            for key, session in sessions.items():
                if session["expiry"] < datetime.now():
                    sessions.pop(key)
                    app.logger.info(f"Session '{key}' has expired and was purged")


# Start that thread
checkSessionExpiryThread = CheckSessionExpiryThread(daemon=True)  # Allows it to exit when main program exits
checkSessionExpiryThread.start()


# HELPER FUNCTIONS
def get_questions_from_session(session_id):
    # Check if a session with that ID exists
    try:
        sessions[session_id]
    except KeyError:
        return {"error": f"Session ID '{session_id}' does not exist."}

    # Get the first question that should be shown
    current_qn_index = sessions[session_id]["current_qn"] - 1  # Zero-based indexing

    # Return the questions from the session
    return {"questions": sessions[session_id]["questions"][current_qn_index:]}


# VIEWABLE PAGES
@app.route("/")
def main_page():
    return render_template("main_page.html")


@app.route("/questioner")
def questioner():  # TODO: Update
    # Generate a seed based on the words in the `SEED_WORDS_FILE`
    seed_value = " ".join(choices(seedWords, k=SEED_LENGTH))

    # Initialise the random number generator with that seed
    random_generator = Random(seed_value)

    # Shuffle the questions
    questions_copy = questions.copy()
    random_generator.shuffle(questions_copy)

    # Return the template with the seed value
    return render_template("questioner.html", seed_value=seed_value, questions=dumps(questions_copy))


# CODE-ONLY PAGES
@app.route("/code-only/heartbeat", methods=["POST"])
def heartbeat():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data or data["session_id"] == "":
        return "The `session_id` must be present for the heartbeat to work!"

    # Update the expiry time in that session
    try:
        sessions[data["session_id"]]["expiry"] = datetime.now() + timedelta(seconds=EXPIRY_AFTER)
    except KeyError:
        return f"Session ID '{data['session_id']}' does not exist so heartbeat failed."

    # Return success message
    return f"Heartbeat successful for session '{data['session_id']}'."


@app.route("/code-only/generate-session-id", methods=["POST"])
def generate_session_id():
    return " ".join(choices(seedWords, k=SEED_LENGTH))


@app.route("/code-only/get-questions", methods=["POST"])
def get_questions():
    # Get the data from the submitted form
    data = request.form

    # Assert that the data contains the needed values
    if "session_id" not in data:
        return "The `session_id` must be present!"

    # Return the questions from that session
    return dumps(get_questions_from_session(data["session_id"]))


@app.route("/code-only/set-up-session", methods=["POST"])
def set_up_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data:
        return "The `session_id` must be present!"

    # Check if the session does not already exist
    if data["session_id"] not in sessions:
        # Initialise the random number generator with that seed
        random_generator = Random(data["session_id"])

        # Shuffle the questions
        questions_copy = questions.copy()
        random_generator.shuffle(questions_copy)

        # Create the session data
        sessions[data["session_id"]] = {
            "questions": questions_copy,
            "current_qn": 1,
            "expiry": datetime.now() + timedelta(seconds=EXPIRY_AFTER)
        }

    # Return the questions from the session
    return dumps(get_questions_from_session(data["session_id"]))


@app.route("/code-only/update-session", methods=["POST"])
def update_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data or "question_num" not in data:
        return "Both the `session_id` and `question_num` must be present!"

    # Check if the session ID is valid
    if data["session_id"] not in sessions:
        return f"Session ID '{data['session_id']}' does not exist."

    # Update session data
    try:
        sessions[data["session_id"]]["current_qn"] = int(data["question_num"])
    except ValueError:
        return f"Invalid question number '{data['question_num']}'."

    # Return OK message
    return "OK"


# MISCELLANEOUS PAGES
@app.route("/favicon.ico")
def favicon():
    return send_file("static/resources/img/favicon.ico")


# MAIN CODE
if __name__ == "__main__":
    app.run()
