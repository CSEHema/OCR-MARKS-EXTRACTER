const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Create connection to MySQL database
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,  // Your MySQL password
    database: process.env.DB_NAME,
    port:3306
});

db.connect((err) => {
    if (err) throw err;
    console.log('MySQL Connected...');
});

// Route to serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'CT.html'));
});

// Route to insert data
app.post('/insert', (req, res) => {
    const subject = req.body.subject;
    const data = req.body.data;
    const exam = req.body.exam;

    // Create table if not exists
    const createTableQuery = 
        `CREATE TABLE IF NOT EXISTS \`${exam}${subject}\` (
            std_id INT AUTO_INCREMENT PRIMARY KEY,
            student_name VARCHAR(30),
            marks REAL
        )`;

    db.query(createTableQuery, (err) => {
        if (err) throw err;

        // Insert data
        const insertDataQuery = `INSERT INTO \`${exam}${subject}\` (student_name, marks) VALUES ?`;
        db.query(insertDataQuery, [data.map(row => [row.studentName, row.marks])], (err) => {
            if (err) throw err;
            res.send('Data inserted');
        });
    });
});

// Route to get marks for a student in all subjects
app.post('/get-marks', (req, res) => {
    const name = req.body.name;
    const exam = req.body.exam;

    // Query to get all tables
    const getTablesQuery = 'SHOW TABLES';
    db.query(getTablesQuery, (err, tables) => {
        if (err) {
            console.error('Error fetching tables:', err.stack);
            return res.json({ success: false, message: 'Failed to fetch tables' });
        }

        // Get the key for the table names dynamically
        const tableKey = Object.keys(tables[0])[0];

        // Filter tables that match the exam name
        const filteredTables = tables
            .map(table => table[tableKey])
            .filter(tableName => tableName.includes(exam));

        // Fetch marks for each matching table
        const promises = filteredTables.map(tableName => {
            const query = `SELECT * FROM \`${tableName}\` WHERE student_name = ?`;
            return new Promise((resolve, reject) => {
                db.query(query, [name], (err, results) => {
                    if (err) return reject(err);
                    resolve({ subject: tableName, data: results });
                });
            });
        });

        Promise.all(promises)
            .then(results => {
                res.json({ success: true, results });
            })
            .catch(err => {
                console.error('Error fetching student data:', err.stack);
                res.json({ success: false, message: 'Failed to fetch student data' });
            });
    });
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:3000`);
});
