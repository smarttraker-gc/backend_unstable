const mysql = require('mysql2');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('db24332', 'dbid233', 'dbpass233', {
    host: 'localhost', // 또는 학과 서버의 IP 주소
    dialect: 'mysql', // MariaDB는 MySQL과 호환
    port: 3306,       // MySQL 기본 포트
    logging: false,   // SQL 쿼리 로깅 비활성화
  });
  sequelize
    .authenticate()
    .then(() => console.log('Database connected successfully.'))
    .catch(err => console.error('Database connection error:', err));




module.exports = sequelize;
