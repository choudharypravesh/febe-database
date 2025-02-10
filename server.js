//importing modules
const express = require('express')
const { createServer } = require("http");
const WebSocket = require('ws');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const db = require('./models')
const userRoutes = require ('./routes/userRoutes')
const engineRoutes = require('./routes/engineRoutes')
const ip = require('ip');
const host = ip.address();
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const fs = require('fs')
var options = {
  customCss: fs.readFileSync(("./swagger.css"), 'utf8')
};

//setting up your port
const port = process.env.PORT || 4000

//assigning the variable app to express
const app = express()
const router = express.Router();


// Configure CORS options
// const corsOptions = {
//   origin: process.env.ORIGIN, // Replace with your frontend origin
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true // Allow cookies to be sent
// };

// Use the CORS middleware with the options
app.use(cors());
app.use(express.json())
app.use('/swagger-ui', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// model.sync(options): https://sequelize.org/docs/v6/core-concepts/model-basics/#model-synchronization
// User.sync() - This creates the table if it doesn't exist (and does nothing if it already exists)
db.sequelize.sync().then(() => {
  console.log("db has been re sync")
})
router.get('/', (req, res) => {
  res.send('Welcome to the API!');
});
app.use(router);
app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With, x-access-token, Origin, Content-Type, Accept"
  );
  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});
app.use('/v1/api/auth', userRoutes)
app.use('/v1/api/engine', engineRoutes)
const server = createServer(app);

app.on('close', function(){
  db.sequelize.close();
})

const socketServer = new WebSocket.Server({ server });
// Store WebSocket server instance in app.locals
app.locals.socketServer = socketServer;
socketServer.on('connection', (socketClient, req) => {
  app.locals.clients = socketServer.clients;
  const ip = req.socket.remoteAddress;
  console.log('[SERVER] connected - Ip:', ip);
  console.log('[SERVER] client Set length: ', socketServer.clients.size);

  socketClient.on('message', (data) => {
    console.log('[SERVER] data: ', JSON.stringify([data]));
    const message = data.toString(); // Convert Buffer to string
    console.log('[SERVER] Received:', message);

    try {
      const jsonData = JSON.parse(message);
      // if (jsonData.callbackUrl === 'ws://localhost:4000/publishCallback') {
        handlePublishCallback(jsonData);
      // } else {
      //   broadcastMessage(data);
      // }
    } catch (error) {
      console.error('[SERVER] Error parsing JSON:', error);
    }
  });

  socketClient.on('close', () => {
    console.log('[SERVER] Close connected');
    console.log('[SERVER] Number of clients: ', socketServer.clients.size);
  });
});

function handlePublishCallback(data) {
  console.log('[SERVER] Handling publish callback:', data);
  sendMessageToClients(data);
}

function broadcastMessage(data) {
  sendMessageToClients(data);
}

function sendMessageToClients(data) {
  socketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify([data]), (err) => {
        if (err) {
          console.log(`[SERVER] error:${err}`);
        }
      });
    }
  });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});