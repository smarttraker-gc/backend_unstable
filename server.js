const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const surveyRoutes = require('./routes/survey');
const cors = require('cors');



const app = express();
app.use(bodyParser.json()); // JSON 파싱 미들웨어
app.use(cors()); // 웹테스트를 위한 라이브러리 사용
app.use(bodyParser.urlencoded({ extended: true }));

// 기본 루트에서 로그인 경로로 리다이렉트
app.get('/', (req, res) => {
  res.redirect('/api/auth/login');
});

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// 라우트 설정
app.use('/api/auth', authRoutes);        // Auth 라우트
app.use('/api/survey', surveyRoutes);    // Survey 라우트

// 서버 실행
app.listen(60032, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:60032`);
});