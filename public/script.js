const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const apiUrl = 'http://localhost:5000';
let attendanceData = [];
let studentList = [];
let courses = new Set();
let lineChart, pieChart, barChart, stackedChart, heatmapChart, donutChart;
let courseSchedules = [];
let individualSchedules = [];

function saveToDatabase(endpoint, data) {
    return fetch(`${apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(response => response.json()).catch(error => {
        logMessage(`Error saving to database: ${error}`);
    });
}

function fetchFromDatabase(endpoint) {
    return fetch(`${apiUrl}/${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json()).catch(error => {
        logMessage(`Error fetching from database: ${error}`);
        return [];
    });
}

mqttClient.on('connect', () => {
    document.getElementById('status').innerText = 'Status MQTT: Terhubung';
    document.getElementById('status').style.color = '#00c4b4';
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
            timestamp: now.toLocaleString('id-ID'),
            status: msg.status,
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
    saveToDatabase('save-message', data).then(result => {
        logMessage(`Data disimpan: ${JSON.stringify(result)}`);
    }).catch(error => {
        logMessage(`Error menyimpan data: ${error}`);
    });
}

function fetchMessages() {
    fetchFromDatabase('get-messages').then(messages => {
        attendanceData = messages.map(msg => ({
            name: msg.name,
            timestamp: new Date(msg.timestamp).toLocaleString('id-ID'),
            status: msg.status,
            course: msg.course || 'Tidak ada jadwal'
        }));
        messages.forEach(msg => courses.add(msg.course));
        updateAttendanceTable();
        updateDashboard();
    }).catch(error => logMessage(`Error mengambil data: ${error}`));
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
            status: 'Tidak Hadir',
            course: '-'
        }));

    const allStudents = [...attendedStudents, ...unattendedStudents];

    allStudents.forEach(data => {
        html += `<tr><td>${data.no}</td><td>${data.name}</td><td>${data.timestamp}</td><td class="${data.status.toLowerCase().replace(' ', '-')}">${data.status}</td><td>${data.course}</td></tr>`;
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
    updateStackedChart();
    updateHeatmapChart();
    updateDonutChart();
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
    const total = attendanceData.filter(data => data.status !== 'Tidak Hadir').length;
    document.getElementById('total-attendance-value').textContent = `${total} Mahasiswa`;
}

function updateLineChart() {
    const ctx = document.getElementById('attendanceLineChart').getContext('2d');
    const timestamps = [...new Set(attendanceData.map(data => data.timestamp))].sort();
    const attendanceCount = timestamps.map(t => attendanceData.filter(data => data.timestamp === t && data.status !== 'Tidak Hadir').length);

    if (lineChart) lineChart.destroy();

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [{
                label: 'Jumlah Hadir/Terlambat',
                data: attendanceCount,
                borderColor: '#00c4b4',
                backgroundColor: 'rgba(0, 196, 180, 0.2)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, ticks: { color: '#333' }, grid: { color: '#e0e0e0' } },
                x: { ticks: { color: '#333' }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: '#333' } } },
            animation: { duration: 1000, easing: 'easeInOutQuad' }
        }
    });
}

function updatePieChart() {
    const ctx = document.getElementById('attendancePieChart').getContext('2d');
    const course = document.getElementById('course-select').value;
    
    let present = 0, late = 0, absent = 0;
    if (course) {
        present = attendanceData.filter(data => data.course === course && data.status === 'Hadir').length;
        late = attendanceData.filter(data => data.course === course && data.status === 'Terlambat').length;
        absent = studentList.length - present - late;
    } else {
        present = attendanceData.filter(data => data.status === 'Hadir').length;
        late = attendanceData.filter(data => data.status === 'Terlambat').length;
        absent = studentList.length - present - late;
    }

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Hadir', 'Terlambat', 'Tidak Hadir'],
            datasets: [{
                data: [present, late, absent],
                backgroundColor: ['#00c4b4', '#ffca28', '#ef5350'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#333' } } },
            animation: { duration: 1000, easing: 'easeInOutQuad' }
        }
    });
}

