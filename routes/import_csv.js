const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sequelize = require('../config/db'); // Sequelize 연결 설정

async function importWalkingTrails() {
    const filePath = path.join(__dirname, '..','dataset','dataset', 'item.csv');

    const trails = [];

    // CSV 읽기
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            trails.push({
                trail_id: row['산책로 ID'],
                trail_category: row['걷기코스 구분명'] || null,
                trail_name: row['걷기코스 이름'] || null,
                description: row['코스 설명'] || null,
                district_name: row['행정구역명'] || null,
                difficulty: row['코스 난이도'] || null,
                length_classification: row['코스 길이 분류'] || null,
                detailed_length: isNaN(parseFloat(row['코스 세부길이'])) ? null : parseFloat(row['코스 세부길이']),
                landscape_category: row['코스 경관 카테고리'] || null,
                estimated_time: row['소요시간'] || null,
                address: row['주소'] || null,
                latitude: isNaN(parseFloat(row['위도'])) ? null : parseFloat(row['위도']),
                longitude: isNaN(parseFloat(row['경도'])) ? null : parseFloat(row['경도']),
                length_range: row['길이_범주'] || null,
                difficulty_score: isNaN(parseInt(row['난이도_수치화'])) ? null : parseInt(row['난이도_수치화']),
                landscape_category_encoded: isNaN(parseInt(row['코스 경관 카테고리_encoded'])) ? null : parseInt(row['코스 경관 카테고리_encoded']),
                difficulty_encoded: isNaN(parseInt(row['코스 난이도_encoded'])) ? null : parseInt(row['코스 난이도_encoded']),
            });
        })
        .on('end', async () => {
            console.log('CSV 파일 읽기 완료, 데이터 삽입 중...');
            try {
                // 데이터 삽입
                await sequelize.query('DELETE FROM WalkingTrails'); // 기존 데이터 삭제 (선택)
                for (const trail of trails) {
                    await sequelize.query(`
                        INSERT INTO WalkingTrails (
                            trail_id ,trail_category, trail_name, description, district_name, difficulty,
                            length_classification, detailed_length, landscape_category, estimated_time,
                            address, latitude, longitude, length_range, difficulty_score,
                            landscape_category_encoded, difficulty_encoded
                        )
                        VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        {
                            replacements: Object.values(trail),
                        }
                    );
                }
                console.log('데이터 삽입 완료');
            } catch (error) {
                console.error('데이터 삽입 중 오류 발생:', error);
            }
        });
}

importWalkingTrails();