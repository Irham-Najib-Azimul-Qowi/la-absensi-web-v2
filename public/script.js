const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const apiUrl = 'https://la-absensi-web.vercel.app/api';
let attendanceData = [];
let studentList = [];

mqttClient.on('connect', () => {
    document.getElementById('status').innerText = 'Status MQTT: Terhubung';
    document.getElementById('status').style.color = '#2ecc71';
    mqttClient.subscribe('lintas_alam/detected_person');
    mqttClient.subscribe('lintas_alam/attendance_share');
    mqttClient.subscribe('lintas_alam/dataset_names');
    logMessage('Terhubung ke MQTT Broker');
});

mqttClient.on('message', (topic, message) => {
    const msg = JSON.parse(message.toString());
    logMessage(`Pesan diterima - Topic: ${topic}, Data: ${JSON.stringify(msg)}`);
    
    if (topic === 'lintas_alam/dataset_names') {
        studentList = msg.names || [];
        updateAttendanceTable();
    } else if (topic === 'lintas_alam/detected_person' || topic === 'lintas_alam/attendance_share') {
        const now = new Date();
        const data = {
            name: msg.name,
            timestamp: msg.timestamp,
            status: 'Hadir',
            course: msg.course
        };
        saveMessage(data);
        const existingIndex = attendanceData.findIndex(item => item.name === msg.name);
        if (existingIndex !== -1) {
            attendanceData.splice(existingIndex, 1);
        }
        attendanceData.unshift(data);
        updateAttendanceTable();
    }
});

function calculateStatus(timestamp) {
    return timestamp ? 'Hadir' : 'Belum Hadir';
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
                status: 'Hadir',
                course: msg.course
            }));
            updateAttendanceTable();
        })
        .catch(error => logMessage(`Error mengambil data: ${error}`));
}

function updateAttendanceTable() {
    const tableDiv = document.getElementById('attendance-table');
    let html = '<table><tr><th>No</th><th>Nama</th><th>Waktu</th><th>Status</th><th>Mata Kuliah</th></tr>';
    
    const attendedStudents = attendanceData.map((data, index) => ({
        no: index + 1,
        name: data.name,
        timestamp: data.timestamp,
        status: data.status,
        course: data.course
    }));

    const unattendedStudents = studentList
        .filter(name => !attendanceData.some(data => data.name === name))
        .map((name, index) => ({
            no: attendedStudents.length + index + 1,
            name: name,
            timestamp: '-',
            status: 'Belum Hadir',
            course: '-'
        }));

    const allStudents = [...attendedStudents, ...unattendedStudents];

    allStudents.forEach(data => {
        html += `<tr><td>${data.no}</td><td>${data.name}</td><td>${data.timestamp}</td><td>${data.status}</td><td>${data.course}</td></tr>`;
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

function deleteCourseSchedule() {
    publishCommand('lintas_alam/schedule', JSON.stringify({ course: 'delete' }));
    logMessage('Jadwal mata kuliah dihapus');
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

function deleteIndividualSchedule() {
    const person = document.getElementById('delete-person-name').value;
    if (person) {
        publishCommand('lintas_alam/schedule', JSON.stringify({ person: 'delete', name: person }));
        logMessage(`Jadwal perorangan untuk ${person} dihapus`);
    } else {
        logMessage('Masukkan nama untuk menghapus jadwal perorangan!');
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
    document.querySelectorAll('.sidebar-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="openTab('${tabId}')"]`).classList.add('active');
}

document.querySelector('.toggle-sidebar').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('collapsed');
});

window.onload = () => {
    fetchMessages();
};
