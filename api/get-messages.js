const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function getMessages(req, res) {
    try {
        await client.connect();
        const database = client.db('absensi');
        const collection = database.collection('messages');
        const messages = await collection.find({}).toArray();
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.close();
    }
}

module.exports = getMessages;