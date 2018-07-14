
import express from 'express';
import http from 'http';
import SocketIO from 'socket.io';
import compression from 'compression';

const app = express();
const server = http.Server(app);
const io = new SocketIO(server);
const port = process.env.PORT || 3000;
const users = [];
const sockets = {};

app.use(compression({}));

io.on('connection', (socket) => {
    let currentUser = {
        id: socket.id,
        nick: socket.resinId
    };

    if (findIndex(users, currentUser.id) > -1) {
        console.log('[INFO] User ID is already connected, kicking.');
        socket.disconnect();
    } else {
        console.log('[INFO] User ' + currentUser.nick + ' connected!');
        sockets[currentUser.id] = socket;
        users.push(currentUser);
        io.emit('userJoin', { nick: currentUser.nick });
        console.log('[INFO] Total users: ' + users.length);
    }

    socket.on('ding', () => {
        socket.emit('dong');
    });

    socket.on('disconnect', () => {
        if (findIndex(users, currentUser.id) > -1) users.splice(findIndex(users, currentUser.id), 1);
        console.log('[INFO] User ' + currentUser.nick + ' disconnected!');
        socket.broadcast.emit('userDisconnect', {nick: currentUser.nick});
    });

    // socket.on('userChat', (data) => {
    //     let _nick = sanitizeString(data.nick);
    //     let _message = sanitizeString(data.message);
    //     let date = new Date();
    //     let time = ("0" + date.getHours()).slice(-2) + ("0" + date.getMinutes()).slice(-2);

    //     console.log('[CHAT] [' + time + '] ' + _nick + ': ' + _message);
    //     socket.broadcast.emit('serverSendUserChat', {nick: _nick, message: _message});
    // });
});

server.listen(port, () => {
    console.log('Listening on *:' + port);
});