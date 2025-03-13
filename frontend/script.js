document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const modal = document.getElementById("eventModal");
    const addEventBtn = document.getElementById("addEventBtn");
    const closeBtn = document.querySelector(".close");
    const eventForm = document.getElementById("eventForm");
    const eventsList = document.getElementById("eventsList");
    const startButton = document.getElementById("startButton");

    let events = [];
    let currentEventIndex = 0;
    let callStartTime = null;

    // Open modal
    addEventBtn.onclick = () => {
        modal.style.display = "block";
    };

    // Close modal
    closeBtn.onclick = () => {
        modal.style.display = "none";
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };

    // Form submission
    eventForm.onsubmit = (e) => {
        e.preventDefault();

        const newEvent = {
            id: Date.now(),
            name: document.getElementById("name").value,
            gender: document.getElementById("gender").value,
            mobile: document.getElementById("mobile").value,
            language: document.getElementById("language").value,
        };

        events.push(newEvent);
        updateEventsList();
        eventForm.reset();
        modal.style.display = "none";
        updateStartButton();
    };

    // Update events list
    function updateEventsList() {
        eventsList.innerHTML = "";
        events.forEach((event, index) => {
            const eventElement = document.createElement("div");
            eventElement.className = "event-item";
            eventElement.innerHTML = `
                <div class="event-item-content">
                    <strong>${index + 1}. ${event.name}</strong><br>
                    <span>📱 ${event.mobile}</span><br>
                    <span>🗣️ ${event.language.toUpperCase()} | 👤 ${event.gender}</span>
                </div>
                <button class="delete-btn" data-id="${event.id}">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            eventsList.appendChild(eventElement);
        });

        // Add delete event listeners
        document.querySelectorAll(".delete-btn").forEach((btn) => {
            btn.onclick = () => {
                const id = parseInt(btn.getAttribute("data-id"));

                events = events.filter((event) => event.id !== id);
                updateEventsList();
                updateStartButton();
            };
        });
    }

    // Update start button state
    function updateStartButton() {
        startButton.disabled = events.length === 0;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showCallInterface(eventIndex) {
        const phoneScreen = document.querySelector(".screen-content");
        const currentContact = events[eventIndex]?.name || "Unknown Contact";
        const currentNumber = events[eventIndex]?.number || "Unknown Contact";

        phoneScreen.innerHTML = `
            <div id = "call-inter" class="call-interface">
                <div class="caller-name">${currentContact}</div>
                <div class="caller-number">${currentNumber}</div>
                <div class="call-image-container">
                    <img src="assets/call.png" alt="Call Interface" class="call-image">
                </div>
                <div class="call-buttons">
                    <button  class="call-button reject-button" aria-label="Reject Call"></button>
                    <button  class="call-button accept-button" aria-label="Accept Call"></button>
                </div>
            </div>
        `;

        // Add event listeners to buttons
        const callInter = phoneScreen.querySelector(".call-interface");
        const callButtons = callInter.querySelector(".call-buttons");
        const rejectButton = callButtons.querySelector(".accept-button");
        const acceptButton = callButtons.querySelector(".reject-button");

        acceptButton.onclick = function () {
            moveToNextCall(eventIndex);
        };
        rejectButton.onclick = function () {
            showAcceptScreen(eventIndex);
        };
    }
    function showAcceptScreen(eventIndex) {
        callStartTime = Date.now();
        const currentContact = events[eventIndex];
        const phoneScreen = document.querySelector(".screen-content");
        let isCallEnded = false;
        let currentAudio = null;
        let isProcessing = false;

        // Set up phone screen UI
        phoneScreen.innerHTML = `
            <div class="accept-interface">
                <div class="caller-name">${currentContact.name}</div>
                <div class="caller-number">${currentContact.mobile}</div>
                <div class="call-image-container">
                    <img src="assets/accept.png" alt="Accept Interface" class="call-image">
                </div>
                <div class="call-buttons">
                    <button type="button" class="call-button decline-button" aria-label="End Call"></button>
                </div>
            </div>
        `;

        // Initialize speech recognition
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = currentContact.language === 'hi' ? 'hi-IN' : 'en-US';

        recognition.onresult = async (event) => {
            if (isProcessing || isCallEnded) return;
            
            const text = event.results[0][0].transcript;
            console.log('Recognized text:', text);
            addToLog(text, 'user');
            
            isProcessing = true;
            try {
                const response = await fetch('http://localhost:3000/send-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        language: currentContact.language,
                        name: currentContact.name,
                        gender: currentContact.gender,
                        mobile: currentContact.mobile
                    })
                });

                const data = await response.json();
                
                if (data.audio) {
                    updateStatus('speaking');
                    addToLog(data.aiResponse, 'ai');

                    if (currentAudio) {
                        currentAudio.pause();
                    }

                    const audioPlayer = new Audio(`data:audio/mp3;base64,${data.audio}`);
                    currentAudio = audioPlayer;

                    audioPlayer.addEventListener('ended', () => {
                        // After AI finishes speaking, end call and move to next contact
                        isCallEnded = false;
                        if (data.shouldEndCall) {
                            logCallEnd(currentContact, 'order_placed');
                        } else {
                            logCallEnd(currentContact, 'call_completed');
                        }
                        setTimeout(() => {
                            const nextIndex = eventIndex + 1;
                            if (nextIndex < events.length) {
                                showCallInterface(nextIndex);
                            } else {
                                showCampaignComplete();
                            }
                        }, 1000);
                    });

                    await audioPlayer.play();
                }
            } catch (error) {
                console.error('Error:', error);
                isProcessing = false;
                if (!isCallEnded) {
                    setTimeout(() => {
                        updateStatus('listening');
                        recognition.start();
                    }, 1000);
                }
            }
        };

        // Handle decline button
        const declineButton = phoneScreen.querySelector('.decline-button');
        declineButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isCallEnded = true;
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            recognition.stop();
            logCallEnd(currentContact, 'user_ended');
            moveToNextCall(eventIndex);
        };

        function startListeningAfterDelay() {
            setTimeout(() => {
                if (!isCallEnded && !isProcessing) {
                    try {
                        recognition.start();
                    } catch (error) {
                        console.error('Error starting recognition:', error);
                    }
                }
            }, 1000);
        }

        // Start the call with initial greeting
        async function startInitialGreeting() {
            try {
                await handleUserInput('initial_greeting');
            } catch (error) {
                console.error('Error in initial greeting:', error);
                if (!isCallEnded) {
                    startListeningAfterDelay();
                }
            }
        }

        // Start the call
        setTimeout(() => {
            startInitialGreeting();
        }, 500);
    }

    async function logCallEnd(contact, endType) {
        try {
            await fetch('http://localhost:3000/send-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: contact.name,
                    mobile: contact.mobile,
                    gender: contact.gender,
                    language: contact.language,
                    callEndType: endType,
                    callDuration: calculateCallDuration() // You'll need to implement this
                })
            });
        } catch (error) {
            console.error('Error logging call end:', error);
        }
    }

    function handleCallEnd(eventIndex) {
        const nextIndex = eventIndex + 1;
        if (nextIndex < events.length) {
            showCallInterface(nextIndex);
        } else {
            showCampaignComplete();
        }
    }

    function showCampaignComplete() {
        const phoneScreen = document.querySelector(".screen-content");
        phoneScreen.innerHTML = `
            <div class="campaign-complete">
                <h3>Campaign Completed</h3>
                <p>Total Calls: ${events.length}</p>
                <p>Click 'Start Campaign' to begin a new session</p>
            </div>
        `;
    }

    function moveToNextCall(currentIndex) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < events.length) {
            setTimeout(() => {
                showCallInterface(nextIndex);
            }, 1000);
        } else {
            const phoneScreen = document.querySelector(".screen-content");
            phoneScreen.innerHTML = `
                <div class="campaign-complete">
                    <h3>Campaign Completed</h3>
                    <p>All calls processed</p>
                </div>
            `;
            updateStatus('idle');
        }
    }

    // Update start button click handler
    startButton.onclick = () => {
        currentEventIndex = 0;
        showCallInterface(currentEventIndex);
    };

    function updateStatus(status) {
        const statusLight = document.getElementById('statusLight');
        const statusText = document.getElementById('statusText');
        
        switch(status) {
            case 'listening':
                statusLight.style.backgroundColor = '#00ff00';
                statusText.textContent = 'Listening';
                break;
            case 'speaking':
                statusLight.style.backgroundColor = '#ff0000';
                statusText.textContent = 'Speaking';
                break;
            default:
                statusLight.style.backgroundColor = '#666';
                statusText.textContent = 'Idle';
        }
    }

    function addToLog(message, type) {
        const logContent = document.getElementById('logContent');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}-message`;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        const text = document.createElement('div');
        text.textContent = message;
        
        entry.appendChild(timestamp);
        entry.appendChild(text);
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    function calculateCallDuration() {
        if (!callStartTime) return 'N/A';
        const duration = Math.floor((Date.now() - callStartTime) / 1000); // Duration in seconds
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
});