// CONSTANTS
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const MIN_TIME = 10;  // In seconds
const MAX_TIME = 3600;  // 1 hour

const MIN_PENALTY_TIME = 1;  // 1 second
const MAX_PENALTY_TIME = 20;  // 20 seconds

// GET ELEMENTS
let sessionIDInput = $("#session-id");
let numPlayersInput = $("#num-players");
let timeLimitInput = $("#time-limit");
let penaltyTimeInput = $("#penalty-time");

let submitSessionIDButton = $("#submit-session-id");
let startGameButton = $("#start-game");

let questionSpan = $("#question");
let questionNumberSpan = $("#question-number");
let topicSpan = $("#topic");

// GLOBAL VARIABLES
let penaltyTime = 1000;  // 10 seconds, i.e. 1000 hundredths of a second
let times = [-1, 6000, 6000];  // Array to store times for all clocks

let initialQuestionNumber = null;  // Initial question number as obtained from the server
let questionNumber = 1;  // Current (relative) question number
let questions = null;  // List of questions that will be obtained from the server

let activeTeam = 1;  // The first team's clock will go first
let eliminatedTeams = [];  // List of eliminated teams that cannot play anymore

let interval = null;  // Interval to handle the decrement of time; will be set once the game starts
let isPaused = false;  // Whether clock interval is paused
let gameStarted = false;

// UTILITY FUNCTIONS
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
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

// HELPER FUNCTIONS
function getNumClocks() {
    return $("#clocks-area .clock-area").length;
}

function getNextQuestion(questionNum) {
    // Get the question and topic from the questions array
    let topic = questions[questionNum - 1]["Topic"];
    let question = questions[questionNum - 1]["Question"];

    // Update the question number, question and topic spans
    questionNumberSpan.text(`${initialQuestionNumber + questionNumber - 1}/${TOTAL_NUM_QUESTIONS}`);
    questionSpan.html(question);
    topicSpan.html("Topic: " + topic);

    // Increment question number
    questionNumber++;
}

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
            origin: {x: randomInRange(0.1, 0.3), y: Math.random() - 0.2}
        }));
        canvas.confetti(Object.assign({}, defaults, {
            particleCount,
            origin: {x: randomInRange(0.7, 0.9), y: Math.random() - 0.2}
        }));
    }, fireworkInterval * 1000);
}

// MAIN CODE
// Code to be run once the page is loaded
$(document).ready(() => {
    // Get a session ID from the server
    $.ajax({
        url: "/code-only/generate-session-id",
        method: "POST"
    }).done((data) => {
        // Update the span
        $("#session-id-span").text(data);
    });
});

// Code to be run once the user presses Enter/Return whilst on the "Enter Session ID" field
sessionIDInput.keyup((event) => {
    if (event.which === 13) {  // Key pressed was the Enter/Return key
        // Click on the submit session ID button
        event.preventDefault();
        submitSessionIDButton.click();
    }
});

// Code to be run once the user clicks on "Submit Seed Value"
submitSessionIDButton.click(() => {
    if (sessionIDInput.val() !== "") {
        // Get all questions
        $.ajax({
            url: "/code-only/set-up-session",
            method: "POST",
            data: {"session_id": sessionIDInput.val()},
        }).done((data) => {
            // Update session ID
            sessionID = sessionIDInput.val();

            // Parse the data
            data = JSON.parse(data);

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
        });
    } else {  // Session ID is empty
        $("#submission-errors").text("Session ID cannot be empty.");
    }
});

