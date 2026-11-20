'use strict';

const service = require('../services/ai.service');
const chatService = require('../services/ai-chat.service');
const { ok } = require('../utils/pagination');

async function insights(req, res) {
  return ok(res, await service.insights(req.validated.query));
}

async function status(_req, res) {
  return ok(res, chatService.status());
}

async function chat(req, res) {
  return ok(res, await chatService.answer(req.validated.body));
}

module.exports = { insights, status, chat };
