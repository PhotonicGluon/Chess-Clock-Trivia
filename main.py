"""
main.py

Created on 2021-08-12
Updated on 2021-09-06

Copyright © Ryan Kan

Description: Main flask app file.
"""

# IMPORTS
import os
from csv import DictReader, Error
from datetime import datetime, timedelta
from io import StringIO
from json import dumps, loads
from random import choices, Random
from time import strftime, gmtime

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
EXPIRY_AFTER = 3600  # How many seconds before a session expires (assuming no heartbeat)

# SETUP
# Get the timezone
timezone = strftime(" %z", gmtime())  # Note that there is a space before this

# Get the list of topics and questions from the `TRIVIA_QUESTIONS_FILE`
with open(TRIVIA_QUESTIONS_FILE, "r") as f:
    csvReader = DictReader(f)
    questions = [line for line in csvReader]
    topics = sorted(list(set([question["Topic"] for question in questions])))  # Only keep distinct topics

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
    lastUpdated = datetime.fromtimestamp(lastUpdatedTimestamp).strftime("%Y-%m-%d %H:%M") + timezone

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
        return dumps({"error": f"Session ID '<code>{session_id}</code>' does not exist."})

    # Get the first question that should be shown
    current_qn_index = session["current_qn"] - 1  # We want to use zero-based indexing

    # Return the questions from the session
    return dumps({
        "outcome": "OK",
        "total_num_qns": session["total_num_qns"],
        "initial_qn_num": session["current_qn"],
        "questions": session["questions"][current_qn_index:]
    })


# MAIN PAGES
@app.route("/")
@limiter.limit("3/second")
def main_page():
    return render_template("main_page.html", last_updated=lastUpdated)


@app.route("/set-up")
@limiter.limit("3/second")
def set_up():
    return render_template("set_up_session.html", last_updated=lastUpdated, topics=topics)


@app.route("/questioner")
@limiter.limit("3/second")
def questioner():
    return render_template("questioner.html", last_updated=lastUpdated)


# DETAIL PAGES
@app.route("/rules")
@limiter.limit("3/second")
def rules():
    return render_template("rules.html", rules=rulesMD, last_updated=lastUpdated)


@app.route("/credits")
@limiter.limit("3/second")
def credits_page():
    return render_template("credits.html", credits=creditsMD, last_updated=lastUpdated)


# CODE-ONLY PAGES
@app.route("/code-only/generate-suggested-session-id", methods=["POST"])
@limiter.limit("3/second")
def generate_suggested_session_id():
    return " ".join(choices(seedWords, k=SEED_LENGTH))


@app.route("/code-only/get-questions", methods=["POST"])
@limiter.limit("3/second")
def get_questions():
    # Get the data from the submitted form
    data = request.form

    # Ensure that all required data is sent
    required_labels = ["session_id", "session_passcode"]

    for required_label in required_labels:
        if required_label not in data:
            return dumps({"outcome": "error", "msg": f"The `{required_label}` must be provided."})

    # Check the provided passcode against the actual passcode
    try:
        session = loads(redisDB.get(data["session_id"]))

        if session["passcode"] != data["session_passcode"]:
            return dumps({"outcome": "error",
                          "msg": f"Incorrect passcode for session with ID '<code>{data['session_id']}</code>'."})

    except TypeError:
        return dumps({"outcome": "error", "msg": f"Session ID '<code>{data['session_id']}</code>' does not exist."})

    # Return the questions from that session
    return get_questions_from_session(data["session_id"])


