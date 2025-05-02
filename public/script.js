const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const apiUrl = 'https://la-absensi-web.vercel.app/api';
let attendanceData = [];
let studentList = [];
let courses = new Set();
let lineChart, pieChart, barChart;

mqttClient.on('connect', () => {
    document.getElementById('status').innerText = 'Status MQTT: Terhubung';
    document.getElementById('status').style.color = '#2ecc71';
    mqttClient.subscribe('lintas_alam/detected_person');
    mqttClient.subscribe('lintas_alam/dataset_names');
    logMessage('Terhubung ke MQTT Broker');
});

mqttClient.on('message', (topic, message) => {
    const msg = JSON.parse(message.toString());
    logMessage(`Pesan diterima - Topic: ${topic}, Data: ${JSON.stringify(msg)}`);
    
    if (topic === 'lintas_alam/dataset_names') {
        studentList = msg.names || [];
        updateAttendanceTable();
        updateDashboard();
    } else if (topic === 'lintas_alam/detected_person') {
        const now = new Date();
        const data = {
            name: msg.name,
            timestamp: now.toLocaleString(),
            status: 'Hadir',
            course: msg.course || 'Tidak ada jadwal'
        };
        saveMessage(data);
        const existingIndex = attendanceData.findIndex(item => item.name === msg.name && item.course === data.course);
        if (existingIndex !== -1) {
            attendanceData.splice(existingIndex, 1);
        }
        attendanceData.unshift(data);
        courses.add(data.course);
        updateAttendanceTable();
        updateDashboard();
    }
});

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
                course: msg.course || 'Tidak ada jadwal'
            }));
            messages.forEach(msg => courses.add(msg.course));
            updateAttendanceTable();
            updateDashboard();
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

function updateDashboard() {
    updateCourseSelect();
    updateTotalAttendance();
    updateLineChart();
    updatePieChart();
    updateBarChart();
    updateCourseSummary();
    updateRecentLogs();
}

function updateCourseSelect() {
    const select = document.getElementById('course-select');
    select.innerHTML = '<option value="">Pilih Mata Kuliah</option>';
    courses.forEach(course => {
        if (course !== 'Tidak ada jadwal') {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            select.appendChild(option);
        }
    });
}

function updateTotalAttendance() {
    const total = attendanceData.length;
    document.getElementById('total-attendance-value').textContent = `${total} Mahasiswa`;
}

function updateLineChart() {
    const ctx = document.getElementById('attendanceLineChart').getContext('2d');
    const timestamps = [...new Set(attendanceData.map(data => data.timestamp))].sort();
    const attendanceCount = timestamps.map(t => attendanceData.filter(data => data.timestamp === t).length);

    if (lineChart) {
        lineChart.destroy();
    }

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [{
                label: 'Jumlah Hadir',
                data: attendanceCount,
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#DDE6ED' },
                    grid: { color: '#526D82' }
                },
                x: {
                    ticks: { color: '#DDE6ED' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#DDE6ED' } }
            }
        }
    });
}

function updatePieChart() {
    const ctx = document.getElementById('attendancePieChart').getContext('2d');
    const course = document.getElementById('course-select').value;
    
    let present = 0, absent = 0;
    if (course) {
        present = attendanceData.filter(data => data.course === course).length;
        absent = studentList.length - present;
    } else {
        present = attendanceData.length;
        absent = studentList.length - attendanceData.length;
    }

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Hadir', 'Belum Hadir'],
            datasets: [{
                data: [present, absent],
                backgroundColor: ['#2ecc71', '#9DB2BF'],
                borderColor: '#DDE6ED',
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { labels: { color: '#DDE6ED' } }
            }
        }
    });
}

function updateBarChart() {
    const ctx = document.getElementById('attendanceBarChart').getContext('2d');
    const courseAttendance = {};
    
    courses.forEach(course => {
        if (course !== 'Tidak ada jadwal') {
            courseAttendance[course] = attendanceData.filter(data => data.course === course).length;
        }
    });

    if (barChart) {
        barChart.destroy();
    }

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(courseAttendance),
            datasets: [{
                label: 'Jumlah Mahasiswa Hadir',
                data: Object.values(courseAttendance),
                backgroundColor: '#2ecc71',
                borderColor: '#27ae60',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#DDE6ED' },
                    grid: { color: '#526D82' }
                },
                x: {
                    ticks: { color: '#DDE6ED' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#DDE6ED' } }
            }
        }
    });
}

function updateCourseSummary() {
    const summaryDiv = document.getElementById('course-summary');
    summaryDiv.innerHTML = '';
    courses.forEach(course => {
        if (course !== 'Tidak ada jadwal') {
            const count = attendanceData.filter(data => data.course === course).length;
            const p = document.createElement('p');
            p.textContent = `${course}: ${count} Hadir`;
            summaryDiv.appendChild(p);
        }
    });
}

function updateRecentLogs() {
    const logsDiv = document.getElementById('recent-logs');
    logsDiv.innerHTML = '';
    const recent = attendanceData.slice(0, 5).map(data => `${data.name} - ${data.timestamp} (${data.course})`).reverse();
    recent.forEach(log => {
        const p = document.createElement('p');
        p.textContent = log;
        logsDiv.appendChild(p);
    });
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

function uploadDataset() {
    const studentName = document.getElementById('student-name').value;
    const files = document.getElementById('dataset-files').files;
    
    if (!studentName || files.length === 0) {
        logMessage('Masukkan nama mahasiswa dan pilih setidaknya satu gambar!');
        return;
    }

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = () => {
            const payload = {
                studentName: studentName,
                image: reader.result.split(',')[1],
                fileName: `${studentName}_${index + 1}.jpg`
            };
            publishCommand('lintas_alam/dataset_upload', JSON.stringify(payload));
        };
        reader.readAsDataURL(file);
    });
    logMessage(`Mengunggah ${files.length} gambar untuk ${studentName}`);
}

function logMessage(message) {
    const logDiv = document.getElementById('log-messages');
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleString()}] ${message}`;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.sidebar-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="openTab('${tabId}')"]`).classList.add('active');
    if (tabId === 'dashboard') updateDashboard();
}

document.querySelector('.toggle-sidebar').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('collapsed');
});

window.onload = () => {
    fetchMessages();
};
