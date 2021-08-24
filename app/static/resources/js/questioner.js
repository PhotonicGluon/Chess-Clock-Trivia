// GET ELEMENTS
let sessionIDInput = $("#session-id");

let getNextQuestionButton = $("#get-next-question");
let submitSessionIDButton = $("#submit-session-id");
let updateSessionButton = $("#update-session");

let answerSpan = $("#answer");
let questionSpan = $("#question");
let questionNumberSpan = $("#question-number");

// GLOBAL VARIABLES
let initialQuestionNumber = null;  // Initial question number as obtained from the server
let questionNumber = 1;    // Current (relative) question number
let questions = null;  // Variable to store the list of questions that will be obtained from the server

// MAIN CODE
// Code to be run once the user clicks on "Submit Session ID"
submitSessionIDButton.click(() => {
    if (sessionIDInput.val() !== "") {
        // Get the questions
        $.ajax({
            url: "/code-only/get-questions",
            method: "POST",
            data: {"session_id": sessionIDInput.val()},
        }).done((data) => {
            // Update session ID
            sessionID = sessionIDInput.val();

            // Parse the data
            data = JSON.parse(data);

            // Check if there are any errors
            if (data["error"] != null) {
                $("#submission-errors").text(data["error"]);
            } else {
                // Get the initial question number, and update `questions` array
                initialQuestionNumber = data["initial_qn_num"];
                questions = data["questions"];

                // Update the question number span
                questionNumberSpan.text(`(${TOTAL_NUM_QUESTIONS - initialQuestionNumber + 1} left)`);

                // Show the main div and hide this div
                $("#main-body").css("display", "block");
                $("#session-id-entering-modal").css("display", "none");

                // Make the session ID appear when hovering over the title
                $("#main-title").prop("title", `Session ID: ${sessionID}`);
            }
        });
    } else {
        $("#submission-errors").text("Session ID cannot be empty.");
    }
});

// Code to be run when the user clicks on "Get Next Question"
getNextQuestionButton.click(() => {
    // Get the next question and answer
    let answer = questions[questionNumber - 1]["Answer"];
    let question = questions[questionNumber - 1]["Question"];

    // Update the question number, question and answer spans
    questionNumberSpan.text(`${initialQuestionNumber + questionNumber - 1}/${TOTAL_NUM_QUESTIONS}`);
    questionSpan.html(question);
    answerSpan.html("Answer: " + answer);

    // Increment question number
    questionNumber++;
});

// Code to be run when the user clicks on "Update Session on Server"
updateSessionButton.click(() => {
    $.ajax({
        url: "/code-only/update-session",
        method: "POST",
        data: {
            "session_id": sessionID,
            "question_num": initialQuestionNumber + questionNumber - 1
        }
    }).done((data) => {
        // Show response from server
        $("#server-response").text(data);

        // Clear the response after 5 seconds
        setTimeout(() => {
            $("#server-response").text("");
        }, 5000);
    });
});
