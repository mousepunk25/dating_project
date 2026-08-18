const express = require('express');
const router = express.Router();
const { getUserConversations, getSingleConversation } = require('../controllers/conversations');
const { sendMessage } = require('../controllers/messages');
const { isLoggedIn } = require('../middleware');

router.get('/conversations', isLoggedIn, getUserConversations);

router.get('/conversations/:conversationId', isLoggedIn, getSingleConversation);

router.post('/conversations/:conversationId/messages', isLoggedIn, sendMessage);

module.exports = router;