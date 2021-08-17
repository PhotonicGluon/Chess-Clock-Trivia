// GET ELEMENTS
let getNextQuestionButton = $("#get-next-question");

let questionSpan = $("#question");
let answerSpan = $("#answer");

// GLOBAL VARIABLES
let questionNumber = 1;

// MAIN CODE
// Code to be run when the user clicks on "Get Next Question"
getNextQuestionButton.click(() => {
    // Get the next question and answer
    let answer = QUESTIONS[questionNumber - 1]["Answer"];
    let question = QUESTIONS[questionNumber - 1]["Question"];

    // Update the question and answer spans
    questionSpan.html(question);
    answerSpan.html("Answer: " + answer);

    // Increment question number
    questionNumber++;
});
