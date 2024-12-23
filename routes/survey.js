const express = require('express');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/db'); // Sequelize 가져오기
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const fs = require('fs');
const router = express.Router();
const exec = require('child_process').exec;
const path = require('path');
const axios = require('axios');
require('dotenv').config();


router.get('/all-surveys', async (req, res) => {
  try {
    // UserSurveys 테이블의 모든 데이터를 조회
    const [results] = await sequelize.query(`SELECT * FROM UserSurveys`);

    // 결과 반환
    res.status(200).json({
      message: 'Surveys retrieved successfully.',
      data: results,
    });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({
      message: 'Error fetching surveys.',
      error,
    });
  }
});


// 설문 항목 업데이트 API
router.post('/update-survey', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    const {
      gender, height, weight, location, preferred_spot, difficulty, distance,
    } = req.body;

    // Gender 및 Difficulty 변환
    const genderMapping = {
      '남': 'Male',
      '여': 'Female',
    };

    const difficultyMapping = {
      1: 'Easy',
      2: 'Medium',
      3: 'Hard',
    };

    // 유효성 검사
    const allowedDistances = ['1', '5', '10', '15', '20'];
    const allowedLocations = [
      '서울 강남구', '서울 강동구', '서울 강북구', '서울 강서구', '서울 관악구', '서울 광진구',
      '서울 구로구', '서울 금천구', '서울 노원구', '서울 도봉구', '서울 동대문구', '서울 동작구',
      '서울 마포구', '서울 서대문구', '서울 서초구', '서울 성동구', '서울 성북구', '서울 송파구',
      '서울 양천구', '서울 영등포구', '서울 용산구', '서울 은평구', '서울 종로구', '서울 중구', '서울 중랑구',
    ];
    const allowedSpots = [
      '강', '계곡', '둘레길', '마을길', '산책로',
      '숲길', '역사 관련', '연못', '예술 관련',
      '인근 공원', '정원', '폭포', '하천', '호수',
    ];

    // 거리 유효성 검사
    if (distance && !allowedDistances.includes(String(distance))) {
      return res.status(400).json({ message: 'Invalid distance value.' });
    }

    // 위치 유효성 검사
    if (location && !allowedLocations.includes(location)) {
      return res.status(400).json({ message: 'Invalid location value.' });
    }

    // 선호 장소 유효성 검사
    if (preferred_spot && !allowedSpots.includes(preferred_spot)) {
      return res.status(400).json({ message: 'Invalid preferred spot value.' });
    }

    // 난이도 유효성 검사
    if (difficulty && !Object.keys(difficultyMapping).includes(String(difficulty))) {
      return res.status(400).json({ message: 'Invalid difficulty value.' });
    }

    // 성별 유효성 검사
    if (gender && !Object.keys(genderMapping).includes(gender)) {
      return res.status(400).json({ message: 'Invalid gender value.' });
    }

    // 산책로 총 길이 유효성 검사
    //if (total_trail_length && (isNaN(total_trail_length) || total_trail_length <= 0)) {
      //return res.status(400).json({ message: 'Invalid total trail length. It must be a positive number.' });
    //}

    // 업데이트할 값 생성
    const updates = [];
    const replacements = [];
    if (gender) {
      updates.push('gender = ?');
      replacements.push(genderMapping[gender]);
    }
    if (height) {
      updates.push('height = ?');
      replacements.push(height);
    }
    if (weight) {
      updates.push('weight = ?');
      replacements.push(weight);
    }
    if (location) {
      updates.push('location = ?');
      replacements.push(location);
    }
    if (preferred_spot) {
      updates.push('preferred_spot = ?');
      replacements.push(preferred_spot);
    }
    if (difficulty) {
      updates.push('difficulty = ?');
      replacements.push(difficultyMapping[difficulty]);
    }
    if (distance) {
      updates.push('distance = ?');
      replacements.push(distance);
    }
    //if (total_trail_length) {
      //updates.push('total_trail_length = ?');
      //replacements.push(total_trail_length);
    //}

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // SQL 업데이트 실행
    replacements.push(user_id);
    const query = `
      UPDATE UserSurveys
      SET ${updates.join(', ')}
      WHERE user_id = ?;
    `;

    await sequelize.query(query, { replacements });

    res.status(200).json({ message: 'Survey updated successfully.' });
  } catch (error) {
    console.error('Error updating survey:', error);
    res.status(500).json({ message: 'Error updating survey.', error });
  }
});


