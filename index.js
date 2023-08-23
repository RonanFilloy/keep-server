const express = require('express');
const app = express();
require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuid } = require('uuid');

app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: true,
    port: 5432
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY,
    title varchar(255),
    content TEXT,
    archived BOOLEAN,
    tags varchar[]
  );
`;

pool.query(createTableQuery, (err, result) => {
    if (err) {
        console.log(process.env.DB_USER)
        console.error('Error creating table:', err);
    } else {
        console.log('Table created successfully');
        startServer();
    }
});

async function startServer() {

    app.get('/notes', async (req, res) => {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT * FROM notes');
            const notes = result.rows;
            client.release();
            res.json(notes);
        } catch (error) {
            console.error('Error executing query', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/notes', async (req, res) => {
        const { title, content, archived, tags } = req.body;
        const id = uuid();
        try {
            const client = await pool.connect();
            const query = 'INSERT INTO notes (id, title, content, archived, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *';
            const values = [id, title, content, archived, tags];
            const result = await client.query(query, values);
            const createdNote = result.rows[0];
            client.release();
            res.json(createdNote);
        } catch (error) {
            console.error('Error executing query', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })

    app.patch('/notes/:id/archive', async (req, res) => {
        const {id} = req.params;
        const { archivedStatus } = req.body;
        try {
            const client = await pool.connect();
            const query = 'UPDATE notes SET archived = $1 WHERE id = $2';
            const values = [archivedStatus, id]
            await client.query(query, values)
            client.release();
            res.sendStatus(200);
        } catch (error) {
            console.error('Error updating note', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.patch('/notes/:id/edit', async (req, res) => {
        const { id } = req.params;
        const { updatedTitle, updatedContent } = req.body;
        try {
            const client = await pool.connect();
            const query = 'UPDATE notes SET title = $1, content = $2 WHERE id = $3';
            const values = [updatedTitle, updatedContent, id]
            await client.query(query, values)
            client.release();
            res.sendStatus(200);
        } catch (error) {
            console.error('Error updating note', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.patch('/notes/:id/tags', async (req, res) => {
        const { id } = req.params;
        const { tagArr } = req.body;
        try {
            const client = await pool.connect();
            const query = 'UPDATE notes SET tags = $1 WHERE id = $2';
            const values = [tagArr, id]
            await client.query(query, values)
            client.release();
            res.sendStatus(200);
        } catch (error) {
            console.error('Error adding new tag', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.delete('/notes/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const client = await pool.connect();
            const query = 'DELETE FROM notes WHERE id = $1';
            const values = [id];
            await client.query(query, values);
            client.release();
            res.sendStatus(200);
        } catch (error) {
            console.error('Error deleting note', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/ping', async (req, res) => {
        const result = await pool.query('SELECT NOW()')
        return res.json(result.rows[0])
    })

    const server = app.listen(5000, () => {
        console.log('Server started on port 5000');
    });

    process.on('SIGINT', () => {
        console.log('Stopping server...');
        server.close(() => {
            console.log('Server stopped.');
            pool.end();
            process.exit(0);
        });
    });
}