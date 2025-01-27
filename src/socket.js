import { io } from "socket.io-client";

const socket = io.connect("https://tabletrouble.com", {
    withCredentials: true,  // Send cookies with the request
});

export default socket;
