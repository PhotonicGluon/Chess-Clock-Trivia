// CONSTANTS
const MIN_NUM_TEAMS = 2;
const MAX_NUM_TEAMS = 4;

const MIN_TIME = 10;  // In seconds
const MAX_TIME = 3600;

const MIN_PENALTY_TIME = 1;  // In seconds
const MAX_PENALTY_TIME = 20;

// GET ELEMENTS
let sessionIDInput = $("#session-id");
let sessionPasscodeInput = $("#session-passcode");
let numTeamsInput = $("#num-teams");
let timeLimitInput = $("#time-limit");
let penaltyTimeInput = $("#penalty-time");

let getNextQuestionButton = $("#get-next-question");
let startGameButton = $("#start-game");
let submitSessionIDButton = $("#submit-session-id");

let answerSpan = $("#answer");
let questionSpan = $("#question");
let questionNumberSpan = $("#question-number");
let topicSpan = $("#topic");

// GLOBAL VARIABLES
let penaltyTime = 1000;  // 10 seconds, i.e. 1000 hundredths of a second
let times = [-1, 6000, 6000];  // Array to store times for all clocks

let initialQuestionNumber = null;  // Initial question number as obtained from the server
let questionNumber = 1;  // Current (relative) question number
let questions = null;  // List of questions that will be obtained from the server
let totalNumQuestions = null;  // Number of questions (in total) given the selected topics
let numQuestions = null;

let activeTeam = 1;  // The first team's clock will go first
let eliminatedTeams = [];  // List of eliminated teams that cannot play anymore

let interval = null;  // Interval to handle the decrement of time; will be set once the game starts
let isPaused = false;  // Whether clock interval is paused
let gameStarted = false;  // Whether the game has started or not

// HELPER FUNCTIONS
function confettiFireworks(duration, fireworkInterval) {
    // Get the confetti canvas
    let canvas = document.getElementById("confetti-canvas");

    // Create the confetti function on that canvas
    canvas.confetti = canvas.confetti || confetti.create(canvas, {resize: true});

    // Determine when the animation should end
    duration *= 1000;  // Duration needs to be in milliseconds
    let animationEnd = Date.now() + duration;

    // Define defaults for the confetti fireworks
    let defaults = {startVelocity: 30, spread: 360, ticks: 60, zIndex: 0};

    // Create the interval object that will shoot the fireworks
    let interval = setInterval(function () {
        let timeLeft = animationEnd - Date.now();

        // Stop the animation once time is up
        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        // Calculate the particle count
        let particleCount = 50 * (timeLeft / duration);

        // Since particles fall down, we should start them a bit higher than random
        canvas.confetti(Object.assign({}, defaults, {
            particleCount,
            origin: {x: randrange(0.1, 0.3), y: Math.random() - 0.2}
        }));
        canvas.confetti(Object.assign({}, defaults, {
            particleCount,
            origin: {x: randrange(0.7, 0.9), y: Math.random() - 0.2}
        }));
    }, fireworkInterval * 1000);
}

function displayTime(timeInHundredthsSeconds) {
    // Helper functions
    function updateTime(k) {
        if (k < 10) {
            return "0" + k;
        } else {
            return k;
        }
    }

    // Handle the case when the time left is less than 60 seconds
    if (timeInHundredthsSeconds < 6000) {
        // Express the seconds in terms of seconds and hundredths of a second
        let seconds = Math.floor(timeInHundredthsSeconds / 100);
        let hundredths = timeInHundredthsSeconds - seconds * 100;

        // Update the seconds and hundredths' seconds
        seconds = updateTime(seconds);
        hundredths = updateTime(hundredths);

        // Return the string representation
        return seconds + "." + hundredths;

    } else {
        // Express the seconds in terms of minutes and seconds
        let minutes = Math.floor(timeInHundredthsSeconds / 100 / 60);
        let seconds = Math.floor(timeInHundredthsSeconds / 100 - minutes * 60);

        // Update the minutes and seconds
        minutes = updateTime(minutes);
        seconds = updateTime(seconds);

        // Return the string representation
        return minutes + ":" + seconds;
    }
}

function getNumClocks() {
    return $("#clocks-area .clock-area").length;
}

function getNumTeams() {
    return getNumClocks();  // Number of clocks equals the number of teams
}

