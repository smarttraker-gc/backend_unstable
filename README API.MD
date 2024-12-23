# 회원가입 및 로그인 API
POST 회원가입 
http://210.102.178.98:60032/api/auth/signup
{
  "name": "testuser",
  "email": "test@example.com",
  "password": "1234"
}

POST 로그인 
http://210.102.178.98:60032/api/auth/login

{
  "email": "test@example.com",
  "password": "1234"
}

# 설문조사 및 정보수정
POST 설문조사 
http://210.102.178.98:60032/api/survey/submit

{
  "survey": {
    "gender": "남",
    "height": 180,
    "weight": 75,
    "location": "서울 송파구", 
    "preferred_spot": "호수", -> ('강','계곡','둘레길','마을길','산책로','숲길','역사 관련','연못','예술 관련','인근 공원','정원','폭포','하천','호수') 중 1
    "difficulty": 2,
    "distance": "10",
  }
}

POST 설문 업데이트 항목 선택적으로 가능(복수선택 가능)
http://210.102.178.98:60032/api/survey/update-survey
{
  "gender" : "남",
  "height": 185,
  "weight": 80,
  "location": "서울 송파구",
  "preferred_spot": "호수",
  "difficulty": "1",  -> 중요 난이도는 1,2,3 으로 입력
  "distance": "10",
}


# 위도경도 UserSurvets 테이블에 입력 및 저장
POST 위도 경도 프론트 GPS에서 받아 UserSurveys 테이블에 업데이트
http://210.102.178.98:60032/api/survey/update-location
{
  "latitude": 37.500185529011226,
  "longitude": 127.09550442721958
}

# 추천 및 선택과 경로안내
추천 POST
http://210.102.178.98:60032/api/survey/recommend
body : none

POST 추천된 산책로 중 1 선택 하여 산책로 이름 and 산책로 id UserSurveys 테이블에 저장
http://210.102.178.98:60032/api/survey/select-route
{
  "selected_trail_id": "<출력된 산책로 id>"
}

경로안내 POST
http://210.102.178.98:60032/api/survey//guide-route

# 관리자용 기능
회원 목록 조회(GET)

URL: http://210.102.178.98:60032/api/auth/users
Method: GET
Header:
Authorization: Bearer <토큰>

회원 삭제(DELETE)

URL: http://210.102.178.98:60032/api/auth/users/:id
Method: DELETE
Header:
Authorization: Bearer <토큰>
Example:
http://210.102.178.98:60032/api/auth/users/1

이메일 중복확인(POST)

http://210.102.178.98:60032/api/auth/check-email

{
  "email": "test@example.com"
}

모든 설문 조회: GET 
http://210.102.178.98:60032/api/survey/all-surveys



