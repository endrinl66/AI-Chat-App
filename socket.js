const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const { getAIReply } = require('./services/aiService');

const roomUsers = {};
const roomSeen = {};

const initSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token provided'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  const broadcastOnlineUsers = (roomId) => {
    const users = roomUsers[roomId] ? Object.values(roomUsers[roomId]) : [];
    io.to(roomId).emit('onlineUsers', [...new Set(users)]);
  };

  io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId, username) => {
      if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        if (roomUsers[socket.currentRoom]) {
          delete roomUsers[socket.currentRoom][socket.id];
          broadcastOnlineUsers(socket.currentRoom);
        }
      }

      socket.join(roomId);
      socket.currentRoom = roomId;
      socket.username = username;

      if (!roomUsers[roomId]) roomUsers[roomId] = {};
      roomUsers[roomId][socket.id] = username;
      broadcastOnlineUsers(roomId);

      if (roomSeen[roomId]) {
        io.to(roomId).emit('seenUpdateAll', roomSeen[roomId]);
      }
    });

    socket.on('markSeen', ({ roomId, messageId, username }) => {
      if (!roomSeen[roomId]) roomSeen[roomId] = {};
      roomSeen[roomId][username] = messageId;
      io.to(roomId).emit('seenUpdate', { username, messageId });
    });

    socket.on('sendMessage', async ({ roomId, roomName, content, senderName, replyTo }) => {
      try {
        const message = new Message({
          room: roomId,
          sender: socket.userId,
          senderName,
          content,
          replyTo: replyTo || undefined,
        });
        await message.save();
        io.to(roomId).emit('newMessage', message);

        const mentionRegex = /@(\w+)/g;
        const mentionedUsernames = new Set();
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
          mentionedUsernames.add(match[1].toLowerCase());
        }

        if (mentionedUsernames.size > 0) {
          for (const [, s] of io.sockets.sockets) {
            if (
              s.username &&
              s.username.toLowerCase() !== senderName.toLowerCase() &&
              mentionedUsernames.has(s.username.toLowerCase())
            ) {
              s.emit('mentionNotification', {
                from: senderName,
                roomId,
                roomName: roomName || 'a room',
                content,
              });
            }
          }
        }

        if (content.toLowerCase().includes('@ai')) {
          io.to(roomId).emit('aiThinking', true);
          try {
            const recentMessages = await Message.find({ room: roomId })
              .sort({ createdAt: -1 })
              .limit(10);
            const orderedMessages = recentMessages.reverse();
            const aiText = await getAIReply(orderedMessages);

            const aiMessage = new Message({
              room: roomId,
              sender: socket.userId,
              senderName: 'AI Assistant',
              content: aiText,
              isAI: true,
            });
            await aiMessage.save();
            io.to(roomId).emit('newMessage', aiMessage);
          } finally {
            io.to(roomId).emit('aiThinking', false);
          }
        }
      } catch (error) {
        console.error('Message error:', error);
        socket.emit('errorMessage', 'Failed to send message');
      }
    });

    socket.on('editMessage', async ({ messageId, content, roomId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== socket.userId) return;
        message.content = content;
        message.edited = true;
        await message.save();
        io.to(roomId).emit('messageUpdated', message);
      } catch (error) {
        console.error('Edit error:', error);
      }
    });

    socket.on('deleteMessage', async ({ messageId, roomId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== socket.userId) return;
        await Message.findByIdAndDelete(messageId);
        io.to(roomId).emit('messageDeleted', { messageId });
      } catch (error) {
        console.error('Delete error:', error);
      }
    });

    socket.on('typing', ({ roomId, username }) => {
      socket.to(roomId).emit('userTyping', username);
    });

    socket.on('stopTyping', ({ roomId }) => {
      socket.to(roomId).emit('userStoppedTyping');
    });

    socket.on('toggleReaction', async ({ roomId, messageId, emoji, username }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIndex = message.reactions.findIndex(
          (r) => r.username === username && r.emoji === emoji
        );

        if (existingIndex > -1) {
          message.reactions.splice(existingIndex, 1);
        } else {
          message.reactions.push({ emoji, username });
        }

        await message.save();
        io.to(roomId).emit('reactionUpdated', { messageId, reactions: message.reactions });
      } catch (error) {
        console.error('Reaction error:', error);
      }
    });

    socket.on('disconnect', () => {
      if (socket.currentRoom && roomUsers[socket.currentRoom]) {
        delete roomUsers[socket.currentRoom][socket.id];
        broadcastOnlineUsers(socket.currentRoom);
      }
    });
  });

  return io;
};

module.exports = initSocket;