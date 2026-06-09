const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getRoadmap, toggleTask } = require('../controllers/roadmapController');

router.get('/', verifyToken, getRoadmap);
router.patch('/toggle', verifyToken, toggleTask);

module.exports = router;
