const express = require('express');
const router = express.Router();
const { getUserConversations, getSingleConversation } = require('../controllers/conversations');
const { sendMessage } = require('../controllers/messages');
const { isLoggedIn } = require('../middleware');

router.get('/', isLoggedIn, getUserConversations);

router.get('/:conversationId', isLoggedIn, getSingleConversation);

router.post('/:conversationId/messages', isLoggedIn, sendMessage);

module.exports = router;