# 추천 api 코드 
router.post('/recommend', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    // SQL 데이터 가져오기
    const [surveyData] = await sequelize.query(`
      SELECT gender, height, weight, location, preferred_spot, difficulty, latitude, longitude, distance
      FROM UserSurveys WHERE user_id = ?`,
      { replacements: [user_id] }
    );

    if (!surveyData || surveyData.length === 0) {
      return res.status(404).json({ message: 'No survey data found for this user.' });
    }

    const survey = surveyData[0];

    // JSON 데이터 생성
    const jsonData = {
      성별: survey.gender === 'Male' ? '남' : survey.gender === 'Female' ? '여' : survey.gender,
      키: survey.height,
      몸무게: survey.weight,
      거주지역: survey.location.replace('서울 ', ''), // '서울 ' 제거
      "선호하는 장소": survey.preferred_spot,
      "트래킹 난이도": survey.difficulty === 'Easy' ? '쉬움' : survey.difficulty === 'Medium' ? '보통' : survey.difficulty === 'Hard' ? '어려움' : survey.difficulty,
      거리: survey.distance,
      위도: survey.latitude,
      경도: survey.longitude,
    };
    console.log("DB에서 가져온 Latitude:", survey.latitude);
    console.log("DB에서 가져온 Longitude:", survey.longitude);
    console.log('Generated JSON Data:', jsonData);

    // CSV 파일 경로
    const newUserCsvPath = path.join(__dirname, '..', 'dataset', 'dataset', 'new_user.csv');

    // CSV 생성
    const columns = ['성별', '키', '몸무게', '거주지역', '선호하는 장소', '트래킹 난이도', '거리', '위도', '경도',]; // 헤더 정의 총 길이
    stringify([jsonData], { header: true, columns }, (err, output) => {
      if (err) {
        console.error('CSV 생성 오류:', err);
        return res.status(500).json({ message: 'CSV 생성 중 오류 발생', error: err });
      }

      fs.writeFile(newUserCsvPath, output, (writeErr) => {
        if (writeErr) {
          console.error('CSV 파일 저장 오류:', writeErr);
          return res.status(500).json({ message: 'CSV 파일 저장 중 오류 발생', error: writeErr });
        }

        console.log('CSV 파일 생성 성공:', newUserCsvPath);

        // CSV 파일을 JSON으로 읽어들이기
        fs.readFile(newUserCsvPath, 'utf8', (readErr, csvData) => {
          if (readErr) {
            console.error('CSV 파일 읽기 오류:', readErr);
            return res.status(500).json({ message: 'CSV 파일 읽기 중 오류 발생', error: readErr });
          }

          // CSV 데이터를 JSON으로 변환
          parse(csvData, { columns: true, skip_empty_lines: true }, (parseErr, parsedJson) => {
            if (parseErr) {
              console.error('CSV 파싱 오류:', parseErr);
              return res.status(500).json({ message: 'CSV 파싱 중 오류 발생', error: parseErr });
            }

            console.log('CSV 데이터 파싱 성공:', parsedJson);

            // AI 모델 실행
            exec(
              `python3 evaluate.py --data '${JSON.stringify(parsedJson[0])}'`,
              { cwd: '/home/t24332/svr/back/SmartTracker/dataset/' },
              (error, stdout, stderr) => {
                if (error) {
                  console.error('AI 모델 오류:', error);
                  console.error('Python stderr:', stderr);
                  return res.status(500).json({ message: 'AI 모델 실행 중 오류 발생', error });
                }
                console.log(stdout);
                res.status(200).json({ recommendation: stdout.trim() });
              }
            );
          });
        });
      });
    });
  } catch (error) {
    console.error('추천 생성 중 오류 발생:', error);
    res.status(500).json({ message: '추천 생성 중 오류 발생', error });
  }
});

# 경로안내 API
router.post('/guide-route', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    // 1. 사용자 인증 및 ID 추출
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    // 2. 출발지 위도/경도 가져오기 (UserSurveys 테이블)
    const [userLocation] = await sequelize.query(`
      SELECT latitude, longitude
      FROM UserSurveys
      WHERE user_id = ?;`, { replacements: [user_id] }
    );

    if (!userLocation || userLocation.length === 0) {
      return res.status(404).json({ message: 'User location not found.' });
    }
    const { latitude: startLat, longitude: startLng } = userLocation[0];

    // 3. 도착지 위도/경도 가져오기 (선택된 산책로)
    const [selectedTrail] = await sequelize.query(`
      SELECT wt.latitude, wt.longitude
      FROM UserSurveys us
      JOIN WalkingTrails wt ON us.selected_trail_id = wt.trail_id
      WHERE us.user_id = ?;`, { replacements: [user_id] }
    );

    if (!selectedTrail || selectedTrail.length === 0) {
      return res.status(404).json({ message: 'Destination trail not found.' });
    }
    const { latitude: endLat, longitude: endLng } = selectedTrail[0];

    // 4. 카카오 경로 탐색 API 호출
    const kakaoApiKey = '카카오 REST ful API 키';
    const response = await axios.get(`https://apis-navi.kakaomobility.com/v1/directions`, {
      params: {
        origin: `${startLng},${startLat}`, // 출발지 (경도, 위도)
        destination: `${endLng},${endLat}`, // 도착지 (경도, 위도)
        priority: 'RECOMMEND', // 추천 경로
      },
      headers: { Authorization: `KakaoAK ${kakaoApiKey}` }
    });

    // 5. 결과 반환
    res.status(200).json({
      message: 'Route retrieved successfully.',
      start: { latitude: startLat, longitude: startLng },
      destination: { latitude: endLat, longitude: endLng },
      route: response.data, // 카카오 경로 탐색 결과
    });
  } catch (error) {
    console.error('Route retrieval error:', error);
    res.status(500).json({ message: 'Error retrieving route.', error });
  }
});