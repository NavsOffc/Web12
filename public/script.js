const socket = io();

socket.on('qr-code', (data) => {
    window.open(`/qr.html?senderId=${data.senderId}&qr=${data.qr}`, 'QR Code', 'width=400,height=400');
});

socket.on('sender-connected', (data) => {
    alert(data.message);
    // Update sender dropdown
    const select = document.getElementById('senderId');
    const option = document.createElement('option');
    option.value = data.senderId;
    option.text = data.senderId;
    select.add(option);
});

async function addSender() {
    const response = await fetch('/add-sender', { method: 'POST' });
    const data = await response.json();
    if (data.success) alert(`Scan QR for Sender: ${data.senderId}`);
}

async function sendBug() {
    const senderId = document.getElementById('senderId').value;
    const bugType = document.getElementById('bugType').value;
    const targetNumber = document.getElementById('targetNumber').value;
    const response = await fetch('/send-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, targetNumber, bugType })
    });
    const data = await response.json();
    alert(data.message || data.error);
}

async function listFiles() {
    const senderId = document.getElementById('fileSenderId').value;
    const response = await fetch(`/file-manager/${senderId}`);
    const data = await response.json();
    alert(JSON.stringify(data.files));
}

async function uploadFile() {
    const senderId = document.getElementById('fileSenderId').value;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
        const formData = new FormData();
        formData.append('file', input.files[0]);
        const response = await fetch(`/file-manager/${senderId}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        alert(data.message || data.error);
    };
    input.click();
}
