"""
main.py

Created on 2021-08-12
Updated on 2021-09-03

Copyright © Ryan Kan

Description: Main flask app file.
"""

# IMPORTS
import os
from csv import DictReader
from datetime import datetime, timedelta
from json import dumps, loads
from random import choices, Random

import redis
from flask import Flask, render_template, send_file, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException

# CONSTANTS
CREDITS_FILE = "data/credits.md"
LAST_UPDATED_TIMESTAMP_FILE = "data/last-updated-timestamp.txt"
RULES_FILE = "data/rules.md"
SEED_WORDS_FILE = "data/seed-words.txt"
TRIVIA_QUESTIONS_FILE = "data/trivia.csv"

SEED_LENGTH = 5  # Number of words in the seed
EXPIRY_AFTER = 300  # How many seconds before a session expires (assuming no heartbeat)

# Get the list of questions from the `TRIVIA_QUESTIONS_FILE`
with open(TRIVIA_QUESTIONS_FILE, "r") as f:
    csvReader = DictReader(f)
    questions = [line for line in csvReader]
    numQuestions = len(questions)

# Get the list of seed words from the `SEED_WORDS_FILE`
with open(SEED_WORDS_FILE, "r") as f:
    seedWords = [x.strip() for x in f.readlines()]

# Read the rules from the `RULES_FILE`
with open(RULES_FILE, "r") as f:
    rulesMD = f.read()  # The text in the `RULES_FILE` is markdown text

# Read the credits/licences from the `CREDITS_FILE`
with open(CREDITS_FILE, "r") as f:
    creditsMD = f.read()  # The text in the `RULES_FILE` is markdown text

# Read the "last updated" value from th `LAST_UPDATED_TIMESTAMP_FILE`
with open(LAST_UPDATED_TIMESTAMP_FILE, "r") as f:
    lastUpdatedTimestamp = int(f.read())
    lastUpdated = datetime.fromtimestamp(lastUpdatedTimestamp).strftime("%Y-%m-%d %H:%M %Z")

# Set up the app instance with rate limiting capabilities
app = Flask(__name__)
limiter = Limiter(app, key_func=get_remote_address)

# Connect to the redis sever and check if successfully connected
redisDB = redis.from_url(os.getenv("REDIS_URL"))

try:
    redisDB.ping()  # Tries to ping the redis database
except redis.exceptions.ConnectionError:
    raise ConnectionError("Cannot connect to redis server. Has the redis server been started yet?")


# HELPER FUNCTIONS
def get_questions_from_session(session_id):
    # Check if a session with that ID exists
    try:
        session = loads(redisDB.get(session_id))
    except TypeError:
        return {"error": f"Session ID '<code>{session_id}</code>' does not exist."}

    # Get the first question that should be shown
    current_qn_index = session["current_qn"] - 1  # We want to use zero-based indexing

    # Return the questions from the session
    return {"initial_qn_num": session["current_qn"], "questions": session["questions"][current_qn_index:]}


# VIEWABLE PAGES
@app.route("/")
@limiter.limit("3/second")
def main_page():
    return render_template("main_page.html", num_questions=numQuestions, last_updated=lastUpdated)


@app.route("/questioner")
@limiter.limit("3/second")
def questioner():
    return render_template("questioner.html", num_questions=numQuestions, last_updated=lastUpdated)


@app.route("/rules")
@limiter.limit("3/second")
def rules():
    return render_template("rules.html", rules=rulesMD, last_updated=lastUpdated)


@app.route("/credits")
@limiter.limit("3/second")
def credits_page():
    return render_template("credits.html", credits=creditsMD, last_updated=lastUpdated)


# CODE-ONLY PAGES
@app.route("/code-only/heartbeat", methods=["POST"])
@limiter.limit("1/minute")
def heartbeat():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data or data["session_id"] == "":
        return "The `session_id` must be provided for the heartbeat to work."

    # Update the expiry time in that session
    try:
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))
    except KeyError:
        return f"Session ID '{data['session_id']}' does not exist so heartbeat failed."

    return f"Heartbeat successful for session '{data['session_id']}'."


@app.route("/code-only/generate-session-id", methods=["POST"])
@limiter.limit("3/second")
def generate_session_id():
    return " ".join(choices(seedWords, k=SEED_LENGTH))


@app.route("/code-only/get-questions", methods=["POST"])
@limiter.limit("1/10second")
def get_questions():
    # Get the data from the submitted form
    data = request.form

    # Assert that the data contains the needed values
    if "session_id" not in data:
        return "The `session_id` must be provided."

    # Return the questions from that session
    return dumps(get_questions_from_session(data["session_id"]))


@app.route("/code-only/set-up-session", methods=["POST"])
@limiter.limit("1/10second")
def set_up_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data:
        return "The `session_id` must be provided."

    # Check if the session does not already exist
    if redisDB.get(data["session_id"]) is None:
        # Initialise the random number generator with the session ID
        random_generator = Random(data["session_id"])

        # Shuffle a copy of the `questions` array
        questions_copy = questions.copy()
        random_generator.shuffle(questions_copy)

        # Create the session data
        session_data = {
            "questions": questions_copy,
            "current_qn": 1
        }

        # Push the session data to the redis server and add an expiry time to said data
        redisDB.set(data["session_id"], dumps(session_data))
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))

    # Return the questions from the session
    return dumps(get_questions_from_session(data["session_id"]))


@app.route("/code-only/update-session", methods=["POST"])
@limiter.limit("1/5second")
def update_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that a session ID was sent
    if "session_id" not in data or "question_num" not in data:
        return "Both the `session_id` and `question_num` must be provided."

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

        return "Session updated successfully."

    # If reached here then probably the question number provided is of incorrect type
    except TypeError:
        return {"error": f"Session ID '{data['session_id']}' does not exist."}

    # If reached here then probably the question number is not valid
    except ValueError:
        return f"Invalid question number '{data['question_num']}'."


# ERROR PAGES
@app.errorhandler(HTTPException)
def ratelimit_handler(e):
    # Get the code, name and  description from the exception
    code = e.code
    name = e.name
    desc = e.description

    # Handle specific errors
    if e.code == 429:  # Too many requests
        desc = f"You have made too many requests (maximum permitted: {desc}). Slow down your requests and try again."

    # Return the error page
    return render_template("error_page.html", error_code=code, error_name=name, error_desc=desc)


# MISCELLANEOUS PAGES
@app.route("/favicon.ico")
@limiter.limit("3/second")
def favicon():
    return send_file("static/resources/img/favicon.ico")  # Access local `favicon.ico` file


# MAIN CODE
if __name__ == "__main__":
    app.run()
