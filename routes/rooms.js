const express = require('express');
const Room = require('../models/Room');
const Message = require('../models/Message');
const protect = require('../middleware/auth');
const { getGroqSuggestions, getGroqSummary } = require('../services/aiService');

const router = express.Router();

// Get all rooms
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a room
router.post('/', protect, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ message: 'Room already exists' });
    }

    const room = new Room({ name, description, createdBy: req.userId });
    await room.save();

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Rename a room
router.put('/:roomId', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the room creator can rename it' });
    }

    room.name = name.trim();
    await room.save();
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Failed to rename room', error: error.message });
  }
});

// Get messages for a room
router.get('/:roomId/messages', protect, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get AI reply suggestions
router.get('/:roomId/suggestions', protect, async (req, res) => {
  try {
    const recentMessages = await Message.find({ room: req.params.roomId })
      .sort({ createdAt: -1 })
      .limit(6);

    if (recentMessages.length === 0) {
      return res.json({ suggestions: [] });
    }

    const orderedMessages = recentMessages.reverse();
    const conversationText = orderedMessages
      .map((m) => `${m.senderName}: ${m.content}`)
      .join('\n');

    const suggestions = await getGroqSuggestions(conversationText);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get suggestions', error: error.message });
  }
});

// Get conversation summary
router.get('/:roomId/summary', protect, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId })
      .sort({ createdAt: -1 })
      .limit(30);

    if (messages.length === 0) {
      return res.json({ summary: 'No messages yet in this room.' });
    }

    const ordered = messages.reverse();
    const conversationText = ordered
      .map((m) => `${m.senderName}: ${m.content}`)
      .join('\n');

    const summary = await getGroqSummary(conversationText);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to summarize', error: error.message });
  }
});

module.exports = router;