// GET ELEMENTS
let sessionIDInput = $("#session-id");
let sessionPasscodeInput = $("#session-passcode");

let getNextQuestionButton = $("#get-next-question");
let submitSessionIDButton = $("#submit-session-id");
let updateSessionButton = $("#update-session");

let answerSpan = $("#answer");
let questionSpan = $("#question");
let questionNumberSpan = $("#question-number");

// GLOBAL VARIABLES
let initialQuestionNumber = null;  // Initial question number as obtained from the server
let questionNumber = 1;  // Current (relative) question number
let questions = null;  // Variable to store the list of questions that will be obtained from the server
let numQuestions = null;

// MAIN CODE
// Code to be run once the user presses Enter/Return whilst on the "Enter Session ID" field
sessionIDInput.keyup((event) => {
    if (event.which === 13) {  // Key pressed was the Enter/Return key
        // Click on the submit session ID button
        event.preventDefault();
        submitSessionIDButton.click();
    }
});

// Code to be run once the user clicks on "Submit Session ID"
submitSessionIDButton.click(() => {
    if (sessionIDInput.val() !== "" && sessionPasscodeInput.val() !== "") {  // Non-empty session ID and passcode
        // Get the questions from the server
        $.ajax({
            url: "/code-only/get-questions",
            method: "POST",
            data: {
                "session_id": sessionIDInput.val(),
                "session_passcode": sessionPasscodeInput.val()
            },
        }).done((data) => {
            try {
                // Update session ID and session passcode variables
                sessionID = sessionIDInput.val();
                sessionPasscode = sessionPasscodeInput.val();

                // Parse the string data as JSON data
                data = JSON.parse(data);

                // Check the outcome
                if (data["outcome"] === "error") {  // An error was sent along
                    $("#submission-errors").html(data["msg"]);

                } else {  // Assume is OK
                    // Get the initial question number, then update `questions` array and the question count
                    initialQuestionNumber = data["initial_qn_num"];
                    questions = data["questions"];
                    numQuestions = questions.length;

                    // Update the question number span
                    questionNumberSpan.text(`(${TOTAL_NUM_QUESTIONS - initialQuestionNumber + 1} left)`);

                    // Show the main div and hide this div
                    $("#main-body").css("display", "block");
                    $("#session-id-entering-modal").css("display", "none");

                    // Make the session ID show up beneath the main header
                    $("#session-id-span").html(`Session ID: <code>${sessionID}</code>`);
                }
            } catch (e) {  // Likely that the request timed out
                $("#submission-errors").text("Request timed out. Try again in a while.");
            }
        });

    } else if (sessionIDInput.val() === "") {  // Session ID is empty
        $("#submission-errors").text("Session ID cannot be empty.");
    } else {  // Session passcode is empty
        $("#submission-errors").text("Session passcode cannot be empty.");
    }
});

// Code to be run when the user clicks on "Get Next Question"
getNextQuestionButton.click(() => {
    if (questionNumber <= numQuestions) {  // Still have questions that can be asked
        // Get the next question and answer
        let answer = questions[questionNumber - 1]["Answer"];
        let question = questions[questionNumber - 1]["Question"];

        // Update the question number, question and answer spans
        questionNumberSpan.text(`${initialQuestionNumber + questionNumber - 1}/${TOTAL_NUM_QUESTIONS}`);
        questionSpan.html(question);
        answerSpan.html("Answer: " + answer);

        // Increment question number
        questionNumber++;
    } else {  // No more questions
        $("#question-header").html("Finished!");
        questionSpan.text("There are no more questions!");
        answerSpan.html("Everyone who is <b>not</b> eliminated are winners!");
    }
});

// Code to be run when the user clicks on "Update Session on Server"
updateSessionButton.click(() => {
    // Call the update session function on the server
    $.ajax({
        url: "/code-only/update-session",
        method: "POST",
        data: {
            "session_id": sessionID,
            "session_passcode": sessionPasscode,
            "question_num": initialQuestionNumber + questionNumber - 1
        }
    }).done((data) => {
        // Parse response from server
        data = JSON.parse(data);

        // Show response from server
        $("#server-response").text(data["msg"]);

        // Disable the update session button
        updateSessionButton.addClass("button-disabled");

        // Wait for 3 seconds
        setTimeout(() => {
            // Enable the update session button
            updateSessionButton.removeClass("button-disabled");

            // Clear the response text
            $("#server-response").text("");
        }, 3000);
    });
});
