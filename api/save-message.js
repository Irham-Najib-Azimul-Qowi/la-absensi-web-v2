const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function saveMessage(req, res) {
    try {
        await client.connect();
        const database = client.db('absensi');
        const collection = database.collection('messages');
        const data = req.body;
        const result = await collection.insertOne({ ...data, savedAt: new Date() });
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.close();
    }
}

module.exports = saveMessage;