//importing modules
const express = require('express')
const engineController = require('../controllers/engineController')
const { publish } = engineController

const router = express.Router()

router.post('/publish', publish)

module.exports = router