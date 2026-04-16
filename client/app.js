let currentContact = null;
let currentSubscriptionId = null;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showStatus(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="${type}">${message}</div>`;
}

async function checkContact() {
    const personalNumber = document.getElementById('personalNumber').value.trim();

    if (!personalNumber) {
        showStatus('check-status', 'Please enter a personal number', 'error');
        return;
    }

    showStatus('check-status', 'Checking...', 'loading');

    try {
        const response = await fetch(`/api/contact/check?personalNumber=${encodeURIComponent(personalNumber)}`);
        const data = await response.json();

        if (response.ok) {
            if (data.exists) {
                currentContact = data.contact;
                showExistingUserScreen();
            } else {
                document.getElementById('regPersonalNumber').value = personalNumber;
                showScreen('screen2b');
            }
        } else {
            showStatus('check-status', data.error || 'Error checking contact', 'error');
        }
    } catch (error) {
        showStatus('check-status', 'Network error', 'error');
    }
}

function showExistingUserScreen() {
    const contactInfo = document.getElementById('contact-info');
    contactInfo.innerHTML = `
        <p><strong>Name:</strong> ${currentContact.FirstName} ${currentContact.LastName}</p>
        <p><strong>Personal Number:</strong> ${currentContact.PersonalNumber}</p>
        <p><strong>Birth Date:</strong> ${currentContact.BirthDate}</p>
        <p><strong>Address:</strong> ${currentContact.Address}</p>
        <p><strong>Mobile:</strong> ${currentContact.Mobile}</p>
    `;
    document.getElementById('contactCode').value = currentContact.ContactCode;
    showScreen('screen2a');
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    showStatus('upload-status', 'Uploading documents...', 'loading');

    try {
        const response = await fetch('/api/document/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showStatus('success-message', `Documents uploaded successfully! Document IDs: ${data.documentIds.join(', ')}`, 'success');
            showScreen('screen3');
        } else {
            showStatus('upload-status', data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showStatus('upload-status', 'Network error', 'error');
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    showStatus('register-status', 'Registering...', 'loading');

    try {
        const response = await fetch('/api/contact/register', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            currentSubscriptionId = data.subscriptionId;
            pollSubscriptionStatus();
        } else {
            showStatus('register-status', data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showStatus('register-status', 'Network error', 'error');
    }
});

async function pollSubscriptionStatus() {
    showStatus('register-status', 'Waiting for CBS approval... (this may take a few moments)', 'loading');

    const poll = async () => {
        try {
            const response = await fetch(`/api/contact/subscription-status?subscriptionId=${encodeURIComponent(currentSubscriptionId)}`);
            const data = await response.json();

            if (response.ok) {
                if (data.status === 'approved') {
                    showStatus('success-message', `Registration approved! Contact Code: ${data.contactCode}`, 'success');
                    showScreen('screen3');
                } else if (data.status === 'rejected') {
                    showStatus('register-status', `Registration rejected: ${data.reason}`, 'error');
                } else if (data.status === 'pending') {
                    setTimeout(poll, 3000); // Poll every 3 seconds
                }
            } else {
                showStatus('register-status', data.error || 'Error checking status', 'error');
            }
        } catch (error) {
            showStatus('register-status', 'Network error while checking status', 'error');
        }
    };

    poll();
}