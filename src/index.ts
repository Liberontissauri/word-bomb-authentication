import express from 'express';
import { createClient} from 'redis';
import uuid from 'uuid';
import winston from "winston";

const logFormat = winston.format.printf(({level, message, label, timestamp}) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.label({ label: 'Socket Server' }),
        winston.format.timestamp(),
        logFormat
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
            new winston.transports.File({ filename: 'error.log', level: 'error' }),
            new winston.transports.File({ filename: 'combined.log' }),
            new winston.transports.Console({
        })
    ],
});

const client = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
client.on('error', (err) => logger.error(`Redis Error: ${err}`));


const app = express();

app.post("/token", async (req, res) => {
    const token = uuid.v4().replace("/", "");
    const room_id = req.query.room
    if(!room_id) {
        logger.error("User tried to create token without specifying room")
        res.status(400).send("No room specified");
        return;
    }
    let room = await client.get(`room_${room_id}`)
    if(!room) {
        logger.error("User tried to create token for non-existent room")
        res.status(400).send("Room does not exist");
        return;
    }

    let room_json = JSON.parse(room);

    if(room_json.password != req.query.password) {
        logger.error("User tried to create token for room with wrong password")
        res.status(400).send("Wrong password");
        return;
    }
    
    const user_id = uuid.v4().replace("/", "");

    client.set(`user_${user_id}`, JSON.stringify({
        username: req.query.username,
    }));

    client.set(`token_${token}`, JSON.stringify({
        room_id: room_id,
        user_id: user_id
    }))
});
app.get("/token/:token" , async (req, res) => {
    const token = req.params.token;
    const token_data = await client.get(`token_${token}`);
    if(!token_data) {
        logger.error("User tried to get token data for non-existent token")
        res.status(400).send("Token does not exist");
        return;
    }
    res.send(token_data);
});