// Code to be run when the player count is updated
numPlayersInput.change(() => {
    // Check if the game started
    if (!gameStarted) {
        // Get the current value of the input field
        let numPlayers = numPlayersInput.val();

        // Get the clocks area div
        let clocksArea = $("#clocks-area");

        // Get the net number of clocks to be added/removed
        let currNumClocks = getNumClocks();
        let netClocks = numPlayers - currNumClocks;

        // Check if any clocks need to be removed or added
        if (netClocks < 0) {
            // Remove clocks
            for (let i = currNumClocks; i > numPlayers; i--) {
                $(`#clock-area-${i}`).remove();
            }

            // Update times of the clocks
            updateTimes();

        } else if (netClocks > 0) {
            // Add clocks
            for (let i = currNumClocks + 1; i <= numPlayers; i++) {
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

            // Update times of the clocks
            updateTimes();
        }
    }
});

// Code to be run when the time limit is updated
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

timeLimitInput.change(updateTimes);

// Code to be run when the penalty time is updated
penaltyTimeInput.change(() => {
    // Check if the game has started
    if (!gameStarted) {
        penaltyTime = penaltyTimeInput.val() * 100;  // Convert to hundredths
    }
});

// Code to be run when the "Toggle Clock" button is pressed
function toggleClock(button) {
    // Check if the button is active
    if (!button.classList.contains("button-disabled")) {
        // Get the ID of the button that was called
        let buttonID = button.id;

        // Check if the clock is currently running
        if (isPaused) {
            // Change the button's text
            button.innerHTML = "Pause Clock";

            // Update active team
            activeTeam = parseInt(buttonID.match(/\d+/g), 10);

            // Get the number of players
            let numPlayers = getNumClocks();

            // Disable all other players' buttons
            for (let i = 1; i <= numPlayers; i++) {
                if (i !== activeTeam) {
                    $(`#toggle-${i}`).addClass("button-disabled");
                }

                $(`#deduct-${i}`).addClass("button-disabled");  // Disable deduct time button for ALL teams
            }

            // Change the state of the interval to "not paused"
            isPaused = false;

            // Get the next question
            getNextQuestion(questionNumber);

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
function handleTeamElimination() {
    // Stop the countdown
    isPaused = true;

    // Change the colour of the clock text to red
    $(`#clock-${activeTeam}`).css("color", "red");

    // Disable the buttons of that team
    $(`#toggle-${activeTeam}`).addClass("button-disabled");
    $(`#deduct-${activeTeam}`).addClass("button-disabled");

    // Add this team to the list of eliminated teams
    eliminatedTeams.push(activeTeam);

    // Change the active team to the next possible team
    let numPlayers = getNumClocks();

    for (let i = activeTeam; i < activeTeam + numPlayers; i++) {
        // Generate the team number
        let teamNumber = i % numPlayers + 1;

        // Check if the team is not eliminated
        if (!eliminatedTeams.includes(teamNumber)) {
            // Set that team to be the new active team
            activeTeam = teamNumber;
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
            handleTeamElimination();

            // Check how many teams are active now
            if (eliminatedTeams.length === getNumClocks() - 1) {
                // Only that team remains
                onlyOneRemains(activeTeam);  // This is the new active team
            }

        } else {
            // Since the time does not go below zero, it is safe to just subtract the time
            times[teamNumber] -= penaltyTime;
        }

        // Update clock text
        clock.text(displayTime(times[teamNumber]));
    }
}

// Code to handle pausing
function handlePause() {
    // Get the number of players
    let numPlayers = getNumClocks();

    // Enable all non-eliminated teams' buttons
    for (let i = 1; i <= numPlayers; i++) {
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
        let errorMsg = "There were errors:<ul>";  // Will be modified along the way

        // Get the data that was entered
        let numPlayers, timeLimit, penaltyTime;

        try {
            numPlayers = parseInt(numPlayersInput.val());
            timeLimit = parseInt(timeLimitInput.val());
            penaltyTime = parseInt(penaltyTimeInput.val());
        } catch (e) {  // Occurs if there are invalid data types for the integer
            validData = false;
            errorMsg = e.text();
        }

        // Validate data
        if (validData) {
            if (!(MIN_PLAYERS <= numPlayers && numPlayers <= MAX_PLAYERS)) {
                validData = false;
                errorMsg += `<li>Number of players should be between ${MIN_PLAYERS} and ${MAX_PLAYERS} inclusive.</li>`;
            }

            if (!(MIN_TIME <= timeLimit && timeLimit <= MAX_TIME)) {
                validData = false;
                errorMsg += `<li>Time limit should be between ${MIN_TIME} seconds and ${MAX_TIME} seconds inclusive.
                             </li>`;
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
                        handleTeamElimination();

                        // Check how many teams are active now
                        if (eliminatedTeams.length === getNumClocks() - 1) {
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
            numPlayersInput.prop("disabled", true);
            timeLimitInput.prop("disabled", true);
            penaltyTimeInput.prop("disabled", true);

            // Enable the active clock's team's "Toggle Clock" button and change the text on it
            let toggleClockButton = $(`#toggle-${activeTeam}`);
            toggleClockButton.removeClass("button-disabled");
            toggleClockButton.text("Pause Clock");

            // Update the `gameStarted` flag
            gameStarted = true;

            // Get the first question
            getNextQuestion(questionNumber);

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

    // Disable all players' buttons
    let numPlayers = getNumClocks();

    for (let i = 1; i <= numPlayers; i++) {
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
