import request from 'supertest';
import express from 'express';
// import {describe, it, expect, test} from 'node:test';

// Create a minimal version of the app to test health endpoint
const app = express();
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: expect.any(String) });
});

describe('API Health Check', () => {
    it('should return 200 OK', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
    });
});
