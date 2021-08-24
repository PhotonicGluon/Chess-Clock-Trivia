"""
main.py

Created on 2021-08-12
Updated on 2021-08-22

Copyright © Ryan Kan

Description: Main flask app file.
"""

# IMPORTS
import os
from csv import DictReader
from datetime import timedelta
from json import dumps, loads
from random import choices, Random

import redis
from flask import Flask, render_template, send_file, request

# CONSTANTS
RULES_FILE = "data/rules.md"
SEED_WORDS_FILE = "data/seed-words.txt"
TRIVIA_QUESTIONS_FILE = "data/trivia.csv"

SEED_LENGTH = 5  # Number of words in the seed
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

# Read the rules from the `RULES_FILE`
with open(RULES_FILE, "r") as f:
    rulesMD = f.read()  # Markdown text

# Set up the app instance and logging
app = Flask(__name__)
app.logger.setLevel(20)  # 20 = Info

# Connect to the redis sever
redisDB = redis.from_url(os.getenv("REDIS_URL"))

# Check if successfully connected
try:
    redisDB.ping()
except redis.exceptions.ConnectionError:
    raise ConnectionError("Redis server not started yet, or cannot connect to redis server.")


# HELPER FUNCTIONS
def get_questions_from_session(session_id):
    # Check if a session with that ID exists
    try:
        session = loads(redisDB.get(session_id))
    except TypeError:
        return {"error": f"Session ID '{session_id}' does not exist."}

    # Get the first question that should be shown
    current_qn_index = session["current_qn"] - 1  # Zero-based indexing

    # Return the questions from the session
    return {"questions": session["questions"][current_qn_index:]}


# VIEWABLE PAGES
@app.route("/")
def main_page():
    return render_template("main_page.html")


@app.route("/questioner")
def questioner():
    return render_template("questioner.html")


@app.route("/rules")
def rules():
    return render_template("rules.html", rules=rulesMD)


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
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))
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
    if redisDB.get(data["session_id"]) is None:
        # Initialise the random number generator with that seed
        random_generator = Random(data["session_id"])

        # Shuffle the questions
        questions_copy = questions.copy()
        random_generator.shuffle(questions_copy)

        # Create the session data
        session_data = {
            "questions": questions_copy,
            "current_qn": 1
        }

        # Push the session data to the redis server
        redisDB.set(data["session_id"], dumps(session_data))

        # Add an expiry time to that data
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))

    # Return the questions from the session
    return dumps(get_questions_from_session(data["session_id"]))


@app.route("/code-only/update-session", methods=["POST"])
def update_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data or "question_num" not in data:
        return "Both the `session_id` and `question_num` must be present!"

    # Update session data
    try:
        # Get the existing session data on the redis server
        session_data = loads(redisDB.get(data["session_id"]))

        # Modify the data
        session_data["current_qn"] = int(data["question_num"])

        # Push the modified data back to the redis server
        redisDB.set(data["session_id"], dumps(session_data))

        # Update expiry time
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))

        # Report success
        return "Session updated successfully."
    except TypeError:
        return {"error": f"Session ID '{data['session_id']}' does not exist."}
    except ValueError:
        return f"Invalid question number '{data['question_num']}'."


# MISCELLANEOUS PAGES
@app.route("/favicon.ico")
def favicon():
    return send_file("static/resources/img/favicon.ico")


# MAIN CODE
if __name__ == "__main__":
    app.run()
