const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const apiUrl = 'https://la-absensi-web.vercel.app/api';
let attendanceData = [];

mqttClient.on('connect', () => {
    document.getElementById('status').innerText = 'Status MQTT: Terhubung';
    document.getElementById('status').style.color = '#2ecc71';
    mqttClient.subscribe('lintas_alam/detected_person');
    mqttClient.subscribe('lintas_alam/attendance_share');
    logMessage('Terhubung ke MQTT Broker');
});

mqttClient.on('message', (topic, message) => {
    const msg = JSON.parse(message.toString());
    logMessage(`Pesan diterima - Topic: ${topic}, Data: ${JSON.stringify(msg)}`);
    if (topic === 'lintas_alam/detected_person' || topic === 'lintas_alam/attendance_share') {
        const now = new Date();
        const status = calculateStatus(now, msg.timestamp);
        const data = {
            name: msg.name,
            timestamp: msg.timestamp,
            status: status,
            course: msg.course
        };
        saveMessage(data);
        attendanceData.push(data);
        updateAttendanceTable();
    }
});

function calculateStatus(currentTime, timestamp) {
    const detectionTime = new Date(timestamp);
    const diffMinutes = (currentTime - detectionTime) / (1000 * 60);
    if (diffMinutes <= 5) return 'On Time';
    if (diffMinutes <= 15) return 'Terlambat';
    return 'Absen';
}

function saveMessage(data) {
    fetch(`${apiUrl}/save-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => logMessage(`Data disimpan: ${JSON.stringify(result)}`))
    .catch(error => logMessage(`Error menyimpan data: ${error}`));
}

function fetchMessages() {
    fetch(`${apiUrl}/get-messages`)
        .then(response => response.json())
        .then(messages => {
            attendanceData = messages.map(msg => ({
                name: msg.name,
                timestamp: msg.timestamp,
                status: msg.status,
                course: msg.course
            }));
            updateAttendanceTable();
        })
        .catch(error => logMessage(`Error mengambil data: ${error}`));
}

function updateAttendanceTable() {
    const tableDiv = document.getElementById('attendance-table');
    let html = '<table><tr><th>Nama</th><th>Waktu</th><th>Status</th><th>Mata Kuliah</th></tr>';
    attendanceData.forEach(data => {
        html += `<tr><td>${data.name}</td><td>${data.timestamp}</td><td>${data.status}</td><td>${data.course}</td></tr>`;
    });
    html += '</table>';
    tableDiv.innerHTML = html;
}

function publishCommand(topic, message) {
    mqttClient.publish(topic, message);
    logMessage(`Perintah dikirim - Topic: ${topic}, Pesan: ${message}`);
}

function sendOledMessage() {
    const message = document.getElementById('oled-message').value;
    if (message) {
        publishCommand('lintas_alam/oled', message);
        document.getElementById('oled-message').value = '';
    } else {
        logMessage('Masukkan pesan untuk OLED terlebih dahulu!');
    }
}

function saveCourseSchedule() {
    const course = document.getElementById('course-name').value;
    const date = document.getElementById('course-date').value;
    const start = document.getElementById('course-start').value;
    const end = document.getElementById('course-end').value;
    if (course && date && start && end) {
        const startDateTime = `${date} ${start}:00`;
        const endDateTime = `${date} ${end}:00`;
        const payload = { course, start: startDateTime, end: endDateTime };
        publishCommand('lintas_alam/schedule', JSON.stringify(payload));
    } else {
        logMessage('Lengkapi semua field jadwal mata kuliah!');
    }
}

function saveIndividualSchedule() {
    const person = document.getElementById('person-name').value;
    const date = document.getElementById('person-date').value;
    const start = document.getElementById('person-start').value;
    const end = document.getElementById('person-end').value;
    if (person && date && start && end) {
        const startDateTime = `${date} ${start}:00`;
        const endDateTime = `${date} ${end}:00`;
        const payload = { person, start: startDateTime, end: endDateTime };
        publishCommand('lintas_alam/schedule', JSON.stringify(payload));
    } else {
        logMessage('Lengkapi semua field jadwal perorangan!');
    }
}

function logMessage(message) {
    const logDiv = document.getElementById('log-messages');
    const p = document.createElement('p');
    p.innerText = `[${new Date().toLocaleString()}] ${message}`;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="openTab('${tabId}')"]`).classList.add('active');
}

window.onload = () => {
    fetchMessages();
};
