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

    # Return the template with the seed value
    return render_template("questioner.html", seed_value=seed_value)


# CODE-ONLY PAGES
@app.route("/code-only/get-question", methods=["POST"])
def get_question():
    # Get the data from the submitted form
    data = request.form

    # Assert that the data contains the needed values
    if not ("seed" in data and "question_num" in data):
        return "Both the `seed` and `question_num` must be present!"

    # Assert that the question number is an integer that is within the valid range
    try:
        question_num = int(data["question_num"])

        if question_num < 1:
            return "The question number must be an integer that is greater than 1!"
        elif question_num > numQuestions:
            return {"Question": "No more questions!", "Answer": "No more answers!", "Theme": "No more questions!"}

    except ValueError:
        return f"The `question_num` must be an integer! (Got: {data['question_num']})"

    # Initialise the random number generator with that seed
    random_generator = Random(data["seed"])

    # Shuffle the questions
    # Todo: find a better & more efficient method to find the question
    questions_copy = questions.copy()
    random_generator.shuffle(questions_copy)

    # Return the question
    return questions_copy[question_num - 1]  # The questions are 1-indexed


# MISCELLANEOUS PAGES
@app.route("/favicon.ico")
def favicon():
    return send_file("static/resources/img/favicon.ico")


# MAIN CODE
if __name__ == "__main__":
    app.run()