function updateBarChart() {
    const ctx = document.getElementById('attendanceBarChart').getContext('2d');
    const courseAttendance = {};
    
    courses.forEach(course => {
        if (course !== 'Tidak ada jadwal') {
            courseAttendance[course] = attendanceData.filter(data => data.course === course && data.status !== 'Tidak Hadir').length;
        }
    });

    if (barChart) barChart.destroy();

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(courseAttendance),
            datasets: [{
                label: 'Jumlah Mahasiswa Hadir/Terlambat',
                data: Object.values(courseAttendance),
                backgroundColor: '#00c4b4',
                borderColor: '#007bff',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, ticks: { color: '#333' }, grid: { color: '#e0e0e0' } },
                x: { ticks: { color: '#333' }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: '#333' } } },
            animation: { duration: 1000, easing: 'easeInOutQuad' }
        }
    });
}

function updateStackedChart() {
    const ctx = document.getElementById('attendanceStackedChart').getContext('2d');
    const students = [...new Set(studentList)];
    const courseList = [...courses].filter(c => c !== 'Tidak ada jadwal');
    
    const datasets = students.map(student => ({
        label: student,
        data: courseList.map(course => {
            const record = attendanceData.find(data => data.name === student && data.course === course);
            return record && record.status !== 'Tidak Hadir' ? 1 : 0;
        }),
        backgroundColor: `#${Math.floor(Math.random()*16777215).toString(16)}`
    }));

    if (stackedChart) stackedChart.destroy();

    stackedChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: courseList,
            datasets: datasets
        },
        options: {
            scales: {
                x: { stacked: true, ticks: { color: '#333' }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { color: '#333' }, grid: { color: '#e0e0e0' } }
            },
            plugins: { legend: { labels: { color: '#333' } } },
            animation: { duration: 1000, easing: 'easeInOutQuad' }
        }
    });
}

function updateHeatmapChart() {
    const ctx = document.getElementById('attendanceHeatmap').getContext('2d');
    const dates = [...new Set(attendanceData.map(data => data.timestamp.split(' ')[0]))].sort();
    const students = [...new Set(studentList)];
    
    const data = students.map(student => ({
        x: dates,
        y: student,
        v: dates.map(date => {
            return attendanceData.filter(data => data.name === student && data.timestamp.includes(date) && data.status !== 'Tidak Hadir').length;
        })
    }));

    if (heatmapChart) heatmapChart.destroy();

    heatmapChart = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Kehadiran per Hari',
                data: data.flatMap(d => d.x.map((x, i) => ({ x, y: d.y, v: d.v[i] }))),
                backgroundColor: c => {
                    const value = c.raw.v;
                    return value === 0 ? '#ef5350' : value === 1 ? '#ffca28' : '#00c4b4';
                },
                width: ({ chart }) => (chart.chartArea.width / dates.length) - 2,
                height: ({ chart }) => (chart.chartArea.height / students.length) - 2
            }]
        },
        options: {
            scales: {
                x: { type: 'category', labels: dates, ticks: { color: '#333' } },
                y: { type: 'category', labels: students, ticks: { color: '#333' } }
            },
            plugins: { legend: { display: false } },
            animation: { duration: 1000, easing: 'easeInOutQuad' }
        }
    });
}

function updateDonutChart() {
    const ctx = document.getElementById('attendanceDonutChart').getContext('2d');
    const present = attendanceData.filter(data => data.status === 'Hadir').length;
    const late = attendanceData.filter(data => data.status === 'Terlambat').length;
    const absent = studentList.length - present - late;

    if (donutChart) donutChart.destroy();

    donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Hadir', 'Terlambat', 'Tidak Hadir'],
            datasets: [{
                data: [present, late, absent],
                backgroundColor: ['#00c4b4', '#ffca28', '#ef5350'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#333' } } },
            cutout: '70%',
            animation: { duration: 1000, easing: 'easeInOutQuad' }
        }
    });
}

function updateCourseSummary() {
    const summaryDiv = document.getElementById('course-summary');
    summaryDiv.innerHTML = '';
    courses.forEach(course => {
        if (course !== 'Tidak ada jadwal') {
            const count = attendanceData.filter(data => data.course === course && data.status !== 'Tidak Hadir').length;
            const p = document.createElement('p');
            p.textContent = `${course}: ${count} Hadir/Terlambat`;
            summaryDiv.appendChild(p);
        }
    });
}

