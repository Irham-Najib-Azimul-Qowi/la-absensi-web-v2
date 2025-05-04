const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const apiUrl = 'https://la-absensi-web.vercel.app/api';
let attendanceData = [];
let studentList = [];
let courses = new Set();
let lineChart, pieChart, barChart;
let courseSchedules = [];
let individualSchedules = [];

const dbConfig = {
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2v1KcdwiMtttUeh.root',
    password: '2OxplUZ7nTiFxDVa',
    database: 'test'
};

function saveToDatabase(endpoint, data) {
    return fetch(`http://${dbConfig.host}:${dbConfig.port}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(response => response.json()).catch(error => {
        logMessage(`Error saving to database: ${error}`);
    });
}

function fetchFromDatabase(endpoint) {
    return fetch(`http://${dbConfig.host}:${dbConfig.port}/${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json()).catch(error => {
        logMessage(`Error fetching from database: ${error}`);
        return [];
    });
}

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
                y: { beginAtZero: true, ticks: { color: '#DDE6ED' }, grid: { color: '#526D82' } },
                x: { ticks: { color: '#DDE6ED' }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: '#DDE6ED' } } }
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
        options: { plugins: { legend: { labels: { color: '#DDE6ED' } } } }
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
                y: { beginAtZero: true, ticks: { color: '#DDE6ED' }, grid: { color: '#526D82' } },
                x: { ticks: { color: '#DDE6ED' }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: '#DDE6ED' } } }
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

function setCourseDateTime() {
    document.getElementById('course-datetime-start').value = '';
    document.getElementById('course-datetime-end').value = '';
    document.getElementById('course-datetime-start').disabled = false;
    document.getElementById('course-datetime-end').disabled = false;
}

function setIndividualDateTime() {
    document.getElementById('person-datetime-start').value = '';
    document.getElementById('person-datetime-end').value = '';
    document.getElementById('person-datetime-start').disabled = false;
    document.getElementById('person-datetime-end').disabled = false;
}

function saveCourseSchedule() {
    const course = document.getElementById('course-name').value;
    const start = document.getElementById('course-datetime-start').value;
    const end = document.getElementById('course-datetime-end').value;
    if (course && start && end) {
        const data = { type: 'course', course, start, end };
        saveToDatabase('save-schedule', data).then(() => {
            fetchCourseSchedules();
            document.getElementById('course-name').value = '';
            document.getElementById('course-datetime-start').value = '';
            document.getElementById('course-datetime-end').value = '';
            document.getElementById('course-datetime-start').disabled = true;
            document.getElementById('course-datetime-end').disabled = true;
            logMessage(`Jadwal mata kuliah ${course} disimpan`);
        });
    } else {
        logMessage('Lengkapi semua field jadwal mata kuliah!');
    }
}

function fetchCourseSchedules() {
    fetchFromDatabase('get-course-schedules').then(schedules => {
        courseSchedules = schedules;
        updateCourseScheduleList();
    });
}

function updateCourseScheduleList() {
    const listDiv = document.getElementById('course-schedule-list');
    listDiv.innerHTML = '';
    courseSchedules.forEach(schedule => {
        const p = document.createElement('p');
        p.textContent = `${schedule.course}: ${schedule.start} - ${schedule.end}`;
        listDiv.appendChild(p);
    });
}

function deleteCourseSchedule() {
    saveToDatabase('delete-schedule', { type: 'course' }).then(() => {
        courseSchedules = [];
        updateCourseScheduleList();
        logMessage('Semua jadwal mata kuliah dihapus');
    });
}

function saveIndividualSchedule() {
    const person = document.getElementById('person-name').value;
    const start = document.getElementById('person-datetime-start').value;
    const end = document.getElementById('person-datetime-end').value;
    if (person && start && end) {
        const data = { type: 'individual', person, start, end };
        saveToDatabase('save-schedule', data).then(() => {
            fetchIndividualSchedules();
            document.getElementById('person-name').value = '';
            document.getElementById('person-datetime-start').value = '';
            document.getElementById('person-datetime-end').value = '';
            document.getElementById('person-datetime-start').disabled = true;
            document.getElementById('person-datetime-end').disabled = true;
            logMessage(`Jadwal perorangan ${person} disimpan`);
        });
    } else {
        logMessage('Lengkapi semua field jadwal perorangan!');
    }
}

function fetchIndividualSchedules() {
    fetchFromDatabase('get-individual-schedules').then(schedules => {
        individualSchedules = schedules;
        updateIndividualScheduleList();
    });
}

function updateIndividualScheduleList() {
    const listDiv = document.getElementById('individual-schedule-list');
    listDiv.innerHTML = '';
    individualSchedules.forEach(schedule => {
        const p = document.createElement('p');
        p.textContent = `${schedule.person}: ${schedule.start} - ${schedule.end}`;
        listDiv.appendChild(p);
    });
}

function deleteIndividualSchedule() {
    saveToDatabase('delete-schedule', { type: 'individual' }).then(() => {
        individualSchedules = [];
        updateIndividualScheduleList();
        logMessage('Semua jadwal perorangan dihapus');
    });
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
    else if (tabId === 'course-schedule') fetchCourseSchedules();
    else if (tabId === 'individual-schedule') fetchIndividualSchedules();
}

document.querySelector('.toggle-sidebar').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('collapsed');
});

window.onload = () => {
    fetchMessages();
    fetchCourseSchedules();
    fetchIndividualSchedules();
    document.getElementById('course-datetime-start').disabled = true;
    document.getElementById('course-datetime-end').disabled = true;
    document.getElementById('person-datetime-start').disabled = true;
    document.getElementById('person-datetime-end').disabled = true;
};