function getNextQuestion() {
    // Check if game has started
    if (gameStarted) {
        // Check the current question number
        if (questionNumber <= numQuestions) {  // Still have questions that can be asked
            // Get the answer, topic, and question from the questions array
            let answer = questions[questionNumber - 1]["Answer"];
            let question = questions[questionNumber - 1]["Question"];
            let topic = questions[questionNumber - 1]["Topic"];

            // Set the answer span to be blurred
            setBlur(true);

            // Update the answer, question number, question, topic spans
            answerSpan.html(answer);
            questionNumberSpan.text(`${initialQuestionNumber + questionNumber - 1}/${totalNumQuestions}`);
            questionSpan.html(question);
            topicSpan.html("Topic: " + topic);

            // Increment question number
            questionNumber++;

        } else {  // No more questions
            // Clear the interval
            clearInterval(interval);

            // Disable all teams' buttons
            let numTeams = getNumTeams();

            for (let i = 1; i <= numTeams; i++) {
                $(`#toggle-${i}`).addClass("button-disabled");
                $(`#deduct-${i}`).addClass("button-disabled");
            }

            // Update text in the questions area
            $("#question-header").html("Finished!");
            questionSpan.text("There are no more questions!");
            topicSpan.html("Everyone who is <b>not</b> eliminated are winners!");
            answerSpan.html("No Answer Here!");

            // Colour all non-eliminated teams' clocks green
            for (let i = 1; i <= numTeams; i++) {
                if (!eliminatedTeams.includes(i)) {  // Not eliminated
                    $(`#clock-${i}`).css("color", "green");
                }
            }

            // Shoot some fireworks!
            confettiFireworks(10, 0.3);
        }
    }
}

function setBlur(is_blurred) {
    if (is_blurred) {
        answerSpan.addClass("blurred");

    } else {
        answerSpan.removeClass("blurred");
    }
}

function toggleBlur() {
    // Toggle blur
    if (answerSpan.hasClass("blurred")) {
        setBlur(false);  // Un-blur
    } else {
        setBlur(true);  // Blur
    }
}

function updateTimes() {
    // Check if the game started
    if (!gameStarted) {
        // Get the current value of the input field
        let timeLimitInSeconds = timeLimitInput.val();

        // Convert that time limit into hundredths
        let timeLimitInHundredthsSeconds = timeLimitInSeconds * 100;

        // Get the correct time limit that should be shown on all clocks
        let timeLimit = displayTime(timeLimitInHundredthsSeconds);

        // Reset the `times` array
        times = [-1];  // We want to use 1-indexed array

        // Update all clocks
        let numClocks = getNumClocks();

        for (let i = 1; i <= numClocks; i++) {
            // Update the text
            $(`#clock-${i}`).text(timeLimit);

            // Append the new time limit to the array
            times.push(timeLimitInHundredthsSeconds);
        }
    }
}

// MAIN CODE
// Code to be run once the user presses Enter/Return whilst on the "Session ID" field
sessionIDInput.keyup((event) => {
    if (event.which === 13) {  // Key pressed was the Enter/Return key
        // Click on the submit session ID button
        event.preventDefault();
        submitSessionIDButton.click();
    }
});

// Code to be run once the user presses Enter/Return whilst on the "Session Passcode" field
sessionPasscodeInput.keyup((event) => {
    if (event.which === 13) {  // Key pressed was the Enter/Return key
        // Click on the submit session ID button
        event.preventDefault();
        submitSessionIDButton.click();
    }
});

