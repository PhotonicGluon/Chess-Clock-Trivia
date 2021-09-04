// GET ELEMENTS
let sessionIDInput = $("#session-id");
let sessionPasscodeInput = $("#session-passcode");
let sessionSeedInput = $("#session-seed");

let setUpSessionButton = $("#set-up-session");

let outcomeSpan = $("#outcome");

// MAIN CODE
// Code to be run once the page is loaded
$(document).ready(() => {
    // Get a session ID from the server
    $.ajax({
        url: "/code-only/generate-suggested-session-id",
        method: "POST"
    }).done((data) => {
        // Update the span
        sessionIDInput.prop("value", data);
    });

    // Generate a suggested seed value
    let suggestedSeedValue = randint(100000, 999999);
    sessionSeedInput.prop("value", suggestedSeedValue);
});

// Code to be run once the "Set Up Session" button is clicked
setUpSessionButton.click(() => {
    // Get input data
    let sessionID = sessionIDInput.val();
    let sessionPasscode = sessionPasscodeInput.val();
    let sessionSeed = sessionSeedInput.val();

    // Declare variables for the validation of data
    let validData = true;
    let errorMsg = "There were errors:<ul>";  // The ul tag will be closed by the end

    // Validate data
    if (sessionID.length === 0) {
        validData = false;
        errorMsg += `<li>Session ID cannot be empty.</li>`;
    }

    if (sessionPasscode.length === 0) {
        validData = false;
        errorMsg += `<li>Session passcode cannot be empty.</li>`;
    }

    if (sessionSeed.length === 0) {
        validData = false;
        errorMsg += "<li>Session seed cannot be empty.</li>";
    }

    // Check if the data is valid
    if (validData) {
        // Set up session by calling server function
        $.ajax({
            url: "/code-only/set-up-session",
            method: "POST",
            data: {
                "session_id": sessionID,
                "session_passcode": sessionPasscode,
                "session_seed": sessionSeed
            }
        }).done((data) => {
            try {
                // Parse the JSON data
                data = JSON.parse(data);

                // Check the outcome
                if (data["outcome"] === "error") {
                    // Display the error
                    outcomeSpan.text(data["msg"]);
                    outcomeSpan.css("color", "red");

                } else {  // Assume it is OK
                    // Show success message
                    outcomeSpan.text("Session set up successfully!");
                    outcomeSpan.css("color", "black");

                    // Disable the update session button
                    setUpSessionButton.addClass("button-disabled");

                    // Wait for 5 seconds
                    setTimeout(() => {
                        // Enable the update session button
                        setUpSessionButton.removeClass("button-disabled");

                        // Clear the response text
                        outcomeSpan.text("");
                    }, 5000);
                }
            } catch (e) {  // Likely that the request timed out
                outcomeSpan.text("Request timed out. Try again in a while.");
                outcomeSpan.css("color", "red");
            }
        });

    } else {  // Data invalid
        // Close the list in the error message
        errorMsg += "</ul>";

        // Show the final validation error message
        outcomeSpan.html(errorMsg);
        outcomeSpan.css("color", "red");
    }
});