//설문 제출
router.post('/submit', async (req, res) => {
  console.log('Incoming request:', req.method, req.url);
  console.log('Request Body:', req.body);

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded);

    const user_id = decoded.user_id;
    const { survey } = req.body;

    console.log('Survey Data:', survey);
   // Distance 값 유효성 검사
    const allowedDistances = ['1', '5', '10', '15', '20'];
    if (!allowedDistances.includes(String(survey.distance))) {
      return res.status(400).json({ message: 'Invalid distance value.' });
    };

    // 가능한 구 이름 목록
    const allowedLocations = [
      '서울 강남구', '서울 강동구', '서울 강북구', '서울 강서구', '서울 관악구', '서울 광진구',
      '서울 구로구', '서울 금천구', '서울 노원구', '서울 도봉구', '서울 동대문구', '서울 동작구',
      '서울 마포구', '서울 서대문구', '서울 서초구', '서울 성동구', '서울 성북구', '서울 송파구',
      '서울 양천구', '서울 영등포구', '서울 용산구', '서울 은평구', '서울 종로구', '서울 중구', '서울 중랑구'
    ];
    // Location 유효성 검사
    if (!allowedLocations.includes(survey.location)) {
      return res.status(400).json({ message: 'Invalid location value.' });
    }
    

    const allowedSpots = [
      '강', '계곡', '둘레길', '마을길', '산책로', 
      '숲길', '역사 관련', '연못', '예술 관련', 
      '인근 공원', '정원', '폭포', '하천', '호수'
    ];
    if (!allowedSpots.includes(survey.preferred_spot)) {
      return res.status(400).json({ message: 'Invalid preferred spot value.' });
    };

    // Gender 및 Difficulty 변환
    const genderMapping = {
      '남': 'Male',
      '여': 'Female',
    };

    const difficultyMapping = {
      1: 'Easy',
      2: 'Medium',
      3: 'Hard',
    };

    const gender = genderMapping[survey.gender] || null;
    const difficulty = difficultyMapping[survey.difficulty] || null;
    console.log('Mapped Gender:', gender);
    console.log('Mapped Difficulty:', difficulty);
    //console.log('Total Trail Length:', total_trail_length);

    const replacements = [
      user_id,
      gender,
      survey.height,
      survey.weight,
      survey.location,
      survey.preferred_spot,
      difficulty,
      survey.distance || null,
    ];

    console.log('SQL Replacements:', replacements);

    // SQL 데이터 저장
     // SQL 데이터 저장: INSERT OR UPDATE
     await sequelize.query(
      `INSERT INTO UserSurveys (
            user_id, gender, height, weight, location, preferred_spot, difficulty, distance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            gender = VALUES(gender),
            height = VALUES(height),
            weight = VALUES(weight),
            location = VALUES(location),
            preferred_spot = VALUES(preferred_spot),
            difficulty = VALUES(difficulty),
            distance = VALUES(distance)`,
      {
        replacements: [
          user_id,
          gender,
          survey.height,
          survey.weight,
          survey.location,
          survey.preferred_spot,
          difficulty,
          survey.distance,
        ],
      }
    );

    res.status(200).json({ message: 'Survey submitted successfully.' });
  } catch (error) {
    console.error('Error saving survey data:', error);
    res.status(500).json({ message: 'Error saving survey data.', error });
  }
});

//설문선택시 산책가능한 산책로 반환
router.get('/routes', async (req, res) => {
  console.log('Request reached /survey/routes endpoint');
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
      return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user_id = decoded.user_id;

      // 사용자 설문 정보 가져오기
    const [userSurvey] = await sequelize.query(`
      SELECT location, distance
      FROM UserSurveys
      WHERE user_id = ?;`, 
      { replacements: [user_id] });

      if (!userSurvey || userSurvey.length === 0) {
        return res.status(404).json({ message: 'No survey data found for this user.' });
      }
  
      const { location, distance } = userSurvey[0];
  
      // `distance` 값을 숫자로 변환
      const maxDistance = parseInt(distance, 10);
  
      // 산책로 필터링 쿼리 실행
      const [routes] = await sequelize.query(`
        SELECT 
            wt.trail_id,
            wt.trail_name,
            wt.description,
            wt.district_name,
            wt.difficulty,
            wt.detailed_length,
            wt.landscape_category,
            wt.estimated_time
        FROM 
            WalkingTrails wt
        WHERE 
            wt.district_name LIKE CONCAT('%', REPLACE(?, '서울 ', ''), '%')
            AND wt.detailed_length <= ?
      `, { replacements: [location, maxDistance] });
  
      if (!routes || routes.length === 0) {
        return res.status(404).json({ message: 'No walking trails found for this user.' });
      }
  
      res.status(200).json({ message: 'Available walking trails retrieved successfully.', data: routes });
    } catch (error) {
      console.error('Error fetching walking trails:', error);
      res.status(500).json({ message: 'Error fetching walking trails.', error });
    }
  });



