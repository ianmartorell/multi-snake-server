
import express from 'express';
import http from 'http';
import SocketIO from 'socket.io';
import compression from 'compression';

const app = express();
const server = http.Server(app);
const io = new SocketIO(server);
const port = process.env.PORT || 3000;
let players = [];
const sockets = {};

const WIDTH = 8;
const HEIGHT = 8;
const COLORS = {
  EMPTY: [0, 0, 0],
  PLAYERS: [
    [230, 25, 75],
    [60, 180, 75],
    [255, 225, 25],
    [0, 130, 200],
    [245, 130, 48],
  ],
};
const STARTING_POSITIONS = [
  [1, 1],
  [6, 1],
  [6, 7],
  [1, 7],
];
const STARTING_DIRECTIONS = [
  'down',
  'down',
  'up',
  'up',
];
const _ = COLORS.EMPTY;
const TICK_DELAY = 500;

let state = 'WAITING';
const EMPTY = [
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
  _, _, _, _, _, _, _, _,
];
let positions;
let lastManStanding;

app.use(compression({}));

const isConnected = (id) => getPlayerIndex(id) > -1;
const getPlayerIndex = (id) => {
  return players.findIndex(player => player.id === id);
}

io.on('connection', (socket) => {
    const currentPlayer = {
        id: socket.handshake.query.id,
        nextDirection: [],
    };

    console.log('players', players);
    if (isConnected(currentPlayer.id)) {
        console.log(`[INFO] Player ${currentPlayer.id} is already connected, kicking.`);
        socket.disconnect();
    } else {
        console.log(`[INFO] Player ${currentPlayer.id} connected!`);
        sockets[currentPlayer.id] = socket;
        players.push({ id: socket.handshake.query.id, nextDirection: [] });
        io.emit('playerJoin', { id: currentPlayer.id });
        console.log('[INFO] Total players: ' + players.length);
    }

    socket.on('disconnect', () => {
      const index = getPlayerIndex(currentPlayer.id);
        if (index > -1) {
          players.splice(index, 1);
        }
        console.log(`[INFO] Player ${currentPlayer.id} disconnected!`);
        socket.broadcast.emit('playerDisconnect', { id: currentPlayer.id });
    });

    socket.on('directionChange', (data) => {
      const index = getPlayerIndex(data.id);
      players[index].nextDirection.push(data.direction);
    });
});

const positionToIdx = ([ x, y ]) => {
	if (x < 0 || x >= WIDTH) {
		throw new Error(`x is out of bounds: ${x}`);
	}
	if (y < 0 || y >= HEIGHT) {
		throw new Error(`y is out of bounds: ${y}`);
	}
	return x + WIDTH * y;
};

const offScreen = (pos) => {
	if (pos[0] < 0 || pos[0] >= WIDTH) return true;
	if (pos[1] < 0 || pos[1] >= HEIGHT) return true;
	return false;
};

const isOccupied = (pos) => {
  return positions[positionToIdx(pos)] !== COLORS.EMPTY;
}

const movePlayer = (player) => {
  const newPlayer = Object.assign({}, player);
	newPlayer.lastDirection = newPlayer.nextDirection.shift() || newPlayer.lastDirection;
	switch(newPlayer.lastDirection) {
		case 'up':
      newPlayer.position = [player.position[0], player.position[1] - 1];
      break;
    case 'click':
		case 'down':
      newPlayer.position = [player.position[0], player.position[1] + 1];
      break;
		case 'left':
      newPlayer.position = [player.position[0] - 1, player.position[1]];
      break;
		case 'right':
      newPlayer.position = [player.position[0] + 1, player.position[1]];
      break;
	}
  return newPlayer;
};

const startLobbyLoop = () => {
  const waitingForPlayersHandle = setInterval(() => {
    if (players.length > 1) {
      clearInterval(waitingForPlayersHandle);
      restartGame();
    }
  }, TICK_DELAY);
};

const restartGame = () => {
  // Clear map and paint players' starting positions
  positions = [...EMPTY];
  players = players.map((player, index) => {
    const position = STARTING_POSITIONS[index];
    positions[positionToIdx(position)] = COLORS.PLAYERS[index];
    return {
      ...player,
      position,
      color: COLORS.PLAYERS[index],
      nextDirection: [],
      lastDirection: STARTING_DIRECTIONS[index],
      alive: true,
    }
  })
  console.log('players', players);
	startGameLoop();
};

let tickIntervalHandle;
const startGameLoop = () => {
	clearInterval(tickIntervalHandle);
	tickIntervalHandle = setInterval(tick, TICK_DELAY);
	state = 'RUNNING';
};

const tick = () => {
  players = players.map(player => {
    if (!player.alive) {
      return player;
    }
    const newPlayer = movePlayer(player);
    if (offScreen(newPlayer.position) || isOccupied(newPlayer.position)) {
      newPlayer.alive = false;
      lastManStanding = newPlayer.id;
    } else {
      positions[positionToIdx(newPlayer.position)] = newPlayer.color;
    }
    return newPlayer;
  });
  console.log(players);
  if (players.every(player => !player.alive)) {
      clearInterval(tickIntervalHandle);
      io.emit('gameEnd', lastManStanding);
      setTimeout(startLobbyLoop, 5000);
  }
  io.emit('tick', { positions, players });
  // Object.keys(sockets).forEach((socket) => {
  //   socket.emit('tick', { positions, players });
  // });
};


server.listen(port, () => {
    console.log('Listening on *:' + port);
    startLobbyLoop();
});