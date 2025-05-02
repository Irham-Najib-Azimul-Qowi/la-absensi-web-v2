const apiUrl = 'https://your-api-endpoint.com/api';
let attendanceData = [];
let totalStudents = 0;

function fetchAttendanceData() {
    fetch(`${apiUrl}/attendance`)
        .then(response => response.json())
        .then(data => {
            attendanceData = data;
            totalStudents = new Set(attendanceData.map(entry => entry.name)).size; // Total unique students
            updateDashboard();
            updatePieChart();
        })
        .catch(error => console.error('Error fetching attendance data:', error));
}

function updateDashboard() {
    const avgCleaningTime = document.getElementById('avg-cleaning-time');
    const employeeSection = document.getElementById('employee-section');
    const detailsTable = document.getElementById('details-table');

    avgCleaningTime.textContent = `Avg. Body Cleaning Time: Last 30 Days until 18 January: ${calculateAverageTime()} min`;

    employeeSection.innerHTML = '';
    const employees = attendanceData.slice(0, 6).map((emp, index) => ({
        name: emp.name,
        time: emp.time,
        image: `employee${index + 1}.jpg`
    }));
    employees.forEach(emp => {
        employeeSection.innerHTML += `
            <div class="employee-card">
                <img src="${emp.image}" alt="${emp.name}">
                <p>${emp.name}</p>
                <p>${emp.time} min</p>
            </div>
        `;
    });

    detailsTable.innerHTML = `
        <tr>
            <th>Employee</th>
            <th>Entered Shower</th>
            <th>Left Shower</th>
            <th>Cleaning Time</th>
            <th>Shower Quality</th>
        </tr>
    `;
    attendanceData.forEach(entry => {
        detailsTable.innerHTML += `
            <tr>
                <td>${entry.name}</td>
                <td>${entry.entered}</td>
                <td>${entry.left}</td>
                <td>${entry.time} min</td>
                <td><div class="progress-bar"><div class="progress" style="width: ${entry.quality}%">${entry.quality}</div></div></td>
            </tr>
        `;
    });
}

function calculateAverageTime() {
    const totalTime = attendanceData.reduce((sum, entry) => sum + parseFloat(entry.time), 0);
    return (totalTime / attendanceData.length).toFixed(1) || '0';
}

function updatePieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    if (window.myPieChart) window.myPieChart.destroy();

    const presentCount = attendanceData.filter(e => e.status === 'Hadir').length;
    const absentCount = totalStudents - presentCount;

    const labels = ['Present', 'Absent'];
    const data = {
        labels: labels,
        datasets: [{
            data: [presentCount, absentCount],
            backgroundColor: ['#28a745', '#dc3545']
        }]
    };

    window.myPieChart = new Chart(ctx, {
        type: 'pie',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            const dataset = tooltipItem.dataset;
                            const total = dataset.data.reduce((sum, val) => sum + val, 0);
                            const value = dataset.data[tooltipItem.dataIndex];
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${tooltipItem.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sidebar ul li').forEach(li => li.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="openTab('${tabId}')"]`).classList.add('active');
    document.querySelector(`.sidebar ul li[onclick="openTab('${tabId}')"]`).classList.add('active');
}

window.onload = () => {
    fetchAttendanceData();
    setInterval(fetchAttendanceData, 60000);
};