function updateRecentLogs() {
    const logsDiv = document.getElementById('recent-logs');
    logsDiv.innerHTML = '';
    const recent = attendanceData.slice(0, 5).map(data => `${data.name} - ${data.timestamp} (${data.status}, ${data.course})`).reverse();
    recent.forEach(log => {
        const p = document.createElement('p');
        p.textContent = log;
        logsDiv.appendChild(p);
    });
}

function saveCourseSchedule() {
    const course = document.getElementById('course-name').value;
    const start = document.getElementById('course-datetime-start').value;
    const end = document.getElementById('course-datetime-end').value;
    if (course && start && end) {
        const data = { type: 'course', course, start, end };
        saveToDatabase('save-schedule', data).then(() => {
            fetchCourseSchedules();
            publishScheduleToESP32(data);
            document.getElementById('course-name').value = '';
            document.getElementById('course-datetime-start').value = '';
            document.getElementById('course-datetime-end').value = '';
            logMessage(`Jadwal mata kuliah ${course} disimpan dan dikirim ke ESP32`);
        });
    } else {
        logMessage('Lengkapi semua field jadwal mata kuliah!');
    }
}

function fetchCourseSchedules() {
    fetchFromDatabase('get-course-schedules').then(schedules => {
        courseSchedules = schedules;
        updateCourseScheduleTable();
    });
}

function updateCourseScheduleTable() {
    const tableBody = document.getElementById('course-schedule-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    courseSchedules.forEach(schedule => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = schedule.entity;
        row.insertCell(1).textContent = new Date(schedule.start_time).toLocaleString('id-ID');
        row.insertCell(2).textContent = new Date(schedule.end_time).toLocaleString('id-ID');
    });
}

function deleteCourseSchedule() {
    saveToDatabase('delete-schedule', { type: 'course' }).then(() => {
        courseSchedules = [];
        updateCourseScheduleTable();
        publishDeleteToESP32('course');
        logMessage('Semua jadwal mata kuliah dihapus dan notifikasi dikirim ke ESP32');
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
            publishScheduleToESP32(data);
            document.getElementById('person-name').value = '';
            document.getElementById('person-datetime-start').value = '';
            document.getElementById('person-datetime-end').value = '';
            logMessage(`Jadwal perorangan ${person} disimpan dan dikirim ke ESP32`);
        });
    } else {
        logMessage('Lengkapi semua field jadwal perorangan!');
    }
}

function fetchIndividualSchedules() {
    fetchFromDatabase('get-individual-schedules').then(schedules => {
        individualSchedules = schedules;
        updateIndividualScheduleTable();
    });
}

function updateIndividualScheduleTable() {
    const tableBody = document.getElementById('individual-schedule-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    individualSchedules.forEach(schedule => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = schedule.entity;
        row.insertCell(1).textContent = new Date(schedule.start_time).toLocaleString('id-ID');
        row.insertCell(2).textContent = new Date(schedule.end_time).toLocaleString('id-ID');
    });
}

function deleteIndividualSchedule() {
    saveToDatabase('delete-schedule', { type: 'individual' }).then(() => {
        individualSchedules = [];
        updateIndividualScheduleTable();
        publishDeleteToESP32('individual');
        logMessage('Semua jadwal perorangan dihapus dan notifikasi dikirim ke ESP32');
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

function publishScheduleToESP32(schedule) {
    const topic = 'lintas_alam/schedule_esp32';
    const payload = {
        type: schedule.type,
        entity: schedule.course || schedule.person,
        start: schedule.start,
        end: schedule.end
    };
    publishCommand(topic, JSON.stringify(payload));
}

function publishDeleteToESP32(type) {
    const topic = 'lintas_alam/schedule_esp32';
    const payload = { type: type, action: 'delete' };
    publishCommand(topic, JSON.stringify(payload));
}

function logMessage(message) {
    const logDiv = document.getElementById('log-messages');
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleString('id-ID')}] ${message}`;
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
};
