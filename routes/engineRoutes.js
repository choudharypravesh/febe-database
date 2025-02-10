//importing modules
const express = require('express')
const engineController = require('../controllers/engineController')
const { publish, publishCallback } = engineController

const router = express.Router()

router.post('/publish', publish)
router.post('/publishCallback', publishCallback)

module.exports = router