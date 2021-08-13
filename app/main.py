"""
main.py

Created on 2021-08-12
Updated on 2021-08-13

Copyright © Ryan Kan

Description: Main flask app.
"""

# IMPORTS
import os
import random
from csv import DictReader
from random import Random
from json import dumps

from flask import Flask, render_template, send_file, request

# CONSTANTS
TRIVIA_QUESTIONS_FILE = "data/Trivia.csv"
SEED_WORDS_FILE = "data/seed-words.txt"

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

# Set up the app instance
app = Flask(__name__)


# VIEWABLE PAGES
@app.route("/")
def main_page():
    return render_template("main_page.html")


@app.route("/questioner")
def questioner():
    # Generate a 4-word seed
    seed_value = "-".join(random.choices(seedWords, k=4))

    # Initialise the random number generator with that seed
    random_generator = Random(seed_value)

    # Shuffle the questions
    questions_copy = questions.copy()
    random_generator.shuffle(questions_copy)

    # Return the template with the seed value
    return render_template("questioner.html", seed_value=seed_value, questions=dumps(questions_copy))


# CODE-ONLY PAGES
@app.route("/code-only/get-questions", methods=["POST"])
def get_questions():
    # Get the data from the submitted form
    data = request.form

    # Assert that the data contains the needed values
    if "seed" not in data:
        return "Both the `seed` and `question_num` must be present!"

    # Initialise the random number generator with that seed
    random_generator = Random(data["seed"])

    # Shuffle the questions
    questions_copy = questions.copy()
    random_generator.shuffle(questions_copy)

    # Return the questions
    return dumps(questions_copy)


# MISCELLANEOUS PAGES
@app.route("/favicon.ico")
def favicon():
    return send_file("static/resources/img/favicon.ico")


# MAIN CODE
if __name__ == "__main__":
    app.run()
