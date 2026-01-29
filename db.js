const sql = require('mssql');

const config = {
    user: "sa",
    password: "Must2024",
    server: "DESKTOP-TEB6P4L\\SQLEXPRESS", // SQL Server instance
    database: "StudentServicePortal",
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,      // Maximum number of connections
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Create a single connection pool and reuse it
let poolPromise = null;

try {
    poolPromise = new sql.ConnectionPool(config)
        .connect()
        .then(pool => {
            console.log('✅ Connected to SQL Server');
            return pool;
        })
        .catch(err => {
            console.log('❌ SQL Server Connection Error:', err);
            throw err; // throw error so app knows connection failed
        });
} catch (err) {
    console.log('❌ Fatal SQL Error:', err);
}

module.exports = { sql, poolPromise };