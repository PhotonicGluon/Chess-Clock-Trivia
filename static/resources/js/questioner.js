// GET ELEMENTS
let getNextQuestionButton = $("#get-next-question");

let questionSpan = $("#question");
let answerSpan = $("#answer");

// GLOBAL VARIABLES
let questionNumber = 1;

// MAIN CODE
// Code to be run when the user clicks on "Get Next Question"
getNextQuestionButton.click(() => {
    // Send a POST request to the server for the next question
    $.ajax({
        url: "/code-only/get-question",
        method: "POST",
        data: {"seed": SEED_VALUE, "question_num": questionNumber},
    }).done((data) => {
        // Increment question number
        questionNumber++;

        // Get the question and answer from the data
        let answer = data["Answer"];
        let question = data["Question"];

        // Update the question and answer spans
        questionSpan.text(question);
        answerSpan.text("Answer: " + answer);
    });
});