@app.route("/code-only/set-up-session", methods=["POST"])
@limiter.limit("3/second")
def set_up_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that all required data is sent
    required_labels = ["session_id", "session_passcode", "session_seed", "session_topics"]

    for required_label in required_labels:
        if required_label not in data:
            return dumps({"outcome": "error", "msg": f"The `{required_label}` must be provided."})

    # Parse the incoming data
    session_id = data["session_id"]
    session_passcode = data["session_passcode"]
    session_seed = data["session_seed"]
    session_topics = set(loads(data["session_topics"]))

    # Validate data
    valid_data = True
    error_msgs = []

    if len(session_id) == 0:
        valid_data = False
        error_msgs.append("Session ID cannot be empty.")

    if len(session_passcode) == 0:
        valid_data = False
        error_msgs.append("Session passcode cannot be empty.")

    if len(session_seed) == 0:
        valid_data = False
        error_msgs.append("Session seed cannot be empty.")

    if len(session_topics) == 0:
        valid_data = False
        error_msgs.append("At least one topic must be selected.")

    # Check if data is invalid
    if not valid_data:
        # Return a JSON object with the error message
        return dumps({"outcome": "error", "msg": " ".join(error_msgs)})

    # Try and read the custom questions
    custom_qns = []
    custom_qns_raw = data["custom_qns"]

    if custom_qns_raw != "":  # There are custom questions
        try:
            # Try to parse it as a CSV string
            custom_qns_reader = DictReader(StringIO(custom_qns_raw))

            # Check if the needed headers are present
            if not {"Topic", "Question", "Answer"}.issubset(set(custom_qns_reader.fieldnames)):
                # Not all headers present; raise error
                return dumps({"outcome": "error",
                              "msg": f"Not all required headers present in custom trivia questions file."})

            # If all headers present, simply create a custom questions list and add the rows there
            for question in custom_qns_reader:
                custom_qns.append(question)

        except Error:  # An error occurred when reading the CSV file
            return dumps({"outcome": "error",
                          "msg": f"The custom trivia questions file needs to be a <code>.csv</code> file."})

    # Check if the session does not already exist
    if redisDB.get(data["session_id"]) is None:
        # Get only the selected topics' questions
        questions_copy = custom_qns  # Include the custom questions already

        for question in questions:
            if question["Topic"] in session_topics:
                questions_copy.append(question)

        # Initialise the random number generator with the session seed
        random_generator = Random(data["session_seed"])

        # Shuffle the `questions_copy` array
        random_generator.shuffle(questions_copy)

        # Create the session data
        session_data = {
            "questions": questions_copy,
            "passcode": data["session_passcode"],
            "total_num_qns": len(questions_copy),
            "current_qn": 1
        }

        # Push the session data to the redis server and add an expiry time to said data
        redisDB.set(data["session_id"], dumps(session_data))
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))

        # Return success message
        return dumps({"outcome": "OK", "msg": "Session set up successfully."})
    else:  # Session with same ID already set up
        return dumps({"outcome": "error",
                      "msg": f"Session with ID '<code>{data['session_id']}</code>' already set up."})


@app.route("/code-only/update-session", methods=["POST"])
@limiter.limit("1/3second")
def update_session():
    # Get the data from the submitted form
    data = request.form

    # Ensure that all required data is sent
    required_labels = ["session_id", "session_passcode", "question_num"]

    for required_label in required_labels:
        if required_label not in data:
            return dumps({"outcome": "error", "msg": f"The `{required_label}` must be provided."})

    # Update session data
    try:
        # Get the existing session data on the redis server
        session_data = loads(redisDB.get(data["session_id"]))

        # Check if the submitted passcode is correct
        if session_data["passcode"] != data["session_passcode"]:
            return dumps({"outcome": "error",
                          "msg": f"Incorrect passcode for session with ID '<code>{data['session_id']}</code>'."})

        # Modify the data
        session_data["current_qn"] = int(data["question_num"])

        # Push the modified data back to the redis server
        redisDB.set(data["session_id"], dumps(session_data))

        # Update expiry time
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))

        return dumps({"outcome": "OK", "msg": "Session updated successfully."})

    # If reached here then probably the session ID doesn't exist
    except TypeError:
        return dumps({"outcome": "error", "msg": f"Session ID '{data['session_id']}' does not exist."})

    # If reached here then probably the question number is not valid
    except ValueError:
        return dumps({"outcome": "error", "msg": f"Invalid question number '{data['question_num']}'."})


@app.route("/code-only/extend-session-expiry", methods=["POST"])
@limiter.limit("1/3second")
def extend_session_expiry():
    # Get the data from the submitted form
    data = request.form

    # Ensure that all required data is sent
    required_labels = ["session_id", "session_passcode"]

    for required_label in required_labels:
        if required_label not in data:
            return dumps({"outcome": "error", "msg": f"The `{required_label}` must be provided."})

    # Update session data
    try:
        # Get the existing session data on the redis server
        session_data = loads(redisDB.get(data["session_id"]))

        # Check if the submitted passcode is correct
        if session_data["passcode"] != data["session_passcode"]:
            return dumps({"outcome": "error",
                          "msg": f"Incorrect passcode for session with ID '<code>{data['session_id']}</code>'."})

        # Update expiry time
        redisDB.expire(data["session_id"], timedelta(seconds=EXPIRY_AFTER))

        # Generate new expiry time
        new_expiry_time = (datetime.now() + timedelta(seconds=EXPIRY_AFTER)).strftime("%Y-%m-%d %H:%M") + timezone

        return dumps({"outcome": "OK",
                      "msg": f"Session expiry extended. Session will now expire at {new_expiry_time}."})

    # If reached here then probably the session ID doesn't exist
    except TypeError:
        return dumps({"outcome": "error", "msg": f"Session ID '{data['session_id']}' does not exist."})


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