// Code to be run once the user clicks on "Submit Seed Value"
submitSessionIDButton.click(() => {
    if (sessionIDInput.val() !== "" && sessionPasscodeInput.val() !== "") {
        // Get all questions
        $.ajax({
            url: "/code-only/get-questions",
            method: "POST",
            data: {
                "session_id": sessionIDInput.val(),
                "session_passcode": sessionPasscodeInput.val()
            },
        }).done((data) => {
            try {
                // Parse the data
                data = JSON.parse(data);

                // Check the outcome
                if (data["outcome"] === "error") {
                    // Show the submission errors
                    $("#submission-errors").html(data["msg"]);

                } else {  // Assume it is OK
                    // Get values from the JSON data
                    initialQuestionNumber = data["initial_qn_num"];
                    questions = data["questions"];
                    totalNumQuestions = data["total_num_qns"];

                    // Get question count
                    numQuestions = questions.length;

                    // Update the question number span
                    questionNumberSpan.text(`(${totalNumQuestions - initialQuestionNumber + 1} left)`);

                    // Show the main div and hide this div
                    $("#main-body").css("display", "block");
                    $("#session-id-entering-modal").css("display", "none");

                    // Make the session ID show up beneath the main header
                    $("#session-id-span").html(`Session ID: <code>${sessionIDInput.val()}</code>`);
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

// Code to be run when the team count is updated
numTeamsInput.change(() => {
    // Check if the game started
    if (!gameStarted) {
        // Get the current value of the input field
        let numTeams = numTeamsInput.val();

        // Get the clocks area div
        let clocksArea = $("#clocks-area");

        // Get the net number of clocks to be added/removed
        let currNumClocks = getNumClocks();
        let netClocks = numTeams - currNumClocks;

        // Update clock count on the main page
        if (netClocks < 0) {  // Need to remove clocks
            // Delete excess clocks
            for (let i = currNumClocks; i > numTeams; i--) {
                $(`#clock-area-${i}`).remove();
            }

            // Update time on the clocks
            updateTimes();

        } else if (netClocks > 0) {  // Need to add clocks
            // Add additional clocks
            for (let i = currNumClocks + 1; i <= numTeams; i++) {
                // Copy base clock
                let newClock = $(`#clock-area-1`).clone();

                // Update the team name and ID of the team name span element
                newClock.find("#team-name-1").text(`Team ${i}`);
                newClock.find("#team-name-1").prop("id", `team-name-${i}`);

                // Update the clock's IDs
                newClock.find("#clock-1").prop("id", `clock-${i}`);

                // Update buttons' IDs
                newClock.find("#toggle-1").prop("id", `toggle-${i}`);
                newClock.find("#deduct-1").prop("id", `deduct-${i}`);

                // Update the new clock's ID
                newClock.prop("id", `clock-area-${i}`);

                // Append the new clock to the end of the clocks area div
                clocksArea.append(newClock);
            }

            // Update time on the clocks
            updateTimes();
        }
    }
});

// Code to be run when the time limit is updated
timeLimitInput.change(updateTimes);

// Code to be run when the penalty time is updated
penaltyTimeInput.change(() => {
    if (!gameStarted) {
        penaltyTime = penaltyTimeInput.val() * 100;  // Convert seconds to hundredths
    }
});

// Code to be run when the "Get Next Question" button is pressed
getNextQuestionButton.click(getNextQuestion);

// Code to be run when the "Toggle Clock" button is pressed
function toggleClock(button) {
    // Check if the button is active
    if (!button.classList.contains("button-disabled")) {
        // Get the ID of the button that was called
        let buttonID = button.id;

        // Check if the clock is currently paused
        if (isPaused) {
            // Change the button's text
            button.innerHTML = "Pause Clock";

            // Update active team
            activeTeam = parseInt(buttonID.match(/\d+/g), 10);

            // Get the number of teams
            let numTeams = getNumTeams();

            // Disable all other teams' buttons
            for (let i = 1; i <= numTeams; i++) {
                // Disable toggle time button for non-active teams
                if (i !== activeTeam) {
                    $(`#toggle-${i}`).addClass("button-disabled");
                }

                // Disable deduct time button for ALL teams
                $(`#deduct-${i}`).addClass("button-disabled");
            }

            // Change the state of the interval to "not paused"
            isPaused = false;

        } else {
            // Change the button's text
            button.innerHTML = "Resume Clock";

            // Change the state of the interval to "paused"
            isPaused = true;

            // Handle the pause
            handlePause();
        }
    }
}

// Code to handle team elimination
function handleTeamElimination(teamNumber) {
    // Stop the countdown
    isPaused = true;

    // Change the colour of the clock text to red
    $(`#clock-${teamNumber}`).css("color", "red");

    // Disable the buttons of that team
    $(`#toggle-${teamNumber}`).addClass("button-disabled");
    $(`#deduct-${teamNumber}`).addClass("button-disabled");

    // Add this team to the list of eliminated teams
    eliminatedTeams.push(teamNumber);

    // Change the active team to the next possible team
    let numPlayers = getNumClocks();

    for (let i = teamNumber; i < teamNumber + numPlayers; i++) {
        // Generate the team number
        let team = i % numPlayers + 1;

        // Check if the team is not eliminated
        if (!eliminatedTeams.includes(team)) {
            // Set that team to be the new active team
            activeTeam = team;
        }
    }
}

// Code to be run when the "Deduct Time" button is pressed
function deductTime(button) {
    // Check if the button is active
    if (!button.classList.contains("button-disabled")) {
        // Get the ID of the button that was called
        let buttonID = button.id;

        // Get the team number from the button ID
        let teamNumber = parseInt(buttonID.match(/\d+/g), 10);

        // Get that team's clock
        let clock = $(`#clock-${teamNumber}`);

        // Deduct time from the clock of that team
        if (times[teamNumber] - penaltyTime <= 0) {  // Ran out of time
            // Set the time to zero
            times[teamNumber] = 0

            // Handle that team's elimination
            handleTeamElimination(teamNumber);  // Updates active team for the winning team check

            // Check how many teams are active now
            if (eliminatedTeams.length === getNumTeams() - 1) {
                // Only the currently active team remains
                onlyOneRemains(activeTeam);
            }

        } else {
            times[teamNumber] -= penaltyTime;
        }

        // Update clock text
        clock.text(displayTime(times[teamNumber]));
    }
}

// Code to handle pausing
function handlePause() {
    // Enable all non-eliminated teams' buttons
    let numTeams = getNumTeams();

    for (let i = 1; i <= numTeams; i++) {
        if (!eliminatedTeams.includes(i)) {
            $(`#toggle-${i}`).removeClass("button-disabled");
            $(`#deduct-${i}`).removeClass("button-disabled");
        }
    }
}

// Code to be run when "Start The Game!" button is clicked
startGameButton.click(() => {
    // Check if the game started already
    if (!gameStarted) {
        // Clear the validation error message box
        let validationErrors = $("#validation-errors")
        validationErrors.html("");

        // Declare variables for the validation of data
        let validData = true;
        let errorMsg = "There were errors:<ul>";  // The ul tag will be closed by the end

        // Get the data that was entered
        let numTeams, timeLimit, penaltyTime;

        try {
            numTeams = parseInt(numTeamsInput.val());
            timeLimit = parseInt(timeLimitInput.val());
            penaltyTime = parseInt(penaltyTimeInput.val());
        } catch (e) {  // Occurs if there are invalid data types for the integer
            validData = false;
            errorMsg = e.text();
        }

        // Validate data
        if (validData) {
            if (!(MIN_NUM_TEAMS <= numTeams && numTeams <= MAX_NUM_TEAMS)) {
                validData = false;
                errorMsg += `<li>Number of teams should be between ${MIN_NUM_TEAMS} and ${MAX_NUM_TEAMS} 
                             inclusive.</li>`;
            }

            if (!(MIN_TIME <= timeLimit && timeLimit <= MAX_TIME)) {
                validData = false;
                errorMsg += `<li>Time limit should be between ${MIN_TIME} seconds and ${MAX_TIME} seconds 
                             inclusive.</li>`;
            }

            if (!(MIN_PENALTY_TIME <= penaltyTime && penaltyTime <= MAX_PENALTY_TIME)) {
                validData = false;
                errorMsg += `<li>Penalty time should be between ${MIN_PENALTY_TIME} seconds and ${MAX_PENALTY_TIME} 
                             seconds inclusive.</li>`;
            }
        }

        // Check if the data is valid
        if (validData) {
            // Create the interval object
            interval = setInterval(() => {
                // Check if not paused
                if (!isPaused) {
                    // Update active team's time left
                    let timeLeft = --times[activeTeam];  // Decrement time first before getting the value

                    // Check if time limit exceeded
                    if (timeLeft < 0) {
                        // Handle that team's elimination
                        handleTeamElimination(activeTeam);  // Updates active team for the winning team check

                        // Check how many teams are active now
                        if (eliminatedTeams.length === getNumTeams() - 1) {
                            // Only that team remains
                            onlyOneRemains(activeTeam);  // This is the new active team
                        } else {
                            // Handle the pause that just occurred
                            handlePause();
                        }

                    } else {
                        // Update clock text
                        $(`#clock-${activeTeam}`).text(displayTime(timeLeft));
                    }
                }
            }, 10);  // Interval is called every 10 ms

            // Disable the "Start The Game!" button
            startGameButton.addClass("button-disabled");

            // Disable input fields
            numTeamsInput.prop("disabled", true);
            timeLimitInput.prop("disabled", true);
            penaltyTimeInput.prop("disabled", true);

            // Enable the active clock's team's "Toggle Clock" button and change the text on it
            let toggleClockButton = $(`#toggle-${activeTeam}`);
            toggleClockButton.removeClass("button-disabled");
            toggleClockButton.text("Pause Clock");

            // Update the `gameStarted` flag
            gameStarted = true;

            // Get the first question
            getNextQuestion();

            // Enable the "Get Next Question" button
            getNextQuestionButton.removeClass("button-disabled");

        } else {  // Data invalid
            // Close the list in the error message
            errorMsg += "</ul>";

            // Show the final validation error message
            validationErrors.html(errorMsg);
        }
    }
});

// Code to be run when there is only one non-eliminated team left
function onlyOneRemains(teamNumber) {
    // Clear the interval
    clearInterval(interval);

    // Highlight that team's clock in green
    $(`#clock-${teamNumber}`).css("color", "green")

    // Disable all teams' buttons
    let numTeams = getNumTeams();

    for (let i = 1; i <= numTeams; i++) {
        $(`#toggle-${i}`).addClass("button-disabled");
        $(`#deduct-${i}`).addClass("button-disabled");
    }

    // Update the centre div to reflect that that team won
    $("#question-header").text("We have a winner!");
    questionSpan.text(`Team "${$(`#team-name-${teamNumber}`).text()}" won!`)
    topicSpan.text("Refresh the page to play again.");

    // Shoot some fireworks!
    confettiFireworks(10, 0.3);
}
