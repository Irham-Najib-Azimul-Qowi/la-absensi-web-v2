const apiUrl = 'http://localhost:5000'; // Ganti dengan URL API Anda

async function fetchAttendance() {
    try {
        const response = await fetch(`${apiUrl}/get-attendance`);
        const data = await response.json();
        const tableBody = document.querySelector('#attendanceTable tbody');
        tableBody.innerHTML = '';

        data.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.full_name}</td>
                <td>${new Date(entry.attendance_time).toLocaleString()}</td>
                <td>${entry.course_name}</td>
                <td>${entry.status}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error mengambil data absensi:', error);
    }
}

async function fetchStudents() {
    try {
        const response = await fetch(`${apiUrl}/get-students`);
        const data = await response.json();
        const select = document.querySelector('#studentName');
        select.innerHTML = '<option value="">Pilih Siswa</option>';

        data.forEach(student => {
            const option = document.createElement('option');
            option.value = student.full_name;
            option.textContent = student.full_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error mengambil daftar siswa:', error);
    }
}

async function uploadImage() {
    const studentName = document.querySelector('#studentName').value;
    const fileInput = document.querySelector('#imageUpload');
    const file = fileInput.files[0];

    if (!studentName || !file) {
        alert('Silakan pilih siswa dan file gambar');
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        const base64Image = reader.result.split(',')[1];
        const data = {
            studentName: studentName,
            image: base64Image,
            fileName: file.name
        };

        try {
            const response = await fetch(`${apiUrl}/save-attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Gambar berhasil diunggah');
                fileInput.value = '';
            } else {
                alert('Gagal mengunggah gambar');
            }
        } catch (error) {
            console.error('Error mengunggah gambar:', error);
            alert('Terjadi kesalahan saat mengunggah');
        }
    };
    reader.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAttendance();
    fetchStudents();
    setInterval(fetchAttendance, 5000); // Perbarui tabel setiap 5 detik
});
