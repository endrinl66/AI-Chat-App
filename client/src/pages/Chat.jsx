import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { connectSocket, getSocket, disconnectSocket } from '../utils/socket';
import './Chat.css';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Chat() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editRoomValue, setEditRoomValue] = useState('');
  const [notification, setNotification] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [aiThinking, setAiThinking] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editMsgValue, setEditMsgValue] = useState('');
  const [seenMap, setSeenMap] = useState({});
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const notifTimeoutRef = useRef(null);
  const activeRoomRef = useRef(null);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    const socket = connectSocket();

    socket.on('newMessage', (message) => {
      const currentRoom = activeRoomRef.current;
      if (currentRoom && message.room === currentRoom._id) {
        setMessages((prev) => [...prev, message]);
        socket.emit('markSeen', { roomId: currentRoom._id, messageId: message._id, username: user.username });
      } else {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.room]: (prev[message.room] || 0) + 1,
        }));
      }
    });

    socket.on('messageUpdated', (updated) => {
      setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    });

    socket.on('messageDeleted', ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    socket.on('reactionUpdated', ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    });

    socket.on('onlineUsers', (users) => setOnlineUsers(users));
    socket.on('userTyping', (username) => setTypingUser(username));
    socket.on('userStoppedTyping', () => setTypingUser(''));
    socket.on('aiThinking', (val) => setAiThinking(val));

    socket.on('seenUpdate', ({ username, messageId }) => {
      setSeenMap((prev) => ({ ...prev, [username]: messageId }));
    });
    socket.on('seenUpdateAll', (map) => setSeenMap(map));

    socket.on('mentionNotification', (data) => {
      setNotification(data);
      clearTimeout(notifTimeoutRef.current);
      notifTimeoutRef.current = setTimeout(() => setNotification(null), 6000);
    });

    fetchRooms();
    return () => disconnectSocket();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (activeRoom && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const socket = getSocket();
      socket.emit('markSeen', { roomId: activeRoom._id, messageId: lastMsg._id, username: user.username });
    }
  }, [messages]);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      await api.post('/rooms', { name: newRoomName });
      setNewRoomName('');
      fetchRooms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create room');
    }
  };

  const startEditRoom = (room, e) => {
    e.stopPropagation();
    setEditingRoomId(room._id);
    setEditRoomValue(room.name);
  };

  const saveRoomName = async (roomId) => {
    if (!editRoomValue.trim()) {
      setEditingRoomId(null);
      return;
    }
    try {
      const res = await api.put(`/rooms/${roomId}`, { name: editRoomValue.trim() });
      setRooms((prev) => prev.map((r) => (r._id === roomId ? res.data : r)));
      if (activeRoom?._id === roomId) setActiveRoom(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to rename room');
    } finally {
      setEditingRoomId(null);
    }
  };

  const joinRoom = async (room) => {
    setActiveRoom(room);
    setSuggestions([]);
    setSummary('');
    setReplyingTo(null);
    setAiThinking(false);
    setLoadingMessages(true);
    setUnreadCounts((prev) => ({ ...prev, [room._id]: 0 }));
    const socket = getSocket();
    socket.emit('joinRoom', room._id, user.username);
    try {
      const res = await api.get(`/rooms/${room._id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchSuggestions = async () => {
    if (!activeRoom) return;
    try {
      const res = await api.get(`/rooms/${activeRoom._id}/suggestions`);
      setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error('Failed to fetch suggestions', err);
    }
  };

  const fetchSummary = async () => {
    if (!activeRoom) return;
    setSummarizing(true);
    setSummary('');
    try {
      const res = await api.get(`/rooms/${activeRoom._id}/summary`);
      setSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to summarize', err);
      setSummary('Could not generate a summary right now.');
    } finally {
      setSummarizing(false);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom) return;
    const socket = getSocket();
    socket.emit('sendMessage', {
      roomId: activeRoom._id,
      roomName: activeRoom.name,
      content: input,
      senderName: user.username,
      replyTo: replyingTo
        ? { senderName: replyingTo.senderName, content: replyingTo.content }
        : null,
    });
    socket.emit('stopTyping', { roomId: activeRoom._id });
    setInput('');
    setSuggestions([]);
    setReplyingTo(null);
  };

  const startReply = (msg) => {
    setReplyingTo(msg);
    setInput(`@${msg.senderName} `);
  };

  const startEditMsg = (msg) => {
    setEditingMsgId(msg._id);
    setEditMsgValue(msg.content);
  };

  const saveEditMsg = (msg) => {
    if (!editMsgValue.trim()) return;
    const socket = getSocket();
    socket.emit('editMessage', { messageId: msg._id, content: editMsgValue.trim(), roomId: activeRoom._id });
    setEditingMsgId(null);
  };

  const deleteMsg = (msg) => {
    if (!window.confirm('Delete this message?')) return;
    const socket = getSocket();
    socket.emit('deleteMessage', { messageId: msg._id, roomId: activeRoom._id });
  };

  const toggleLike = (messageId) => {
    const socket = getSocket();
    socket.emit('toggleReaction', {
      roomId: activeRoom._id,
      messageId,
      emoji: '❤️',
      username: user.username,
    });
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!activeRoom) return;
    socket.emit('typing', { roomId: activeRoom._id, username: user.username });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { roomId: activeRoom._id });
    }, 1500);
  };

  const useSuggestion = (text) => {
    setInput(text);
    setSuggestions([]);
  };

  const goToMentionedRoom = () => {
    if (!notification) return;
    const room = rooms.find((r) => r._id === notification.roomId);
    if (room) joinRoom(room);
    setNotification(null);
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const otherOnlineCount = onlineUsers.filter((u) => u !== user.username).length;
  const lastMessage = messages[messages.length - 1];
  const seenByOthers = lastMessage
    ? Object.entries(seenMap).filter(
        ([username, msgId]) => username !== user.username && msgId === lastMessage._id
      ).map(([username]) => username)
    : [];

  return (
    <div className="chat-page">
      {notification && (
        <div className="mention-toast" onClick={goToMentionedRoom}>
          <div className="mention-toast-title">
            <strong>{notification.from}</strong> mentioned you in <strong>#{notification.roomName}</strong>
          </div>
          <div className="mention-toast-body">{notification.content}</div>
        </div>
      )}

      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <span className="sidebar-username">{user?.username}</span>
          </div>
          <div className="sidebar-header-actions">
            <button className="theme-toggle" onClick={() => setDarkMode((d) => !d)}>
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button className="logout-btn" onClick={logout}>Log out</button>
          </div>
        </div>
        <div className="room-section">
          <h4>Rooms</h4>
          <input
            className="new-room-input"
            placeholder="New room name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
          />
          <button className="create-room-btn" onClick={createRoom}>Create room</button>
          {loadingRooms ? (
            <p className="muted-note">Loading rooms…</p>
          ) : rooms.length === 0 ? (
            <p className="muted-note">No rooms yet — create the first one.</p>
          ) : (
            <ul className="room-list">
              {rooms.map((room) => {
                const unread = unreadCounts[room._id] || 0;
                return (
                  <li
                    key={room._id}
                    onClick={() => joinRoom(room)}
                    className={`room-item ${activeRoom?._id === room._id ? 'active' : ''}`}
                  >
                    {editingRoomId === room._id ? (
                      <input
                        className="room-edit-input"
                        value={editRoomValue}
                        onChange={(e) => setEditRoomValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => saveRoomName(room._id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRoomName(room._id)}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span className="room-name-text"># {room.name}</span>
                        <span className="room-item-right">
                          {unread > 0 && <span className="unread-badge">{unread > 9 ? '9+' : unread}</span>}
                          <span className="room-edit-icon" onClick={(e) => startEditRoom(room, e)}>✏️</span>
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="chat-main">
        {activeRoom ? (
          <>
            <div className="chat-header">
              <h3># {activeRoom.name}</h3>
              <div className="online-indicator">
                <span className="online-dot"></span>
                {otherOnlineCount > 0
                  ? `${otherOnlineCount} other${otherOnlineCount > 1 ? 's' : ''} online`
                  : 'Only you here'}
              </div>
            </div>

            <button className="summary-btn" onClick={fetchSummary} disabled={summarizing}>
              {summarizing ? 'Summarizing…' : '📝 Catch me up'}
            </button>
            {summary && (
              <div className="summary-box">
                <strong>Summary:</strong> {summary}
              </div>
            )}

            <div className="messages-area">
              {loadingMessages ? (
                <p className="muted-note center">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="muted-note center">No messages yet. Say hello.</p>
              ) : (
                messages.map((msg, i) => {
                  const isOwn = msg.senderName === user.username && !msg.isAI;
                  const rowClass = msg.isAI ? 'ai' : isOwn ? 'own' : 'other';
                  const likeCount = msg.reactions?.filter((r) => r.emoji === '❤️').length || 0;
                  const likedByMe = msg.reactions?.some((r) => r.emoji === '❤️' && r.username === user.username);
                  const isEditing = editingMsgId === msg._id;
                  return (
                    <div key={msg._id || i} className={`message-row ${rowClass}`}>
                      <span className={`message-sender ${msg.isAI ? 'ai-sender' : ''}`}>
                        {msg.isAI && <span className="ai-dot"></span>}
                        {msg.senderName}
                      </span>
                      <div className="message-block">
                        {msg.replyTo && (
                          <div className="reply-preview">
                            <strong>{msg.replyTo.senderName}</strong> {msg.replyTo.content}
                          </div>
                        )}
                        {isEditing ? (
                          <div className="edit-box">
                            <input
                              value={editMsgValue}
                              onChange={(e) => setEditMsgValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditMsg(msg)}
                              autoFocus
                            />
                            <button onClick={() => saveEditMsg(msg)}>Save</button>
                            <button onClick={() => setEditingMsgId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="message-bubble">
                            {msg.content}
                            {msg.edited && <span className="edited-tag"> (edited)</span>}
                          </div>
                        )}
                        <div className="message-actions">
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                          {!msg.isAI && (
                            <button className="action-icon" onClick={() => startReply(msg)}>↩ Reply</button>
                          )}
                          <button
                            className={`action-icon ${likedByMe ? 'liked' : ''}`}
                            onClick={() => toggleLike(msg._id)}
                          >
                            ❤ {likeCount > 0 && likeCount}
                          </button>
                          {isOwn && (
                            <>
                              <button className="action-icon" onClick={() => startEditMsg(msg)}>Edit</button>
                              <button className="action-icon" onClick={() => deleteMsg(msg)}>Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {aiThinking && (
                <div className="message-row ai">
                  <span className="message-sender ai-sender">
                    <span className="ai-dot"></span>AI Assistant
                  </span>
                  <div className="message-bubble thinking-bubble">
                    <span className="think-dot"></span>
                    <span className="think-dot"></span>
                    <span className="think-dot"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {seenByOthers.length > 0 && (
              <div className="seen-indicator">Seen by {seenByOthers.join(', ')}</div>
            )}

            {typingUser && typingUser !== user.username && (
              <div className="typing-indicator">{typingUser} is typing…</div>
            )}

            <div className="suggestions-bar">
              <button className="suggest-btn" onClick={fetchSuggestions}>💡 Suggest replies</button>
              {suggestions.length > 0 && (
                <div className="suggestion-pills">
                  {suggestions.map((s, i) => (
                    <button key={i} className="suggestion-pill" onClick={() => useSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {replyingTo && (
              <div className="replying-bar">
                Replying to <strong>{replyingTo.senderName}</strong>: {replyingTo.content.slice(0, 60)}
                <button className="cancel-reply" onClick={() => { setReplyingTo(null); setInput(''); }}>✕</button>
              </div>
            )}
            <form className="message-form" onSubmit={sendMessage}>
              <input
                className="message-input"
                value={input}
                onChange={handleInputChange}
                placeholder="Type a message..."
              />
              <button type="submit" className="send-btn">Send</button>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="60" fill="#EEEDFE"/>
              <path d="M40 45C40 41.6863 42.6863 39 46 39H74C77.3137 39 80 41.6863 80 45V65C80 68.3137 77.3137 71 74 71H54L44 81V71H46C42.6863 71 40 68.3137 40 65V45Z" fill="#5B5FEF"/>
              <circle cx="52" cy="55" r="3" fill="white"/>
              <circle cx="60" cy="55" r="3" fill="white"/>
              <circle cx="68" cy="55" r="3" fill="white"/>
              <circle cx="90" cy="35" r="14" fill="#FF7A59"/>
              <path d="M84 35L88 39L96 31" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>Nothing open yet</h3>
            <p>Pick a room from the sidebar, or create a new one to start chatting — try mentioning <strong>@ai</strong> once you're in.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;0