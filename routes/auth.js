const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

const router = express.Router();

// 회원가입 라우트
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const newUser = await User.create({
      name,
      email,
      password_hash: hashedPassword,
    });

    res.status(201).json({ message: 'User registered successfully', user_id: newUser.user_id });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Error registering user: ' + error.message });
    }
  }
});
// 로그인 페이지에 메시지 반환
router.get('/login', (req, res) => {
  res.send('Welcome to the login page. Please POST to this endpoint to log in.');
});

// 모든 회원 조회
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['user_id', 'name', 'email'], // 필요한 필드만 반환
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

// 로그인 라우트
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    //디버깅용 콘솔로그
    console.log('Incoming request: POST /login');
    console.log('Request Body:', req.body);
    // 사용자 확인
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    //디버깅용
    console.log('User found:', user);
    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password Match:', isMatch);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['user_id', 'name', 'email'], // 필요한 필드만 반환
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

    // JWT 토큰 생성
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 성공
    res.status(200).json({ message: 'Login successful', userId: user.user_id, token });
  }catch (error) {
    console.error('Error during login:', error); // 에러 로그 출력
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// 회원 삭제
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await User.destroy({
      where: { user_id: id },
    });
    if (deleted) {
      res.status(200).json({ message: 'User deleted successfully.' });
    } else {
      res.status(404).json({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error });
  }
});

// 이메일 중복 확인
router.post('/check-email', async (req, res) => {
  const { email } = req.body; // JSON Body에서 email 추출

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ where: { email } }); // email로만 검색

    if (user) {
      return res.status(200).json({ exists: true, message: 'Email is already taken.' });
    } else {
      return res.status(200).json({ exists: false, message: 'Email is available.' });
    }
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: 'Error checking email.', error });
  }
});


module.exports = router;