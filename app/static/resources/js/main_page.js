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

    // Calculate the duration in milliseconds and determine when the animation should end
    duration *= 1000;
    let animationEnd = Date.now() + duration;

    // Define defaults
    let defaults = {startVelocity: 30, spread: 360, ticks: 60, zIndex: 0};

    // Create the interval object that will shoot the fireworks
    let interval = setInterval(function () {
        // Calculate time left
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
let times = [-1, 6000, 6000];  // Array to store all times left for all clocks

let initialQuestionNumber = null;  // Initial question number as obtained from the server
let questionNumber = 1;  // Current (relative) question number
let questions = null;  // Variable to store the list of questions that will be obtained from the server

let activeTeam = 1;  // The first team's clock will go first
let eliminatedTeams = [];  // List of eliminated teams that cannot play anymore

let interval = null;  // Interval to handle the decrement of time; will be set once the game starts
let isPaused = false;  // Flag that says whether the interval is paused or not
let gameStarted = false;  // Has the game started?

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
        if (times[teamNumber] - penaltyTime <= 0) {
            // Set the time to zero
            times[teamNumber] = 0

            // Change the colour of that clock's text to red
            clock.css("color", "red");

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

    // Set all toggle clock buttons to be active
    for (let i = 1; i <= numPlayers; i++) {
        $(`#toggle-${i}`).removeClass("button-disabled");
        $(`#deduct-${i}`).removeClass("button-disabled");
    }
}

// Code to be run when "Start The Game!" button is clicked
startGameButton.click(() => {
    // Check if the game started already
    if (!gameStarted) {
        // Create the interval object
        interval = setInterval(() => {
            // Check if not paused
            if (!isPaused) {
                // Update active team's time left
                let timeLeft = --times[activeTeam];  // Decrement time first before getting the value

                // Get the clock element
                let activeClock = $(`#clock-${activeTeam}`);

                // Check if time limit exceeded
                if (timeLeft < 0) {
                    // Stop the countdown
                    isPaused = true;

                    // Change the colour of the clock text to red
                    activeClock.css("color", "red");

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

                    // Check how many teams are active now
                    if (eliminatedTeams.length === getNumClocks() - 1) {
                        // Only that team remains
                        onlyOneRemains(activeTeam);
                    } else {
                        // Handle the pause that just occurred
                        handlePause();
                    }

                } else {
                    // Update clock text
                    activeClock.text(displayTime(timeLeft));
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
    }
});

// Code to be run when there is only one non-eliminated team left
function onlyOneRemains(teamNumber) {
    // Clear the interval
    clearInterval(interval);

    // Highlight that team's clock in green
    $(`#clock-${teamNumber}`).css("color", "green")

    // Update the centre div to reflect that that team won
    $("#question-header").text("We have a winner!");
    questionSpan.text(`Team "${$(`#team-name-${teamNumber}`).text()}" won!`)
    topicSpan.text("Please refresh the page to play again.");

    // Shoot some fireworks!
    confettiFireworks(10, 0.3);
}
