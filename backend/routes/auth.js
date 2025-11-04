const express = require('express');
const { register, login } = require('../controllers/userController');
const { uploadPhoto } = require('../config/multer');
const router = express.Router();

router.post('/register', uploadPhoto.single('photo'), register);
router.post('/login', login);

module.exports = router;