//반환한 산책로 선택 후 사용자의 설문 테이블에 저장
router.post('/select-route', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    const { selected_trail_id } = req.body; // 사용자가 선택한 산책로 ID

    if (!selected_trail_id) {
      return res.status(400).json({ message: 'Selected trail ID is required.' });
    }

    // 선택한 산책로 정보 가져오기
    const [trail] = await sequelize.query(`
      SELECT * FROM WalkingTrails WHERE trail_id = ?;
    `, { replacements: [selected_trail_id] });

    if (!trail || trail.length === 0) {
      return res.status(404).json({ message: 'Selected walking trail not found.' });
    }

    const selectedTrail = trail[0]; // 선택된 산책로 정보
    console.log('Selected Trail:', selectedTrail);

    // UserSurveys 테이블 업데이트 (interested_route 및 selected_trail_id 업데이트)
    await sequelize.query(`
      UPDATE UserSurveys
      SET interested_route = ?, selected_trail_id = ?
      WHERE user_id = ?;
    `, { replacements: [selectedTrail.trail_name, selectedTrail.trail_id, user_id] });

    res.status(200).json({
      message: 'Selected walking trail saved successfully.',
      data: selectedTrail,
    });
  } catch (error) {
    console.error('Error saving selected walking trail:', error);
    res.status(500).json({ message: 'Error saving selected walking trail.', error });
  }
});


// GPS를 이용해 위도와 경도를 저장하는 API
router.post('/update-location', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    const { latitude, longitude } = req.body;

    // 입력 값 검증
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and Longitude are required.' });
    }

    // 위도 및 경도 업데이트
    await sequelize.query(`
      UPDATE UserSurveys
      SET latitude = ?, longitude = ?
      WHERE user_id = ?;
    `, { replacements: [latitude, longitude, user_id] });

    res.status(200).json({ message: 'Location updated successfully.' });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ message: 'Error updating location.', error });
  }
});

//추천 api
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


// 경로 안내 API (GET 요청) 사용 X 더미데이터
router.get('/route-guide', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    // UserSurveys에서 선택한 경로 ID 가져오기
    const [userSurvey] = await sequelize.query(`
      SELECT selected_trail_id, latitude, longitude 
      FROM UserSurveys WHERE user_id = ?;
    `, { replacements: [user_id] });

    if (!userSurvey || userSurvey.length === 0) {
      return res.status(404).json({ message: 'User survey data not found.' });
    }

    const { selected_trail_id, latitude: user_latitude, longitude: user_longitude } = userSurvey[0];

    if (!selected_trail_id || !user_latitude || !user_longitude) {
      return res.status(400).json({ message: 'User location or selected trail ID is missing.' });
    }

    // 선택한 산책로 정보 가져오기
    const [trail] = await sequelize.query(`
      SELECT * FROM WalkingTrails WHERE trail_id = ?;
    `, { replacements: [selected_trail_id] });

    if (!trail || trail.length === 0) {
      return res.status(404).json({ message: 'Selected walking trail not found.' });
    }

    const selectedTrail = trail[0];
    console.log('Selected Trail:', selectedTrail);

    // Kakao Map Link API로 사용자 위치에서 산책로 시작점까지 경로 생성
    const kakaoMapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(selectedTrail.trail_name)},${selectedTrail.latitude},${selectedTrail.longitude}`;
    console.log('Kakao Map URL:', kakaoMapUrl);

    res.status(200).json({
      message: 'Route guide generated successfully.',
      trail: selectedTrail,
      kakao_map_url: kakaoMapUrl
    });
  } catch (error) {
    console.error('Error generating route guide:', error);
    res.status(500).json({ message: 'Error generating route guide.', error });
  }
});

//경로안내 POST 
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
    const kakaoApiKey = 'e171de783420e9199d7edc58d475ffd2';
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

//GET 설문 유무 확인
router.get('/check-survey', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  try {
    // 사용자 인증 및 ID 추출
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    // UserSurveys 테이블에서 해당 사용자의 데이터가 존재하는지 확인
    const [surveyData] = await sequelize.query(`
      SELECT 1
      FROM UserSurveys
      WHERE user_id = ?;
    `, { replacements: [user_id] });

    // 설문조사 데이터가 있는지 여부를 확인하여 반환
    if (surveyData && surveyData.length > 0) {
      res.status(200).json({ hasSurvey: true, message: 'User has completed the survey.' });
    } else {
      res.status(200).json({ hasSurvey: false, message: 'User has not completed the survey.' });
    }
  } catch (error) {
    console.error('Error checking survey status:', error);
    res.status(500).json({ message: 'Error checking survey status.', error });
  }
});

module.exports = router;
