import { io } from "socket.io-client";

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL;

const socket = io.connect(SOCKET_SERVER_URL, {
    withCredentials: true,
});

export default socket;
