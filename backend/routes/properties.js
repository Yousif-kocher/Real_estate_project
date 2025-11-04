const express = require('express');
const { createProperty, getProperties, getRecentProperties,deleteProperty } = require('../controllers/propertyController');
const { uploadVideo } = require('../config/multer');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', authenticateToken, uploadVideo.single('video'), createProperty);
router.get('/', getProperties);
router.get('/recent', getRecentProperties);
router.delete('/:id', authenticateToken, deleteProperty); 

module.exports = router;